// ============================================================
// constants.js - The Rule Book for Our Game
// ============================================================
// This file is like a recipe card. It holds all the important
// numbers that control how the game looks and feels -- things
// like how big the playing field is, how fast the ball moves,
// and how many points you need to win.
//
// We put these numbers here in one place so if we ever want
// to change something (like making the ball faster), we only
// have to change it in ONE spot instead of hunting through
// every file. Other files "require" this file to use them.
// ============================================================

// Game constants (Node.js module)

// The size of the game area (the "canvas") in pixels.
// Think of it like the size of the table in a real ping-pong game.
const CANVAS_W = 800;
const CANVAS_H = 500;

// How big the paddles are (the rectangles players move up and down).
// W = width (how thick), H = height (how tall).
const PADDLE_W = 12;
const PADDLE_H = 90;
// How many pixels the paddle moves each frame when you press up or down.
const PADDLE_SPEED = 6;

// How big the ball is (in pixels) and how fast it moves.
// The ball starts at BALL_SPEED_INIT and gets faster every time
// it bounces off a paddle, but it can never go faster than BALL_SPEED_MAX.
const BALL_SIZE = 10;
const BALL_SPEED_INIT = 5;
const BALL_SPEED_MAX = 12;

// First player to reach this many points wins the game!
const WIN_SCORE = 10;

// If a single round lasts longer than this (60,000 milliseconds = 60 seconds),
// the round ends automatically and the ball's position decides who gets the point.
const ROUND_TIME_LIMIT = 60000;

// The "slow" power-up lets you slow down your opponent's paddle.
// SLOW_COOLDOWN = how long you have to wait before using it again (5 seconds).
// SLOW_DURATION = how long the slow effect lasts (5 seconds).
const SLOW_COOLDOWN = 5000;
const SLOW_DURATION = 5000;

// After the game starts, players have to wait this long before
// their slow ability becomes available for the first time (10 seconds).
const PLAYER_SLOW_DELAY = 10000;

// How long the "3, 2, 1" countdown lasts before each round starts (3 seconds).
const COUNTDOWN_DURATION = 3000;

// How long the explosion animation plays when someone scores (1 second).
const EXPLOSION_DURATION = 1000;

// The ball leaves a trail behind it (like a comet tail).
// This is the maximum number of trail dots we remember.
const TRAIL_MAX = 40;

// "module.exports" is how we share these values with other files.
// Any file that does require('./constants') can use all of these numbers.
module.exports = {
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
    PLAYER_SLOW_DELAY,
    COUNTDOWN_DURATION,
    EXPLOSION_DURATION,
    TRAIL_MAX,
};
