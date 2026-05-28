// ============================================================
// gameManager.js - The Game Room Manager
// ============================================================
// Imagine an arcade with many Pong tables. This file is like
// the person who manages ALL the tables at once. It can:
//
// - Set up a new table when two players want to play (createGame)
// - Clean up a table when a game ends (endGame)
// - Find which table a player is at (getGameByPlayer)
// - Let people watch a game (addSpectator / removeSpectator)
// - Handle what happens when someone disconnects mid-game
//
// HOW MULTIPLE GAMES RUN AT THE SAME TIME:
// Each game gets its own GameEngine (from gameEngine.js) and two
// timers: one that runs the physics 60 times per second ("tick"),
// and one that sends the game picture to players 20 times per
// second ("broadcast"). All games are stored in a Map (like a
// dictionary) where the key is the game's unique ID. This way,
// 10 games can be running at the same time without getting mixed up!
// ============================================================

// crypto gives us random unique IDs for each game.
const crypto = require('crypto');
const GameEngine = require('./gameEngine');

// These get filled in by server.js after this file loads.
// We need them to update player statuses and save match results.
let lobbyManager = null;
let storageManager = null;

try { lobbyManager = require('./lobbyManager'); } catch (e) { /* optional */ }
try { storageManager = require('./storageManager'); } catch (e) { /* optional */ }

// This Map holds ALL active games. Think of it as a list of game rooms.
// Each entry has: the game engine, and two timers (tick + broadcast).
const activeGames = new Map(); // gameId -> { engine, tickInterval, broadcastInterval }

// Creates a brand new game between two players.
// Sets up the engine, starts the physics loop, and starts
// sending game updates to both players' screens.
function createGame(player1Info, player2Info, io) {
    // Generate a unique ID so we can tell games apart.
    const gameId = crypto.randomUUID();
    const engine = new GameEngine(player1Info, player2Info, gameId);
    engine.start();

    // Tick at 60Hz (~16.67ms between each tick).
    // This is the "physics loop" -- it moves the ball, checks collisions, etc.
    // After each tick, if anything happened (like a sound effect),
    // we send those events to both players and any spectators.
    const tickInterval = setInterval(() => {
        const result = engine.tick();
        // Emit events to both players
        if (result.events && result.events.length > 0) {
            const sockets = [engine.player1.socketId, engine.player2.socketId, ...engine.spectators];
            for (const sid of sockets) {
                const sock = io.sockets.sockets.get(sid);
                if (sock) {
                    for (const evt of result.events) {
                        if (evt.type === 'sound') {
                            sock.emit('soundTrigger', { sound: evt.sound });
                        } else if (evt.type === 'explosion') {
                            sock.emit('soundTrigger', { sound: 'explosion', x: evt.x, y: evt.y });
                        }
                    }
                }
            }
        }

        // Auto-end game when gameOver phase is reached.
        // The _gameOverHandled flag prevents this from running twice.
        if (engine.phase === 'gameOver' && !engine._gameOverHandled) {
            engine._gameOverHandled = true;
            endGame(gameId, 'completed');
        }
    }, 1000 / 60);

    // Broadcast state at 20Hz (every 50ms).
    // This is separate from the tick because we don't need to send
    // the full game picture as often as we compute physics.
    // 20 times per second is plenty for smooth-looking movement.
    const broadcastInterval = setInterval(() => {
        const state = engine.getState();
        const sockets = [engine.player1.socketId, engine.player2.socketId, ...engine.spectators];
        for (const sid of sockets) {
            const sock = io.sockets.sockets.get(sid);
            if (sock) {
                sock.emit('gameState', state);
            }
        }
    }, 50);

    // Store everything in our active games Map.
    activeGames.set(gameId, { engine, tickInterval, broadcastInterval });
    return gameId;
}

// Ends a game: stops the timers, records the result, and tells everyone.
function endGame(gameId, reason) {
    const entry = activeGames.get(gameId);
    if (!entry) return null;

    const { engine, tickInterval, broadcastInterval } = entry;

    // Stop both timers so the game stops running.
    clearInterval(tickInterval);
    clearInterval(broadcastInterval);

    // Create a record of the match (like a scorecard) to save.
    const matchRecord = {
        gameId: engine.id,
        player1: { socketId: engine.player1.socketId, username: engine.player1.username },
        player2: { socketId: engine.player2.socketId, username: engine.player2.username },
        scores: engine.scores,
        winner: engine.winner,
        reason: reason,
        duration: Date.now() - engine.createdAt,
        endedAt: Date.now(),
    };

    // Save the match result and update each player's win/loss stats.
    if (storageManager) {
        if (typeof storageManager.recordMatch === 'function') {
            storageManager.recordMatch(matchRecord);
        }
        if (typeof storageManager.updatePlayerStats === 'function') {
            storageManager.updatePlayerStats(engine.player1.username, {
                won: engine.winner === 1,
                score: engine.scores[0],
                opponentScore: engine.scores[1],
            });
            storageManager.updatePlayerStats(engine.player2.username, {
                won: engine.winner === 2,
                score: engine.scores[1],
                opponentScore: engine.scores[0],
            });
        }
    }

    // Notify both players and spectators that the game ended.
    const gameEndData = {
        winner: engine.winner,
        scores: engine.scores,
        reason: reason,
        p1Username: engine.player1.username,
        p2Username: engine.player2.username,
    };
    const allSockets = [engine.player1.socketId, engine.player2.socketId, ...engine.spectators];
    for (const sid of allSockets) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) {
            sock.emit('gameEnd', gameEndData);
        }
    }

    // Clean up: destroy the engine and remove it from our Map.
    engine.destroy();
    activeGames.delete(gameId);

    return matchRecord;
}

// Look up a game by its unique ID.
function getGame(gameId) {
    const entry = activeGames.get(gameId);
    return entry ? entry.engine : null;
}

// Find which game a player is in by checking every active game.
// This is like looking at every table in the arcade to find someone.
function getGameByPlayer(socketId) {
    for (const [, entry] of activeGames) {
        const engine = entry.engine;
        if (engine.player1.socketId === socketId || engine.player2.socketId === socketId) {
            return engine;
        }
    }
    return null;
}

// Add a spectator (watcher) to a game.
function addSpectator(gameId, socketId) {
    const entry = activeGames.get(gameId);
    if (entry && !entry.engine.spectators.includes(socketId)) {
        entry.engine.spectators.push(socketId);
    }
}

// Remove a spectator from a game.
function removeSpectator(gameId, socketId) {
    const entry = activeGames.get(gameId);
    if (entry) {
        const idx = entry.engine.spectators.indexOf(socketId);
        if (idx !== -1) entry.engine.spectators.splice(idx, 1);
    }
}

// Returns a simple list of all active games (for the lobby screen).
function getActiveGamesList() {
    const list = [];
    for (const [id, entry] of activeGames) {
        const engine = entry.engine;
        list.push({
            id: id,
            player1: engine.player1.username,
            player2: engine.player2.username,
            scores: engine.scores,
        });
    }
    return list;
}

// When a player disconnects mid-game, the other player wins automatically.
// We end the game and let the remaining player know what happened.
function handleDisconnect(socketId, io) {
    const engine = getGameByPlayer(socketId);
    if (!engine) return null;

    // The other player wins
    if (engine.player1.socketId === socketId) {
        engine.winner = 2;
    } else {
        engine.winner = 1;
    }
    engine.phase = 'gameOver';

    const matchRecord = endGame(engine.id, 'disconnect');

    // Notify the remaining player that their opponent left.
    const remainingSocketId = engine.player1.socketId === socketId
        ? engine.player2.socketId
        : engine.player1.socketId;
    if (io) {
        const sock = io.sockets.sockets.get(remainingSocketId);
        if (sock) {
            sock.emit('opponentDisconnected', matchRecord);
        }
    }

    return matchRecord;
}

module.exports = {
    createGame,
    endGame,
    getGame,
    getGameByPlayer,
    addSpectator,
    removeSpectator,
    getActiveGamesList,
    handleDisconnect,
};
