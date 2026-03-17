// Audio manager (loaded via script tag — no modules)
var AudioManager = (function () {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var musicEnabled = true;

    function playLaserSound() {
        if (!musicEnabled) return;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.15);
    }

    function playGameOverSound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;
        // Deep boom
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
        // Descending tone
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

    function playVictorySound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;
        var notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach(function (freq, i) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t + i * 0.15);
            gain.gain.setValueAtTime(0, t);
            gain.gain.setValueAtTime(1.0, t + i * 0.15);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.3);
            osc.start(t + i * 0.15);
            osc.stop(t + i * 0.15 + 0.3);
        });
    }

    function playSadSound() {
        if (!musicEnabled) return;
        var t = audioCtx.currentTime;
        var notes = [400, 350, 300, 200]; // descending sad tones
        notes.forEach(function (freq, i) {
            var osc = audioCtx.createOscillator();
            var gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t + i * 0.25);
            gain.gain.setValueAtTime(0, t);
            gain.gain.setValueAtTime(1.0, t + i * 0.25);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.4);
            osc.start(t + i * 0.25);
            osc.stop(t + i * 0.25 + 0.4);
        });
    }

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
