// ============================================================================
// ONLINE GAME (onlineGame.js)
// ============================================================================
// This file is for playing pong ONLINE against someone on a different computer!
//
// HOW THIS IS DIFFERENT FROM LOCAL GAME:
// In localGame.js, YOUR computer is the boss — it moves the ball, checks
// collisions, and keeps score all by itself.
//
// But in online mode, a SERVER (a computer on the internet) is the boss.
// The server moves the ball, checks collisions, and keeps score.
// This file just does two things:
//   1. SENDS your key presses to the server ("I'm pressing UP!")
//   2. RECEIVES the game state from the server ("the ball is at x=200, y=150")
//      and DRAWS it on your screen.
//
// Think of it like a TV remote: you press buttons (input), and the TV
// (server) decides what to show. This file is the remote + the screen.
// ============================================================================

// OnlineGame — client-side online game renderer and input handler
// Depends on globals: Renderer, AudioManager, Network
// Depends on constants: CANVAS_W, CANVAS_H, BALL_SIZE, BALL_SPEED_INIT,
//   BALL_SPEED_MAX, PADDLE_W, PADDLE_H, EXPLOSION_DURATION, COUNTDOWN_DURATION,
//   SLOW_COOLDOWN, SLOW_DURATION, WIN_SCORE, TRAIL_MAX

var OnlineGame = (function () {

    var GAME_OVER_FADE_DURATION = 2000;

    // --- State variables ---
    // These track everything we need to show the game on screen.
    var canvas = null;
    var ctx = null;
    var active = false;
    var gameState = null;      // The latest info the server sent us
    var stars = null;
    var bgEnabled = true;
    var playerNumber = 0;      // Are we Player 1 or Player 2?
    var localInput = { up: false, down: false, slow: false }; // What keys we're pressing
    var lastInputSent = null;  // Avoid sending the same input twice
    var gameOverPhase = 0;     // 0=not over, 1="Game Over!" fading, 2=show result
    var gameOverStart = 0;
    var winner = null;
    var animFrameId = null;
    var trail = [];
    var explosionParticles = [];
    var exploding = false;
    var explosionStart = 0;
    var onReturnToLobbyCallback = null;

    // Interpolation: the server sends updates ~20 times per second, but our
    // screen refreshes ~60 times per second. To make things look smooth, we
    // blend between the last two server updates. This is called "interpolation."
    var snapshots = [];        // Stores recent server updates with timestamps
    var LERP_DELAY = 80;      // We draw 80ms behind the server for smoothness

    // Own paddle: when you press a key, we move your paddle right away
    // (so it feels instant) but gently nudge it toward where the server
    // says it should be. This trick is called "client-side prediction."
    var localPaddleY = CANVAS_H / 2 - PADDLE_H / 2;
    var serverPaddleY = CANVAS_H / 2 - PADDLE_H / 2;

    // Touch state
    var touchTargetY = null;  // null when not touching, canvas-Y when touching
    var touchInputInterval = null;

    // Bound event handlers (so we can remove them)
    var boundKeyDown = null;
    var boundKeyUp = null;

    // --- Init / Start / Stop ---
    // init() — set up the canvas once when the page loads.
    // start() — join an online game (hooks up keyboard, touch, and server messages).
    // stop() — leave the game and clean everything up.

    /**
     * Initialize with a canvas element.
     * @param {HTMLCanvasElement} canvasEl
     */
    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        stars = Renderer.generateStars(150);
    }

    // --- Touch controls (for phones and tablets) ---
    // Same idea as local game — drag your finger to move your paddle.
    // But instead of moving the paddle directly, we figure out if you
    // want to go up or down and SEND that to the server.

    function touchToCanvasOnline(touch) {
        var rect = canvas.getBoundingClientRect();
        var scaleY = canvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * (canvas.width / rect.width),
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    function resumeAudioOnTouch() {
        if (typeof AudioManager !== 'undefined' && AudioManager.audioCtx && AudioManager.audioCtx.state === 'suspended') {
            AudioManager.audioCtx.resume();
        }
    }

    function onOnlineCanvasTouchStart(e) {
        if (!active) return;
        e.preventDefault();
        resumeAudioOnTouch();
        var touch = e.changedTouches[0];
        var pos = touchToCanvasOnline(touch);
        // Check if tapping the on-canvas ENTER button
        if (needsEnterButton() && isInsideRect(pos.x, pos.y, ENTER_BTN)) {
            if (gameState && gameState.phase === 'waiting') {
                Network.sendReady();
            } else if (gameOverPhase === 2 && onReturnToLobbyCallback) {
                onReturnToLobbyCallback();
            }
            return;
        }
        if (playerNumber === 0) return;
        // Check if tapping the local player's slow button
        var localBtn = getLocalSlowBtn();
        if (isInsideRect(pos.x, pos.y, localBtn)) {
            if (!localInput.slow) {
                localInput.slow = true;
                sendInputIfChanged();
                // Auto-release slow after a brief moment (it's a tap activation)
                setTimeout(function () {
                    localInput.slow = false;
                    sendInputIfChanged();
                }, 100);
            }
            return;
        }
        touchTargetY = pos.y - PADDLE_H / 2;
    }

    function onOnlineCanvasTouchMove(e) {
        if (!active || playerNumber === 0) return;
        e.preventDefault();
        var touch = e.changedTouches[0];
        var pos = touchToCanvasOnline(touch);
        touchTargetY = pos.y - PADDLE_H / 2;
    }

    function onOnlineCanvasTouchEnd(e) {
        if (!active) return;
        e.preventDefault();
        touchTargetY = null;
        localInput.up = false;
        localInput.down = false;
        sendInputIfChanged();
    }

    function updateTouchInput() {
        if (touchTargetY === null || !active || playerNumber === 0) return;
        // Compare touch target to our current local predicted paddle position
        var currentY = localPaddleY;
        var threshold = 2; // dead zone in canvas pixels
        var wantUp = false;
        var wantDown = false;

        if (touchTargetY < currentY - threshold) {
            wantUp = true;
        } else if (touchTargetY > currentY + threshold) {
            wantDown = true;
        }

        var changed = false;
        if (localInput.up !== wantUp) { localInput.up = wantUp; changed = true; }
        if (localInput.down !== wantDown) { localInput.down = wantDown; changed = true; }
        if (changed) sendInputIfChanged();
    }

    function onOnlineTouchEnterBtn(e) {
        e.preventDefault();
        resumeAudioOnTouch();
        if (gameState && gameState.phase === 'waiting') {
            Network.sendReady();
            return;
        }
        if (gameOverPhase === 2) {
            if (onReturnToLobbyCallback) onReturnToLobbyCallback();
            return;
        }
    }

    // Slow button bounds for online game (both players)
    var SLOW_BTN_P1 = { x: 10, y: CANVAS_H - 45, w: 80, h: 35 };
    var SLOW_BTN_P2 = { x: CANVAS_W - 90, y: CANVAS_H - 45, w: 80, h: 35 };
    var ENTER_BTN = { x: CANVAS_W / 2 - 80, y: CANVAS_H / 2 + 80, w: 160, h: 50 };
    var isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    function drawCanvasButton(btn, label) {
        var r = 10;
        ctx.beginPath();
        ctx.moveTo(btn.x + r, btn.y);
        ctx.lineTo(btn.x + btn.w - r, btn.y);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + r);
        ctx.lineTo(btn.x + btn.w, btn.y + btn.h - r);
        ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - r, btn.y + btn.h);
        ctx.lineTo(btn.x + r, btn.y + btn.h);
        ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - r);
        ctx.lineTo(btn.x, btn.y + r);
        ctx.quadraticCurveTo(btn.x, btn.y, btn.x + r, btn.y);
        ctx.closePath();
        ctx.fillStyle = '#2a5';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '22px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2 + 8);
    }

    var touchActionBtn = null;
    var boundTouchAction = null;

    function needsEnterButton() {
        if (!isTouchDevice || !active) return false;
        if (gameState && gameState.phase === 'waiting') return true;
        if (gameOverPhase === 2) return true;
        return false;
    }

    function updateTouchActionButton() {
        if (!touchActionBtn || !isTouchDevice) return;
        // Show when: waiting for ready, no gameState yet (still connecting), or game over
        var show = false;
        if (active && gameOverPhase === 2) {
            touchActionBtn.textContent = 'LOBBY';
            show = true;
        } else if (active && (!gameState || (gameState && gameState.phase === 'waiting'))) {
            touchActionBtn.textContent = 'READY';
            show = true;
        }
        touchActionBtn.style.display = show ? 'block' : 'none';
    }

    function onTouchActionClick() {
        if (typeof AudioManager !== 'undefined' && AudioManager.audioCtx && AudioManager.audioCtx.state === 'suspended') {
            AudioManager.audioCtx.resume();
        }
        if (gameState && gameState.phase === 'waiting') {
            Network.sendReady();
        } else if (gameOverPhase === 2 && onReturnToLobbyCallback) {
            onReturnToLobbyCallback();
        }
    }

    function getLocalSlowBtn() {
        return playerNumber === 1 ? SLOW_BTN_P1 : SLOW_BTN_P2;
    }

    function isInsideRect(cx, cy, r) {
        return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
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
        localPaddleY = CANVAS_H / 2 - PADDLE_H / 2;
        serverPaddleY = CANVAS_H / 2 - PADDLE_H / 2;
        snapshots = [];

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

        // Set up touch listeners
        touchTargetY = null;
        canvas.addEventListener('touchstart', onOnlineCanvasTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onOnlineCanvasTouchMove, { passive: false });
        canvas.addEventListener('touchend', onOnlineCanvasTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onOnlineCanvasTouchEnd, { passive: false });

        // Poll touch target vs paddle position at ~60Hz to send appropriate up/down inputs
        touchInputInterval = setInterval(updateTouchInput, 16);

        var touchEnterBtn = document.getElementById('touch-enter');
        if (touchEnterBtn) touchEnterBtn.addEventListener('touchstart', onOnlineTouchEnterBtn, { passive: false });

        // Set up floating touch action button
        touchActionBtn = document.getElementById('online-touch-action');
        if (touchActionBtn && isTouchDevice) {
            boundTouchAction = function () { onTouchActionClick(); };
            touchActionBtn.addEventListener('click', boundTouchAction);
            updateTouchActionButton();
        }

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

        // Remove touch listeners
        if (canvas) {
            canvas.removeEventListener('touchstart', onOnlineCanvasTouchStart);
            canvas.removeEventListener('touchmove', onOnlineCanvasTouchMove);
            canvas.removeEventListener('touchend', onOnlineCanvasTouchEnd);
            canvas.removeEventListener('touchcancel', onOnlineCanvasTouchEnd);
        }
        touchTargetY = null;
        if (touchInputInterval !== null) {
            clearInterval(touchInputInterval);
            touchInputInterval = null;
        }

        var touchEnterBtn = document.getElementById('touch-enter');
        if (touchEnterBtn) touchEnterBtn.removeEventListener('touchstart', onOnlineTouchEnterBtn);

        // Hide and clean up floating touch action button
        if (touchActionBtn) {
            touchActionBtn.style.display = 'none';
            if (boundTouchAction) touchActionBtn.removeEventListener('click', boundTouchAction);
            touchActionBtn = null;
            boundTouchAction = null;
        }

        // Clear Network callbacks
        Network.onGameState(null);
        Network.onSoundTrigger(null);
        Network.onGameEnd(null);
        Network.onOpponentDisconnected(null);
    }

    // --- Input handling ---
    // KEY DIFFERENCE from local game: when you press W to go up, we do NOT
    // move the paddle ourselves. Instead we tell the server "up = true" and
    // the server moves the paddle for us. We only send a message when
    // something CHANGES (press or release) to save bandwidth.

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

        // Escape to leave/forfeit the game
        if (key === 'Escape') {
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

    // Only send a message to the server when our input actually changed.
    // (No point saying "I'm pressing up" 60 times a second if we already said it!)
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

    // --- Receiving game state from the server ---
    // About 20 times per second, the server sends us a snapshot of the
    // whole game: where the ball is, where paddles are, scores, etc.
    // We save these snapshots so we can smoothly blend between them.

    /**
     * Called when a new game state is received from the server.
     * @param {object} state
     */
    function onGameState(state) {
        if (!state) return;

        // Store snapshot for interpolation
        snapshots.push({ state: state, time: performance.now() });
        // Keep only the last 30 snapshots (~1.5s at 20Hz)
        if (snapshots.length > 30) snapshots.shift();

        // Always update non-interpolated data from latest state
        gameState = {
            scores: state.scores,
            phase: state.phase,
            p1Color: state.p1Color,
            p2Color: state.p2Color,
            p1Name: state.p1Username,
            p2Name: state.p2Username,
            p1Slow: state.p1Slow,
            p2Slow: state.p2Slow,
            countdownRemaining: state.countdownRemaining,
            roundTimeRemaining: state.roundTimeRemaining,
            winner: state.winner,
            p1Ready: state.p1Ready,
            p2Ready: state.p2Ready,
            startingPlayer: state.startingPlayer
        };

        // Update server paddle Y for our paddle (for smooth correction)
        serverPaddleY = (playerNumber === 1) ? state.p1y : state.p2y;
    }

    /**
     * Interpolate between two snapshots at the given render time.
     * Returns { p1y, p2y, bx, by, bvx, bvy, trail }
     */
    function getInterpolatedPositions() {
        var renderTime = performance.now() - LERP_DELAY;
        var def = {
            p1y: CANVAS_H / 2 - PADDLE_H / 2,
            p2y: CANVAS_H / 2 - PADDLE_H / 2,
            bx: CANVAS_W / 2, by: CANVAS_H / 2,
            bvx: 0, bvy: 0, trail: []
        };
        if (snapshots.length === 0) return def;

        // If we only have one snapshot or render time is past all snapshots, use latest
        if (snapshots.length === 1 || renderTime >= snapshots[snapshots.length - 1].time) {
            var s = snapshots[snapshots.length - 1].state;
            return { p1y: s.p1y, p2y: s.p2y, bx: s.bx, by: s.by, bvx: s.bvx, bvy: s.bvy, trail: s.trail || [] };
        }

        // If render time is before all snapshots, use earliest
        if (renderTime <= snapshots[0].time) {
            var s = snapshots[0].state;
            return { p1y: s.p1y, p2y: s.p2y, bx: s.bx, by: s.by, bvx: s.bvx, bvy: s.bvy, trail: s.trail || [] };
        }

        // Find the two snapshots to interpolate between
        for (var i = 1; i < snapshots.length; i++) {
            if (snapshots[i].time >= renderTime) {
                var a = snapshots[i - 1];
                var b = snapshots[i];
                var t = (renderTime - a.time) / (b.time - a.time);
                return {
                    p1y: a.state.p1y + (b.state.p1y - a.state.p1y) * t,
                    p2y: a.state.p2y + (b.state.p2y - a.state.p2y) * t,
                    bx: a.state.bx + (b.state.bx - a.state.bx) * t,
                    by: a.state.by + (b.state.by - a.state.by) * t,
                    bvx: b.state.bvx,
                    bvy: b.state.bvy,
                    trail: b.state.trail || []
                };
            }
        }
        var last = snapshots[snapshots.length - 1].state;
        return { p1y: last.p1y, p2y: last.p2y, bx: last.bx, by: last.by, bvx: last.bvx, bvy: last.bvy, trail: last.trail || [] };
    }

    // The server tells us when to play sounds (like the laser "pew" when
    // the ball bounces). We can't hear sounds from the server's computer,
    // so it sends a message and we play the sound on OUR computer.
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

    // --- Game over handling ---
    // The server tells us who won. We show a "Game Over!" message that
    // fades out (phase 1), then show "YOU WON!" or "You Lose" (phase 2).

    /**
     * Called when the server signals the game has ended.
     * @param {object} data - { winner: number|string, ... }
     */
    function onGameEnd(data) {
        winner = data ? data.winner : null;
        gameOverPhase = 1;
        gameOverStart = Date.now();
        AudioManager.playGameOverSound();
    }

    /**
     * Called when the opponent disconnects mid-game.
     * @param {object} data
     */
    function onOpponentDisconnected(data) {
        winner = playerNumber; // local player wins by default
        // Play game over sequence
        gameOverPhase = 1;
        gameOverStart = Date.now();
        AudioManager.playGameOverSound();
    }

    // --- The render loop ---
    // Unlike localGame which has update() + draw(), online mode only has
    // this render() function. We don't need update() because the SERVER
    // does all the game logic. We just draw what the server tells us!
    // This still runs ~60 times per second to keep the screen smooth.

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

            // Get interpolated positions from snapshot buffer
            var interp = getInterpolatedPositions();

            // --- Own paddle: predict locally, only correct when idle ---
            if (gs.phase === 'playing' && playerNumber > 0) {
                // Apply local input
                if (localInput.up) localPaddleY -= PADDLE_SPEED;
                if (localInput.down) localPaddleY += PADDLE_SPEED;
                if (localPaddleY < 0) localPaddleY = 0;
                if (localPaddleY > CANVAS_H - PADDLE_H) localPaddleY = CANVAS_H - PADDLE_H;
                // Only correct toward server when NOT actively moving
                if (!localInput.up && !localInput.down) {
                    var diff = serverPaddleY - localPaddleY;
                    localPaddleY += diff * 0.05;
                }
            } else {
                // Not playing — snap to server
                localPaddleY = (playerNumber === 1) ? interp.p1y : interp.p2y;
            }

            // Build display paddles
            var p1x = 20;
            var p2x = CANVAS_W - 20 - PADDLE_W;
            var displayP1y = (playerNumber === 1) ? localPaddleY : interp.p1y;
            var displayP2y = (playerNumber === 2) ? localPaddleY : interp.p2y;
            var displayP1 = { x: p1x, y: displayP1y, w: PADDLE_W, h: PADDLE_H };
            var displayP2 = { x: p2x, y: displayP2y, w: PADDLE_W, h: PADDLE_H };

            var displayBall = { x: interp.bx, y: interp.by };
            var ballSpeed = Math.sqrt(interp.bvx * interp.bvx + interp.bvy * interp.bvy);

            // Build trail from interpolated ball position
            if (gs.phase === 'playing' && ballSpeed > 0) {
                trail.push({ x: interp.bx, y: interp.by });
                if (trail.length > TRAIL_MAX) trail.shift();
            } else if (interp.trail && interp.trail.length > 0) {
                trail = interp.trail;
            }

            // 3. Draw player usernames above paddles
            if (gs.p1Name || gs.p2Name) {
                ctx.fillStyle = '#fff';
                ctx.font = '12px Courier New';
                ctx.textAlign = 'center';
                if (gs.p1Name) {
                    ctx.fillText(gs.p1Name, displayP1.x + PADDLE_W / 2, displayP1.y - 8);
                }
                if (gs.p2Name) {
                    ctx.fillText(gs.p2Name, displayP2.x + PADDLE_W / 2, displayP2.y - 8);
                }
            }

            // 4. Draw paddles
            Renderer.drawPaddle(ctx, displayP1, gs.p1Color || '#fff');
            Renderer.drawPaddle(ctx, displayP2, gs.p2Color || '#fff');

            // 5. Draw trail and ball
            Renderer.drawTrail(ctx, trail, ballSpeed);
            Renderer.drawBall(ctx, displayBall, ballSpeed);

            // 6. Draw explosion if active
            if (exploding) {
                var explosionElapsed = Date.now() - explosionStart;
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
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#fff';
                ctx.font = '36px Courier New';
                ctx.textAlign = 'center';
                ctx.fillText('Press ENTER when ready', W / 2, H / 2 - 40);
                ctx.font = '18px Courier New';
                var p1Status = gs.p1Ready ? 'READY' : 'waiting...';
                var p2Status = gs.p2Ready ? 'READY' : 'waiting...';
                ctx.fillStyle = gs.p1Ready ? '#0f0' : '#888';
                ctx.fillText((gs.p1Name || 'Player 1') + ': ' + p1Status, W / 2, H / 2 + 10);
                ctx.fillStyle = gs.p2Ready ? '#0f0' : '#888';
                ctx.fillText((gs.p2Name || 'Player 2') + ': ' + p2Status, W / 2, H / 2 + 35);
                ctx.fillStyle = '#666';
                ctx.font = '14px Courier New';
                ctx.fillText('ESC to leave', W / 2, H / 2 + 70);
                if (isTouchDevice) {
                    drawCanvasButton(ENTER_BTN, 'READY');
                }
            }

            // 10. Countdown phase (use pre-computed remaining from server)
            if (gs.phase === 'countdown' && gs.countdownRemaining > 0) {
                var remaining = Math.ceil(gs.countdownRemaining / 1000);
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
            if (isTouchDevice) {
                drawCanvasButton(ENTER_BTN, 'LOBBY');
            }
        }

        // 13. Update floating touch button visibility
        updateTouchActionButton();

        // 14. Continue loop
        animFrameId = requestAnimationFrame(render);
    }

    /**
     * Draw slow ability button indicators for both players on canvas.
     * @param {object} gs - current game state
     */
    function drawSlowTimers(gs) {
        if (!gs || gameOverPhase > 0) return;
        if (gs.phase !== 'playing') return;

        function getSlowInfo(slowData) {
            if (!slowData) return null;
            if (slowData.status === 'active') {
                return { color: '#ff8800', text: 'ACTIVE' };
            }
            if (slowData.status === 'ready') {
                return { color: '#4caf50', text: 'SLOW' };
            }
            if (slowData.status === 'cooldown' && slowData.remaining > 0) {
                return { color: '#555', text: Math.ceil(slowData.remaining / 1000) + 's' };
            }
            return null;
        }

        function drawSlowButton(btn, info) {
            if (!info) return;
            var sbr = 8;
            ctx.beginPath();
            ctx.moveTo(btn.x + sbr, btn.y);
            ctx.lineTo(btn.x + btn.w - sbr, btn.y);
            ctx.quadraticCurveTo(btn.x + btn.w, btn.y, btn.x + btn.w, btn.y + sbr);
            ctx.lineTo(btn.x + btn.w, btn.y + btn.h - sbr);
            ctx.quadraticCurveTo(btn.x + btn.w, btn.y + btn.h, btn.x + btn.w - sbr, btn.y + btn.h);
            ctx.lineTo(btn.x + sbr, btn.y + btn.h);
            ctx.quadraticCurveTo(btn.x, btn.y + btn.h, btn.x, btn.y + btn.h - sbr);
            ctx.lineTo(btn.x, btn.y + sbr);
            ctx.quadraticCurveTo(btn.x, btn.y, btn.x + sbr, btn.y);
            ctx.closePath();
            ctx.fillStyle = info.color;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(info.text, btn.x + btn.w / 2, btn.y + btn.h / 2 + 6);
        }

        // Player 1 slow button (bottom-left)
        var p1Info = getSlowInfo(gs.p1Slow);
        drawSlowButton(SLOW_BTN_P1, p1Info);

        // Player 2 slow button (bottom-right)
        var p2Info = getSlowInfo(gs.p2Slow);
        drawSlowButton(SLOW_BTN_P2, p2Info);
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
        onGameState: onGameState,
        onSoundTrigger: onSoundTrigger,
        onGameEnd: onGameEnd,
        get active() { return active; },
        get gameOverPhase() { return gameOverPhase; },
        set bgEnabled(val) { bgEnabled = val; }
    };

})();
