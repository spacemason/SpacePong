// ============================================================================
// hubInput.js — diffenderfer.games shared INPUT SYSTEM integration
// ============================================================================
// This is a small bridge to the hub's unified input layer (hub.input). It gives
// the online Pong client first-class keyboard + touch + gamepad support for the
// paddle WITHOUT changing any of the existing keyboard / mouse / touch handling
// already in onlineGame.js — that all keeps working as before. This module just
// ADDS a gamepad paddle axis on top. (Touch is handled directly by the game as
// touch-to-target; there is no hub on-screen joystick.)
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
    // combines up/down into -1..1. The hub maps these to keyboard (w/s +
    // arrows) and gamepad (left stick vertical + d-pad).
    //
    // NOTE: there is intentionally NO touch mapping / on-screen virtual
    // joystick here. Touch is handled directly by the game as tap/drag
    // "touch-to-target" on the play surface (see onlineGame.js), which feels
    // far better than a draggable stick. Keeping a hub touch stick would draw
    // a second, competing control, so it is omitted.
    hub.input.define({
        groups: {
            play: {
                inputs: {
                    paddleUp:   { keys: ['w', 'arrowup'],   gamepad: { axis: [1, '-'] } },
                    paddleDown: { keys: ['s', 'arrowdown'], gamepad: { axis: [1, '+'] } },
                },
                axes: { paddle: { y: ['paddleUp', 'paddleDown'] } },
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

    // Make the client's own menus / lobby / modals gamepad-navigable. While any
    // matching button is visible AND a gamepad is the active device, the
    // d-pad/stick move a highlight ring across them and A clicks the focused
    // one. It re-queries every frame (so it follows screens showing/hiding) and
    // is a no-op for mouse/touch/keyboard, so it doesn't affect existing input
    // or in-game paddle control. Selector covers the main mode-select menu, the
    // username + color modals, and every lobby action / challenge modal (all of
    // which carry the .lobby-btn class).
    try {
        hub.input.autoNavigate(
            '#mode-select .mode-btn, #username-modal .mode-btn, #online-color-modal .mode-btn, .lobby-btn'
        );
    } catch (e) {}
}).catch(function () {
    // Hub client not available (running without the host). Keep the no-op
    // surface — existing keyboard/touch controls remain fully functional.
});
