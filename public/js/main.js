// main.js — top-level orchestrator for Pong (local + online)
// Loaded last; depends on: LocalGame, OnlineGame, LobbyUI, Network, AudioManager

var currentScreen = 'modeSelect';
var notificationPermissionRequested = false;

document.addEventListener('DOMContentLoaded', function () {

    // --- DOM references ---
    var modeSelectEl = document.getElementById('mode-select');
    var usernameModal = document.getElementById('username-modal');
    var lobbyScreen = document.getElementById('lobby-screen');
    var gameScreen = document.getElementById('game-screen');
    var canvas = document.getElementById('game');

    var modeAiBtn = document.getElementById('mode-ai');
    var mode2pBtn = document.getElementById('mode-2p');
    var modeOnlineBtn = document.getElementById('mode-online');

    var usernameInput = document.getElementById('username-input');
    var usernameError = document.getElementById('username-error');
    var usernameJoinBtn = document.getElementById('username-join-btn');

    // --- Initialize modules ---
    LocalGame.init(canvas);
    OnlineGame.init(canvas);
    LobbyUI.init(onChallenge, onSpectate, onLeaveOnline);

    // --- LocalGame callbacks ---
    LocalGame.setOnReturnToMenu(function () {
        LocalGame.stop();
        showScreen('modeSelect');
    });

    // --- OnlineGame callbacks ---
    OnlineGame.setOnReturnToLobby(function () {
        OnlineGame.stop();
        Network.leaveGame();
        showScreen('lobby');
    });

    // --- Screen management ---

    function showScreen(screenName) {
        currentScreen = screenName;

        // Hide all screens
        modeSelectEl.style.display = 'none';
        usernameModal.style.display = 'none';
        gameScreen.style.display = 'none';
        LobbyUI.hide();

        switch (screenName) {
            case 'modeSelect':
                modeSelectEl.style.display = 'flex';
                break;

            case 'localGame':
                gameScreen.style.display = 'flex';
                break;

            case 'usernameEntry':
                usernameModal.style.display = 'flex';
                usernameError.textContent = '';
                usernameInput.value = '';
                usernameInput.focus();
                break;

            case 'lobby':
                LobbyUI.show();
                // Request fresh data
                Network.getPlayerList().then(function (players) {
                    LobbyUI.updatePlayerList(players);
                }).catch(function () {});
                Network.getActiveGames().then(function (games) {
                    LobbyUI.updateActiveGames(games);
                }).catch(function () {});
                Network.getLeaderboard('wins').then(function (data) {
                    LobbyUI.updateLeaderboard(data);
                }).catch(function () {});
                Network.getMatchHistory(Network.username, 20).then(function (data) {
                    LobbyUI.updateMatchHistory(data);
                }).catch(function () {});
                break;

            case 'onlineGame':
                gameScreen.style.display = 'flex';
                break;
        }
    }

    // Show initial screen
    showScreen('modeSelect');

    // --- Mode select button handlers ---

    modeAiBtn.addEventListener('click', function () {
        LocalGame.start(true);
        showScreen('localGame');
    });

    mode2pBtn.addEventListener('click', function () {
        LocalGame.start(false);
        showScreen('localGame');
    });

    modeOnlineBtn.addEventListener('click', function () {
        // Request notification permission the first time
        if (!notificationPermissionRequested) {
            notificationPermissionRequested = true;
            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission();
            }
        }

        var savedUsername = localStorage.getItem('pongUsername');
        if (savedUsername) {
            connectAndGoToLobby(savedUsername);
        } else {
            showScreen('usernameEntry');
        }
    });

    // --- Username entry ---

    function validateUsername(name) {
        if (!name || name.length < 2 || name.length > 16) {
            return 'Username must be 2-16 characters';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            return 'Only letters, numbers, and underscores allowed';
        }
        return null;
    }

    function submitUsername() {
        var name = usernameInput.value.trim();
        var error = validateUsername(name);
        if (error) {
            usernameError.textContent = error;
            return;
        }
        usernameError.textContent = '';
        localStorage.setItem('pongUsername', name);
        connectAndGoToLobby(name);
    }

    usernameJoinBtn.addEventListener('click', submitUsername);
    usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitUsername();
        }
    });

    function connectAndGoToLobby(username) {
        Network.connect(username).then(function (data) {
            if (data.playerList) LobbyUI.updatePlayerList(data.playerList);
            if (data.leaderboard) LobbyUI.updateLeaderboard(data.leaderboard);
            showScreen('lobby');
        }).catch(function (err) {
            var msg = (err && err.message) ? err.message : 'Connection failed';
            if (currentScreen === 'usernameEntry') {
                usernameError.textContent = msg;
            } else {
                // If we had a saved username and it failed, go to username entry
                showScreen('usernameEntry');
                usernameError.textContent = msg;
            }
            // Clear saved username on registration error so user can retry
            localStorage.removeItem('pongUsername');
        });
    }

    // --- Lobby callbacks ---

    function onChallenge(targetSocketId) {
        Network.challenge(targetSocketId);
        LobbyUI.showChallengingModal('opponent', function () {
            // onCancel — nothing extra needed, modal hides itself
        });
    }

    function onSpectate(gameId) {
        Network.spectateGame(gameId);
        OnlineGame.start(0); // 0 = spectator
        showScreen('onlineGame');
    }

    function onLeaveOnline() {
        Network.disconnect();
        showScreen('modeSelect');
    }

    // --- Network event wiring ---

    Network.onChallenged(function (data) {
        // Browser notification if tab not focused
        if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            var n = new Notification(data.fromUsername + ' challenged you to a duel!', {
                body: 'Click to respond',
                tag: 'pong-challenge'
            });
            n.onclick = function () {
                window.focus();
                n.close();
            };
        }

        LobbyUI.showChallengeModal(
            data.fromUsername,
            function () { // accept
                Network.acceptChallenge(data.challengeId);
            },
            function () { // decline
                Network.declineChallenge(data.challengeId);
            }
        );
    });

    Network.onChallengeAccepted(function (data) {
        LobbyUI.hideChallengeModal();
        OnlineGame.start(data.playerNumber);
        showScreen('onlineGame');
    });

    Network.onChallengeDeclined(function () {
        LobbyUI.hideChallengeModal();
        LobbyUI.showNotification('Challenge declined', 'info');
    });

    Network.onChallengeExpired(function () {
        LobbyUI.hideChallengeModal();
        LobbyUI.showNotification('Challenge expired', 'info');
    });

    Network.onPlayerListUpdate(function (players) {
        LobbyUI.updatePlayerList(players);
    });

    Network.onActiveGamesUpdate(function (games) {
        LobbyUI.updateActiveGames(games);
    });

    Network.onGameStart(function (data) {
        OnlineGame.start(data.playerNumber);
        showScreen('onlineGame');
    });

    Network.onGameState(function (state) {
        OnlineGame.onGameState(state);
    });

    Network.onSoundTrigger(function (data) {
        OnlineGame.onSoundTrigger(data);
    });

    Network.onGameEnd(function (data) {
        OnlineGame.onGameEnd(data);
    });

    Network.onOpponentDisconnected(function () {
        OnlineGame.onGameEnd({ winner: 'you', reason: 'disconnect' });
    });

    // --- Global keyboard shortcuts ---

    window.addEventListener('keydown', function (e) {
        if (e.key === 'Control') {
            if (currentScreen === 'lobby' || currentScreen === 'onlineGame') {
                e.preventDefault();
                if (currentScreen === 'onlineGame') {
                    OnlineGame.stop();
                    Network.leaveGame();
                }
                Network.disconnect();
                showScreen('modeSelect');
            }
        }
    });

});
