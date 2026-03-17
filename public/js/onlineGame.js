// OnlineGame — client-side online game renderer and input handler
// Depends on globals: Renderer, AudioManager, Network
// Depends on constants: CANVAS_W, CANVAS_H, BALL_SIZE, BALL_SPEED_INIT,
//   BALL_SPEED_MAX, PADDLE_W, PADDLE_H, EXPLOSION_DURATION, COUNTDOWN_DURATION,
//   SLOW_COOLDOWN, SLOW_DURATION, WIN_SCORE, TRAIL_MAX

var OnlineGame = (function () {

    var GAME_OVER_FADE_DURATION = 2000;

    // --- State ---
    var canvas = null;
    var ctx = null;
    var active = false;
    var gameState = null;
    var stars = null;
    var bgEnabled = true;
    var playerNumber = 0;
    var localInput = { up: false, down: false, slow: false };
    var lastInputSent = null;
    var gameOverPhase = 0; // 0=not over, 1="Game Over!" fading, 2=show result
    var gameOverStart = 0;
    var winner = null;
    var animFrameId = null;
    var trail = [];
    var explosionParticles = [];
    var exploding = false;
    var explosionStart = 0;
    var onReturnToLobbyCallback = null;

    // Bound event handlers (so we can remove them)
    var boundKeyDown = null;
    var boundKeyUp = null;

    // --- Methods ---

    /**
     * Initialize with a canvas element.
     * @param {HTMLCanvasElement} canvasEl
     */
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        stars = Renderer.generateStars(150);
    }

    /**
     * Start the online game as a given player number.
     * @param {number} pNum - 1 or 2
     */
    function start(pNum) {
        active = true;
        playerNumber = pNum;
        gameState = null;
        gameOverPhase = 0;
        gameOverStart = 0;
        winner = null;
        trail = [];
        explosionParticles = [];
        exploding = false;
        explosionStart = 0;
        localInput = { up: false, down: false, slow: false };
        lastInputSent = null;

        // Set up keyboard listeners
        boundKeyDown = handleKeyDown.bind(null);
        boundKeyUp = handleKeyUp.bind(null);
        window.addEventListener('keydown', boundKeyDown);
        window.addEventListener('keyup', boundKeyUp);

        // Set up Network callbacks
        Network.onGameState(onGameState);
        Network.onSoundTrigger(onSoundTrigger);
        Network.onGameEnd(onGameEnd);
        Network.onOpponentDisconnected(onOpponentDisconnected);

        // Start render loop
        animFrameId = requestAnimationFrame(render);
    }

    /**
     * Stop the online game, clean up listeners.
     */
    function stop() {
        active = false;

        if (animFrameId !== null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        if (boundKeyDown) {
            window.removeEventListener('keydown', boundKeyDown);
            boundKeyDown = null;
        }
        if (boundKeyUp) {
            window.removeEventListener('keyup', boundKeyUp);
            boundKeyUp = null;
        }

        // Clear Network callbacks
        Network.onGameState(null);
        Network.onSoundTrigger(null);
        Network.onGameEnd(null);
        Network.onOpponentDisconnected(null);
    }

    /**
     * Handle keydown events.
     * W/S or ArrowUp/ArrowDown for movement, Shift for slow, Enter for ready.
     */
    function handleKeyDown(e) {
        if (!active) return;

        var key = e.key;

        // SPACE to return to lobby when game is over
        if (key === ' ' && gameOverPhase === 2) {
            e.preventDefault();
            if (onReturnToLobbyCallback) {
                onReturnToLobbyCallback();
            }
            return;
        }

        // Enter to signal ready
        if (key === 'Enter') {
            e.preventDefault();
            Network.sendReady();
            return;
        }

        // Movement and slow — always W/S regardless of player number
        var changed = false;
        if (key === 'w' || key === 'W' || key === 'ArrowUp') {
            e.preventDefault();
            if (!localInput.up) {
                localInput.up = true;
                changed = true;
            }
        }
        if (key === 's' || key === 'S' || key === 'ArrowDown') {
            e.preventDefault();
            if (!localInput.down) {
                localInput.down = true;
                changed = true;
            }
        }
        if (key === 'Shift') {
            if (!localInput.slow) {
                localInput.slow = true;
                changed = true;
            }
        }

        if (changed) {
            sendInputIfChanged();
        }
    }

    /**
     * Handle keyup events.
     */
    function handleKeyUp(e) {
        if (!active) return;

        var key = e.key;
        var changed = false;

        if (key === 'w' || key === 'W' || key === 'ArrowUp') {
            if (localInput.up) {
                localInput.up = false;
                changed = true;
            }
        }
        if (key === 's' || key === 'S' || key === 'ArrowDown') {
            if (localInput.down) {
                localInput.down = false;
                changed = true;
            }
        }
        if (key === 'Shift') {
            if (localInput.slow) {
                localInput.slow = false;
                changed = true;
            }
        }

        if (changed) {
            sendInputIfChanged();
        }
    }

    /**
     * Only send input if it has changed from the last sent state.
     */
    function sendInputIfChanged() {
        var current = localInput.up + ',' + localInput.down + ',' + localInput.slow;
        if (current !== lastInputSent) {
            lastInputSent = current;
            Network.sendInput({
                up: localInput.up,
                down: localInput.down,
                slow: localInput.slow
            });
        }
    }

    /**
     * Called when a new game state is received from the server.
     * @param {object} state
     */
    function onGameState(state) {
        gameState = state;

        // Build trail from state data if provided
        if (state && state.trail) {
            trail = state.trail;
        } else if (state && state.ball) {
            // If server doesn't send trail, maintain locally
            trail.push({ x: state.ball.x, y: state.ball.y });
            if (trail.length > TRAIL_MAX) {
                trail.shift();
            }
        }
    }

    /**
     * Called when the server triggers a sound.
     * @param {object} data - { sound: string, x?: number, y?: number }
     */
    function onSoundTrigger(data) {
        if (!data || !data.sound) return;

        switch (data.sound) {
            case 'laser':
                AudioManager.playLaserSound();
                break;
            case 'explosion':
                AudioManager.playGameOverSound();
                startLocalExplosion(data.x || CANVAS_W / 2, data.y || CANVAS_H / 2);
                break;
            case 'gameOver':
                AudioManager.playGameOverSound();
                break;
            case 'victory':
                AudioManager.playVictorySound();
                break;
            case 'sad':
                AudioManager.playSadSound();
                break;
        }
    }

    /**
     * Start a local explosion particle effect at (x, y).
     */
    function startLocalExplosion(x, y) {
        exploding = true;
        explosionStart = Date.now();
        explosionParticles = [];
        for (var i = 0; i < 40; i++) {
            var angle = Math.random() * Math.PI * 2;
            var speed = Math.random() * 4 + 1;
            explosionParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: Math.random() * 4 + 2,
                color: ['#ff4400', '#ff8800', '#ffcc00', '#fff'][Math.floor(Math.random() * 4)]
            });
        }
    }

    /**
     * Called when the server signals the game has ended.
     * @param {object} data - { winner: number|string, ... }
     */
    function onGameEnd(data) {
        gameOverPhase = 1;
        gameOverStart = Date.now();
        winner = data ? data.winner : null;
    }

    /**
     * Called when the opponent disconnects mid-game.
     * @param {object} data
     */
    function onOpponentDisconnected(data) {
        gameOverPhase = 2;
        winner = playerNumber; // local player wins by default
    }

    /**
     * Main render loop.
     */
    function render() {
        if (!active) return;

        var W = CANVAS_W;
        var H = CANVAS_H;

        // 1. Background
        Renderer.drawBackground(ctx, W, H, stars, bgEnabled);

        // 2. Center line
        Renderer.drawCenterLine(ctx, W, H);

        // If we have game state, draw the game
        if (gameState) {
            var gs = gameState;

            // 3. Draw player usernames above paddles
            if (gs.p1Name || gs.p2Name) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Courier New';
                ctx.textAlign = 'center';
                if (gs.p1Name && gs.paddle1) {
                    ctx.fillText(gs.p1Name, gs.paddle1.x + PADDLE_W / 2, gs.paddle1.y - 8);
                }
                if (gs.p2Name && gs.paddle2) {
                    ctx.fillText(gs.p2Name, gs.paddle2.x + PADDLE_W / 2, gs.paddle2.y - 8);
                }
            }

            // 4. Draw paddles
            if (gs.paddle1) {
                Renderer.drawPaddle(ctx, gs.paddle1, gs.p1Color || '#fff');
            }
            if (gs.paddle2) {
                Renderer.drawPaddle(ctx, gs.paddle2, gs.p2Color || '#fff');
            }

            // 5. Draw trail and ball
            if (gs.ball) {
                var bvx = gs.ball.vx || 0;
                var bvy = gs.ball.vy || 0;
                var ballSpeed = Math.sqrt(bvx * bvx + bvy * bvy);

                Renderer.drawTrail(ctx, trail, ballSpeed);
                Renderer.drawBall(ctx, gs.ball, ballSpeed);
            }

            // 6. Draw explosion if active
            if (exploding) {
                var explosionElapsed = Date.now() - explosionStart;
                // Update particle positions
                for (var i = 0; i < explosionParticles.length; i++) {
                    explosionParticles[i].x += explosionParticles[i].vx;
                    explosionParticles[i].y += explosionParticles[i].vy;
                    explosionParticles[i].r *= 0.97;
                }
                if (explosionElapsed >= EXPLOSION_DURATION) {
                    exploding = false;
                } else {
                    Renderer.drawExplosion(ctx, explosionParticles, explosionElapsed);
                }
            }

            // 7. Draw scores
            if (gs.scores) {
                ctx.fillStyle = '#fff';
                ctx.font = '48px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText(String(gs.scores[0]), W / 4, 50);
                ctx.fillText(String(gs.scores[1]), (W / 4) * 3, 50);
            }

            // 8. Slow ability timer display
            drawSlowTimers(gs);

            // 9. Waiting phase overlay
            if (gs.phase === 'waiting') {
                Renderer.drawOverlay(ctx, W, H, 'Waiting for players...', 'Press ENTER when ready');
            }

            // 10. Countdown phase
            if (gs.phase === 'countdown' && gs.countdownStart) {
                var countdownElapsed = Date.now() - gs.countdownStart;
                var remaining = Math.ceil((COUNTDOWN_DURATION - countdownElapsed) / 1000);
                if (remaining > 0) {
                    Renderer.drawCountdown(ctx, W, H, remaining);
                }
            }
        } else {
            // No game state yet — show waiting
            Renderer.drawOverlay(ctx, W, H, 'Connecting...', 'Waiting for game state');
        }

        // 11. Game over phase 1: "Game Over!" fading
        if (gameOverPhase === 1) {
            var fadeElapsed = Date.now() - gameOverStart;
            var alpha = 1 - fadeElapsed / GAME_OVER_FADE_DURATION;
            if (alpha <= 0) {
                gameOverPhase = 2;
                // Play victory or sad sound based on winner
                if (winner === playerNumber) {
                    AudioManager.playVictorySound();
                } else {
                    AudioManager.playSadSound();
                }
            } else {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = '#fff';
                ctx.font = '60px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('Game Over!', W / 2, H / 2);
                ctx.restore();
            }
        }

        // 12. Game over phase 2: show result
        if (gameOverPhase === 2) {
            ctx.fillStyle = '#fff';
            ctx.font = '48px Courier New';
            ctx.textAlign = 'center';
            if (winner === playerNumber) {
                ctx.fillText('YOU WON!', W / 2, H / 2 - 20);
            } else if (winner !== null) {
                ctx.fillText('You Lose', W / 2, H / 2 - 20);
            } else {
                ctx.fillText('Game Over', W / 2, H / 2 - 20);
            }
            ctx.font = '20px Courier New';
            ctx.fillText('Press SPACE to return to lobby', W / 2, H / 2 + 30);
        }

        // 13. Continue loop
        animFrameId = requestAnimationFrame(render);
    }

    /**
     * Draw slow ability timer indicators for both players.
     * Shows countdown, "READY", or "SLOWED" text near canvas edges.
     * @param {object} gs - current game state
     */
    function drawSlowTimers(gs) {
        if (!gs || gameOverPhase > 0) return;
        if (gs.phase !== 'playing') return;

        var W = CANVAS_W;
        var H = CANVAS_H;
        var now = Date.now();

        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';

        // Player 1 slow timer (left side)
        if (gs.p1Slow !== undefined) {
            var p1Text = '';
            var p1Color = '#888';
            if (gs.p1Slow === 'slowed') {
                p1Text = 'SLOWED';
                p1Color = '#ff6666';
            } else if (gs.p1Slow === 'ready') {
                p1Text = 'READY';
                p1Color = '#00ff00';
            } else if (typeof gs.p1Slow === 'number' && gs.p1Slow > 0) {
                p1Text = Math.ceil(gs.p1Slow / 1000) + 's';
                p1Color = '#888';
            }
            if (p1Text) {
                ctx.fillStyle = p1Color;
                ctx.fillText(p1Text, W / 4, H - 20);
            }
        }

        // Player 2 slow timer (right side)
        if (gs.p2Slow !== undefined) {
            var p2Text = '';
            var p2Color = '#888';
            if (gs.p2Slow === 'slowed') {
                p2Text = 'SLOWED';
                p2Color = '#ff6666';
            } else if (gs.p2Slow === 'ready') {
                p2Text = 'READY';
                p2Color = '#00ff00';
            } else if (typeof gs.p2Slow === 'number' && gs.p2Slow > 0) {
                p2Text = Math.ceil(gs.p2Slow / 1000) + 's';
                p2Color = '#888';
            }
            if (p2Text) {
                ctx.fillStyle = p2Color;
                ctx.fillText(p2Text, (W / 4) * 3, H - 20);
            }
        }
    }

    /**
     * Set the callback for when the player wants to return to the lobby.
     * @param {function} callback
     */
    function setOnReturnToLobby(callback) {
        onReturnToLobbyCallback = callback;
    }

    // --- Public API ---
    return {
        init: init,
        start: start,
        stop: stop,
        setOnReturnToLobby: setOnReturnToLobby,
        get active() { return active; },
        get gameOverPhase() { return gameOverPhase; },
        set bgEnabled(val) { bgEnabled = val; }
    };

})();
