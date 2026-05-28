// ============================================================
// network.js - The Walkie-Talkie File!
// ============================================================
// This file is like a WALKIE-TALKIE that lets your browser
// talk to the server. Just like two kids with walkie-talkies,
// your browser can send messages AND listen for messages back!
//
// When you play online, your computer needs to talk to a
// "server" - a special computer that runs the game for everyone.
//
// HOW IT WORKS (think of it like pen pals!):
// - Your browser is like YOU writing letters
// - The server is like your PEN PAL in another city
// - Socket.IO is like a SUPER FAST mail service that delivers
//   messages back and forth almost instantly
//
// Instead of waiting for a letter to arrive (like email),
// Socket.IO keeps an open connection - like a phone call where
// both sides can talk whenever they want!
//
// "emit" = send a message TO the server (like mailing a letter)
// "on" = listen for a message FROM the server (like checking your mailbox)
//
// This file handles ALL the communication:
// - Connecting and telling the server your username
// - Sending challenges to other players
// - Sending your paddle movements during the game
// - Receiving the game state (where everything is) from the server
//
// WHAT IS A PROMISE?
// A promise is like ordering food at a restaurant -- you ask for
// it now, but you get it later. When you call connect() or
// getPlayerList(), they return a promise. That means: "I don't
// have the answer yet, but I PROMISE I'll give it to you when
// it arrives!" You use .then() to say what to do when the food
// (data) arrives, and .catch() if something goes wrong.
// ============================================================

var Network = (function () {

    // --- Private state (only this file can see these) ---
    var socket = null;          // Our connection to the server
    var connected = false;      // Are we connected right now?
    var username = null;        // Our player name
    var playerNumber = null;    // Are we Player 1 or Player 2?
    var currentGameId = null;   // Which game room are we in?

    // --- CALLBACKS: The Event System ---
    // Callbacks are like signing up for notifications. Other parts of the
    // code say: "Hey Network, when you get a message about X, tell ME!"
    // Think of them like "when the doorbell rings, do THIS."
    // Each slot below holds one function (or null if nobody signed up).
    var callbacks = {
        onPlayerListUpdate: null,
        onActiveGamesUpdate: null,
        onChallenged: null,
        onChallengeAccepted: null,
        onChallengeDeclined: null,
        onChallengeExpired: null,
        onGameStart: null,
        onGameState: null,
        onSoundTrigger: null,
        onGameEnd: null,
        onOpponentDisconnected: null,
        onError: null
    };

    // --- Setting up our "mailbox" ---
    // This function tells Socket.IO what to do when different
    // types of messages arrive from the server. Each "socket.on"
    // is like saying "when you get a letter labeled X, do Y"
    function setupListeners() {
        // When the server sends an updated list of online players
        socket.on('playerListUpdate', function (players) {
            if (callbacks.onPlayerListUpdate) {
                callbacks.onPlayerListUpdate(players);
            }
        });

        // When the server sends a list of games being played right now
        socket.on('activeGamesUpdate', function (games) {
            if (callbacks.onActiveGamesUpdate) {
                callbacks.onActiveGamesUpdate(games);
            }
        });

        // When someone challenges US to a game!
        socket.on('challenged', function (data) {
            if (callbacks.onChallenged) {
                callbacks.onChallenged(data);
            }
        });

        // When someone we challenged says "yes, let's play!"
        socket.on('challengeAccepted', function (data) {
            if (callbacks.onChallengeAccepted) {
                callbacks.onChallengeAccepted(data);
            }
        });

        // When someone we challenged says "no thanks"
        socket.on('challengeDeclined', function (data) {
            if (callbacks.onChallengeDeclined) {
                callbacks.onChallengeDeclined(data);
            }
        });

        // When a challenge we sent waited too long with no answer
        socket.on('challengeExpired', function (data) {
            if (callbacks.onChallengeExpired) {
                callbacks.onChallengeExpired(data);
            }
        });

        // When the server says "the game is starting!" and tells
        // us which game room we're in and if we're Player 1 or 2
        socket.on('gameStart', function (data) {
            currentGameId = data.gameId;
            playerNumber = data.playerNumber;
            if (callbacks.onGameStart) {
                callbacks.onGameStart(data);
            }
        });

        // This one comes VERY often during a game (about 20 times/second)!
        // It tells us where all the paddles and the ball are right now.
        socket.on('gameState', function (state) {
            if (callbacks.onGameState) {
                callbacks.onGameState(state);
            }
        });

        // When the server says to play a sound effect
        // (the server tells BOTH players when to play sounds so they're in sync)
        socket.on('soundTrigger', function (data) {
            if (callbacks.onSoundTrigger) {
                callbacks.onSoundTrigger(data);
            }
        });

        // When the game is over and the server tells us who won
        socket.on('gameEnd', function (data) {
            currentGameId = null;
            playerNumber = null;
            if (callbacks.onGameEnd) {
                callbacks.onGameEnd(data);
            }
        });

        // When the other player disconnects (closes their browser, etc.)
        socket.on('opponentDisconnected', function (data) {
            if (callbacks.onOpponentDisconnected) {
                callbacks.onOpponentDisconnected(data);
            }
        });

        // When something goes wrong
        socket.on('error', function (data) {
            if (callbacks.onError) {
                callbacks.onError(data);
            }
        });

        // When WE get disconnected from the server
        socket.on('disconnect', function () {
            connected = false;
        });
    }

    // --- CONNECT ---
    // This is how we first "call" the server and introduce ourselves.
    // It returns a "Promise" -- remember, a promise is like ordering
    // food: you ask now and get the answer later!
    //   resolve = the food arrived! (connection worked)
    //   reject  = the kitchen is closed! (something went wrong)
    function connect(name) {
        return new Promise(function (resolve, reject) {
            try {
                // io() creates the Socket.IO connection to the server
                socket = io();
                username = name;

                // When the connection is established, say hello!
                socket.on('connect', function () {
                    connected = true;
                    // Tell the server our username (like signing a guest book)
                    socket.emit('register', { username: username });
                });

                // Server says "welcome!" and sends us the player list
                socket.on('registered', function (data) {
                    setupListeners();
                    resolve({
                        success: true,
                        playerList: data.playerList,
                        leaderboard: data.leaderboard
                    });
                });

                // Server says "that name is taken" or some other problem
                socket.on('registerError', function (data) {
                    reject(data);
                });

                // Couldn't reach the server at all (no internet, server down, etc.)
                socket.on('connect_error', function (err) {
                    connected = false;
                    reject({ success: false, message: 'Connection failed: ' + err.message });
                });
            } catch (err) {
                reject({ success: false, message: err.message });
            }
        });
    }

    // --- DISCONNECT ---
    // Hang up the phone call with the server
    function disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        connected = false;
        username = null;
        playerNumber = null;
        currentGameId = null;
    }

    // --- GET PLAYER LIST ---
    // Ask the server "who's online right now?"
    function getPlayerList() {
        return new Promise(function (resolve, reject) {
            if (!socket || !connected) {
                reject({ message: 'Not connected' });
                return;
            }
            socket.emit('getPlayerList', function (data) {
                resolve(data);
            });
        });
    }

    // --- GET ACTIVE GAMES ---
    // Ask the server "what games are happening right now?"
    function getActiveGames() {
        return new Promise(function (resolve, reject) {
            if (!socket || !connected) {
                reject({ message: 'Not connected' });
                return;
            }
            socket.emit('getActiveGames', function (data) {
                resolve(data);
            });
        });
    }

    // --- GET LEADERBOARD ---
    // Ask the server "who are the best players?" sorted by wins or win rate
    function getLeaderboard(sortBy) {
        return new Promise(function (resolve, reject) {
            if (!socket || !connected) {
                reject({ message: 'Not connected' });
                return;
            }
            socket.emit('getLeaderboard', { sortBy: sortBy || 'wins' }, function (data) {
                resolve(data);
            });
        });
    }

    // --- GET MATCH HISTORY ---
    // Ask the server "show me the last few games this player played"
    function getMatchHistory(playerName, limit) {
        return new Promise(function (resolve, reject) {
            if (!socket || !connected) {
                reject({ message: 'Not connected' });
                return;
            }
            socket.emit('getMatchHistory', { playerName: playerName, limit: limit }, function (data) {
                resolve(data);
            });
        });
    }

    // --- CHALLENGE ---
    // Send a challenge to another player (like throwing down a glove!)
    // targetSocketId is the unique ID of the player we want to play against.
    // Unlike connect(), this does NOT return a promise -- we just send it
    // and wait for the server to notify us later via a callback.
    function challenge(targetSocketId) {
        if (socket && connected) {
            socket.emit('challenge', { targetSocketId: targetSocketId });
        }
    }

    // --- ACCEPT CHALLENGE ---
    // Someone challenged us and we say "let's do this!"
    function acceptChallenge(challengeId) {
        if (socket && connected) {
            socket.emit('acceptChallenge', { challengeId: challengeId });
        }
    }

    // --- DECLINE CHALLENGE ---
    // Someone challenged us and we say "not right now"
    function declineChallenge(challengeId) {
        if (socket && connected) {
            socket.emit('declineChallenge', { challengeId: challengeId });
        }
    }

    // --- SEND INPUT ---
    // Tell the server which keys we're pressing RIGHT NOW.
    // We send: up (true/false), down (true/false), slow (true/false).
    // This gets called many times per second while the game is running!
    // The server uses this to move our paddle on its end.
    function sendInput(input) {
        if (socket && connected) {
            socket.emit('playerInput', { up: input.up, down: input.down, slow: input.slow });
        }
    }

    // --- SEND READY ---
    // Tell the server "I'm ready to start the game!"
    function sendReady() {
        if (socket && connected) {
            socket.emit('playerReady');
        }
    }

    // --- SPECTATE ---
    // Watch someone else's game (like sitting in the audience)
    function spectateGame(gameId) {
        if (socket && connected) {
            socket.emit('spectateGame', { gameId: gameId });
        }
    }

    // --- LEAVE GAME ---
    // Leave the current game or stop watching
    function leaveGame() {
        if (socket && connected) {
            socket.emit('leaveGame');
        }
        currentGameId = null;
        playerNumber = null;
    }

    // --- SEND PADDLE COLOR ---
    // Tell the server what color we want our paddle to be
    function sendPaddleColor(color) {
        if (socket && connected) {
            socket.emit('paddleColor', { color: color });
        }
    }

    // --- EVENT CALLBACK SETTERS ---
    // These let other files say "when X happens, call my function."
    // It's like signing up for notifications on your phone.
    // For example: Network.onGameStart(myFunction) means
    // "when a game starts, please run myFunction for me!"
    function onPlayerListUpdate(callback) { callbacks.onPlayerListUpdate = callback; }
    function onActiveGamesUpdate(callback) { callbacks.onActiveGamesUpdate = callback; }
    function onChallenged(callback) { callbacks.onChallenged = callback; }
    function onChallengeAccepted(callback) { callbacks.onChallengeAccepted = callback; }
    function onChallengeDeclined(callback) { callbacks.onChallengeDeclined = callback; }
    function onChallengeExpired(callback) { callbacks.onChallengeExpired = callback; }
    function onGameStart(callback) { callbacks.onGameStart = callback; }
    function onGameState(callback) { callbacks.onGameState = callback; }
    function onSoundTrigger(callback) { callbacks.onSoundTrigger = callback; }
    function onGameEnd(callback) { callbacks.onGameEnd = callback; }
    function onOpponentDisconnected(callback) { callbacks.onOpponentDisconnected = callback; }
    function onError(callback) { callbacks.onError = callback; }

    // --- PUBLIC INTERFACE ---
    // Everything we share with the rest of the program
    return {
        // Properties: "get" means read-only (you can look but can't change)
        get socket() { return socket; },
        get connected() { return connected; },
        get username() { return username; },
        get playerNumber() { return playerNumber; },
        get currentGameId() { return currentGameId; },

        // Methods for talking to the server
        connect: connect,
        disconnect: disconnect,
        getPlayerList: getPlayerList,
        getActiveGames: getActiveGames,
        getLeaderboard: getLeaderboard,
        getMatchHistory: getMatchHistory,
        challenge: challenge,
        acceptChallenge: acceptChallenge,
        declineChallenge: declineChallenge,
        sendInput: sendInput,
        sendReady: sendReady,
        spectateGame: spectateGame,
        leaveGame: leaveGame,
        sendPaddleColor: sendPaddleColor,

        // Event callback setters (subscribe to notifications)
        onPlayerListUpdate: onPlayerListUpdate,
        onActiveGamesUpdate: onActiveGamesUpdate,
        onChallenged: onChallenged,
        onChallengeAccepted: onChallengeAccepted,
        onChallengeDeclined: onChallengeDeclined,
        onChallengeExpired: onChallengeExpired,
        onGameStart: onGameStart,
        onGameState: onGameState,
        onSoundTrigger: onSoundTrigger,
        onGameEnd: onGameEnd,
        onOpponentDisconnected: onOpponentDisconnected,
        onError: onError
    };

})();
