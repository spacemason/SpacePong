// ============================================================
// server.js - The Main Brain of Our Game Server
// ============================================================
// This is where everything starts! When you run the game, THIS
// file is the one that runs first. It does three big jobs:
//
// 1. It creates a WEB SERVER using "Express" -- think of Express
//    like a waiter at a restaurant. When someone opens the game
//    in their browser, Express delivers the webpage to them.
//
// 2. It sets up "Socket.IO" -- this is like a walkie-talkie
//    system. Normally, a browser loads a page and that's it.
//    But with Socket.IO, the browser and server can keep talking
//    back and forth in REAL TIME. That's how players can see
//    each other's paddles move instantly!
//
// 3. It listens for EVENTS from players (like "I want to join",
//    "I challenge you", "I pressed the up key") and tells the
//    right manager (lobby, game, or storage) to handle them.
// ============================================================

// "require" is how we load tools (called "libraries") that other people wrote.
// Express helps us serve web pages. http lets us create a server.
// Socket.IO gives us real-time two-way communication.
// path helps us work with file and folder locations.
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Create the Express app, then wrap it in an HTTP server,
// then attach Socket.IO to that server so it can handle real-time messages.
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // CORS stands for "Cross-Origin Resource Sharing".
  // origin: '*' means we allow connections from any website address.
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// This is the port number -- like a door number on a building.
// Browsers will connect to this door to reach our server.
// If someone sets a PORT in the environment, use that; otherwise use 3000.
const PORT = process.env.PORT || 3000;

// Serve static files from public/
// This tells Express: "When a browser asks for a file (like index.html
// or a .js file), look in the 'public' folder and send it to them."
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Managers ---
// These are helper modules that each handle one part of the game:
// lobbyManager  = keeps track of who's online and challenge invitations
// gameManager   = runs the actual pong games
// storageManager = saves scores and match history to files
const lobbyManager = require('./lobbyManager');
const gameManager = require('./gameManager');
const storageManager = require('./storageManager');

// Wire managers into gameManager so it can use them.
// The game manager needs to know about the lobby (to update player status)
// and storage (to save match results when a game ends).
gameManager.lobbyManager = lobbyManager;
gameManager.storageManager = storageManager;

// --- Challenge expiry interval (every 5 seconds) ---
// Every 5 seconds, we check if any challenges have been sitting around
// too long without being accepted. If so, we tell both players it expired.
// This is like a timer -- if you don't answer an invitation in time, it goes away.
setInterval(() => {
  const expired = lobbyManager.expireChallenges();
  for (const challenge of expired) {
    // Notify the challenger that the challenge expired
    const fromSock = io.sockets.sockets.get(challenge.from);
    if (fromSock) {
      fromSock.emit('challengeExpired', { challengeId: challenge.id, to: challenge.toUsername });
    }
    // Notify the target that the challenge expired
    const toSock = io.sockets.sockets.get(challenge.to);
    if (toSock) {
      toSock.emit('challengeExpired', { challengeId: challenge.id, from: challenge.fromUsername });
    }
  }
}, 5000);

// --- Socket.IO Connection Handler ---
// This runs every time a new player connects to the server.
// "socket" represents that one player's connection -- like their personal phone line.
io.on('connection', (socket) => {
  console.log(`[Connect] ${socket.id}`);

  // --- register ---
  // When a player picks a username and clicks "Join", this event fires.
  // We add them to the lobby, make sure they exist in our saved data,
  // then send them the list of players and the leaderboard.
  socket.on('register', (data) => {
    const username = (typeof data === 'string') ? data : data.username;
    const success = lobbyManager.addPlayer(socket.id, username);
    if (!success) {
      socket.emit('registerError', { success: false, message: 'Username taken' });
      return;
    }

    // Ensure player entry exists in storageManager
    // (If this is a brand new player, this creates their stats record.)
    storageManager.getPlayer(username);

    // Send registered confirmation (client listens for this)
    const playerList = lobbyManager.getPlayerList();
    const leaderboard = storageManager.getLeaderboard();
    socket.emit('registered', { success: true, playerList: playerList, leaderboard: leaderboard });

    // Broadcast updated player list to ALL connected players
    // so everyone sees the new player appear in the lobby.
    io.emit('playerListUpdate', playerList);

    // Send active games to this socket so they can see games to spectate.
    socket.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- disconnect ---
  // When a player closes their browser or loses internet, this fires.
  // We clean up their game (if they were in one) and remove them from the lobby.
  socket.on('disconnect', (reason) => {
    console.log(`[Disconnect] ${socket.id} - ${reason}`);

    // Handle game disconnect (other player wins, etc.)
    gameManager.handleDisconnect(socket.id, io);

    // Remove from lobby (also cleans up pending challenges)
    lobbyManager.removePlayer(socket.id);

    // Broadcast updates so everyone's screen is up to date.
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- getPlayerList ---
  // A player is asking "who is online right now?"
  // "ack" is a callback -- it sends the answer directly back to whoever asked.
  socket.on('getPlayerList', (ack) => {
    if (typeof ack === 'function') ack(lobbyManager.getPlayerList());
  });

  // --- getActiveGames ---
  // A player is asking "what games are happening right now?"
  socket.on('getActiveGames', (ack) => {
    if (typeof ack === 'function') ack(gameManager.getActiveGamesList());
  });

  // --- getLeaderboard ---
  // A player wants to see the leaderboard (who has the most wins).
  // They can choose to sort by total wins or by win rate (percentage).
  socket.on('getLeaderboard', (data, ack) => {
    // Handle case where data is the ack (no data argument)
    if (typeof data === 'function') {
      data(storageManager.getLeaderboard('wins'));
      return;
    }
    if (typeof ack === 'function') {
      ack(storageManager.getLeaderboard(data.sortBy || 'wins'));
    }
  });

  // --- getMatchHistory ---
  // A player wants to see past game results.
  // They can ask for all matches or just matches for a specific player.
  socket.on('getMatchHistory', (data, ack) => {
    if (typeof data === 'function') {
      data(storageManager.getMatches(50));
      return;
    }
    if (typeof ack === 'function') {
      if (data.playerName) {
        ack(storageManager.getMatchesForPlayer(data.playerName, data.limit));
      } else {
        ack(storageManager.getMatches(data.limit || 50));
      }
    }
  });

  // --- challenge ---
  // Player A says "I want to play against Player B!"
  // We create a challenge and send it to Player B so they can accept or decline.
  socket.on('challenge', (data) => {
    const challengeId = lobbyManager.createChallenge(socket.id, data.targetSocketId);
    if (!challengeId) {
      socket.emit('error', { message: 'Unable to create challenge. Target may be unavailable.' });
      return;
    }

    // Send the challenge invitation to the other player.
    const challenge = lobbyManager.getChallenge(challengeId);
    const targetSock = io.sockets.sockets.get(data.targetSocketId);
    if (targetSock) {
      targetSock.emit('challenged', { challengeId, from: challenge.fromUsername });
    }
  });

  // --- acceptChallenge ---
  // Player B says "Yes, I'll play!" -- so we start the game!
  // We set both players to "in-game" status, create the game engine,
  // and tell both players the game is starting.
  socket.on('acceptChallenge', (data) => {
    const challenge = lobbyManager.acceptChallenge(data.challengeId);
    if (!challenge) return;

    const player1Info = lobbyManager.getPlayer(challenge.from);
    const player2Info = lobbyManager.getPlayer(challenge.to);
    if (!player1Info || !player2Info) return;

    // Set both players to in-game status so nobody else can challenge them.
    lobbyManager.setStatus(challenge.from, 'in-game');
    lobbyManager.setStatus(challenge.to, 'in-game');

    // Create the game (this starts the game engine ticking!)
    const gameId = gameManager.createGame(player1Info, player2Info, io);

    // Notify player 1 (the one who sent the challenge)
    const sock1 = io.sockets.sockets.get(challenge.from);
    if (sock1) {
      sock1.emit('gameStart', { gameId, opponent: player2Info.username, playerNumber: 1 });
    }

    // Notify player 2 (the one who accepted the challenge)
    const sock2 = io.sockets.sockets.get(challenge.to);
    if (sock2) {
      sock2.emit('gameStart', { gameId, opponent: player1Info.username, playerNumber: 2 });
    }

    // Broadcast updates so everyone sees these players are now in a game.
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- declineChallenge ---
  // Player B says "No thanks!" -- we delete the challenge and tell Player A.
  socket.on('declineChallenge', (data) => {
    const challenge = lobbyManager.declineChallenge(data.challengeId);
    if (!challenge) return;

    const challengerSock = io.sockets.sockets.get(challenge.from);
    if (challengerSock) {
      challengerSock.emit('challengeDeclined', { by: challenge.toUsername });
    }
  });

  // --- playerInput ---
  // A player pressed or released a key (up, down, or slow).
  // We find their game and pass the input to the game engine.
  socket.on('playerInput', (data) => {
    const engine = gameManager.getGameByPlayer(socket.id);
    if (engine) {
      engine.handleInput(socket.id, data);
    }
  });

  // --- playerReady ---
  // A player clicks "Ready" before a round starts.
  // Once BOTH players are ready, the countdown begins.
  socket.on('playerReady', () => {
    const engine = gameManager.getGameByPlayer(socket.id);
    if (engine) {
      engine.playerReady(socket.id);
    }
  });

  // --- spectateGame ---
  // A player wants to watch someone else's game (like sitting in the audience).
  socket.on('spectateGame', (data) => {
    gameManager.addSpectator(data.gameId, socket.id);
    lobbyManager.setStatus(socket.id, 'spectating');
    socket.join(data.gameId);
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
  });

  // --- leaveGame ---
  // A player wants to leave -- either stop spectating or forfeit their game.
  socket.on('leaveGame', () => {
    const player = lobbyManager.getPlayer(socket.id);
    if (!player) return;

    if (player.status === 'spectating') {
      // They were just watching, so remove them from the audience.
      for (const game of gameManager.getActiveGamesList()) {
        gameManager.removeSpectator(game.id, socket.id);
        socket.leave(game.id);
      }
      lobbyManager.setStatus(socket.id, 'idle');
    } else if (player.status === 'in-game') {
      // They were actually playing! Leaving means they forfeit (give up),
      // and the other player automatically wins.
      const engine = gameManager.getGameByPlayer(socket.id);
      if (engine) {
        if (engine.player1.socketId === socket.id) {
          engine.winner = 2;
        } else {
          engine.winner = 1;
        }
        engine.phase = 'gameOver';

        const matchRecord = gameManager.endGame(engine.id, 'forfeit');

        // Tell the other player that their opponent gave up.
        const otherSocketId = engine.player1.socketId === socket.id
          ? engine.player2.socketId
          : engine.player1.socketId;
        const otherSock = io.sockets.sockets.get(otherSocketId);
        if (otherSock) {
          otherSock.emit('opponentForfeited', matchRecord);
        }

        // Set both players back to idle so they can play again.
        lobbyManager.setStatus(socket.id, 'idle');
        lobbyManager.setStatus(otherSocketId, 'idle');
      }
    }

    // Broadcast updates
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- paddleColor ---
  // A player chose a custom color for their paddle.
  socket.on('paddleColor', (data) => {
    const engine = gameManager.getGameByPlayer(socket.id);
    if (engine) {
      if (engine.player1.socketId === socket.id) {
        engine.player1.color = data.color;
      } else if (engine.player2.socketId === socket.id) {
        engine.player2.color = data.color;
      }
    }
  });
});

// Start listening! This is like opening the restaurant doors.
// Now players can connect by going to http://localhost:3000 in their browser.
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
