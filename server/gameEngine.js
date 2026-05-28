// ============================================================
// gameEngine.js - The Physics Engine (The Heart of the Game!)
// ============================================================
// This file runs a single game of Pong. It's like a referee +
// physicist combined! It handles:
//
// - PHYSICS: Moving the ball, bouncing it off walls and paddles
// - COLLISION DETECTION: Checking if the ball hit a paddle or wall
//   (imagine drawing invisible boxes around objects and checking
//   if any boxes overlap -- that's collision detection!)
// - SCORING: Keeping track of points and deciding who wins
// - GAME PHASES: The game goes through stages like a traffic light:
//     "waiting" -> "countdown" -> "playing" -> "explosion" -> back to "waiting"
//     When someone reaches 10 points, it goes to "gameOver"
//
// THE TICK CONCEPT: The tick() method runs about 60 times per second.
// Each "tick" is like one tiny step forward in time. The ball moves
// a little, paddles move a little, and we check for collisions.
// It's like a flipbook -- each page looks almost the same, but
// flipping through them fast creates smooth animation!
// ============================================================

// Load all the game numbers (speeds, sizes, etc.) from our constants file.
const {
    CANVAS_W,
    CANVAS_H,
    PADDLE_W,
    PADDLE_H,
    PADDLE_SPEED,
    BALL_SIZE,
    BALL_SPEED_INIT,
    BALL_SPEED_MAX,
    WIN_SCORE,
    ROUND_TIME_LIMIT,
    SLOW_COOLDOWN,
    SLOW_DURATION,
    COUNTDOWN_DURATION,
    EXPLOSION_DURATION,
    TRAIL_MAX,
} = require('./constants');

// "clamp" keeps a number between a minimum and maximum value.
// For example, clamp(150, 0, 100) returns 100, because 150 is too big.
// We use this to stop paddles from going off the screen.
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

class GameEngine {
    // The constructor sets up a brand new game with two players.
    // It's like setting up the table before a ping-pong match.
    constructor(player1Info, player2Info, gameId) {
        this.id = gameId;
        this.destroyed = false;

        // Each player has: their socket ID (their phone line to the server),
        // a username, a paddle position (starts in the middle), a color,
        // and an "input" object tracking which keys they're pressing.
        this.player1 = {
            socketId: player1Info.socketId,
            username: player1Info.username,
            paddleY: CANVAS_H / 2 - PADDLE_H / 2,
            color: '#fff',
            input: { up: false, down: false, slow: false },
        };

        this.player2 = {
            socketId: player2Info.socketId,
            username: player2Info.username,
            paddleY: CANVAS_H / 2 - PADDLE_H / 2,
            color: '#fff',
            input: { up: false, down: false, slow: false },
        };

        // The ball has a position (x, y) and a velocity (vx, vy).
        // Velocity means "how fast and in which direction it's moving."
        // vx = horizontal speed, vy = vertical speed.
        this.ball = { x: 0, y: 0, vx: 0, vy: 0 };
        this.scores = [0, 0];
        this.trail = [];

        // The game phase tracks what's happening right now.
        this.phase = 'waiting'; // 'countdown' | 'playing' | 'explosion' | 'waiting' | 'gameOver'
        this.countdownStart = 0;
        this.roundStartTime = 0;
        this.startingPlayer = 0;

        // Each player's "slow" power-up state.
        // cooldownStart = when the cooldown timer started.
        // active = is the slow effect happening right now?
        // activeUntil = when does the slow effect wear off?
        this.player1Slow = { cooldownStart: 0, active: false, activeUntil: 0 };
        this.player2Slow = { cooldownStart: 0, active: false, activeUntil: 0 };

        // Explosion animation data (plays when someone scores).
        this.explosion = { active: false, particles: [], startTime: 0 };
        this._explosionCallback = null;

        // Both players must click "Ready" before a round starts.
        this.player1Ready = false;
        this.player2Ready = false;
        this.spectators = [];
        this.createdAt = Date.now();
        this.winner = null;
    }

    // Called once when the game is first created.
    // Randomly picks which player serves first (like a coin flip!).
    start() {
        this.phase = 'waiting';
        this.startingPlayer = Math.random() < 0.5 ? 1 : 2;
        this._positionBallAtPaddle();
    }

    // Places the ball right next to the serving player's paddle,
    // ready to be launched. Also clears the trail.
    _positionBallAtPaddle() {
        this.trail.length = 0;
        this.ball.vx = 0;
        this.ball.vy = 0;
        if (this.startingPlayer === 1) {
            // Put ball next to left paddle
            this.ball.x = 20 + PADDLE_W + BALL_SIZE;
            this.ball.y = this.player1.paddleY + PADDLE_H / 2;
        } else {
            // Put ball next to right paddle
            this.ball.x = (CANVAS_W - 20 - PADDLE_W) - BALL_SIZE;
            this.ball.y = this.player2.paddleY + PADDLE_H / 2;
        }
    }

    // When a player clicks "Ready", we record it.
    // Once BOTH players are ready, the countdown begins!
    playerReady(socketId) {
        if (this.phase !== 'waiting') return;
        if (socketId === this.player1.socketId) this.player1Ready = true;
        if (socketId === this.player2.socketId) this.player2Ready = true;
        if (this.player1Ready && this.player2Ready) {
            this.phase = 'countdown';
            this.countdownStart = Date.now();
            this.player1Ready = false;
            this.player2Ready = false;
        }
    }

    // When a player presses or releases a key, this updates their input state.
    handleInput(socketId, input) {
        if (socketId === this.player1.socketId) {
            this.player1.input = input;
        } else if (socketId === this.player2.socketId) {
            this.player2.input = input;
        }
    }

    // ============================================================
    // tick() - THE MAIN GAME LOOP (runs ~60 times per second!)
    // ============================================================
    // Each tick is one "frame" of the game. We move things, check
    // for collisions, update scores, and return any events that
    // happened (like sounds to play). This is where ALL the
    // physics and game logic lives.
    tick() {
        const events = [];
        if (this.destroyed) return { events };

        // --- Countdown phase ---
        // During countdown ("3... 2... 1..."), we just wait.
        // Once the countdown finishes, we launch the ball!
        if (this.phase === 'countdown') {
            const elapsed = Date.now() - this.countdownStart;
            if (elapsed >= COUNTDOWN_DURATION) {
                this.phase = 'playing';
                this.roundStartTime = Date.now();
                this.player1Slow.cooldownStart = Date.now();
                this.player2Slow.cooldownStart = Date.now();
                this.player1Slow.active = false;
                this.player2Slow.active = false;

                // Launch the ball! Pick a random-ish angle so it's not
                // always the same. The direction depends on who's serving.
                const direction = this.startingPlayer === 1 ? 1 : -1;
                const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
                this.ball.vx = Math.cos(angle) * BALL_SPEED_INIT * direction;
                this.ball.vy = Math.sin(angle) * BALL_SPEED_INIT;
            }
            return { events };
        }

        // --- Explosion phase ---
        // After someone scores, an explosion animation plays.
        // We move the particles outward and shrink them until time's up.
        if (this.phase === 'explosion') {
            for (const p of this.explosion.particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.r *= 0.97;
            }
            if (Date.now() - this.explosion.startTime >= EXPLOSION_DURATION) {
                this.explosion.active = false;
                if (this._explosionCallback) {
                    this._explosionCallback(events);
                    this._explosionCallback = null;
                }
            }
            return { events };
        }

        // --- gameOver or waiting: nothing to do ---
        if (this.phase === 'gameOver' || this.phase === 'waiting') {
            return { events };
        }

        // ============================
        // --- Playing phase ---
        // This is where the action happens!
        // ============================

        // --- Slow ability for Player 1 ---
        // If player 1 presses the slow button AND the cooldown is done,
        // activate the slow effect on their OPPONENT (player 2 gets slowed).
        if (this.player1.input.slow) {
            const elapsed = Date.now() - this.player1Slow.cooldownStart;
            if (elapsed >= SLOW_COOLDOWN && !this.player1Slow.active) {
                this.player1Slow.active = true;
                this.player1Slow.activeUntil = Date.now() + SLOW_DURATION;
                this.player1Slow.cooldownStart = Date.now();
            }
        }
        // Turn off the slow effect when it runs out of time.
        if (this.player1Slow.active && Date.now() >= this.player1Slow.activeUntil) {
            this.player1Slow.active = false;
        }

        // --- Slow ability for Player 2 (same logic) ---
        if (this.player2.input.slow) {
            const elapsed = Date.now() - this.player2Slow.cooldownStart;
            if (elapsed >= SLOW_COOLDOWN && !this.player2Slow.active) {
                this.player2Slow.active = true;
                this.player2Slow.activeUntil = Date.now() + SLOW_DURATION;
                this.player2Slow.cooldownStart = Date.now();
            }
        }
        if (this.player2Slow.active && Date.now() >= this.player2Slow.activeUntil) {
            this.player2Slow.active = false;
        }

        // --- Move paddles ---
        // If the opponent's slow is active, this player moves at 67% speed.
        // Player 1's paddle is slowed when Player 2's slow ability is active (and vice versa).
        const p1Speed = PADDLE_SPEED * (this.player2Slow.active ? 0.67 : 1);
        if (this.player1.input.up) this.player1.paddleY -= p1Speed;
        if (this.player1.input.down) this.player1.paddleY += p1Speed;
        this.player1.paddleY = clamp(this.player1.paddleY, 0, CANVAS_H - PADDLE_H);

        const p2Speed = PADDLE_SPEED * (this.player1Slow.active ? 0.67 : 1);
        if (this.player2.input.up) this.player2.paddleY -= p2Speed;
        if (this.player2.input.down) this.player2.paddleY += p2Speed;
        this.player2.paddleY = clamp(this.player2.paddleY, 0, CANVAS_H - PADDLE_H);

        // --- Move ball ---
        // Add the velocity to the position. This is basic physics:
        // new position = old position + speed.
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // --- Trail ---
        // Save the ball's current position to draw a comet-tail effect.
        // If the trail gets too long, remove the oldest point.
        this.trail.push({ x: this.ball.x, y: this.ball.y });
        if (this.trail.length > TRAIL_MAX) this.trail.shift();

        // --- Wall bounce (top and bottom) ---
        // If the ball hits the top or bottom wall, flip its vertical direction.
        // Math.abs makes the number positive, then we add or remove the minus sign.
        if (this.ball.y - BALL_SIZE / 2 <= 0) {
            this.ball.y = BALL_SIZE / 2;
            this.ball.vy = Math.abs(this.ball.vy);
        }
        if (this.ball.y + BALL_SIZE / 2 >= CANVAS_H) {
            this.ball.y = CANVAS_H - BALL_SIZE / 2;
            this.ball.vy = -Math.abs(this.ball.vy);
        }

        // --- Paddle 1 collision (left paddle) ---
        // We check: is the ball moving left? Is it overlapping the paddle's rectangle?
        // If yes, bounce it! The bounce angle depends on WHERE it hit the paddle.
        // Hitting the top edge sends it upward; hitting the bottom sends it downward.
        // The ball also gets a little faster each bounce (up to the max speed).
        const p1x = 20;
        if (this.ball.vx < 0 &&
            this.ball.x - BALL_SIZE / 2 <= p1x + PADDLE_W &&
            this.ball.x + BALL_SIZE / 2 >= p1x &&
            this.ball.y >= this.player1.paddleY &&
            this.ball.y <= this.player1.paddleY + PADDLE_H) {
            // "hit" is a number from -1 to 1 showing where on the paddle the ball landed.
            const hit = (this.ball.y - (this.player1.paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
            const angle = hit * (Math.PI / 4);
            // Speed up by 0.7 each bounce, but don't go over the max.
            const speed = clamp(
                Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) + 0.7,
                BALL_SPEED_INIT,
                BALL_SPEED_MAX
            );
            this.ball.vx = Math.cos(angle) * speed;
            this.ball.vy = Math.sin(angle) * speed;
            // Push ball out of the paddle so it doesn't get stuck inside.
            this.ball.x = p1x + PADDLE_W + BALL_SIZE / 2;
            events.push({ type: 'sound', sound: 'laser' });
        }

        // --- Paddle 2 collision (right paddle) ---
        // Same idea as paddle 1, but mirrored for the right side.
        const p2x = CANVAS_W - 20 - PADDLE_W;
        if (this.ball.vx > 0 &&
            this.ball.x + BALL_SIZE / 2 >= p2x &&
            this.ball.x - BALL_SIZE / 2 <= p2x + PADDLE_W &&
            this.ball.y >= this.player2.paddleY &&
            this.ball.y <= this.player2.paddleY + PADDLE_H) {
            const hit = (this.ball.y - (this.player2.paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
            const angle = hit * (Math.PI / 4);
            const speed = clamp(
                Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) + 0.7,
                BALL_SPEED_INIT,
                BALL_SPEED_MAX
            );
            // Negative vx because we want it to bounce LEFT.
            this.ball.vx = -Math.cos(angle) * speed;
            this.ball.vy = Math.sin(angle) * speed;
            this.ball.x = p2x - BALL_SIZE / 2;
            events.push({ type: 'sound', sound: 'laser' });
        }

        // --- Round time limit ---
        // If the round takes too long (60 seconds), end it automatically.
        // Whoever's side the ball is on LOSES the point (because they couldn't score).
        if (Date.now() - this.roundStartTime >= ROUND_TIME_LIMIT) {
            if (this.ball.x < CANVAS_W / 2) {
                this.scores[1]++;
            } else {
                this.scores[0]++;
            }
            const won = this.scores[0] >= WIN_SCORE || this.scores[1] >= WIN_SCORE;
            events.push({ type: 'explosion', x: this.ball.x, y: this.ball.y });
            this.startExplosion(this.ball.x, this.ball.y, (evts) => {
                if (won) {
                    this.winner = this.scores[0] >= WIN_SCORE ? 1 : 2;
                    this.phase = 'gameOver';
                    evts.push({ type: 'sound', sound: 'gameOver' });
                } else {
                    this._setupWaitingState();
                }
            });
            this.ball.vx = 0;
            this.ball.vy = 0;
            return { events };
        }

        // --- Scoring: ball went past the LEFT edge ---
        // Player 2 gets a point! (Player 1 missed the ball.)
        if (this.ball.x < 0) {
            this.scores[1]++;
            events.push({ type: 'explosion', x: this.ball.x, y: this.ball.y });
            const won = this.scores[1] >= WIN_SCORE;
            this.startExplosion(this.ball.x, this.ball.y, (evts) => {
                if (won) {
                    this.winner = 2;
                    this.phase = 'gameOver';
                    evts.push({ type: 'sound', sound: 'gameOver' });
                } else {
                    this._setupWaitingState();
                }
            });
            this.ball.vx = 0;
            this.ball.vy = 0;
        }

        // --- Scoring: ball went past the RIGHT edge ---
        // Player 1 gets a point! (Player 2 missed the ball.)
        if (this.ball.x > CANVAS_W) {
            this.scores[0]++;
            events.push({ type: 'explosion', x: this.ball.x, y: this.ball.y });
            const won = this.scores[0] >= WIN_SCORE;
            this.startExplosion(this.ball.x, this.ball.y, (evts) => {
                if (won) {
                    this.winner = 1;
                    this.phase = 'gameOver';
                    evts.push({ type: 'sound', sound: 'gameOver' });
                } else {
                    this._setupWaitingState();
                }
            });
            this.ball.vx = 0;
            this.ball.vy = 0;
        }

        return { events };
    }

    // Creates a cool explosion animation with 40 tiny particles
    // flying outward in random directions. When the explosion finishes,
    // the callback decides what happens next (new round or game over).
    startExplosion(x, y, callback) {
        this.phase = 'explosion';
        this.explosion.active = true;
        this.explosion.startTime = Date.now();
        this.explosion.particles = [];
        for (let i = 0; i < 40; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.explosion.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: Math.random() * 4 + 2,
                color: ['#ff4400', '#ff8800', '#ffcc00', '#fff'][Math.floor(Math.random() * 4)],
            });
        }
        this._explosionCallback = callback;
    }

    // After a point is scored and the explosion finishes,
    // set up for the next round: pick a new server and place the ball.
    _setupWaitingState() {
        this.phase = 'waiting';
        this.startingPlayer = Math.random() < 0.5 ? 1 : 2;
        this._positionBallAtPaddle();
    }

    // getState() packages up EVERYTHING about the game right now
    // into one object and sends it to the players' browsers.
    // This runs 20 times per second so the screen stays up to date.
    getState() {
        const now = Date.now();
        // How many milliseconds left in the countdown?
        let countdownRemaining = 0;
        if (this.phase === 'countdown' && this.countdownStart) {
            countdownRemaining = Math.max(0, COUNTDOWN_DURATION - (now - this.countdownStart));
        }
        // How many milliseconds left in the current round?
        let roundTimeRemaining = 0;
        if (this.phase === 'playing' && this.roundStartTime) {
            roundTimeRemaining = Math.max(0, ROUND_TIME_LIMIT - (now - this.roundStartTime));
        }
        // Figure out each player's slow ability status for the client:
        // "ready" = can use it now, "active" = it's working, "cooldown" = waiting.
        function slowState(slowData) {
            if (slowData.active) return { status: 'active' };
            const elapsed = now - slowData.cooldownStart;
            if (elapsed >= SLOW_COOLDOWN) return { status: 'ready' };
            return { status: 'cooldown', remaining: SLOW_COOLDOWN - elapsed };
        }
        return {
            p1y: this.player1.paddleY,
            p2y: this.player2.paddleY,
            p1Color: this.player1.color,
            p2Color: this.player2.color,
            bx: this.ball.x,
            by: this.ball.y,
            bvx: this.ball.vx,
            bvy: this.ball.vy,
            scores: this.scores,
            phase: this.phase,
            trail: this.trail.map(t => ({ x: t.x, y: t.y })),
            startingPlayer: this.startingPlayer,
            p1Slow: slowState(this.player1Slow),
            p2Slow: slowState(this.player2Slow),
            countdownRemaining: countdownRemaining,
            roundTimeRemaining: roundTimeRemaining,
            winner: this.winner,
            p1Username: this.player1.username,
            p2Username: this.player2.username,
            p1Ready: this.player1Ready,
            p2Ready: this.player2Ready,
        };
    }

    // Returns 1 or 2 depending on which player this socket belongs to.
    getPlayerNumber(socketId) {
        if (socketId === this.player1.socketId) return 1;
        if (socketId === this.player2.socketId) return 2;
        return null;
    }

    // Marks this game engine as destroyed so tick() stops doing anything.
    destroy() {
        this.destroyed = true;
    }
}

module.exports = GameEngine;
