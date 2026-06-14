// ============================================================================
// hubInput.js — diffenderfer.games shared INPUT SYSTEM integration
// ============================================================================
// This is a small bridge to the hub's unified input layer (hub.input). It gives
// the online Pong client first-class keyboard + touch + gamepad support for the
// paddle WITHOUT changing any of the existing keyboard / mouse / touch handling
// already in onlineGame.js — that all keeps working as before. This module just
// ADDS a gamepad/touch-stick paddle axis on top.
//
// Paddle control is a 1-D vertical axis: up / down. We declare those inputs
// once and expose `window.HubPaddle` with helpers that onlineGame.js folds into
// its existing per-frame input poll.
//
// Loaded as an ES module (it imports the canonical hub client served by the
// host at /_hub/hub.js). When the game is run outside the hub host (e.g. a bare
// static server with no /_hub/ route), the import fails gracefully and the
// helpers become no-ops, so existing keyboard/touch play is unaffected.
// ============================================================================

// Default no-op surface so onlineGame.js can call these unconditionally even if
// the hub client never loads (e.g. running the raw repo without the host).
window.HubPaddle = {
    ready: false,
    enable: function () {},
    disable: function () {},
    // Returns the paddle axis in -1..1 (negative = up, positive = down), or 0.
    axis: function () { return 0; },
};

import('/_hub/hub.js').then(function (mod) {
    var hub = mod.hub;
    if (!hub || !hub.input) return;

    // Declare named inputs once. Each reads as a scalar; the `paddle` axis
    // combines up/down into -1..1. The hub maps these to gamepad (left stick
    // vertical + d-pad) and a touch joystick automatically, and draws the
    // on-screen stick for touch devices.
    hub.input.define({
        groups: {
            play: {
                inputs: {
                    paddleUp:   { keys: ['w', 'arrowup'],   gamepad: { axis: [1, '-'] }, touch: { stick: 'pad', axis: 'y-' } },
                    paddleDown: { keys: ['s', 'arrowdown'], gamepad: { axis: [1, '+'] }, touch: { stick: 'pad', axis: 'y+' } },
                },
                axes: { paddle: { y: ['paddleUp', 'paddleDown'] } },
                virtual: [
                    { id: 'pad', type: 'joystick', place: 'right', size: 140 },
                ],
            },
        },
    });

    window.HubPaddle = {
        ready: true,
        enable: function () { try { hub.input.enable('play'); } catch (e) {} },
        disable: function () { try { hub.input.disable('play'); } catch (e) {} },
        // -1..1 vertical axis (negative = up, positive = down).
        axis: function () {
            try { return hub.input.axis('paddle'); } catch (e) { return 0; }
        },
    };
}).catch(function () {
    // Hub client not available (running without the host). Keep the no-op
    // surface — existing keyboard/touch controls remain fully functional.
});
