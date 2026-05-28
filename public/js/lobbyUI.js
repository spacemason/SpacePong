// ============================================================
// lobbyUI.js - Building the Online Lobby (Waiting Room!)
// ============================================================
// Think of the lobby like a WAITING ROOM before a game starts.
// Imagine a room at a bowling alley where you can:
//   - See who else is there (player list)
//   - Ask someone to play (challenge button)
//   - Watch other people's games (spectate)
//   - See who's the best (leaderboard)
//
// This file BUILDS that waiting room screen using JavaScript
// instead of writing it in HTML. Why? Because the lobby is
// complex and only needed for online play. Building it with
// code means we can easily update it when new data arrives
// from the server.
//
// It uses "DOM manipulation" -- that's a fancy way of saying
// "creating and changing HTML elements with JavaScript code."
// DOM stands for "Document Object Model" -- it's how the browser
// organizes all the pieces of a webpage, like a family tree of
// elements (divs inside divs inside the page).
// ============================================================

var LobbyUI = (function () {

    // References to important parts of the lobby we create
    var container = null;         // The whole lobby screen
    var playerListEl = null;      // The box showing online players
    var activeGamesEl = null;     // The box showing games in progress
    var leaderboardEl = null;     // The box showing top players
    var matchHistoryEl = null;    // The box showing recent matches
    var modalOverlay = null;      // Pop-up window (for challenges)
    var notificationTimeout = null; // Timer for toast messages

    // Functions to call when the user clicks Challenge or Watch
    var onChallengeCallback = null;
    var onSpectateCallback = null;

    // --- STYLE INJECTION ---
    // This adds CSS styles for the lobby directly into the page.
    // It's like writing the fashion rules for how lobby elements should look.
    // We do this in JavaScript because these styles only matter when
    // the lobby exists.
    function injectStyles() {
        // Don't add styles twice!
        if (document.getElementById('lobby-styles')) return;

        var style = document.createElement('style');
        style.id = 'lobby-styles';
        // All the CSS rules for the lobby, joined into one big string
        style.textContent = [
            '#lobby-screen {',
            '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
            '  background: #111; color: #eee; font-family: "Courier New", monospace;',
            '  display: none; flex-direction: column; z-index: 1000; overflow: hidden;',
            '}',
            '#lobby-screen.visible { display: flex; }',
            '',
            '.lobby-header {',
            '  display: flex; align-items: center; justify-content: space-between;',
            '  padding: 12px 24px; background: #181818; border-bottom: 1px solid #333;',
            '  flex-shrink: 0;',
            '}',
            '.lobby-header h1 { margin: 0; font-size: 22px; color: #fff; }',
            '.lobby-header .lobby-user { color: #0f0; font-size: 14px; }',
            '',
            '.lobby-btn {',
            '  background: #333; color: #eee; border: 1px solid #555; padding: 6px 14px;',
            '  font-family: "Courier New", monospace; font-size: 13px; cursor: pointer;',
            '  transition: background 0.15s;',
            '}',
            '.lobby-btn:hover { background: #444; }',
            '.lobby-btn.primary { background: #0a5; border-color: #0c7; color: #fff; }',
            '.lobby-btn.primary:hover { background: #0b6; }',
            '.lobby-btn.danger { background: #a33; border-color: #c44; color: #fff; }',
            '.lobby-btn.danger:hover { background: #b44; }',
            '.lobby-btn.watch { background: #338; border-color: #55a; color: #ccf; }',
            '.lobby-btn.watch:hover { background: #449; }',
            '.lobby-btn.small { padding: 3px 8px; font-size: 11px; }',
            '',
            '.lobby-columns {',
            '  display: flex; flex: 1; overflow: hidden; gap: 0;',
            '}',
            '.lobby-panel {',
            '  flex: 1; display: flex; flex-direction: column;',
            '  border-right: 1px solid #333; overflow: hidden;',
            '}',
            '.lobby-panel:last-child { border-right: none; }',
            '.lobby-panel-header {',
            '  padding: 10px 16px; background: #1a1a1a; border-bottom: 1px solid #333;',
            '  font-size: 14px; font-weight: bold; color: #aaa; flex-shrink: 0;',
            '  display: flex; align-items: center; justify-content: space-between;',
            '}',
            '.lobby-panel-body {',
            '  flex: 1; overflow-y: auto; padding: 8px;',
            '}',
            '',
            '.player-item {',
            '  display: flex; align-items: center; justify-content: space-between;',
            '  padding: 6px 10px; border-bottom: 1px solid #222;',
            '}',
            '.player-item:last-child { border-bottom: none; }',
            '.player-name { flex: 1; font-size: 13px; }',
            '.status-badge {',
            '  display: inline-block; width: 8px; height: 8px; border-radius: 50%;',
            '  margin-right: 8px; flex-shrink: 0;',
            '}',
            '.status-idle { background: #0c0; }',
            '.status-in-game { background: #cc0; }',
            '.status-spectating { background: #48f; }',
            '',
            '.game-item {',
            '  display: flex; align-items: center; justify-content: space-between;',
            '  padding: 6px 10px; border-bottom: 1px solid #222; font-size: 13px;',
            '}',
            '.game-item:last-child { border-bottom: none; }',
            '',
            '.leaderboard-table, .history-table {',
            '  width: 100%; border-collapse: collapse; font-size: 12px;',
            '}',
            '.leaderboard-table th, .history-table th {',
            '  text-align: left; padding: 6px 8px; background: #1a1a1a;',
            '  border-bottom: 1px solid #333; color: #888; font-size: 11px;',
            '  position: sticky; top: 0;',
            '}',
            '.leaderboard-table td, .history-table td {',
            '  padding: 5px 8px; border-bottom: 1px solid #1a1a1a;',
            '}',
            '',
            '.sort-btns { display: flex; gap: 4px; }',
            '.sort-btn {',
            '  background: #222; color: #888; border: 1px solid #444; padding: 2px 8px;',
            '  font-family: "Courier New", monospace; font-size: 10px; cursor: pointer;',
            '}',
            '.sort-btn.active { background: #335; color: #aaf; border-color: #55a; }',
            '.sort-btn:hover { background: #2a2a2a; }',
            '',
            '.lobby-bottom {',
            '  border-top: 1px solid #333; max-height: 200px; display: flex;',
            '  flex-direction: column; flex-shrink: 0;',
            '}',
            '.lobby-bottom .lobby-panel-header { background: #181818; }',
            '.lobby-bottom .lobby-panel-body {',
            '  overflow-y: auto; padding: 0;',
            '}',
            '',
            '.lobby-modal-overlay {',
            '  position: fixed; top: 0; left: 0; width: 100%; height: 100%;',
            '  background: rgba(0,0,0,0.7); display: flex; align-items: center;',
            '  justify-content: center; z-index: 2000;',
            '}',
            '.lobby-modal {',
            '  background: #222; border: 1px solid #444; padding: 28px 36px;',
            '  text-align: center; font-family: "Courier New", monospace;',
            '  max-width: 400px; width: 90%;',
            '}',
            '.lobby-modal h2 { margin: 0 0 16px; font-size: 16px; color: #fff; }',
            '.lobby-modal p { margin: 0 0 20px; font-size: 14px; color: #ccc; }',
            '.lobby-modal .modal-btns { display: flex; gap: 12px; justify-content: center; }',
            '',
            '.lobby-toast {',
            '  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);',
            '  padding: 10px 24px; font-family: "Courier New", monospace; font-size: 13px;',
            '  z-index: 3000; opacity: 0; transition: opacity 0.3s;',
            '  pointer-events: none;',
            '}',
            '.lobby-toast.show { opacity: 1; }',
            '.lobby-toast.success { background: #0a5; color: #fff; }',
            '.lobby-toast.error { background: #a33; color: #fff; }',
            '.lobby-toast.info { background: #338; color: #ddf; }'
        ].join('\n');

        document.head.appendChild(style);
    }

    // --- DOM CREATION HELPER ---
    // This is a handy shortcut function for creating HTML elements.
    // Instead of writing 5 lines to make a button, we can do it in 1!
    // - tag: what kind of element ("div", "button", "span", etc.)
    // - attrs: properties like className, textContent, onClick
    // - children: other elements to put inside this one
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            for (var key in attrs) {
                if (key === 'className') {
                    node.className = attrs[key];
                } else if (key === 'textContent') {
                    node.textContent = attrs[key];
                } else if (key.indexOf('on') === 0) {
                    // If the attribute starts with "on" (like onClick),
                    // set it up as an event listener
                    node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
                } else {
                    node.setAttribute(key, attrs[key]);
                }
            }
        }
        // Add child elements (or text) inside this element
        if (children) {
            if (!Array.isArray(children)) children = [children];
            for (var i = 0; i < children.length; i++) {
                if (typeof children[i] === 'string') {
                    node.appendChild(document.createTextNode(children[i]));
                } else if (children[i]) {
                    node.appendChild(children[i]);
                }
            }
        }
        return node;
    }

    // --- SHOW / HIDE THE LOBBY ---
    function show() {
        if (container) container.classList.add('visible');
    }

    function hide() {
        if (container) container.classList.remove('visible');
    }

    // --- INITIALIZE THE LOBBY ---
    // This builds the entire lobby screen from scratch!
    // It creates the header, three columns (players, games, leaderboard),
    // and a bottom section for match history.
    // The three parameters are callback functions -- they tell this file
    // what to do when someone clicks "Challenge", "Watch", or "Leave."
    // That way, lobbyUI.js just builds the screen, and the MAIN code
    // decides what actually happens when buttons are clicked.
    function init(onChallenge, onSpectate, onLeaveOnline) {
        injectStyles();

        onChallengeCallback = onChallenge;
        onSpectateCallback = onSpectate;

        // Clean up if we're re-creating the lobby
        var existing = document.getElementById('lobby-screen');
        if (existing) existing.remove();

        // Create the main lobby container
        container = el('div', { id: 'lobby-screen' });

        // --- HEADER (top bar with title and leave button) ---
        var usernameDisplay = el('span', { className: 'lobby-user' },
            Network.username ? 'Logged in as: ' + Network.username : '');
        var leaveBtn = el('button', {
            className: 'lobby-btn danger',
            textContent: 'Leave',
            onClick: function () { if (onLeaveOnline) onLeaveOnline(); }
        });
        var headerRight = el('div', {
            style: 'display:flex;align-items:center;gap:16px;'
        }, [usernameDisplay, leaveBtn]);
        var header = el('div', { className: 'lobby-header' }, [
            el('h1', { textContent: 'Online Lobby' }),
            headerRight
        ]);
        container.appendChild(header);

        // --- THREE-COLUMN LAYOUT ---
        // The lobby has 3 side-by-side panels, like newspaper columns
        var columns = el('div', { className: 'lobby-columns' });

        // LEFT PANEL: Shows all online players with colored status dots
        // Green = idle (available), Yellow = in a game, Blue = watching
        playerListEl = el('div', { className: 'lobby-panel-body' });
        var leftPanel = el('div', { className: 'lobby-panel' }, [
            el('div', { className: 'lobby-panel-header' }, 'Players'),
            playerListEl
        ]);

        // CENTER PANEL: Shows games being played right now (you can watch!)
        activeGamesEl = el('div', { className: 'lobby-panel-body' });
        var centerPanel = el('div', { className: 'lobby-panel' }, [
            el('div', { className: 'lobby-panel-header' }, 'Active Games'),
            activeGamesEl
        ]);

        // RIGHT PANEL: Leaderboard showing the best players
        // Has buttons to sort by total wins or by win percentage
        leaderboardEl = el('div', { className: 'lobby-panel-body' });
        var activeSortBtn = 'wins';

        var btnWins = el('button', {
            className: 'sort-btn active',
            textContent: 'By Wins',
            onClick: function () {
                activeSortBtn = 'wins';
                btnWins.classList.add('active');
                btnRate.classList.remove('active');
                Network.getLeaderboard('wins').then(function (data) {
                    updateLeaderboard(data);
                });
            }
        });
        var btnRate = el('button', {
            className: 'sort-btn',
            textContent: 'By Win Rate',
            onClick: function () {
                activeSortBtn = 'winRate';
                btnRate.classList.add('active');
                btnWins.classList.remove('active');
                Network.getLeaderboard('winRate').then(function (data) {
                    updateLeaderboard(data);
                });
            }
        });
        var sortBtns = el('div', { className: 'sort-btns' }, [btnWins, btnRate]);
        var lbHeader = el('div', { className: 'lobby-panel-header' }, [
            el('span', { textContent: 'Leaderboard' }),
            sortBtns
        ]);
        var rightPanel = el('div', { className: 'lobby-panel' }, [
            lbHeader,
            leaderboardEl
        ]);

        columns.appendChild(leftPanel);
        columns.appendChild(centerPanel);
        columns.appendChild(rightPanel);
        container.appendChild(columns);

        // --- BOTTOM SECTION: Match History ---
        // Shows a table of recent games that were played
        matchHistoryEl = el('div', { className: 'lobby-panel-body' });
        var bottomSection = el('div', { className: 'lobby-bottom' }, [
            el('div', { className: 'lobby-panel-header' }, 'Match History'),
            matchHistoryEl
        ]);
        container.appendChild(bottomSection);

        // Add the whole lobby to the page!
        document.body.appendChild(container);
    }

    // --- UPDATE PLAYER LIST ---
    // Rebuilds the list of online players whenever it changes.
    // Each player shows a colored dot for their status and a
    // "Challenge" button if they're available to play.
    // This gets called every time someone joins, leaves, or
    // starts a game -- the server sends a fresh list and we
    // redraw everything. It's like erasing a whiteboard and
    // writing the new list of names!
    function updatePlayerList(players) {
        if (!playerListEl) return;
        // Clear the old list and rebuild it
        playerListEl.innerHTML = '';

        if (!players || players.length === 0) {
            playerListEl.appendChild(el('div', {
                style: 'color:#666;padding:12px;font-size:12px;',
                textContent: 'No players online'
            }));
            return;
        }

        for (var i = 0; i < players.length; i++) {
            var p = players[i];
            // Pick the right color dot based on what the player is doing
            var statusClass = 'status-idle';
            if (p.status === 'in-game') statusClass = 'status-in-game';
            else if (p.status === 'spectating') statusClass = 'status-spectating';

            var badge = el('span', { className: 'status-badge ' + statusClass });
            var name = el('span', { className: 'player-name' }, p.username);

            var item = el('div', { className: 'player-item' }, [badge, name]);

            // Only show Challenge button for idle players who aren't YOU
            if (p.status === 'idle' && p.socketId !== (Network.socket && Network.socket.id)) {
                // The tricky "(function(sid) { ... })(p.socketId)" pattern is
                // called a "closure" - it remembers which player's ID to use
                // when the button is clicked, even later!
                var challengeBtn = el('button', {
                    className: 'lobby-btn primary small',
                    textContent: 'Challenge',
                    'data-sid': p.socketId,
                    onClick: (function (sid) {
                        return function () {
                            if (onChallengeCallback) onChallengeCallback(sid);
                        };
                    })(p.socketId)
                });
                item.appendChild(challengeBtn);
            }

            playerListEl.appendChild(item);
        }
    }

    // --- UPDATE ACTIVE GAMES ---
    // Shows all games being played right now with a "Watch" button.
    // Like a TV guide that shows what's on -- you pick a game to watch!
    function updateActiveGames(games) {
        if (!activeGamesEl) return;
        activeGamesEl.innerHTML = '';

        if (!games || games.length === 0) {
            activeGamesEl.appendChild(el('div', {
                style: 'color:#666;padding:12px;font-size:12px;',
                textContent: 'No active games'
            }));
            return;
        }

        for (var i = 0; i < games.length; i++) {
            var g = games[i];
            var scores = g.scores ? '[' + g.scores[0] + '-' + g.scores[1] + ']' : '';
            var label = el('span', null, g.player1 + ' vs ' + g.player2 + ' ' + scores);
            var watchBtn = el('button', {
                className: 'lobby-btn watch small',
                textContent: 'Watch',
                onClick: (function (gid) {
                    return function () {
                        if (onSpectateCallback) onSpectateCallback(gid);
                    };
                })(g.id)
            });
            var item = el('div', { className: 'game-item' }, [label, watchBtn]);
            activeGamesEl.appendChild(item);
        }
    }

    // --- UPDATE LEADERBOARD ---
    // Builds a table showing the top players with their wins, losses,
    // and win rate (what percentage of games they win)
    function updateLeaderboard(data) {
        if (!leaderboardEl) return;
        leaderboardEl.innerHTML = '';

        var table = el('table', { className: 'leaderboard-table' });
        // Table header row (the titles at the top of each column)
        var thead = el('thead', null, [
            el('tr', null, [
                el('th', { textContent: 'Rank' }),
                el('th', { textContent: 'Name' }),
                el('th', { textContent: 'Wins' }),
                el('th', { textContent: 'Losses' }),
                el('th', { textContent: 'Win Rate' })
            ])
        ]);
        table.appendChild(thead);

        // Table body (the actual data rows)
        var tbody = el('tbody');
        if (data && data.length > 0) {
            for (var i = 0; i < data.length; i++) {
                var d = data[i];
                // Convert win rate from decimal (0.75) to percentage (75.0%)
                var winRate = d.winRate !== undefined
                    ? (d.winRate * 100).toFixed(1) + '%'
                    : '0.0%';
                var row = el('tr', null, [
                    el('td', { textContent: String(i + 1) }),
                    el('td', { textContent: d.name || d.username || '' }),
                    el('td', { textContent: String(d.wins || 0) }),
                    el('td', { textContent: String(d.losses || 0) }),
                    el('td', { textContent: winRate })
                ]);
                tbody.appendChild(row);
            }
        } else {
            var emptyRow = el('tr', null, [
                el('td', { colspan: '5', style: 'color:#666;padding:12px;', textContent: 'No data yet' })
            ]);
            tbody.appendChild(emptyRow);
        }
        table.appendChild(tbody);
        leaderboardEl.appendChild(table);
    }

    // --- UPDATE MATCH HISTORY ---
    // Shows a table of past games with dates, players, scores, and winner
    function updateMatchHistory(matches) {
        if (!matchHistoryEl) return;
        matchHistoryEl.innerHTML = '';

        var table = el('table', { className: 'history-table' });
        var thead = el('thead', null, [
            el('tr', null, [
                el('th', { textContent: 'Date' }),
                el('th', { textContent: 'Player 1' }),
                el('th', { textContent: 'Player 2' }),
                el('th', { textContent: 'Score' }),
                el('th', { textContent: 'Winner' })
            ])
        ]);
        table.appendChild(thead);

        var tbody = el('tbody');
        if (matches && matches.length > 0) {
            for (var i = 0; i < matches.length; i++) {
                var m = matches[i];
                // Format the date into something readable
                var dateStr = '';
                if (m.date) {
                    var d = new Date(m.date);
                    dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                var scoreStr = m.scores ? m.scores[0] + '-' + m.scores[1] : '';
                var row = el('tr', null, [
                    el('td', { textContent: dateStr }),
                    el('td', { textContent: m.player1 || '' }),
                    el('td', { textContent: m.player2 || '' }),
                    el('td', { textContent: scoreStr }),
                    el('td', { textContent: m.winner || '' })
                ]);
                tbody.appendChild(row);
            }
        } else {
            var emptyRow = el('tr', null, [
                el('td', { colspan: '5', style: 'color:#666;padding:12px;', textContent: 'No matches yet' })
            ]);
            tbody.appendChild(emptyRow);
        }
        table.appendChild(tbody);
        matchHistoryEl.appendChild(table);
    }

    // --- CHALLENGE MODAL (pop-up window) ---
    // When someone challenges you, this pop-up appears with Accept/Decline buttons.
    // A "modal" is a pop-up that blocks everything behind it until you respond --
    // like when a friend asks "wanna play?" and stands there waiting for your answer.
    // You HAVE to say yes or no before you can do anything else!
    function showChallengeModal(fromUsername, onAccept, onDecline) {
        // Remove any existing modal first
        hideChallengeModal();

        modalOverlay = el('div', { className: 'lobby-modal-overlay' }, [
            el('div', { className: 'lobby-modal' }, [
                el('h2', { textContent: 'Challenge!' }),
                el('p', { textContent: fromUsername + ' challenged you to a duel!' }),
                el('div', { className: 'modal-btns' }, [
                    el('button', {
                        className: 'lobby-btn primary',
                        textContent: 'Accept',
                        onClick: function () {
                            hideChallengeModal();
                            if (onAccept) onAccept();
                        }
                    }),
                    el('button', {
                        className: 'lobby-btn danger',
                        textContent: 'Decline',
                        onClick: function () {
                            hideChallengeModal();
                            if (onDecline) onDecline();
                        }
                    })
                ])
            ])
        ]);

        document.body.appendChild(modalOverlay);
    }

    // --- "CHALLENGING..." MODAL ---
    // Shows while waiting for the other player to accept or decline.
    // This is what YOU see after you challenge someone -- a "please
    // wait" screen with a Cancel button in case you change your mind.
    function showChallengingModal(toUsername, onCancel) {
        hideChallengeModal();

        modalOverlay = el('div', { className: 'lobby-modal-overlay' }, [
            el('div', { className: 'lobby-modal' }, [
                el('h2', { textContent: 'Challenging...' }),
                el('p', { textContent: 'Challenging ' + toUsername + '... waiting for response' }),
                el('div', { className: 'modal-btns' }, [
                    el('button', {
                        className: 'lobby-btn danger',
                        textContent: 'Cancel',
                        onClick: function () {
                            hideChallengeModal();
                            if (onCancel) onCancel();
                        }
                    })
                ])
            ])
        ]);

        document.body.appendChild(modalOverlay);
    }

    // Remove any visible challenge modal
    function hideChallengeModal() {
        if (modalOverlay) {
            modalOverlay.remove();
            modalOverlay = null;
        }
    }

    // --- TOAST NOTIFICATION ---
    // A "toast" is a small message that pops up at the bottom of the screen
    // for a few seconds and then disappears -- like toast popping up from a toaster!
    // Used for quick messages like "Challenge declined" or "Player left."
    // The "type" can be 'success' (green), 'error' (red), or 'info' (blue).
    function showNotification(message, type) {
        var existing = document.querySelector('.lobby-toast');
        if (existing) existing.remove();
        if (notificationTimeout) clearTimeout(notificationTimeout);

        type = type || 'info';
        var toast = el('div', { className: 'lobby-toast ' + type, textContent: message });
        document.body.appendChild(toast);

        // Wait one animation frame, then fade in (CSS transition handles the animation)
        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        // After 3 seconds, fade out and remove
        notificationTimeout = setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 3000);
    }

    // --- PUBLIC INTERFACE ---
    // This is the "menu" of things other files can use from LobbyUI.
    // Anything NOT listed here is private -- hidden inside this file.
    return {
        show: show,
        hide: hide,
        init: init,
        updatePlayerList: updatePlayerList,
        updateActiveGames: updateActiveGames,
        updateLeaderboard: updateLeaderboard,
        updateMatchHistory: updateMatchHistory,
        showChallengeModal: showChallengeModal,
        showChallengingModal: showChallengingModal,
        hideChallengeModal: hideChallengeModal,
        showNotification: showNotification
    };

})();
