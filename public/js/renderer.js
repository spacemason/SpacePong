// Renderer — all drawing functions extracted from index.html
// Depends on globals from constants.js: CANVAS_W, CANVAS_H, BALL_SIZE,
// BALL_SPEED_MAX, BALL_SPEED_INIT, PADDLE_H, TRAIL_MAX, EXPLOSION_DURATION

var Renderer = (function () {

    /**
     * Generate an array of star objects for the space background.
     * @param {number} count - number of stars to create
     * @returns {Array} stars array
     */
    function generateStars(count) {
        var stars = [];
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * CANVAS_W,
                y: Math.random() * CANVAS_H,
                r: Math.random() * 1.5 + 0.5,
                brightness: Math.random() * 0.7 + 0.3,
                twinkleSpeed: Math.random() * 0.02 + 0.005
            });
        }
        return stars;
    }

    /**
     * Draw the background (space or plain) and twinkling stars.
     */
    function drawBackground(ctx, W, H, stars, bgEnabled) {
        ctx.fillStyle = bgEnabled ? '#050510' : '#111';
        ctx.fillRect(0, 0, W, H);

        if (bgEnabled) {
            var now = Date.now();
            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                var alpha = s.brightness * (0.6 + 0.4 * Math.sin(now * s.twinkleSpeed));
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
                ctx.fill();
            }
        }
    }

    /**
     * Draw the dashed center line.
     */
    function drawCenterLine(ctx, W, H) {
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);
        ctx.lineTo(W / 2, H);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    /**
     * Draw a single paddle rectangle.
     * @param {object} paddle - { x, y, w, h }
     * @param {string} color  - CSS color string
     */
    function drawPaddle(ctx, paddle, color) {
        ctx.fillStyle = color;
        ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    }

    /**
     * Draw the fire trail behind the ball.
     * Normal: dark red -> orange -> yellow
     * Comet (speed >= midpoint): icy blue-white
     * Meteor (speed >= BALL_SPEED_MAX - 0.5): intense with ember particles
     */
    function drawTrail(ctx, trail, ballSpeed) {
        var isMeteor = ballSpeed >= BALL_SPEED_MAX - 0.5;
        var isComet = !isMeteor && ballSpeed >= (BALL_SPEED_INIT + BALL_SPEED_MAX) / 2;

        for (var i = 0; i < trail.length; i++) {
            var t = i / trail.length; // 0 = oldest, 1 = newest

            if (isMeteor) {
                // Meteor trail: bigger, more intense
                var radius = (BALL_SIZE / 2) * (0.5 + t * 1.2);
                var alpha = t * 0.9;
                var r = 255;
                var g = Math.floor(100 + t * 155);
                var b = Math.floor(50 + t * 200);
                ctx.beginPath();
                ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
                ctx.fill();
                // Extra ember particles
                if (Math.random() < 0.4) {
                    var ox = (Math.random() - 0.5) * 10;
                    var oy = (Math.random() - 0.5) * 10;
                    ctx.beginPath();
                    ctx.arc(trail[i].x + ox, trail[i].y + oy, Math.random() * 2 + 1, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,200,50,' + (alpha * 0.6) + ')';
                    ctx.fill();
                }
            } else if (isComet) {
                // Comet trail: icy blue-white tail
                var radius = (BALL_SIZE / 2) * (0.4 + t * 0.9);
                var alpha = t * 0.85;
                var r = Math.floor(100 + t * 155);
                var g = Math.floor(180 + t * 75);
                var b = 255;
                ctx.beginPath();
                ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
                ctx.fill();
            } else {
                // Normal: dark red -> orange -> yellow
                var radius = (BALL_SIZE / 2) * (0.3 + t * 0.7);
                var alpha = t * 0.8;
                var r = 255;
                var g = Math.floor(60 + t * 180);
                var b = Math.floor(t * 30);
                ctx.beginPath();
                ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
                ctx.fill();
            }
        }
    }

    /**
     * Draw the ball with normal / comet / meteor appearance.
     * @param {object} ball - { x, y, vx, vy }
     * @param {number} ballSpeed - precomputed sqrt(vx^2 + vy^2)
     */
    function drawBall(ctx, ball, ballSpeed) {
        var isMeteor = ballSpeed >= BALL_SPEED_MAX - 0.5;
        var isComet = !isMeteor && ballSpeed >= (BALL_SPEED_INIT + BALL_SPEED_MAX) / 2;

        if (isMeteor) {
            // Outer glow
            var glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE * 1.5);
            glow.addColorStop(0, 'rgba(255,200,100,0.6)');
            glow.addColorStop(0.5, 'rgba(255,100,0,0.2)');
            glow.addColorStop(1, 'rgba(255,50,0,0)');
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            // Meteor body
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ff6600';
            ctx.fill();
            // Hot core
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc00';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else if (isComet) {
            // Icy blue glow
            var glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE * 1.2);
            glow.addColorStop(0, 'rgba(150,200,255,0.5)');
            glow.addColorStop(0.6, 'rgba(80,150,255,0.15)');
            glow.addColorStop(1, 'rgba(50,100,255,0)');
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            // Comet body
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#88ccff';
            ctx.fill();
            // Bright core
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else {
            // Normal ball (bright white-yellow core)
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffaa';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }
    }

    /**
     * Draw explosion particles with fading alpha.
     * @param {Array} particles - array of { x, y, r, color }
     * @param {number} elapsed  - ms since explosion started
     */
    function drawExplosion(ctx, particles, elapsed) {
        var alpha = 1 - elapsed / EXPLOSION_DURATION;
        for (var i = 0; i < particles.length; i++) {
            var p = particles[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, alpha);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Draw the big centered countdown number with a dark overlay.
     * @param {number} remaining - seconds left (e.g. 3, 2, 1)
     */
    function drawCountdown(ctx, W, H, remaining) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '120px Courier New';
        ctx.fillText(remaining, W / 2, H / 2 + 40);
    }

    /**
     * Draw a dark overlay with centered title and subtitle text.
     * Used for pause screen, waiting screens, etc.
     * @param {string} title    - large text line
     * @param {string} subtitle - smaller text line below
     */
    function drawOverlay(ctx, W, H, title, subtitle) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '48px Courier New';
        ctx.fillText(title, W / 2, H / 2);
        ctx.font = '20px Courier New';
        ctx.fillText(subtitle, W / 2, H / 2 + 40);
    }

    // Public API
    return {
        generateStars: generateStars,
        drawBackground: drawBackground,
        drawCenterLine: drawCenterLine,
        drawPaddle: drawPaddle,
        drawTrail: drawTrail,
        drawBall: drawBall,
        drawExplosion: drawExplosion,
        drawCountdown: drawCountdown,
        drawOverlay: drawOverlay
    };

})();
