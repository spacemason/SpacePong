// ============================================================
// audio.js - Sound Effects Manager
// ============================================================
// This file makes all the sounds you hear in the game!
//
// HOW COMPUTERS MAKE SOUNDS:
// Sounds are actually invisible waves in the air, kind of like
// waves in a swimming pool. Your speakers push air back and
// forth really fast to create these waves. The computer uses
// something called an "oscillator" to make these waves.
//
// Different wave shapes make different sounds:
//   - "sine" = smooth and round, like a flute (oooooo)
//   - "square" = blocky, like old video games (beep beep)
//   - "sawtooth" = buzzy, like a laser (zzzzzap!)
//
// The "frequency" is how fast the wave goes up and down.
// High frequency = high-pitched sound (like a whistle)
// Low frequency = low-pitched sound (like a drum)
//
// The "gain" is the volume - how loud or quiet the sound is.
// We fade it from loud to silent so sounds don't cut off suddenly.
// ============================================================

// AudioManager is wrapped in a special pattern called an IIFE
// (Immediately Invoked Function Expression). Think of it like
// a lunchbox - everything inside is private and organized,
// and we only share what we want to through the little window.
var AudioManager = (function () {
    // Create the audio system - this is like turning on the sound mixer
    // "webkitAudioContext" is for older Safari browsers
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // This flag lets us turn all sounds on or off
    var musicEnabled = true;

    // --- LASER SOUND (plays when the ball hits a paddle) ---
    // Makes a quick "pew!" sound by starting at a high pitch (1200 Hz)
    // and sliding down to a low pitch (200 Hz) in 0.15 seconds
    function playLaserSound() {
        // If sound is turned off, do nothing
        if (!musicEnabled) return;
        // Create an oscillator (the wave maker) and a gain node (volume knob)
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        // Connect them: oscillator -> volume -> speakers
        // It's like connecting a guitar to an amp to a speaker!
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        // "sawtooth" waves sound buzzy and laser-like
        osc.type = 'sawtooth';
        // Start at a high pitch (1200 Hz) and slide down to 200 Hz
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15);
        // Start at half volume and fade to silence
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        // Play the sound for 0.15 seconds (very quick!)
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    }

    // --- GAME OVER SOUND (plays when someone wins) ---
    // This creates a dramatic "BOOM" followed by a sad descending tone,
    // like in movies when something big happens.
    // It uses TWO oscillators playing at the same time!
    function playGameOverSound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;

        // Sound 1: A deep boom (like a bass drum)
        // Uses a smooth "sine" wave starting at 150 Hz going down to 40 Hz
        var osc1 = audioCtx.createOscillator();
        var gain1 = audioCtx.createGain();
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(150, t);
        osc1.frequency.exponentialRampToValueAtTime(40, t + 0.8);
        gain1.gain.setValueAtTime(0.6, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
        osc1.start(t);
        osc1.stop(t + 0.8);

        // Sound 2: A descending tone on top of the boom
        // Uses a "square" wave (retro game sound) from 600 Hz to 80 Hz
        var osc2 = audioCtx.createOscillator();
        var gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(600, t);
        osc2.frequency.exponentialRampToValueAtTime(80, t + 1.0);
        gain2.gain.setValueAtTime(0.3, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
        osc2.start(t);
        osc2.stop(t + 1.0);
    }

    // --- VICTORY SOUND (plays when YOU win!) ---
    // Plays 4 musical notes going UP (C, E, G, C) - a happy chord!
    // It's like the "da da da DAA!" you hear when you complete something.
    // Each note plays 0.15 seconds after the last one.
    function playVictorySound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;
        // These numbers are musical note frequencies (measured in Hertz)
        // C5=523, E5=659, G5=784, C6=1047 - a major chord going up!
        var notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach(function (freq, i) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'square';
            // Each note starts a little later (i * 0.15 seconds apart)
            osc.frequency.setValueAtTime(freq, t + i * 0.15);
            gain.gain.setValueAtTime(0, t);
            gain.gain.setValueAtTime(1.0, t + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.3);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.3);
        });
    }

    // --- SAD SOUND (plays when you lose) ---
    // The opposite of victory - 4 notes going DOWN, which sounds sad.
    // Uses smooth "sine" waves and plays slower than the victory sound.
    function playSadSound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;
        // Descending frequencies make things sound sad and droopy
        var notes = [400, 350, 300, 200]; // descending sad tones
        notes.forEach(function (freq, i) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            // Each note is 0.25 seconds apart (slower = sadder)
            osc.frequency.setValueAtTime(freq, t + i * 0.25);
            gain.gain.setValueAtTime(0, t);
            gain.gain.setValueAtTime(1.0, t + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.4);
            osc.start(t + i * 0.25);
            osc.stop(t + i * 0.25 + 0.4);
        });
    }

    // This is the "window" of our lunchbox - we only share these things
    // with the rest of the program. Everything else stays private inside.
    return {
        get audioCtx() { return audioCtx; },
        get musicEnabled() { return musicEnabled; },
        set musicEnabled(val) { musicEnabled = val; },
        playLaserSound: playLaserSound,
        playGameOverSound: playGameOverSound,
        playVictorySound: playVictorySound,
        playSadSound: playSadSound,
    };
})();
