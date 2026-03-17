// LobbyUI — manages the online lobby screen DOM
// Depends on Network global for username/socketId context

var LobbyUI = (function () {

    var container = null;
    var playerListEl = null;
    var activeGamesEl = null;
    var leaderboardEl = null;
    var matchHistoryEl = null;
    var modalOverlay = null;
    var notificationTimeout = null;

    var onChallengeCallback = null;
    var onSpectateCallback = null;

    // --- Style injection ---

    function injectStyles() {
        if (document.getElementById('lobby-styles')) return;

        var style = document.createElement('style');
        style.id = 'lobby-styles';
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

    // --- DOM creation helpers ---

    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        if (attrs) {
            for (var key in attrs) {
                if (key === 'className') {
                    node.className = attrs[key];
                } else if (key === 'textContent') {
                    node.textContent = attrs[key];
                } else if (key.indexOf('on') === 0) {
                    node.addEventListener(key.slice(2).toLowerCase(), attrs[key]);
                } else {
                    node.setAttribute(key, attrs[key]);
                }
            }
        }
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

    // --- Public methods ---

    /**
     * Show the lobby screen.
     */
    function show() {
        if (container) container.classList.add('visible');
    }

    /**
     * Hide the lobby screen.
     */
    function hide() {
        if (container) container.classList.remove('visible');
    }

    /**
     * Initialize the lobby DOM structure.
     * @param {function} onChallenge - called with socketId when a player is challenged
     * @param {function} onSpectate - called with gameId when user wants to spectate
     * @param {function} onLeaveOnline - called when user clicks "Leave"
     */
    function init(onChallenge, onSpectate, onLeaveOnline) {
        injectStyles();

        onChallengeCallback = onChallenge;
        onSpectateCallback = onSpectate;

        // Remove existing lobby if re-initialized
        var existing = document.getElementById('lobby-screen');
        if (existing) existing.remove();

        // Main container
        container = el('div', { id: 'lobby-screen' });

        // --- Header ---
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

        // --- Three-column layout ---
        var columns = el('div', { className: 'lobby-columns' });

        // Left panel: Players
        playerListEl = el('div', { className: 'lobby-panel-body' });
        var leftPanel = el('div', { className: 'lobby-panel' }, [
            el('div', { className: 'lobby-panel-header' }, 'Players'),
            playerListEl
        ]);

        // Center panel: Active Games
        activeGamesEl = el('div', { className: 'lobby-panel-body' });
        var centerPanel = el('div', { className: 'lobby-panel' }, [
            el('div', { className: 'lobby-panel-header' }, 'Active Games'),
            activeGamesEl
        ]);

        // Right panel: Leaderboard
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

        // --- Bottom section: Match History ---
        matchHistoryEl = el('div', { className: 'lobby-panel-body' });
        var bottomSection = el('div', { className: 'lobby-bottom' }, [
            el('div', { className: 'lobby-panel-header' }, 'Match History'),
            matchHistoryEl
        ]);
        container.appendChild(bottomSection);

        document.body.appendChild(container);
    }

    /**
     * Re-render the player list.
     * @param {Array} players - array of { username, status, socketId }
     */
    function updatePlayerList(players) {
        if (!playerListEl) return;
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
            var statusClass = 'status-idle';
            if (p.status === 'in-game') statusClass = 'status-in-game';
            else if (p.status === 'spectating') statusClass = 'status-spectating';

            var badge = el('span', { className: 'status-badge ' + statusClass });
            var name = el('span', { className: 'player-name' }, p.username);

            var item = el('div', { className: 'player-item' }, [badge, name]);

            // Add challenge button for idle players that are not yourself
            if (p.status === 'idle' && p.socketId !== (Network.socket && Network.socket.id)) {
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

    /**
     * Re-render the active games list.
     * @param {Array} games - array of { id, player1, player2, scores }
     */
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

    /**
     * Re-render the leaderboard table.
     * @param {Array} data - array of leaderboard entries
     */
    function updateLeaderboard(data) {
        if (!leaderboardEl) return;
        leaderboardEl.innerHTML = '';

        var table = el('table', { className: 'leaderboard-table' });
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

        var tbody = el('tbody');
        if (data && data.length > 0) {
            for (var i = 0; i < data.length; i++) {
                var d = data[i];
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

    /**
     * Re-render the match history table.
     * @param {Array} matches - array of match objects
     */
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

    /**
     * Show a modal when someone challenges you.
     * @param {string} fromUsername - challenger's name
     * @param {function} onAccept - called when Accept is clicked
     * @param {function} onDecline - called when Decline is clicked
     */
    function showChallengeModal(fromUsername, onAccept, onDecline) {
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

    /**
     * Show a modal while waiting for challenge response.
     * @param {string} toUsername - name of the player being challenged
     * @param {function} onCancel - called when Cancel is clicked
     */
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

    /**
     * Remove any visible challenge modal.
     */
    function hideChallengeModal() {
        if (modalOverlay) {
            modalOverlay.remove();
            modalOverlay = null;
        }
    }

    /**
     * Show a brief toast notification.
     * @param {string} message - text to display
     * @param {string} type - 'success', 'error', or 'info'
     */
    function showNotification(message, type) {
        // Remove any existing toast
        var existing = document.querySelector('.lobby-toast');
        if (existing) existing.remove();
        if (notificationTimeout) clearTimeout(notificationTimeout);

        type = type || 'info';
        var toast = el('div', { className: 'lobby-toast ' + type, textContent: message });
        document.body.appendChild(toast);

        // Trigger show after a frame for the CSS transition
        requestAnimationFrame(function () {
            toast.classList.add('show');
        });

        notificationTimeout = setTimeout(function () {
            toast.classList.remove('show');
            setTimeout(function () {
                if (toast.parentNode) toast.remove();
            }, 300);
        }, 3000);
    }

    // --- Expose public interface ---

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
