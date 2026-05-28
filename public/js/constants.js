// ============================================================
// constants.js - Game Settings and Numbers
// ============================================================
// This file is like a recipe card for the game. It holds all
// the important numbers that control how big things are, how
// fast they move, and how the game works. We put them here so
// if we want to change something (like making the ball faster),
// we only have to change it in ONE place!
//
// "const" means "constant" - a number that never changes while
// the game is running. Think of it like writing a rule in pen
// instead of pencil.
// ============================================================

// How big the game screen (canvas) is, measured in tiny dots called "pixels"
// 800 pixels wide and 500 pixels tall - like a small TV screen
const CANVAS_W = 800;
const CANVAS_H = 500;

// The paddles are the rectangles players move up and down
// They are 12 pixels wide (thin) and 90 pixels tall
const PADDLE_W = 12;
const PADDLE_H = 90;
// How many pixels a paddle moves each frame (bigger = faster movement)
const PADDLE_SPEED = 6;

// The ball is 10 pixels across (its diameter)
const BALL_SIZE = 10;
// The ball starts at speed 5, and gets faster every time it bounces off a paddle
const BALL_SPEED_INIT = 5;
// The ball can never go faster than 12 - that's the speed limit!
const BALL_SPEED_MAX = 12;

// First player to score 10 points wins the game
const WIN_SCORE = 10;

// If a round takes longer than 60 seconds (60000 milliseconds),
// the round ends and the ball's position decides who gets the point
// (1000 milliseconds = 1 second)
const ROUND_TIME_LIMIT = 60000;

// The "slow" power-up: you can slow down your opponent!
// After using it, you have to wait 5 seconds before using it again (cooldown)
const SLOW_COOLDOWN = 5000;
// The slow effect lasts for 5 seconds
const SLOW_DURATION = 5000;

// In AI mode, after 10 seconds in a round, YOUR paddle gets slowed down
// too - this makes the game harder the longer a round goes on!
const PLAYER_SLOW_DELAY = 10000;

// The "3... 2... 1..." countdown before the ball launches takes 3 seconds
const COUNTDOWN_DURATION = 3000;

// When someone scores, there's a cool explosion that lasts 1 second
const EXPLOSION_DURATION = 1000;

// The ball leaves a fire trail behind it. We remember up to 40 old
// positions to draw the trail (like a comet's tail in the sky!)
const TRAIL_MAX = 40;
