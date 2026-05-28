// ============================================================
// renderer.js - The Artist of the Game
// ============================================================
// A "renderer" is the part of a game that DRAWS everything
// you see on the screen. Think of it like a super-fast artist
// who redraws the entire picture 60 times per second!
//
// This file uses the HTML "canvas" - which is like a digital
// painting canvas. We can draw shapes, lines, and colors on it
// using special commands like "fillRect" (draw a filled rectangle)
// and "arc" (draw a circle or part of a circle).
//
// The canvas uses an (x, y) coordinate system:
//   - x=0 is the left edge, x=800 is the right edge
//   - y=0 is the TOP edge, y=500 is the BOTTOM edge
//   (yes, y goes DOWN, which is a little weird!)
//
// "ctx" stands for "context" - it's the toolbox we use to draw.
// ============================================================

var Renderer = (function () {

    // --- STAR GENERATOR ---
    // Creates an array of star objects for the space background.
    // Each star gets a random position, size, brightness, and
    // twinkle speed - just like real stars look different from each other!
    function generateStars(count) {
        var stars = [];
        for (var i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * CANVAS_W,        // random position left-to-right
                y: Math.random() * CANVAS_H,        // random position top-to-bottom
                r: Math.random() * 1.5 + 0.5,       // radius (size) between 0.5 and 2 pixels
                brightness: Math.random() * 0.7 + 0.3, // how bright (0.3 to 1.0)
                twinkleSpeed: Math.random() * 0.02 + 0.005 // how fast it twinkles
            });
        }
        return stars;
    }

    // --- BACKGROUND ---
    // Fills the whole screen with a dark color, then draws twinkling stars.
    // The stars twinkle by using Math.sin() which makes a wave that goes
    // up and down over time - so the star's brightness gently pulses!
    function drawBackground(ctx, W, H, stars, bgEnabled) {
        // Dark space blue if background is on, plain dark gray if off
        ctx.fillStyle = bgEnabled ? '#050510' : '#111';
        ctx.fillRect(0, 0, W, H);

        // Only draw stars if the fancy background is turned on
        if (bgEnabled) {
            var now = Date.now();
            for (var i = 0; i < stars.length; i++) {
                var s = stars[i];
                // Math.sin makes a smooth wave (-1 to 1) so stars gently pulse
                var alpha = s.brightness * (0.6 + 0.4 * Math.sin(now * s.twinkleSpeed));
                ctx.beginPath();
                // arc() draws a circle: (center x, center y, radius, start angle, end angle)
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                // "alpha" controls transparency - closer to 0 = more see-through
                ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
                ctx.fill();
            }
        }
    }

    // --- CENTER LINE ---
    // Draws the dashed line down the middle of the court,
    // just like in real ping pong tables! The dashes are
    // 10 pixels long with 10-pixel gaps between them.
    function drawCenterLine(ctx, W, H) {
        ctx.setLineDash([10, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(W / 2, 0);      // start at top center
        ctx.lineTo(W / 2, H);      // draw to bottom center
        ctx.stroke();
        ctx.setLineDash([]);         // turn off dashes for other drawing
    }

    // --- PADDLE ---
    // Draws one paddle as a simple filled rectangle.
    // A paddle has x, y (top-left corner), w (width), and h (height).
    function drawPaddle(ctx, paddle, color) {
        ctx.fillStyle = color;
        ctx.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    }

    // --- FIRE TRAIL ---
    // Draws the cool trail behind the ball! The trail looks different
    // depending on how fast the ball is going:
    //   - Normal speed: red-orange-yellow fire trail
    //   - Medium speed ("comet"): icy blue-white trail
    //   - Max speed ("meteor"): intense fire with sparking embers!
    //
    // The trail is made of circles that get smaller and more transparent
    // the further they are from the ball (oldest = smallest & faintest).
    function drawTrail(ctx, trail, ballSpeed) {
        // Figure out which trail style to use based on ball speed
        var isMeteor = ballSpeed >= BALL_SPEED_MAX - 0.5;
        var isComet = !isMeteor && ballSpeed >= (BALL_SPEED_INIT + BALL_SPEED_MAX) / 2;

        for (var i = 0; i < trail.length; i++) {
            // "t" goes from 0 (oldest trail dot) to 1 (newest, closest to ball)
            var t = i / trail.length;

            if (isMeteor) {
                // METEOR: big, bright, with random spark particles flying off
                var radius = (BALL_SIZE / 2) * (0.5 + t * 1.2);
                var alpha = t * 0.9;
                var r = 255;
                var g = Math.floor(100 + t * 155);
                var b = Math.floor(50 + t * 200);
                ctx.beginPath();
                ctx.arc(trail[i].x, trail[i].y, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
                ctx.fill();
                // Randomly draw extra little sparks around the trail
                if (Math.random() < 0.4) {
                    var ox = (Math.random() - 0.5) * 10;
                    var oy = (Math.random() - 0.5) * 10;
                    ctx.beginPath();
                    ctx.arc(trail[i].x + ox, trail[i].y + oy, Math.random() * 2 + 1, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(255,200,50,' + (alpha * 0.6) + ')';
                    ctx.fill();
                }
            } else if (isComet) {
                // COMET: cool icy blue-white, like a frozen comet in space
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
                // NORMAL: warm fire colors - dark red fading to orange to yellow
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

    // --- BALL ---
    // Draws the ball itself with different looks based on speed:
    //   - Normal: simple white-yellow circle
    //   - Comet: glowing blue ball with bright white center
    //   - Meteor: fiery orange ball with glow effect and white-hot core
    //
    // The glow effect uses a "radial gradient" - a color that smoothly
    // changes from bright in the center to invisible at the edges,
    // like a flashlight shining on a wall.
    function drawBall(ctx, ball, ballSpeed) {
        var isMeteor = ballSpeed >= BALL_SPEED_MAX - 0.5;
        var isComet = !isMeteor && ballSpeed >= (BALL_SPEED_INIT + BALL_SPEED_MAX) / 2;

        if (isMeteor) {
            // Outer glow - a big semi-transparent circle around the ball
            var glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE * 1.5);
            glow.addColorStop(0, 'rgba(255,200,100,0.6)');
            glow.addColorStop(0.5, 'rgba(255,100,0,0.2)');
            glow.addColorStop(1, 'rgba(255,50,0,0)');
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            // Orange meteor body
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = '#ff6600';
            ctx.fill();
            // Hot yellow core
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = '#ffcc00';
            ctx.fill();
            // White-hot center (the hottest part!)
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.25, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else if (isComet) {
            // Icy blue glow around the ball
            var glow = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, BALL_SIZE * 1.2);
            glow.addColorStop(0, 'rgba(150,200,255,0.5)');
            glow.addColorStop(0.6, 'rgba(80,150,255,0.15)');
            glow.addColorStop(1, 'rgba(50,100,255,0)');
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 1.2, 0, Math.PI * 2);
            ctx.fillStyle = glow;
            ctx.fill();
            // Light blue comet body
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#88ccff';
            ctx.fill();
            // Bright white center
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else {
            // Normal ball - a simple glowing dot
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffaa'; // pale yellow outer
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_SIZE / 2 - 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; // white center
            ctx.fill();
        }
    }

    // --- EXPLOSION ---
    // When someone scores, particles fly out in all directions!
    // Each particle is a small colored circle that slowly fades away.
    // "alpha" controls how see-through the particles are - they start
    // fully visible and fade to invisible over EXPLOSION_DURATION.
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
        // Reset alpha back to fully visible for everything drawn after this
        ctx.globalAlpha = 1;
    }

    // --- COUNTDOWN ---
    // Shows a big number (3, 2, 1) in the center of the screen
    // with a dark overlay behind it so you can read it clearly.
    function drawCountdown(ctx, W, H, remaining) {
        // Semi-transparent black overlay (like sunglasses for the screen)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        // Big white number in the center
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '120px Courier New';
        ctx.fillText(remaining, W / 2, H / 2 + 40);
    }

    // --- OVERLAY ---
    // Shows a title and subtitle over the game (used for "PAUSED",
    // "Waiting...", etc.). Same dark background trick as countdown.
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

    // --- PUBLIC API ---
    // These are all the drawing functions that other files can use.
    // It's like a menu at a restaurant - these are the things we offer!
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
