// ============================================================================
// LOCAL GAME (localGame.js)
// ============================================================================
// This file has ALL the code for playing pong on your own computer.
// It handles two modes:
//   1) One player vs the AI (the computer controls the other paddle)
//   2) Two players on the same keyboard (one uses W/S, the other uses arrows)
//
// Everything happens right here — the ball moves, paddles move, scores count,
// and the screen gets drawn — all inside this one file. No server needed!
//
// HOW A GAME LOOP WORKS:
// A game is like a flipbook. Many times per second (about 60!), the computer:
//   1. UPDATES the game — moves the ball, moves paddles, checks for collisions
//   2. DRAWS everything on the screen in its new position
// This happens so fast it looks like smooth motion, just like a cartoon!
// The function "requestAnimationFrame" asks the browser to call our loop
// again right before the next screen refresh.
// ============================================================================

// LocalGame — all local game logic (1P vs AI and 2P local)
// Depends on globals: Renderer, AudioManager, and all constants from constants.js
var LocalGame = (function () {

    // ── Canvas ──────────────────────────────────────────────────────────
    // "canvas" is the rectangle on the web page where we draw the game.
    // "ctx" (context) is the drawing tool we use to paint on the canvas.
    var canvas, ctx;

    // ── State variables ────────────────────────────────────────────────
    // These are like little on/off switches that tell us what the game
    // is doing right now. For example: is the game running? Is it paused?
    // ── Flags ───────────────────────────────────────────────────────────
    var active = false;          // Is this game mode turned on?
    var aiMode = false;          // true = playing vs computer, false = 2 players
    var gameOver = false;        // Has someone won?
    var paused = false;          // Did the player press pause?
    var waitingToStart = true;   // Are we waiting for the player to press Enter?
    var countingDown = false;    // Is the 3-2-1 countdown happening?
    var colorPickerOpen = false; // Is the color-picker menu showing?
    var settingsOpen = false;    // Is the settings menu showing?

    // ── Paddles & ball ──────────────────────────────────────────────────
    // Each paddle has a position (x, y), a size (w = width, h = height),
    // and a score. The ball has a position AND a velocity (vx, vy) which
    // is how fast it moves left/right and up/down each frame.
    var paddle1 = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H, score: 0 };
    var paddle2 = { x: 0, y: 0, w: PADDLE_W, h: PADDLE_H, score: 0 };
    var ball = { x: 0, y: 0, vx: 0, vy: 0 };

    // ── Input ───────────────────────────────────────────────────────────
    // "keys" remembers which keyboard keys are being held down right now.
    var keys = {};
    function clearKeys() { Object.keys(keys).forEach(function (k) { keys[k] = false; }); }

    // ── Trail / stars ───────────────────────────────────────────────────
    // "trail" stores the ball's recent positions so we can draw a cool tail.
    // "stars" are the little dots in the background that look like space.
    var trail = [];
    var stars = [];

    // ── Timers ──────────────────────────────────────────────────────────
    // Timers track when things started so we know how much time has passed.
    var roundStartTime = 0;
    var slowCooldownStart = 0;
    var aiSlowed = false;
    var aiSlowedUntil = 0;
    var playerSlowed = false;
    var playerSlowedUntil = 0;
    var countdownStart = 0;
    var startingPlayer = 0;

    // ── Explosion ───────────────────────────────────────────────────────
    // When someone scores, we show a little firework explosion!
    var exploding = false;
    var explosionParticles = [];
    var explosionStart = 0;
    var explosionCallback = null;

    // ── Game over sequence ──────────────────────────────────────────────
    var gameOverPhase = 0; // 0 = not over, 1 = "Game Over!" fading, 2 = show result
    var gameOverStart = 0;
    var GAME_OVER_FADE_DURATION = 2000;

    // ── Appearance ──────────────────────────────────────────────────────
    var paddle1Color = '#fff';
    var paddle2Color = '#fff';
    var bgEnabled = true;
    var musicEnabled = true;

    // ── Touch state ─────────────────────────────────────────────────────
    // These let people play on phones/tablets by touching the screen.
    var touchP1Id = null;   // touch identifier tracking player 1
    var touchP2Id = null;   // touch identifier tracking player 2
    var touchP1TargetY = null;  // target Y for smooth paddle movement
    var touchP2TargetY = null;
    var boundTouchStart = null;
    var boundTouchMove = null;
    var boundTouchEnd = null;
    var boundTouchEnter = null;
    var boundTouchPause = null;
    var boundTouchReset = null;
    var boundTouchSettings = null;

    // ── Slow button bounds (canvas coords) ────────────────────────────
    var SLOW_BTN = { x: 10, y: CANVAS_H - 45, w: 80, h: 35 };

    // ── Animation ───────────────────────────────────────────────────────
    var animFrameId = null;

    // ── Menu callback ───────────────────────────────────────────────────
    var onReturnToMenu = null;

    // ── DOM element references (cached on first use) ────────────────────
    var score1El, score2El, slowTimerEl, playerSlowTimerEl;
    var colorPickerEl, settingsEl, musicToggle, bgToggle;
    var p1ColorInput, p2ColorInput, p2ColorLabel;

    function cacheDom() {
        score1El = document.getElementById('score1');
        score2El = document.getElementById('score2');
        slowTimerEl = document.getElementById('slow-timer');
        playerSlowTimerEl = document.getElementById('player-slow-timer');
        colorPickerEl = document.getElementById('color-picker');
        settingsEl = document.getElementById('settings');
        musicToggle = document.getElementById('music-toggle');
        bgToggle = document.getElementById('bg-toggle');
        p1ColorInput = document.getElementById('p1-color-input');
        p2ColorInput = document.getElementById('p2-color-input');
        p2ColorLabel = document.getElementById('p2-color-label');
    }

    // ── Utility ─────────────────────────────────────────────────────────
    function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    // ── Init / Start / Stop ────────────────────────────────────────────
    // init() sets things up once at the very beginning.
    // start() begins a new game (called when you pick 1P or 2P mode).
    // stop() shuts everything down when you leave the game.

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        stars = Renderer.generateStars(150);
        cacheDom();
    }

    function setupWaitingState() {
        startingPlayer = aiMode ? 1 : (Math.random() < 0.5 ? 1 : 2);
        waitingToStart = true;
        trail.length = 0;
        ball.vx = 0;
        ball.vy = 0;
        // Place ball near the starting player's paddle
        if (startingPlayer === 1) {
            ball.x = paddle1.x + paddle1.w + BALL_SIZE;
            ball.y = paddle1.y + paddle1.h / 2;
        } else {
            ball.x = paddle2.x - BALL_SIZE;
            ball.y = paddle2.y + paddle2.h / 2;
        }
    }

    function resetBall(direction) {
        clearKeys();
        trail.length = 0;
        roundStartTime = Date.now();
        slowCooldownStart = Date.now();
        aiSlowed = false;
        playerSlowed = false;
        ball.x = CANVAS_W / 2;
        ball.y = CANVAS_H / 2;
        var angle = (Math.random() * Math.PI / 3) - Math.PI / 6; // -30 to +30 deg
        var speed = BALL_SPEED_INIT;
        ball.vx = Math.cos(angle) * speed * direction;
        ball.vy = Math.sin(angle) * speed;
    }

    function resetGame() {
        clearKeys();
        paddle1.score = 0;
        paddle2.score = 0;
        score1El.textContent = '0';
        score2El.textContent = '0';
        paddle1.y = CANVAS_H / 2 - PADDLE_H / 2;
        paddle2.y = CANVAS_H / 2 - PADDLE_H / 2;
        gameOver = false;
        gameOverPhase = 0;
        paused = false;
        exploding = false;
        countingDown = false;
        colorPickerOpen = false;
        settingsOpen = false;
        colorPickerEl.style.display = 'none';
        settingsEl.style.display = 'none';
        setupWaitingState();
    }

    function startExplosion(x, y, callback) {
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
        explosionCallback = callback;
    }

    // ── Update ──────────────────────────────────────────────────────────
    // This is the "brain" of the game. Every frame it:
    //   - Moves the paddles based on key presses (or AI thinking)
    //   - Moves the ball
    //   - Checks if the ball hit a wall or paddle (collision detection)
    //   - Checks if someone scored
    // It runs about 60 times per second!

    function update() {
        if (gameOver || paused || waitingToStart || colorPickerOpen || settingsOpen) return;

        // Update explosion
        if (exploding) {
            for (var i = 0; i < explosionParticles.length; i++) {
                var p = explosionParticles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.r *= 0.97;
            }
            if (Date.now() - explosionStart >= EXPLOSION_DURATION) {
                exploding = false;
                if (explosionCallback) {
                    explosionCallback();
                    explosionCallback = null;
                }
            }
            return;
        }

        // Check if player slow should activate or expire (AI mode only)
        if (aiMode && !playerSlowed) {
            var roundElapsed = Date.now() - roundStartTime;
            if (roundElapsed >= PLAYER_SLOW_DELAY) {
                playerSlowed = true;
                playerSlowedUntil = Date.now() + SLOW_DURATION;
            }
        }
        if (playerSlowed && Date.now() >= playerSlowedUntil) {
            playerSlowed = false;
        }

        // Player 1 movement (W/S or touch target)
        var p1Speed = PADDLE_SPEED * (playerSlowed ? 0.67 : 1);
        if (touchP1TargetY !== null) {
            var touchDiff1 = touchP1TargetY - paddle1.y;
            // Smooth lerp: move 30% of remaining distance each frame
            // but at least p1Speed so it doesn't get stuck
            var move1 = touchDiff1 * 0.3;
            if (Math.abs(move1) < 1) {
                paddle1.y = touchP1TargetY;
            } else {
                paddle1.y += move1;
            }
        }
        if (keys['w']) paddle1.y -= p1Speed;
        if (keys['s']) paddle1.y += p1Speed;
        paddle1.y = clamp(paddle1.y, 0, CANVAS_H - PADDLE_H);

        // Player 2 / AI movement
        // HOW THE AI WORKS:
        // The computer looks at where the ball is (ball.y) and where its
        // paddle center is. If the ball is above the paddle, move up.
        // If the ball is below, move down. Simple! But it moves a bit
        // slower than a human (0.75x speed) so it's not impossible to beat.
        if (aiMode) {
            // Check if slow has expired
            if (aiSlowed && Date.now() >= aiSlowedUntil) {
                aiSlowed = false;
            }
            var center = paddle2.y + PADDLE_H / 2;
            var diff = ball.y - center;
            var aiSpeed = PADDLE_SPEED * 0.75 * (aiSlowed ? 0.67 : 1);
            if (Math.abs(diff) > 10) {
                paddle2.y += Math.sign(diff) * aiSpeed;
            }
        } else {
            if (touchP2TargetY !== null) {
                var touchDiff2 = touchP2TargetY - paddle2.y;
                var move2 = touchDiff2 * 0.3;
                if (Math.abs(move2) < 1) {
                    paddle2.y = touchP2TargetY;
                } else {
                    paddle2.y += move2;
                }
            }
            if (keys['arrowup']) paddle2.y -= PADDLE_SPEED;
            if (keys['arrowdown']) paddle2.y += PADDLE_SPEED;
        }
        paddle2.y = clamp(paddle2.y, 0, CANVAS_H - PADDLE_H);

        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Fire trail
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > TRAIL_MAX) trail.shift();

        // Top/bottom wall bounce
        if (ball.y - BALL_SIZE / 2 <= 0) {
            ball.y = BALL_SIZE / 2;
            ball.vy = Math.abs(ball.vy);
        }
        if (ball.y + BALL_SIZE / 2 >= CANVAS_H) {
            ball.y = CANVAS_H - BALL_SIZE / 2;
            ball.vy = -Math.abs(ball.vy);
        }

        // PADDLE COLLISION MATH — how the ball bounces off a paddle:
        // First we check: is the ball touching the paddle? We look at whether
        // the ball's edges overlap with the paddle's edges (like two rectangles
        // overlapping).
        //
        // Then we figure out WHERE on the paddle the ball hit:
        //   - "hit" goes from -1 (top edge) to +1 (bottom edge), 0 = center.
        //   - If the ball hits near the top of the paddle, it bounces upward.
        //   - If it hits near the bottom, it bounces downward.
        //   - If it hits the middle, it goes mostly straight.
        //
        // The ball also speeds up a tiny bit (+0.7) each time it's hit,
        // up to a max speed. This makes the game get harder over time!

        // Paddle 1 collision (left paddle)
        if (ball.vx < 0 &&
            ball.x - BALL_SIZE / 2 <= paddle1.x + paddle1.w &&
            ball.x + BALL_SIZE / 2 >= paddle1.x &&
            ball.y >= paddle1.y &&
            ball.y <= paddle1.y + paddle1.h) {
            var hit = (ball.y - (paddle1.y + paddle1.h / 2)) / (paddle1.h / 2);
            var angle = hit * (Math.PI / 4);
            var speed = clamp(Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + 0.7, BALL_SPEED_INIT, BALL_SPEED_MAX);
            ball.vx = Math.cos(angle) * speed;
            ball.vy = Math.sin(angle) * speed;
            ball.x = paddle1.x + paddle1.w + BALL_SIZE / 2;
            AudioManager.playLaserSound();
        }

        // Paddle 2 collision (right paddle) — same idea, but ball goes left
        if (ball.vx > 0 &&
            ball.x + BALL_SIZE / 2 >= paddle2.x &&
            ball.x - BALL_SIZE / 2 <= paddle2.x + paddle2.w &&
            ball.y >= paddle2.y &&
            ball.y <= paddle2.y + paddle2.h) {
            var hit = (ball.y - (paddle2.y + paddle2.h / 2)) / (paddle2.h / 2);
            var angle = hit * (Math.PI / 4);
            var speed = clamp(Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) + 0.7, BALL_SPEED_INIT, BALL_SPEED_MAX);
            ball.vx = -Math.cos(angle) * speed;
            ball.vy = Math.sin(angle) * speed;
            ball.x = paddle2.x - BALL_SIZE / 2;
            AudioManager.playLaserSound();
        }

        // Round time limit — award point based on ball position
        if (Date.now() - roundStartTime >= ROUND_TIME_LIMIT) {
            if (ball.x < CANVAS_W / 2) {
                paddle2.score++;
                score2El.textContent = paddle2.score;
            } else {
                paddle1.score++;
                score1El.textContent = paddle1.score;
            }
            var won = paddle1.score >= WIN_SCORE || paddle2.score >= WIN_SCORE;
            startExplosion(ball.x, ball.y, function () {
                if (won) {
                    gameOver = true;
                    gameOverPhase = 1;
                    gameOverStart = Date.now();
                    AudioManager.playGameOverSound();
                } else {
                    setupWaitingState();
                }
            });
            ball.vx = 0;
            ball.vy = 0;
            return;
        }

        // Scoring — ball past left edge
        if (ball.x < 0) {
            paddle2.score++;
            score2El.textContent = paddle2.score;
            if (paddle2.score >= WIN_SCORE) {
                startExplosion(ball.x, ball.y, function () {
                    gameOver = true;
                    gameOverPhase = 1;
                    gameOverStart = Date.now();
                    AudioManager.playGameOverSound();
                });
            } else {
                startExplosion(ball.x, ball.y, function () { resetBall(1); });
            }
            ball.vx = 0;
            ball.vy = 0;
        }
        // Scoring — ball past right edge
        if (ball.x > CANVAS_W) {
            paddle1.score++;
            score1El.textContent = paddle1.score;
            if (paddle1.score >= WIN_SCORE) {
                startExplosion(ball.x, ball.y, function () {
                    gameOver = true;
                    gameOverPhase = 1;
                    gameOverStart = Date.now();
                    AudioManager.playGameOverSound();
                });
            } else {
                startExplosion(ball.x, ball.y, function () { resetBall(-1); });
            }
            ball.vx = 0;
            ball.vy = 0;
        }
    }

    // ── Draw ────────────────────────────────────────────────────────────
    // This is the "artist" of the game. It paints everything on screen:
    // background, stars, paddles, ball, trail, explosions, and any menus.
    // It does NOT move anything — that's update()'s job.

    function draw() {
        var W = CANVAS_W;
        var H = CANVAS_H;

        // Background & stars
        Renderer.drawBackground(ctx, W, H, stars, bgEnabled);

        // Center line
        Renderer.drawCenterLine(ctx, W, H);

        // Paddles
        Renderer.drawPaddle(ctx, paddle1, paddle1Color);
        Renderer.drawPaddle(ctx, paddle2, paddle2Color);

        // Trail + ball
        var ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        Renderer.drawTrail(ctx, trail, ballSpeed);
        Renderer.drawBall(ctx, ball, ballSpeed);

        // Explosion particles
        if (exploding) {
            var elapsed = Date.now() - explosionStart;
            Renderer.drawExplosion(ctx, explosionParticles, elapsed);
        }

        // Draw slow button on canvas (AI mode only)
        if (aiMode && !waitingToStart && !gameOver) {
            var sbx = SLOW_BTN.x, sby = SLOW_BTN.y, sbw = SLOW_BTN.w, sbh = SLOW_BTN.h, sbr = 8;
            var elapsed = Date.now() - slowCooldownStart;
            var sbColor, sbText;
            if (aiSlowed) {
                sbColor = '#ff8800'; sbText = 'ACTIVE';
            } else if (elapsed >= SLOW_COOLDOWN) {
                sbColor = '#4caf50'; sbText = 'SLOW';
            } else {
                sbColor = '#555'; sbText = Math.ceil((SLOW_COOLDOWN - elapsed) / 1000) + 's';
            }
            ctx.beginPath();
            ctx.moveTo(sbx + sbr, sby);
            ctx.lineTo(sbx + sbw - sbr, sby);
            ctx.quadraticCurveTo(sbx + sbw, sby, sbx + sbw, sby + sbr);
            ctx.lineTo(sbx + sbw, sby + sbh - sbr);
            ctx.quadraticCurveTo(sbx + sbw, sby + sbh, sbx + sbw - sbr, sby + sbh);
            ctx.lineTo(sbx + sbr, sby + sbh);
            ctx.quadraticCurveTo(sbx, sby + sbh, sbx, sby + sbh - sbr);
            ctx.lineTo(sbx, sby + sbr);
            ctx.quadraticCurveTo(sbx, sby, sbx + sbr, sby);
            ctx.closePath();
            ctx.fillStyle = sbColor;
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(sbText, sbx + sbw / 2, sby + sbh / 2 + 6);
        }

        // Pause overlay
        if (paused && !gameOver) {
            Renderer.drawOverlay(ctx, W, H, 'PAUSED', 'Press SPACE to resume');
        }

        // Waiting to start overlay
        if (waitingToStart) {
            if (countingDown) {
                var cdElapsed = Date.now() - countdownStart;
                var cdRemaining = Math.ceil((COUNTDOWN_DURATION - cdElapsed) / 1000);
                if (cdRemaining <= 0) {
                    // Countdown done — launch ball
                    countingDown = false;
                    waitingToStart = false;
                    clearKeys();
                    roundStartTime = Date.now();
                    slowCooldownStart = Date.now();
                    aiSlowed = false;
                    playerSlowed = false;
                    var direction = startingPlayer === 1 ? 1 : -1;
                    var angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
                    var speed = BALL_SPEED_INIT;
                    ball.vx = Math.cos(angle) * speed * direction;
                    ball.vy = Math.sin(angle) * speed;
                } else {
                    Renderer.drawCountdown(ctx, W, H, cdRemaining);
                }
            } else {
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.font = '36px Courier New';
                var name = startingPlayer === 1 ? 'Player 1' : (aiMode ? 'AI' : 'Player 2');
                ctx.fillText(name + ' starts with the ball', W / 2, H / 2 - 20);
                ctx.font = '20px Courier New';
                ctx.fillText('Press ENTER to start', W / 2, H / 2 + 30);
            }
        }

        // Game over sequence
        if (gameOver) {
            ctx.textAlign = 'center';
            if (gameOverPhase === 1) {
                // "Game Over!" fading out
                var goElapsed = Date.now() - gameOverStart;
                var alpha = 1 - goElapsed / GAME_OVER_FADE_DURATION;
                if (alpha <= 0) {
                    gameOverPhase = 2;
                    var player1Won = paddle1.score >= WIN_SCORE;
                    if (aiMode && player1Won) AudioManager.playVictorySound();
                    else if (aiMode && !player1Won) AudioManager.playSadSound();
                } else {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = '#fff';
                    ctx.font = '60px Courier New';
                    ctx.fillText('Game Over!', W / 2, H / 2);
                    ctx.globalAlpha = 1;
                }
            }
            if (gameOverPhase === 2) {
                ctx.fillStyle = '#fff';
                ctx.font = '48px Courier New';
                var player1Won = paddle1.score >= WIN_SCORE;
                if (aiMode) {
                    ctx.fillText(player1Won ? 'YOU WON!' : 'You Lose', W / 2, H / 2 - 20);
                } else {
                    var winner = player1Won ? 'Player 1' : 'Player 2';
                    ctx.fillText(winner + ' Wins!', W / 2, H / 2 - 20);
                }
                ctx.font = '20px Courier New';
                ctx.fillText('Press SPACE to play again', W / 2, H / 2 + 30);
            }
        }
    }

    // ── Game loop ───────────────────────────────────────────────────────
    // This is the heartbeat of the game! It calls update() then draw(),
    // then asks the browser to call it again. This creates an endless
    // cycle that runs ~60 times per second until we stop the game.

    function gameLoop() {
        if (!active) return;
        update();  // Step 1: move everything and check collisions
        draw();    // Step 2: paint the new picture on screen
        animFrameId = requestAnimationFrame(gameLoop); // Step 3: do it again!
    }

    // ── Keyboard handling ─────────────────────────────────────────────
    // When you press a key, the browser fires a "keydown" event.
    // When you let go, it fires "keyup". We listen for both so we know
    // which keys are currently held down. This is how we move paddles!
    //   W / S         = Player 1 up / down
    //   Arrow Up/Down = Player 2 up / down
    //   Space         = Pause or restart after game over
    //   Enter         = Start the round
    //   Shift         = Activate "slow" power-up (AI mode)
    //   E             = Open color picker
    //   Q             = Open settings
    //   R             = Reset the game
    //   Ctrl          = Go back to the menu

    function onKeyDown(e) {
        if (!active) return;

        // Ctrl — return to mode select menu
        if (e.key === 'Control') {
            e.preventDefault();
            if (onReturnToMenu) onReturnToMenu();
            return;
        }

        // While settings is open, only handle Q to close
        if (settingsOpen) {
            if (e.key === 'q' || e.key === 'Q') {
                settingsOpen = false;
                paused = false;
                settingsEl.style.display = 'none';
                clearKeys();
            }
            return;
        }

        // While color picker is open, only handle Space to close
        if (colorPickerOpen) {
            if (e.key === ' ') {
                e.preventDefault();
                var c1 = p1ColorInput.value.trim();
                var c2 = p2ColorInput.value.trim();
                if (c1) paddle1Color = c1;
                if (c2) paddle2Color = c2;
                colorPickerOpen = false;
                paused = false;
                colorPickerEl.style.display = 'none';
                clearKeys();
            }
            return;
        }

        keys[e.key.toLowerCase()] = true;

        if (e.key === 'Enter') {
            e.preventDefault();
            if (waitingToStart && !countingDown) {
                countingDown = true;
                countdownStart = Date.now();
            }
        }

        if (e.key === ' ') {
            e.preventDefault();
            if (gameOver) {
                resetGame();
            } else if (!waitingToStart) {
                paused = !paused;
                if (!paused) clearKeys();
            }
        }

        if ((e.key === 'e' || e.key === 'E') && !colorPickerOpen && !gameOver) {
            colorPickerOpen = true;
            paused = true;
            p2ColorLabel.textContent = aiMode ? "AI's Paddle Color" : "Player 2's Paddle Color";
            p1ColorInput.value = paddle1Color;
            p2ColorInput.value = paddle2Color;
            colorPickerEl.style.display = 'block';
            p1ColorInput.focus();
            return;
        }

        if ((e.key === 'q' || e.key === 'Q') && !settingsOpen && !colorPickerOpen) {
            settingsOpen = true;
            paused = true;
            settingsEl.style.display = 'block';
            clearKeys();
            return;
        }

        if (e.key === 'r' || e.key === 'R') {
            resetGame();
        }

        if (e.key === 'Shift' && aiMode && !waitingToStart && !gameOver && !paused) {
            var elapsed = Date.now() - slowCooldownStart;
            if (elapsed >= SLOW_COOLDOWN && !aiSlowed) {
                aiSlowed = true;
                aiSlowedUntil = Date.now() + SLOW_DURATION;
                slowCooldownStart = Date.now();
            }
        }

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }
    }

    function onKeyUp(e) {
        if (!active) return;
        keys[e.key.toLowerCase()] = false;
    }

    function onBlur() {
        if (!active) return;
        clearKeys();
    }

    // Settings toggle handlers
    function onMusicToggleClick() {
        musicEnabled = !musicEnabled;
        AudioManager.musicEnabled = musicEnabled;
        musicToggle.classList.toggle('on', musicEnabled);
    }

    function onBgToggleClick() {
        bgEnabled = !bgEnabled;
        bgToggle.classList.toggle('on', bgEnabled);
    }

    // ── Touch handling (for phones and tablets) ────────────────────────
    // On a touchscreen there's no keyboard, so players drag their finger
    // on their side of the screen to move their paddle. The left half
    // controls Player 1, the right half controls Player 2.

    function touchToCanvas(touch) {
        var rect = canvas.getBoundingClientRect();
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    function resumeAudioOnTouch() {
        if (typeof AudioManager !== 'undefined' && AudioManager.audioCtx && AudioManager.audioCtx.state === 'suspended') {
            AudioManager.audioCtx.resume();
        }
    }

    function isInsideSlowBtn(cx, cy) {
        return cx >= SLOW_BTN.x && cx <= SLOW_BTN.x + SLOW_BTN.w &&
               cy >= SLOW_BTN.y && cy <= SLOW_BTN.y + SLOW_BTN.h;
    }

    function onCanvasTouchStart(e) {
        if (!active) return;
        e.preventDefault();
        resumeAudioOnTouch();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            var pos = touchToCanvas(touch);
            // Check slow button tap
            if (aiMode && isInsideSlowBtn(pos.x, pos.y)) {
                if (!waitingToStart && !gameOver && !paused) {
                    var elapsed = Date.now() - slowCooldownStart;
                    if (elapsed >= SLOW_COOLDOWN && !aiSlowed) {
                        aiSlowed = true;
                        aiSlowedUntil = Date.now() + SLOW_DURATION;
                        slowCooldownStart = Date.now();
                    }
                }
                continue;
            }
            if (aiMode || pos.x < CANVAS_W / 2) {
                // In AI mode, whole canvas controls player 1
                // In 2P mode, left half controls player 1
                touchP1Id = touch.identifier;
                touchP1TargetY = clamp(pos.y - PADDLE_H / 2, 0, CANVAS_H - PADDLE_H);
            } else {
                // Right half — player 2 (only in 2P mode)
                touchP2Id = touch.identifier;
                touchP2TargetY = clamp(pos.y - PADDLE_H / 2, 0, CANVAS_H - PADDLE_H);
            }
        }
    }

    function onCanvasTouchMove(e) {
        if (!active) return;
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            var pos = touchToCanvas(touch);
            if (touch.identifier === touchP1Id) {
                touchP1TargetY = clamp(pos.y - PADDLE_H / 2, 0, CANVAS_H - PADDLE_H);
            } else if (touch.identifier === touchP2Id) {
                touchP2TargetY = clamp(pos.y - PADDLE_H / 2, 0, CANVAS_H - PADDLE_H);
            }
        }
    }

    function onCanvasTouchEnd(e) {
        if (!active) return;
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            if (touch.identifier === touchP1Id) { touchP1Id = null; touchP1TargetY = null; }
            if (touch.identifier === touchP2Id) { touchP2Id = null; touchP2TargetY = null; }
        }
    }

    function onTouchEnterBtn(e) {
        e.preventDefault();
        resumeAudioOnTouch();
        if (settingsOpen) {
            settingsOpen = false;
            paused = false;
            settingsEl.style.display = 'none';
            clearKeys();
            return;
        }
        if (colorPickerOpen) {
            var c1 = p1ColorInput.value.trim();
            var c2 = p2ColorInput.value.trim();
            if (c1) paddle1Color = c1;
            if (c2) paddle2Color = c2;
            colorPickerOpen = false;
            paused = false;
            colorPickerEl.style.display = 'none';
            clearKeys();
            return;
        }
        if (waitingToStart && !countingDown) {
            countingDown = true;
            countdownStart = Date.now();
            return;
        }
        if (gameOver) {
            resetGame();
            return;
        }
    }

    function onTouchPauseBtn(e) {
        e.preventDefault();
        if (gameOver || waitingToStart) return;
        paused = !paused;
        if (!paused) clearKeys();
    }

    function onTouchResetBtn(e) {
        e.preventDefault();
        resetGame();
    }

    function onTouchSettingsBtn(e) {
        e.preventDefault();
        if (settingsOpen) {
            settingsOpen = false;
            paused = false;
            settingsEl.style.display = 'none';
            clearKeys();
        } else if (!colorPickerOpen) {
            settingsOpen = true;
            paused = true;
            settingsEl.style.display = 'block';
            clearKeys();
        }
    }

    // ── Start / Stop ────────────────────────────────────────────────────
    // start() sets up everything for a new game — puts paddles in the
    // middle, resets scores to 0, hooks up keyboard/touch controls,
    // and kicks off the game loop.
    // stop() tears it all down — removes controls and stops the loop.

    function start(isAiMode) {
        aiMode = isAiMode;
        active = true;

        // Sync musicEnabled from AudioManager
        musicEnabled = AudioManager.musicEnabled;

        // Reset paddle positions using canvas constants
        paddle1.x = 20;
        paddle1.y = CANVAS_H / 2 - PADDLE_H / 2;
        paddle1.w = PADDLE_W;
        paddle1.h = PADDLE_H;
        paddle1.score = 0;

        paddle2.x = CANVAS_W - 20 - PADDLE_W;
        paddle2.y = CANVAS_H / 2 - PADDLE_H / 2;
        paddle2.w = PADDLE_W;
        paddle2.h = PADDLE_H;
        paddle2.score = 0;

        ball.x = 0;
        ball.y = 0;
        ball.vx = 0;
        ball.vy = 0;

        trail.length = 0;
        gameOver = false;
        gameOverPhase = 0;
        paused = false;
        exploding = false;
        countingDown = false;
        colorPickerOpen = false;
        settingsOpen = false;
        paddle1Color = '#fff';
        paddle2Color = '#fff';

        score1El.textContent = '0';
        score2El.textContent = '0';
        colorPickerEl.style.display = 'none';
        settingsEl.style.display = 'none';

        setupWaitingState();

        // Attach event listeners
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        musicToggle.addEventListener('click', onMusicToggleClick);
        bgToggle.addEventListener('click', onBgToggleClick);

        // Attach touch listeners
        touchP1Id = null;
        touchP2Id = null;
        touchP1TargetY = null;
        touchP2TargetY = null;
        canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
        canvas.addEventListener('touchend', onCanvasTouchEnd, { passive: false });
        canvas.addEventListener('touchcancel', onCanvasTouchEnd, { passive: false });

        var touchEnterBtn = document.getElementById('touch-enter');
        var touchPauseBtn = document.getElementById('touch-pause');
        var touchResetBtn = document.getElementById('touch-reset');
        var touchSettingsBtn = document.getElementById('touch-settings');

        if (touchEnterBtn) touchEnterBtn.addEventListener('touchstart', onTouchEnterBtn, { passive: false });
        if (touchPauseBtn) touchPauseBtn.addEventListener('touchstart', onTouchPauseBtn, { passive: false });
        if (touchResetBtn) touchResetBtn.addEventListener('touchstart', onTouchResetBtn, { passive: false });
        if (touchSettingsBtn) touchSettingsBtn.addEventListener('touchstart', onTouchSettingsBtn, { passive: false });

        // Start loop
        gameLoop();
    }

    function stop() {
        active = false;
        if (animFrameId != null) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        // Remove event listeners
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        if (musicToggle) musicToggle.removeEventListener('click', onMusicToggleClick);
        if (bgToggle) bgToggle.removeEventListener('click', onBgToggleClick);

        // Remove touch listeners
        if (canvas) {
            canvas.removeEventListener('touchstart', onCanvasTouchStart);
            canvas.removeEventListener('touchmove', onCanvasTouchMove);
            canvas.removeEventListener('touchend', onCanvasTouchEnd);
            canvas.removeEventListener('touchcancel', onCanvasTouchEnd);
        }
        touchP1Id = null;
        touchP2Id = null;
        touchP1TargetY = null;
        touchP2TargetY = null;

        var touchEnterBtn = document.getElementById('touch-enter');
        var touchPauseBtn = document.getElementById('touch-pause');
        var touchResetBtn = document.getElementById('touch-reset');
        var touchSettingsBtn = document.getElementById('touch-settings');

        if (touchEnterBtn) touchEnterBtn.removeEventListener('touchstart', onTouchEnterBtn);
        if (touchPauseBtn) touchPauseBtn.removeEventListener('touchstart', onTouchPauseBtn);
        if (touchResetBtn) touchResetBtn.removeEventListener('touchstart', onTouchResetBtn);
        if (touchSettingsBtn) touchSettingsBtn.removeEventListener('touchstart', onTouchSettingsBtn);

        // Clear timers display
        if (slowTimerEl) slowTimerEl.textContent = '';
        if (playerSlowTimerEl) playerSlowTimerEl.textContent = '';

        // Hide overlays
        if (colorPickerEl) colorPickerEl.style.display = 'none';
        if (settingsEl) settingsEl.style.display = 'none';
    }

    function setOnReturnToMenu(callback) {
        onReturnToMenu = callback;
    }

    // ── Public API ──────────────────────────────────────────────────────
    return {
        init: init,
        start: start,
        stop: stop,
        setupWaitingState: setupWaitingState,
        resetBall: resetBall,
        resetGame: resetGame,
        startExplosion: startExplosion,
        update: update,
        draw: draw,
        gameLoop: gameLoop,
        setOnReturnToMenu: setOnReturnToMenu
    };

})();
