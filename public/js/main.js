// ============================================================
// main.js — The "Traffic Controller" of the game!
// This file is like a boss that decides which screen you see.
// It listens for button clicks and tells the game what to do.
// It loads last because it needs all the other files ready first.
// ============================================================

// This keeps track of which screen we're looking at right now
var currentScreen = 'modeSelect';
// Have we already asked the player "Can we send you notifications?" (we only ask once)
var notificationPermissionRequested = false;

// Wait until the whole page is loaded before we start doing anything
document.addEventListener('DOMContentLoaded', function () {

    // --- DOM references ---
    // Grab all the important pieces of the page so we can show/hide them later
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

    var onlineColorModal = document.getElementById('online-color-modal');
    var onlineColorInput = document.getElementById('online-color-input');
    var onlineColorBtn = document.getElementById('online-color-btn');
    var onlinePaddleColor = localStorage.getItem('pongPaddleColor') || '#ffffff';
    var usernameJoinBtn = document.getElementById('username-join-btn');

    // --- Fit canvas to screen ---
    function fitCanvas() {
        var scoreWidth = 100; // space for scores on each side
        var padding = 20;
        var touchControlsHeight = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 60 : 0;
        var maxW = window.innerWidth - scoreWidth - padding;
        var maxH = window.innerHeight - touchControlsHeight - padding;
        // Canvas internal resolution is 800x500 (aspect ratio 1.6)
        var aspect = 800 / 500;
        var w = maxW;
        var h = w / aspect;
        if (h > maxH) {
            h = maxH;
            w = h * aspect;
        }
        canvas.style.width = Math.floor(w) + 'px';
        canvas.style.height = Math.floor(h) + 'px';
    }
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', function () { setTimeout(fitCanvas, 200); });

    // --- Initialize modules ---
    // Wake up each part of the game and get them ready
    LocalGame.init(canvas);
    OnlineGame.init(canvas);
    LobbyUI.init(onChallenge, onSpectate, onLeaveOnline);

    // --- LocalGame callbacks ---
    // When the player wants to go back to the menu from a local game, stop the game and show the menu
    LocalGame.setOnReturnToMenu(function () {
        LocalGame.stop();
        showScreen('modeSelect');
    });

    // --- OnlineGame callbacks ---
    // When the player wants to leave an online game, stop it and go back to the lobby
    OnlineGame.setOnReturnToLobby(function () {
        OnlineGame.stop();
        Network.leaveGame();
        showScreen('lobby');
    });

    // --- Screen management ---
    // showScreen is the main "traffic controller" function!
    // It hides ALL screens first, then shows only the one you asked for.
    // Think of it like turning off all the lights, then turning on just one.
    function showScreen(screenName) {
        currentScreen = screenName;

        // Hide all screens
        modeSelectEl.style.display = 'none';
        usernameModal.style.display = 'none';
        onlineColorModal.style.display = 'none';
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

            case 'onlineColorPicker':
                onlineColorModal.style.display = 'flex';
                selectColor(onlinePaddleColor);
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
    // These listen for clicks on the 3 big buttons on the main menu

    // "1 Player and AI" button — start a game against the computer
    modeAiBtn.addEventListener('click', function () {
        LocalGame.start(true);
        showScreen('localGame');
    });

    // "2 Players" button — start a game with a friend on the same keyboard
    mode2pBtn.addEventListener('click', function () {
        LocalGame.start(false);
        showScreen('localGame');
    });

    // "Online Play" button — play against someone on the internet!
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
            showScreen('onlineColorPicker');
        } else {
            showScreen('usernameEntry');
        }
    });

    // --- Username entry ---
    // Before going online, you need a name! This checks if the name is okay.

    // Make sure the username follows the rules (2-16 characters, no weird symbols)
    function validateUsername(name) {
        if (!name || name.length < 2 || name.length > 16) {
            return 'Username must be 2-16 characters';
        }
        if (!/^[a-zA-Z0-9_]+$/.test(name)) {
            return 'Only letters, numbers, and underscores allowed';
        }
        return null;
    }

    // When you click "Join" or press Enter, save your name and move to color picker
    function submitUsername() {
        var name = usernameInput.value.trim();
        var error = validateUsername(name);
        if (error) {
            usernameError.textContent = error;
            return;
        }
        usernameError.textContent = '';
        localStorage.setItem('pongUsername', name);
        showScreen('onlineColorPicker');
    }

    // Click the "Join" button to submit your username
    usernameJoinBtn.addEventListener('click', submitUsername);
    // Or just press Enter on your keyboard — same thing!
    usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            submitUsername();
        }
    });

    // --- Online color picker ---
    // Pick a color for your paddle before joining the lobby!

    // Save the chosen color and connect to the server
    function submitOnlineColor() {
        onlinePaddleColor = onlineColorInput.value;
        localStorage.setItem('pongPaddleColor', onlinePaddleColor);
        var savedUsername = localStorage.getItem('pongUsername');
        connectAndGoToLobby(savedUsername);
    }

    // Build color grid
    var colorChoices = [
        '#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffff00', '#88ff00',
        '#00ff00', '#00ff88', '#00ffff', '#0088ff', '#0000ff', '#8800ff',
        '#ff00ff', '#ff0088', '#ffffff', '#cccccc', '#888888', '#ff6688',
        '#ffaa44', '#44ffaa', '#44aaff', '#aa44ff', '#ff4488', '#00cc88'
    ];
    var colorGrid = document.getElementById('color-grid');
    var colorPreview = document.getElementById('color-preview');

    function selectColor(color) {
        onlinePaddleColor = color;
        onlineColorInput.value = color;
        colorPreview.style.background = color;
        // Update selected state
        var swatches = colorGrid.querySelectorAll('.color-swatch');
        for (var i = 0; i < swatches.length; i++) {
            if (swatches[i].dataset.color === color) {
                swatches[i].classList.add('selected');
            } else {
                swatches[i].classList.remove('selected');
            }
        }
    }

    for (var i = 0; i < colorChoices.length; i++) {
        var swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.background = colorChoices[i];
        swatch.dataset.color = colorChoices[i];
        swatch.addEventListener('click', (function (c) {
            return function () { selectColor(c); };
        })(colorChoices[i]));
        colorGrid.appendChild(swatch);
    }

    // Custom color input updates preview
    onlineColorInput.addEventListener('input', function () {
        selectColor(onlineColorInput.value);
    });

    onlineColorBtn.addEventListener('click', submitOnlineColor);

    window.addEventListener('keydown', function (e) {
        if (currentScreen === 'onlineColorPicker' && e.key === 'Enter') {
            e.preventDefault();
            submitOnlineColor();
        }
    });

    // Connect to the game server using your username, then show the lobby
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
    // These run when you do things in the lobby (challenge, spectate, or leave)

    // When you click "Challenge" on another player, send them a challenge!
    function onChallenge(targetSocketId) {
        Network.challenge(targetSocketId);
        LobbyUI.showChallengingModal('opponent', function () {
            // onCancel — nothing extra needed, modal hides itself
        });
    }

    // When you want to watch someone else's game (like sitting in the bleachers!)
    function onSpectate(gameId) {
        Network.spectateGame(gameId);
        OnlineGame.start(0); // 0 = spectator
        showScreen('onlineGame');
    }

    // When you want to leave online mode and go back to the main menu
    function onLeaveOnline() {
        Network.disconnect();
        showScreen('modeSelect');
    }

    // --- Network event wiring ---
    // The server sends us messages when things happen online.
    // Here we tell the game what to do when each message arrives.

    // Someone challenged YOU to a game! Show a popup so you can accept or decline.
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

    // The other player said YES to your challenge — time to play!
    Network.onChallengeAccepted(function (data) {
        LobbyUI.hideChallengeModal();
        Network.sendPaddleColor(onlinePaddleColor);
        OnlineGame.start(data.playerNumber);
        showScreen('onlineGame');
    });

    // The other player said NO to your challenge
    Network.onChallengeDeclined(function () {
        LobbyUI.hideChallengeModal();
        LobbyUI.showNotification('Challenge declined', 'info');
    });

    // The challenge timed out — nobody answered in time
    Network.onChallengeExpired(function () {
        LobbyUI.hideChallengeModal();
        LobbyUI.showNotification('Challenge expired', 'info');
    });

    // The server sent an updated list of who's online
    Network.onPlayerListUpdate(function (players) {
        LobbyUI.updatePlayerList(players);
    });

    // The server sent an updated list of games happening right now
    Network.onActiveGamesUpdate(function (games) {
        LobbyUI.updateActiveGames(games);
    });

    // A game is starting! Send our paddle color and jump into the game screen
    Network.onGameStart(function (data) {
        Network.sendPaddleColor(onlinePaddleColor);
        OnlineGame.start(data.playerNumber);
        showScreen('onlineGame');
    });

    // The server tells us where the ball and paddles are (many times per second!)
    Network.onGameState(function (state) {
        OnlineGame.onGameState(state);
    });

    // The server says "play a sound!" (like a bounce or score sound)
    Network.onSoundTrigger(function (data) {
        OnlineGame.onSoundTrigger(data);
    });

    // The game is over — someone won!
    Network.onGameEnd(function (data) {
        OnlineGame.onGameEnd(data);
    });

    // The other player disconnected (maybe their internet went out) — you win!
    Network.onOpponentDisconnected(function () {
        OnlineGame.onGameEnd({ winner: 'you', reason: 'disconnect' });
    });

    // --- Global keyboard shortcuts ---
    // Press the Ctrl key as a quick escape — it disconnects you and goes back to the menu
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
