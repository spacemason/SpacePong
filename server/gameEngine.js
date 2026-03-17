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

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

class GameEngine {
    constructor(player1Info, player2Info, gameId) {
        this.id = gameId;
        this.destroyed = false;

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

        this.ball = { x: 0, y: 0, vx: 0, vy: 0 };
        this.scores = [0, 0];
        this.trail = [];

        this.phase = 'waiting'; // 'countdown' | 'playing' | 'explosion' | 'waiting' | 'gameOver'
        this.countdownStart = 0;
        this.roundStartTime = 0;
        this.startingPlayer = 0;

        this.player1Slow = { cooldownStart: 0, active: false, activeUntil: 0 };
        this.player2Slow = { cooldownStart: 0, active: false, activeUntil: 0 };

        this.explosion = { active: false, particles: [], startTime: 0 };
        this._explosionCallback = null;

        this.spectators = [];
        this.createdAt = Date.now();
        this.winner = null;
    }

    start() {
        this.phase = 'waiting';
        this.startingPlayer = Math.random() < 0.5 ? 1 : 2;
        this._positionBallAtPaddle();
    }

    _positionBallAtPaddle() {
        this.trail.length = 0;
        this.ball.vx = 0;
        this.ball.vy = 0;
        if (this.startingPlayer === 1) {
            // paddle1.x = 20, paddle1.w = PADDLE_W
            this.ball.x = 20 + PADDLE_W + BALL_SIZE;
            this.ball.y = this.player1.paddleY + PADDLE_H / 2;
        } else {
            // paddle2.x = CANVAS_W - 20 - PADDLE_W
            this.ball.x = (CANVAS_W - 20 - PADDLE_W) - BALL_SIZE;
            this.ball.y = this.player2.paddleY + PADDLE_H / 2;
        }
    }

    playerReady(socketId) {
        if (this.phase === 'waiting') {
            this.phase = 'countdown';
            this.countdownStart = Date.now();
        }
    }

    handleInput(socketId, input) {
        if (socketId === this.player1.socketId) {
            this.player1.input = input;
        } else if (socketId === this.player2.socketId) {
            this.player2.input = input;
        }
    }

    tick() {
        const events = [];
        if (this.destroyed) return { events };

        // --- Countdown phase ---
        if (this.phase === 'countdown') {
            const elapsed = Date.now() - this.countdownStart;
            if (elapsed >= COUNTDOWN_DURATION) {
                this.phase = 'playing';
                this.roundStartTime = Date.now();
                this.player1Slow.cooldownStart = Date.now();
                this.player2Slow.cooldownStart = Date.now();
                this.player1Slow.active = false;
                this.player2Slow.active = false;

                // Launch ball
                const direction = this.startingPlayer === 1 ? 1 : -1;
                const angle = (Math.random() * Math.PI / 3) - Math.PI / 6;
                this.ball.vx = Math.cos(angle) * BALL_SPEED_INIT * direction;
                this.ball.vy = Math.sin(angle) * BALL_SPEED_INIT;
            }
            return { events };
        }

        // --- Explosion phase ---
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

        // --- Playing phase ---

        // Check slow ability activation and expiration for player 1
        if (this.player1.input.slow) {
            const elapsed = Date.now() - this.player1Slow.cooldownStart;
            if (elapsed >= SLOW_COOLDOWN && !this.player1Slow.active) {
                this.player1Slow.active = true;
                this.player1Slow.activeUntil = Date.now() + SLOW_DURATION;
                this.player1Slow.cooldownStart = Date.now();
            }
        }
        if (this.player1Slow.active && Date.now() >= this.player1Slow.activeUntil) {
            this.player1Slow.active = false;
        }

        // Check slow ability activation and expiration for player 2
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

        // Player 1 movement — slowed if player2's slow is active on them
        const p1Speed = PADDLE_SPEED * (this.player2Slow.active ? 0.67 : 1);
        if (this.player1.input.up) this.player1.paddleY -= p1Speed;
        if (this.player1.input.down) this.player1.paddleY += p1Speed;
        this.player1.paddleY = clamp(this.player1.paddleY, 0, CANVAS_H - PADDLE_H);

        // Player 2 movement — slowed if player1's slow is active on them
        const p2Speed = PADDLE_SPEED * (this.player1Slow.active ? 0.67 : 1);
        if (this.player2.input.up) this.player2.paddleY -= p2Speed;
        if (this.player2.input.down) this.player2.paddleY += p2Speed;
        this.player2.paddleY = clamp(this.player2.paddleY, 0, CANVAS_H - PADDLE_H);

        // Move ball
        this.ball.x += this.ball.vx;
        this.ball.y += this.ball.vy;

        // Trail
        this.trail.push({ x: this.ball.x, y: this.ball.y });
        if (this.trail.length > TRAIL_MAX) this.trail.shift();

        // Top/bottom wall bounce
        if (this.ball.y - BALL_SIZE / 2 <= 0) {
            this.ball.y = BALL_SIZE / 2;
            this.ball.vy = Math.abs(this.ball.vy);
        }
        if (this.ball.y + BALL_SIZE / 2 >= CANVAS_H) {
            this.ball.y = CANVAS_H - BALL_SIZE / 2;
            this.ball.vy = -Math.abs(this.ball.vy);
        }

        // Paddle 1 collision (left paddle at x=20)
        const p1x = 20;
        if (this.ball.vx < 0 &&
            this.ball.x - BALL_SIZE / 2 <= p1x + PADDLE_W &&
            this.ball.x + BALL_SIZE / 2 >= p1x &&
            this.ball.y >= this.player1.paddleY &&
            this.ball.y <= this.player1.paddleY + PADDLE_H) {
            const hit = (this.ball.y - (this.player1.paddleY + PADDLE_H / 2)) / (PADDLE_H / 2);
            const angle = hit * (Math.PI / 4);
            const speed = clamp(
                Math.sqrt(this.ball.vx * this.ball.vx + this.ball.vy * this.ball.vy) + 0.7,
                BALL_SPEED_INIT,
                BALL_SPEED_MAX
            );
            this.ball.vx = Math.cos(angle) * speed;
            this.ball.vy = Math.sin(angle) * speed;
            this.ball.x = p1x + PADDLE_W + BALL_SIZE / 2;
            events.push({ type: 'sound', sound: 'laser' });
        }

        // Paddle 2 collision (right paddle at x = CANVAS_W - 20 - PADDLE_W)
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
            this.ball.vx = -Math.cos(angle) * speed;
            this.ball.vy = Math.sin(angle) * speed;
            this.ball.x = p2x - BALL_SIZE / 2;
            events.push({ type: 'sound', sound: 'laser' });
        }

        // Round time limit
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

        // Scoring — ball past left edge
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

        // Scoring — ball past right edge
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

    _setupWaitingState() {
        this.phase = 'waiting';
        this.startingPlayer = Math.random() < 0.5 ? 1 : 2;
        this._positionBallAtPaddle();
    }

    getState() {
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
            p1Slow: {
                cooldownStart: this.player1Slow.cooldownStart,
                active: this.player1Slow.active,
            },
            p2Slow: {
                cooldownStart: this.player2Slow.cooldownStart,
                active: this.player2Slow.active,
            },
            explosion: {
                active: this.explosion.active,
                particles: this.explosion.particles,
                startTime: this.explosion.startTime,
            },
            countdownStart: this.countdownStart,
            roundStartTime: this.roundStartTime,
            winner: this.winner,
            p1Username: this.player1.username,
            p2Username: this.player2.username,
        };
    }

    getPlayerNumber(socketId) {
        if (socketId === this.player1.socketId) return 1;
        if (socketId === this.player2.socketId) return 2;
        return null;
    }

    destroy() {
        this.destroyed = true;
    }
}

module.exports = GameEngine;
