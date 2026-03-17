const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Managers ---
const lobbyManager = require('./lobbyManager');
const gameManager = require('./gameManager');
const storageManager = require('./storageManager');

// Wire managers into gameManager
gameManager.lobbyManager = lobbyManager;
gameManager.storageManager = storageManager;

// --- Challenge expiry interval (every 5 seconds) ---
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

io.on('connection', (socket) => {
  console.log(`[Connect] ${socket.id}`);

  // --- register ---
  socket.on('register', (data) => {
    const username = (typeof data === 'string') ? data : data.username;
    const success = lobbyManager.addPlayer(socket.id, username);
    if (!success) {
      socket.emit('registerError', { success: false, message: 'Username taken' });
      return;
    }

    // Ensure player entry exists in storageManager
    storageManager.getPlayer(username);

    // Send registered confirmation (client listens for this)
    const playerList = lobbyManager.getPlayerList();
    const leaderboard = storageManager.getLeaderboard();
    socket.emit('registered', { success: true, playerList: playerList, leaderboard: leaderboard });

    // Broadcast updated player list to all
    io.emit('playerListUpdate', playerList);

    // Send active games to this socket
    socket.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- disconnect ---
  socket.on('disconnect', (reason) => {
    console.log(`[Disconnect] ${socket.id} - ${reason}`);

    // Handle game disconnect (other player wins, etc.)
    gameManager.handleDisconnect(socket.id, io);

    // Remove from lobby (also cleans up pending challenges)
    lobbyManager.removePlayer(socket.id);

    // Broadcast updates
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- getPlayerList ---
  socket.on('getPlayerList', (ack) => {
    if (typeof ack === 'function') ack(lobbyManager.getPlayerList());
  });

  // --- getActiveGames ---
  socket.on('getActiveGames', (ack) => {
    if (typeof ack === 'function') ack(gameManager.getActiveGamesList());
  });

  // --- getLeaderboard ---
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
  socket.on('challenge', (data) => {
    const challengeId = lobbyManager.createChallenge(socket.id, data.targetSocketId);
    if (!challengeId) {
      socket.emit('error', { message: 'Unable to create challenge. Target may be unavailable.' });
      return;
    }

    const challenge = lobbyManager.getChallenge(challengeId);
    const targetSock = io.sockets.sockets.get(data.targetSocketId);
    if (targetSock) {
      targetSock.emit('challenged', { challengeId, from: challenge.fromUsername });
    }
  });

  // --- acceptChallenge ---
  socket.on('acceptChallenge', (data) => {
    const challenge = lobbyManager.acceptChallenge(data.challengeId);
    if (!challenge) return;

    const player1Info = lobbyManager.getPlayer(challenge.from);
    const player2Info = lobbyManager.getPlayer(challenge.to);
    if (!player1Info || !player2Info) return;

    // Set both players to in-game status
    lobbyManager.setStatus(challenge.from, 'in-game');
    lobbyManager.setStatus(challenge.to, 'in-game');

    // Create the game
    const gameId = gameManager.createGame(player1Info, player2Info, io);

    // Notify player 1 (challenger)
    const sock1 = io.sockets.sockets.get(challenge.from);
    if (sock1) {
      sock1.emit('gameStart', { gameId, opponent: player2Info.username, playerNumber: 1 });
    }

    // Notify player 2 (acceptor)
    const sock2 = io.sockets.sockets.get(challenge.to);
    if (sock2) {
      sock2.emit('gameStart', { gameId, opponent: player1Info.username, playerNumber: 2 });
    }

    // Broadcast updates
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- declineChallenge ---
  socket.on('declineChallenge', (data) => {
    const challenge = lobbyManager.declineChallenge(data.challengeId);
    if (!challenge) return;

    const challengerSock = io.sockets.sockets.get(challenge.from);
    if (challengerSock) {
      challengerSock.emit('challengeDeclined', { by: challenge.toUsername });
    }
  });

  // --- playerInput ---
  socket.on('playerInput', (data) => {
    const engine = gameManager.getGameByPlayer(socket.id);
    if (engine) {
      engine.handleInput(socket.id, data);
    }
  });

  // --- playerReady ---
  socket.on('playerReady', () => {
    const engine = gameManager.getGameByPlayer(socket.id);
    if (engine) {
      engine.playerReady(socket.id);
    }
  });

  // --- spectateGame ---
  socket.on('spectateGame', (data) => {
    gameManager.addSpectator(data.gameId, socket.id);
    lobbyManager.setStatus(socket.id, 'spectating');
    socket.join(data.gameId);
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
  });

  // --- leaveGame ---
  socket.on('leaveGame', () => {
    const player = lobbyManager.getPlayer(socket.id);
    if (!player) return;

    if (player.status === 'spectating') {
      // Find which game this socket is spectating and remove
      for (const game of gameManager.getActiveGamesList()) {
        gameManager.removeSpectator(game.id, socket.id);
        socket.leave(game.id);
      }
      lobbyManager.setStatus(socket.id, 'idle');
    } else if (player.status === 'in-game') {
      // Forfeit: the other player wins
      const engine = gameManager.getGameByPlayer(socket.id);
      if (engine) {
        if (engine.player1.socketId === socket.id) {
          engine.winner = 2;
        } else {
          engine.winner = 1;
        }
        engine.phase = 'gameOver';

        const matchRecord = gameManager.endGame(engine.id, 'forfeit');

        // Notify the other player
        const otherSocketId = engine.player1.socketId === socket.id
          ? engine.player2.socketId
          : engine.player1.socketId;
        const otherSock = io.sockets.sockets.get(otherSocketId);
        if (otherSock) {
          otherSock.emit('opponentForfeited', matchRecord);
        }

        // Set both players back to idle
        lobbyManager.setStatus(socket.id, 'idle');
        lobbyManager.setStatus(otherSocketId, 'idle');
      }
    }

    // Broadcast updates
    io.emit('playerListUpdate', lobbyManager.getPlayerList());
    io.emit('activeGamesUpdate', gameManager.getActiveGamesList());
  });

  // --- paddleColor ---
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

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
