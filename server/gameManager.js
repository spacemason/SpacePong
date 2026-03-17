const crypto = require('crypto');
const GameEngine = require('./gameEngine');

let lobbyManager = null;
let storageManager = null;

try { lobbyManager = require('./lobbyManager'); } catch (e) { /* optional */ }
try { storageManager = require('./storageManager'); } catch (e) { /* optional */ }

const activeGames = new Map(); // gameId -> { engine, tickInterval, broadcastInterval }

function createGame(player1Info, player2Info, io) {
    const gameId = crypto.randomUUID();
    const engine = new GameEngine(player1Info, player2Info, gameId);
    engine.start();

    // Tick at 60Hz (~16.67ms)
    const tickInterval = setInterval(() => {
        const result = engine.tick();
        // Emit events to both players
        if (result.events && result.events.length > 0) {
            const sockets = [engine.player1.socketId, engine.player2.socketId, ...engine.spectators];
            for (const sid of sockets) {
                const sock = io.sockets.sockets.get(sid);
                if (sock) {
                    for (const evt of result.events) {
                        sock.emit('gameEvent', evt);
                    }
                }
            }
        }

        // Auto-end game when gameOver phase is reached
        if (engine.phase === 'gameOver' && !engine._gameOverHandled) {
            engine._gameOverHandled = true;
            endGame(gameId, 'completed');
        }
    }, 1000 / 60);

    // Broadcast state at 20Hz (50ms)
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

    activeGames.set(gameId, { engine, tickInterval, broadcastInterval });
    return gameId;
}

function endGame(gameId, reason) {
    const entry = activeGames.get(gameId);
    if (!entry) return null;

    const { engine, tickInterval, broadcastInterval } = entry;

    clearInterval(tickInterval);
    clearInterval(broadcastInterval);

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

    // Record match via storageManager if available
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

    engine.destroy();
    activeGames.delete(gameId);

    return matchRecord;
}

function getGame(gameId) {
    const entry = activeGames.get(gameId);
    return entry ? entry.engine : null;
}

function getGameByPlayer(socketId) {
    for (const [, entry] of activeGames) {
        const engine = entry.engine;
        if (engine.player1.socketId === socketId || engine.player2.socketId === socketId) {
            return engine;
        }
    }
    return null;
}

function addSpectator(gameId, socketId) {
    const entry = activeGames.get(gameId);
    if (entry && !entry.engine.spectators.includes(socketId)) {
        entry.engine.spectators.push(socketId);
    }
}

function removeSpectator(gameId, socketId) {
    const entry = activeGames.get(gameId);
    if (entry) {
        const idx = entry.engine.spectators.indexOf(socketId);
        if (idx !== -1) entry.engine.spectators.splice(idx, 1);
    }
}

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

    // Notify the remaining player
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
