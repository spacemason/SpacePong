// Network — Socket.IO client wrapper for online multiplayer
// Depends on socket.io client library loaded via script tag

var Network = (function () {

    // --- Private state ---
    var socket = null;
    var connected = false;
    var username = null;
    var playerNumber = null;
    var currentGameId = null;

    // Callback storage for event listeners
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

    // --- Private helpers ---

    /**
     * Set up all Socket.IO event listeners on the current socket.
     */
    function setupListeners() {
        socket.on('playerListUpdate', function (players) {
            if (callbacks.onPlayerListUpdate) {
                callbacks.onPlayerListUpdate(players);
            }
        });

        socket.on('activeGamesUpdate', function (games) {
            if (callbacks.onActiveGamesUpdate) {
                callbacks.onActiveGamesUpdate(games);
            }
        });

        socket.on('challenged', function (data) {
            if (callbacks.onChallenged) {
                callbacks.onChallenged(data);
            }
        });

        socket.on('challengeAccepted', function (data) {
            if (callbacks.onChallengeAccepted) {
                callbacks.onChallengeAccepted(data);
            }
        });

        socket.on('challengeDeclined', function (data) {
            if (callbacks.onChallengeDeclined) {
                callbacks.onChallengeDeclined(data);
            }
        });

        socket.on('challengeExpired', function (data) {
            if (callbacks.onChallengeExpired) {
                callbacks.onChallengeExpired(data);
            }
        });

        socket.on('gameStart', function (data) {
            currentGameId = data.gameId;
            playerNumber = data.playerNumber;
            if (callbacks.onGameStart) {
                callbacks.onGameStart(data);
            }
        });

        socket.on('gameState', function (state) {
            if (callbacks.onGameState) {
                callbacks.onGameState(state);
            }
        });

        socket.on('soundTrigger', function (data) {
            if (callbacks.onSoundTrigger) {
                callbacks.onSoundTrigger(data);
            }
        });

        socket.on('gameEnd', function (data) {
            currentGameId = null;
            playerNumber = null;
            if (callbacks.onGameEnd) {
                callbacks.onGameEnd(data);
            }
        });

        socket.on('opponentDisconnected', function (data) {
            if (callbacks.onOpponentDisconnected) {
                callbacks.onOpponentDisconnected(data);
            }
        });

        socket.on('error', function (data) {
            if (callbacks.onError) {
                callbacks.onError(data);
            }
        });

        socket.on('disconnect', function () {
            connected = false;
        });
    }

    // --- Public API ---

    /**
     * Connect to the Socket.IO server and register with a username.
     * @param {string} name - the username to register
     * @returns {Promise} resolves with { success, playerList, leaderboard }
     */
    function connect(name) {
        return new Promise(function (resolve, reject) {
            try {
                socket = io();
                username = name;

                socket.on('connect', function () {
                    connected = true;
                    socket.emit('register', { username: username });
                });

                socket.on('registered', function (data) {
                    setupListeners();
                    resolve({
                        success: true,
                        playerList: data.playerList,
                        leaderboard: data.leaderboard
                    });
                });

                socket.on('registerError', function (data) {
                    reject(data);
                });

                socket.on('connect_error', function (err) {
                    connected = false;
                    reject({ success: false, message: 'Connection failed: ' + err.message });
                });
            } catch (err) {
                reject({ success: false, message: err.message });
            }
        });
    }

    /**
     * Disconnect from the Socket.IO server.
     */
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

    /**
     * Request the current player list from the server.
     * @returns {Promise} resolves with array of players
     */
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

    /**
     * Request the list of active games from the server.
     * @returns {Promise} resolves with array of games
     */
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

    /**
     * Request the leaderboard from the server.
     * @param {string} sortBy - 'wins' or 'winRate'
     * @returns {Promise} resolves with leaderboard data
     */
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

    /**
     * Request match history for a player.
     * @param {string} playerName - player to look up
     * @param {number} limit - max number of matches to return
     * @returns {Promise} resolves with match history data
     */
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

    /**
     * Challenge another player.
     * @param {string} targetSocketId - socket ID of the player to challenge
     */
    function challenge(targetSocketId) {
        if (socket && connected) {
            socket.emit('challenge', { targetSocketId: targetSocketId });
        }
    }

    /**
     * Accept an incoming challenge.
     * @param {string} challengeId - the challenge to accept
     */
    function acceptChallenge(challengeId) {
        if (socket && connected) {
            socket.emit('acceptChallenge', { challengeId: challengeId });
        }
    }

    /**
     * Decline an incoming challenge.
     * @param {string} challengeId - the challenge to decline
     */
    function declineChallenge(challengeId) {
        if (socket && connected) {
            socket.emit('declineChallenge', { challengeId: challengeId });
        }
    }

    /**
     * Send player input to the server.
     * @param {object} input - { up: bool, down: bool, slow: bool }
     */
    function sendInput(input) {
        if (socket && connected) {
            socket.emit('playerInput', { up: input.up, down: input.down, slow: input.slow });
        }
    }

    /**
     * Signal that this player is ready.
     */
    function sendReady() {
        if (socket && connected) {
            socket.emit('playerReady');
        }
    }

    /**
     * Start spectating a game.
     * @param {string} gameId - the game to spectate
     */
    function spectateGame(gameId) {
        if (socket && connected) {
            socket.emit('spectateGame', { gameId: gameId });
        }
    }

    /**
     * Leave the current game or spectating session.
     */
    function leaveGame() {
        if (socket && connected) {
            socket.emit('leaveGame');
        }
        currentGameId = null;
        playerNumber = null;
    }

    /**
     * Send paddle color preference to the server.
     * @param {string} color - CSS color string
     */
    function sendPaddleColor(color) {
        if (socket && connected) {
            socket.emit('paddleColor', { color: color });
        }
    }

    // --- Event callback setters ---

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

    // --- Expose public interface ---

    return {
        // Properties (accessed via getters for encapsulation)
        get socket() { return socket; },
        get connected() { return connected; },
        get username() { return username; },
        get playerNumber() { return playerNumber; },
        get currentGameId() { return currentGameId; },

        // Methods
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

        // Event callback setters
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
