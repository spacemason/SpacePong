# How This Pong Game Works - A Guide for Beginners

Hey! Welcome to the code behind this Pong game. This guide explains how
everything works in simple terms. If you're just starting to learn
programming, this is a great place to start!

---

## What Is This Game?

Pong is one of the first video games ever made. Two paddles hit a ball
back and forth. If you miss the ball, the other player scores a point.
First to 10 points wins!

This game has two versions:
1. **Local version** (`index.html`) - Play on one computer
2. **Online version** (`public/` + `server/`) - Play with friends over the internet

---

## Part 1: The Local Game (index.html)

The entire local game lives in ONE file: `index.html`. It has three
sections inside it:

### Section 1: HTML (The Structure)

HTML is like the skeleton of a webpage. It tells the browser what to
show. Here's what our HTML creates:

```
- A "Game Modes" menu (pick AI or 2 Players)
- A settings panel (toggle music and background)
- A color picker (change paddle colors)
- The game canvas (where the game is drawn)
- Score displays on each side
- Touch buttons for phones/tablets
```

The most important HTML element is the **canvas**:
```html
<canvas id="game" width="800" height="500"></canvas>
```
Think of a canvas like a whiteboard. We draw everything on it — the
paddles, the ball, the stars, explosions — using JavaScript.

### Section 2: CSS (The Style)

CSS makes things look nice. It controls colors, sizes, and positions.

```css
body {
    background: #111;     /* Dark background color */
    color: #fff;          /* White text */
    font-family: 'Courier New', monospace;  /* The font we use */
}
```

Color codes like `#111` are called "hex colors":
- `#111` = very dark gray (almost black)
- `#fff` = white
- `#ff0000` = red
- `#4caf50` = green

### Section 3: JavaScript (The Brain)

JavaScript is where the magic happens. It makes everything move and
respond to your actions. Let's break it down piece by piece:

#### The Game Variables

At the top, we set up numbers that control how the game works:

```javascript
const PADDLE_W = 12;          // Paddle width in pixels
const PADDLE_H = 90;          // Paddle height in pixels
const PADDLE_SPEED = 6;       // How fast paddles move
const BALL_SIZE = 10;          // Ball diameter
const BALL_SPEED_INIT = 5;    // Ball starting speed
const BALL_SPEED_MAX = 12;    // Ball maximum speed
const WIN_SCORE = 10;          // Points needed to win
```

`const` means "this value never changes." These are like the RULES
of the game. Try changing `WIN_SCORE` to 3 for a shorter game!

We also create objects to track the paddles and ball:

```javascript
const paddle1 = { x: 20, y: 250, w: 12, h: 90, score: 0 };
const ball = { x: 0, y: 0, vx: 0, vy: 0 };
```

An **object** is like a box that holds related information:
- `x` and `y` = position on screen
- `vx` and `vy` = velocity (how fast and which direction it moves)
- `score` = how many points this player has

#### The Game Loop

Every video game has a "game loop" — code that runs over and over,
about 60 times per second. Ours has two parts:

```javascript
function gameLoop() {
    update();   // 1. Figure out what changed
    draw();     // 2. Draw everything on screen
    requestAnimationFrame(gameLoop);  // 3. Do it again!
}
```

`requestAnimationFrame` tells the browser "call this function again
before the next screen refresh." This creates smooth animation!

#### The Update Function (Game Logic)

`update()` is where all the game rules happen:

**Moving the paddles:**
```javascript
if (keys['w']) paddle1.y -= PADDLE_SPEED;  // W key = move up
if (keys['s']) paddle1.y += PADDLE_SPEED;  // S key = move down
```

Remember: on a screen, y=0 is the TOP. So subtracting from y moves UP,
and adding to y moves DOWN. This confuses everyone at first!

**Moving the ball:**
```javascript
ball.x += ball.vx;  // Move horizontally
ball.y += ball.vy;  // Move vertically
```

The ball has velocity (speed + direction). Every frame, we add the
velocity to the position. That's how movement works in games!

**Bouncing off walls:**
```javascript
if (ball.y - BALL_SIZE / 2 <= 0) {   // Hit top wall?
    ball.vy = Math.abs(ball.vy);       // Make vy positive (go down)
}
if (ball.y + BALL_SIZE / 2 >= H) {   // Hit bottom wall?
    ball.vy = -Math.abs(ball.vy);      // Make vy negative (go up)
}
```

**Paddle collision (the trickiest part!):**

When the ball hits a paddle, we calculate where on the paddle it hit:
```javascript
const hit = (ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2);
```
This gives a number from -1 (top of paddle) to +1 (bottom of paddle).
We use this to change the ball's angle — hit the edge of the paddle
and the ball flies off at a steep angle!

**Scoring:**
```javascript
if (ball.x < 0) {           // Ball went past left side?
    paddle2.score++;          // Player 2 scores!
}
if (ball.x > W) {           // Ball went past right side?
    paddle1.score++;          // Player 1 scores!
}
```

#### The Draw Function (Graphics)

`draw()` paints everything on the canvas. It runs every frame, so it
clears the screen and redraws everything from scratch:

```javascript
// 1. Draw the space background
ctx.fillStyle = '#050510';
ctx.fillRect(0, 0, W, H);

// 2. Draw twinkling stars
for (const s of stars) { ... }

// 3. Draw the center line
// 4. Draw both paddles
// 5. Draw the ball trail (fire, ice, or meteor effect)
// 6. Draw the ball itself
```

The `ctx` is the "drawing context" — it's like a pen that draws on
the canvas. Some important drawing commands:

- `ctx.fillRect(x, y, width, height)` - Draw a filled rectangle
- `ctx.arc(x, y, radius, 0, Math.PI*2)` - Draw a circle
- `ctx.fillStyle = 'red'` - Set the drawing color
- `ctx.fillText('Hello', x, y)` - Write text on the canvas

#### The Ball's Visual Stages

The ball changes appearance based on speed:

1. **Normal** (slow speed) — Yellow-white with a fire trail
2. **Comet** (medium speed) — Blue with an icy trail
3. **Meteor** (maximum speed) — Big fiery orange with embers

This is checked with:
```javascript
const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
const isMeteor = ballSpeed >= BALL_SPEED_MAX - 0.5;
const isComet = !isMeteor && ballSpeed >= (BALL_SPEED_INIT + BALL_SPEED_MAX) / 2;
```

`Math.sqrt(vx² + vy²)` calculates the actual speed using the
Pythagorean theorem. Yes, math class is useful in game development!

#### Keyboard Input

We track which keys are pressed using an object:

```javascript
const keys = {};
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;   // Key pressed!
});
window.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;  // Key released!
});
```

Then in update(), we check: `if (keys['w'])` — is W pressed right now?

#### The AI Opponent

The AI is surprisingly simple! It just tries to move its paddle toward
the ball:

```javascript
const center = paddle2.y + PADDLE_H / 2;  // Center of AI paddle
const diff = ball.y - center;              // How far is the ball?
const aiSpeed = PADDLE_SPEED * 0.75;       // AI is a bit slower
if (Math.abs(diff) > 10) {                 // If ball is far enough
    paddle2.y += Math.sign(diff) * aiSpeed; // Move toward it
}
```

The AI moves at 75% speed so it's beatable. That's it — no fancy
artificial intelligence, just "move toward the ball"!

#### Sound Effects

Sounds are made with the Web Audio API — no sound files needed!
We create sounds by generating electronic waves:

```javascript
const osc = audioCtx.createOscillator();  // Create a sound wave
osc.type = 'sawtooth';                    // Wave shape
osc.frequency.setValueAtTime(1200, ...);  // Start at high pitch
osc.frequency.exponentialRampToValueAtTime(200, ...); // Slide to low
```

The laser sound starts at a high pitch (1200 Hz) and slides down to
a low pitch (200 Hz) in 0.15 seconds. That "pew pew" is just math!

#### Touch Controls

For phones and tablets, we track finger positions on the canvas:

```javascript
canvas.addEventListener('touchstart', e => {
    const pos = getTouchPos(touch);        // Where did they touch?
    if (pos.x < W / 2) {                  // Left half of screen?
        touchP1TargetY = pos.y;            // Move player 1 there
    }
});
```

The paddle doesn't jump to your finger — it moves toward it smoothly
at the same speed as keyboard controls. This feels better to play!

---

## Part 2: The Online Version (public/ + server/)

The online version splits the code into many files. Here's why:

When you play locally, everything runs on YOUR computer. But for
online play, we need a **server** (a computer in the middle) that
both players connect to. The server makes sure nobody cheats and
keeps both players in sync.

### File Map

```
public/              <-- Runs in the BROWSER (what you see)
  index.html         <-- The webpage structure
  css/style.css      <-- All the visual styles
  js/
    constants.js     <-- Game rules (shared with server)
    audio.js         <-- Sound effects
    renderer.js      <-- Drawing functions (ball, paddles, stars...)
    localGame.js     <-- Local play (same as index.html logic)
    onlineGame.js    <-- Online play (talks to server)
    network.js       <-- Handles internet connection
    lobbyUI.js       <-- The lobby screen (player list, etc.)
    main.js          <-- Controls which screen you're on

server/              <-- Runs on the SERVER (the middle computer)
    server.js        <-- Starts the server, handles connections
    gameEngine.js    <-- Game physics (runs on server, not browser!)
    gameManager.js   <-- Manages multiple games at once
    lobbyManager.js  <-- Tracks who's online and challenges
    storageManager.js<-- Saves wins/losses to a file
    constants.js     <-- Same game rules as the client
    data/
        matches.json <-- Record of every game played
        players.json <-- Every player's win/loss stats
```

### How Online Play Works

Think of it like a board game by mail:

1. **You** press W to move up
2. Your **browser** sends a message to the **server**: "I'm pressing up!"
3. The **server** moves your paddle, moves the ball, checks for
   collisions — all the game logic
4. The **server** sends back: "Here's where everything is now"
5. Your **browser** draws it on screen

This happens 20-60 times per second! It feels instant because the
internet is fast.

### The Server (Node.js)

The server is written in JavaScript too, but it runs in **Node.js**
instead of a browser. Node.js lets JavaScript run on a server.

**server.js** is the main server file. It uses two important libraries:
- **Express** — serves the webpage files to your browser
- **Socket.IO** — enables real-time two-way communication

```javascript
// When a player connects...
io.on('connection', (socket) => {
    // When they register their username...
    socket.on('register', (data, ack) => {
        lobbyManager.addPlayer(socket.id, data.username);
    });
    // When they send game input...
    socket.on('playerInput', (data) => {
        engine.handleInput(socket.id, data);
    });
});
```

**Socket.IO** works like a walkie-talkie:
- `socket.emit('message', data)` = Send a message
- `socket.on('message', callback)` = Listen for a message

### The Game Engine (gameEngine.js)

This is the same game logic as the local version, but running on the
server. It processes inputs from BOTH players and simulates the game:

```javascript
tick() {
    // Move paddles based on player inputs
    // Move ball
    // Check collisions
    // Update scores
    // Return events (sounds to play, etc.)
}
```

The server runs `tick()` 60 times per second and broadcasts the
game state to both players 20 times per second.

### The Network Client (network.js)

This runs in your browser and talks to the server:

```javascript
Network.connect('MyName')        // Join the server
Network.sendInput({up: true})    // Tell server you're pressing up
Network.challenge(otherPlayer)   // Challenge someone to play
Network.onGameState(callback)    // Listen for game updates
```

### The Lobby (lobbyUI.js)

The lobby shows:
- **Connected Players** — who's online, with a "Challenge" button
- **Active Games** — games in progress you can watch
- **Leaderboard** — who has the most wins
- **Match History** — record of every game played

### Data Storage (storageManager.js)

Every game result is saved to JSON files:

```javascript
// players.json looks like:
{
    "Alex": { "wins": 5, "losses": 3, "gamesPlayed": 8 },
    "Sam":  { "wins": 2, "losses": 6, "gamesPlayed": 8 }
}

// matches.json looks like:
[
    {
        "player1": "Alex",
        "player2": "Sam",
        "score1": 10,
        "score2": 7,
        "winner": "Alex",
        "timestamp": "2026-03-18T..."
    }
]
```

JSON (JavaScript Object Notation) is a way to store data as text.
It looks just like JavaScript objects!

---

## Part 3: Key Programming Concepts Used

Here are the big ideas you'll see throughout this code:

### Variables — Storing Information
```javascript
let score = 0;           // A number that can change
const SPEED = 5;         // A number that stays the same
let name = "Pong";       // A piece of text (called a "string")
let playing = true;      // true or false (called a "boolean")
```

### Objects — Grouping Related Data
```javascript
const ball = {
    x: 400,    // horizontal position
    y: 250,    // vertical position
    vx: 5,     // horizontal speed
    vy: 3      // vertical speed
};
// Access with: ball.x, ball.y, etc.
```

### Functions — Reusable Blocks of Code
```javascript
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
// clamp(150, 0, 100) returns 100 (keeps values in range)
```

### If Statements — Making Decisions
```javascript
if (ball.x < 0) {
    // Ball went off the left side!
    score2++;
} else if (ball.x > 800) {
    // Ball went off the right side!
    score1++;
}
```

### Loops — Repeating Actions
```javascript
// Draw all 150 stars
for (const star of stars) {
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
}
```

### Event Listeners — Responding to Actions
```javascript
// When a key is pressed, do something
window.addEventListener('keydown', function(e) {
    if (e.key === 'w') {
        // Move paddle up!
    }
});
```

### The Coordinate System
```
(0,0) -------- x increases --------> (800,0)
  |                                      |
  |          The Canvas                  |
  y increases                            |
  |                                      |
  v                                      |
(0,500) --------------------------> (800,500)
```

**Important:** y=0 is at the TOP, not the bottom! Moving "up" on
screen means making y SMALLER. This is standard in computer graphics.

---

## Try These Experiments!

Want to start modifying the game? Here are some easy things to try
in `index.html`:

1. **Change the ball speed** — Find `BALL_SPEED_INIT` and change 5
   to 10. Watch the ball zoom!

2. **Make paddles bigger** — Change `PADDLE_H` from 90 to 200.
   Now it's easy mode!

3. **Change the win score** — Change `WIN_SCORE` from 10 to 3
   for quick games.

4. **Change star count** — Find `i < 150` in the stars loop and
   change 150 to 500 for a crowded sky.

5. **Change ball color** — Find `#ffffaa` (the ball color) and
   change it to `red` or `#00ff00` (green).

6. **Make the AI smarter** — Find `PADDLE_SPEED * 0.75` (AI speed)
   and change 0.75 to 1.0. Now the AI is as fast as you!

7. **Reverse gravity** — In the wall bounce code, try removing the
   bounce logic. What happens?

Each time you make a change, save the file and refresh your browser
to see what happened. Don't be afraid to break things — you can
always undo your changes!

---

## Glossary

- **Canvas** — An HTML element you can draw on, like a digital whiteboard
- **CSS** — The language that controls how things look (colors, sizes)
- **DOM** — The structure of a webpage that JavaScript can modify
- **Event** — Something that happens (key press, mouse click, etc.)
- **Frame** — One single picture in an animation (games show ~60 per second)
- **Function** — A reusable chunk of code with a name
- **HTML** — The language that defines the structure of a webpage
- **JavaScript** — The programming language that makes webpages interactive
- **JSON** — A text format for storing data (looks like JS objects)
- **Node.js** — A tool that runs JavaScript outside of a browser
- **Object** — A container that groups related variables together
- **Pixel** — One tiny dot on your screen
- **Server** — A computer that other computers connect to
- **Socket** — A real-time two-way connection between computers
- **Variable** — A named container that stores a value
- **Velocity** — Speed with a direction (how fast AND which way)
