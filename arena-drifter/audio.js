// audio.js — AudioManager (engine, drift, music, one-shot SFX)
(function() {
  'use strict';

  const Audio = {
    ctx: null,
    masterGain: null,
    sfxVolume: 0.7,
    musicVolume: 0.4,
    muted: false,
    sounds: {},
    engineOsc: null, engineGain: null, engineFilter: null, _enginePlaying: false,
    driftNoise: null, driftGain: null, driftFilter: null, _driftPlaying: false,
    musicNodes: null, _musicPlaying: false,

    init() {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        // Load prefs
        try {
          const saved = JSON.parse(localStorage.getItem('oversteer_audio_v1'));
          if (saved) {
            this.sfxVolume = saved.sfx ?? 0.7;
            this.musicVolume = saved.music ?? 0.4;
            this.muted = saved.muted ?? false;
          }
        } catch(e) {}
        this.masterGain.gain.value = this.muted ? 0 : 1;
        // Generate one-shot SFX via offline render → Howler
        this._genAllSounds();
      } catch(e) {
        console.warn('AudioManager init failed:', e);
      }
    },

    _savePrefs() {
      localStorage.setItem('oversteer_audio_v1', JSON.stringify({
        sfx: this.sfxVolume, music: this.musicVolume, muted: this.muted
      }));
    },

    _generateWav(fn, dur, sampleRate) {
      sampleRate = sampleRate || 44100;
      const len = Math.floor(dur * sampleRate);
      const buf = new Float32Array(len);
      fn(buf, sampleRate, len);
      // Encode as WAV blob URL
      const numCh = 1, bitsPerSample = 16;
      const byteRate = sampleRate * numCh * bitsPerSample / 8;
      const blockAlign = numCh * bitsPerSample / 8;
      const dataSize = len * blockAlign;
      const abuf = new ArrayBuffer(44 + dataSize);
      const v = new DataView(abuf);
      const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      writeStr(0, 'RIFF'); v.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
      writeStr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, numCh, true); v.setUint32(24, sampleRate, true);
      v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true);
      v.setUint16(34, bitsPerSample, true); writeStr(36, 'data'); v.setUint32(40, dataSize, true);
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, buf[i]));
        v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      return URL.createObjectURL(new Blob([abuf], { type: 'audio/wav' }));
    },

    _genAllSounds() {
      // collision: white noise burst + sine thump 100Hz, 0.15s
      this.sounds.collision = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr, env = 1 - t / 0.15;
          b[i] = (Math.random() * 2 - 1) * 0.3 * env + Math.sin(2 * Math.PI * 100 * t) * 0.5 * env;
        }
      }, 0.15)], volume: this.sfxVolume });

      // encircle: ascending sine sweep 400→1200Hz + harmonics, 0.4s
      this.sounds.encircle = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr, env = 1 - t / 0.4;
          const freq = 400 + 800 * (t / 0.4);
          b[i] = (Math.sin(2 * Math.PI * freq * t) * 0.4 +
                  Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2 +
                  Math.sin(2 * Math.PI * freq * 2 * t) * 0.1) * env;
        }
      }, 0.4)], volume: this.sfxVolume });

      // near_miss: bandpass noise sweep 500→2kHz, 0.15s
      this.sounds.near_miss = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr, env = 1 - t / 0.15;
          const noise = Math.random() * 2 - 1;
          b[i] = noise * 0.4 * env * Math.sin(2 * Math.PI * (500 + 1500 * t / 0.15) * t);
        }
      }, 0.15)], volume: this.sfxVolume });

      // horde_warn: square wave 440Hz, 8Hz on-off pulse, 0.8s
      this.sounds.horde_warn = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.sin(2 * Math.PI * 8 * t) > 0 ? 1 : 0;
          const sq = Math.sin(2 * Math.PI * 440 * t) > 0 ? 0.35 : -0.35;
          b[i] = sq * env * (1 - t / 0.8);
        }
      }, 0.8)], volume: this.sfxVolume });

      // combo_sting: sine chord (root + fifth + octave), 0.25s
      this.sounds.combo_sting = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr, env = 1 - t / 0.25;
          b[i] = (Math.sin(2 * Math.PI * 440 * t) * 0.3 +
                  Math.sin(2 * Math.PI * 660 * t) * 0.2 +
                  Math.sin(2 * Math.PI * 880 * t) * 0.15) * env;
        }
      }, 0.25)], volume: this.sfxVolume });

      // ui_click: sine blip 800Hz fast decay, 0.05s
      this.sounds.ui_click = new Howl({ src: [this._generateWav((b, sr, len) => {
        for (let i = 0; i < len; i++) {
          const t = i / sr, env = 1 - t / 0.05;
          b[i] = Math.sin(2 * Math.PI * 800 * t) * 0.3 * env * env;
        }
      }, 0.05)], volume: this.sfxVolume });
    },

    play(id) {
      if (!this.sounds[id]) return;
      this.sounds[id].volume(this.muted ? 0 : this.sfxVolume);
      this.sounds[id].play();
    },

    // --- Engine (live oscillator) ---
    startEngine() {
      if (!this.ctx || this._enginePlaying) return;
      this._resumeCtx();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 80;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 800;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = this.muted ? 0 : 0.1 * this.sfxVolume;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);
      this.engineOsc.start();
      this._enginePlaying = true;
    },
    stopEngine() {
      if (!this._enginePlaying) return;
      try { this.engineOsc.stop(); } catch(e) {}
      this._enginePlaying = false;
      this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    },
    setEngineSpeed(speedFrac) {
      if (!this._enginePlaying || !this.engineOsc) return;
      const f = Math.max(0, Math.min(1, speedFrac));
      this.engineOsc.frequency.value = 80 + 120 * f;
      this.engineGain.gain.value = this.muted ? 0 : (0.1 + 0.3 * f) * this.sfxVolume;
    },

    // --- Drift squeal (live noise) ---
    startDrift() {
      if (!this.ctx || this._driftPlaying) return;
      this._resumeCtx();
      // White noise buffer
      const bufSize = this.ctx.sampleRate * 2;
      const noiseBuf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      this.driftNoise = this.ctx.createBufferSource();
      this.driftNoise.buffer = noiseBuf;
      this.driftNoise.loop = true;
      this.driftFilter = this.ctx.createBiquadFilter();
      this.driftFilter.type = 'highpass';
      this.driftFilter.frequency.value = 2000;
      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.value = 0;
      this.driftNoise.connect(this.driftFilter);
      this.driftFilter.connect(this.driftGain);
      this.driftGain.connect(this.masterGain);
      this.driftNoise.start();
      this._driftPlaying = true;
    },
    stopDrift() {
      if (!this._driftPlaying) return;
      try { this.driftNoise.stop(); } catch(e) {}
      this._driftPlaying = false;
      this.driftNoise = null; this.driftGain = null; this.driftFilter = null;
    },
    setDriftIntensity(slip) {
      if (!this.ctx) return;
      if (slip > 0 && !this._driftPlaying) this.startDrift();
      if (slip <= 0 && this._driftPlaying) { this.stopDrift(); return; }
      if (this._driftPlaying && this.driftGain) {
        this.driftGain.gain.value = this.muted ? 0 : Math.min(1, slip) * 0.25 * this.sfxVolume;
      }
    },

    // --- Music (live oscillators) ---
    startMusic() {
      if (!this.ctx || this._musicPlaying) return;
      this._resumeCtx();
      const g = this.ctx.createGain();
      g.gain.value = this.muted ? 0 : this.musicVolume * 0.3;
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine'; osc1.frequency.value = 110;
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine'; osc2.frequency.value = 165;
      // LFO for subtle modulation
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.3;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 5;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 300;
      osc1.connect(filt); osc2.connect(filt);
      filt.connect(g); g.connect(this.masterGain);
      osc1.start(); osc2.start(); lfo.start();
      this.musicNodes = { osc1, osc2, lfo, lfoGain, filter: filt, gain: g };
      this._musicPlaying = true;
    },
    stopMusic() {
      if (!this._musicPlaying || !this.musicNodes) return;
      try { this.musicNodes.osc1.stop(); } catch(e) {}
      try { this.musicNodes.osc2.stop(); } catch(e) {}
      try { this.musicNodes.lfo.stop(); } catch(e) {}
      this._musicPlaying = false;
      this.musicNodes = null;
    },
    fadeOutMusic(dur) {
      if (!this._musicPlaying || !this.musicNodes) return;
      const g = this.musicNodes.gain;
      g.gain.setValueAtTime(g.gain.value, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + dur);
      const nodes = this.musicNodes;
      this._musicPlaying = false;
      this.musicNodes = null;
      setTimeout(() => {
        try { nodes.osc1.stop(); } catch(e) {}
        try { nodes.osc2.stop(); } catch(e) {}
        try { nodes.lfo.stop(); } catch(e) {}
      }, dur * 1000 + 50);
    },

    stopAll() {
      this.stopEngine();
      this.stopDrift();
      this.stopMusic();
    },

    setMuted(val) {
      this.muted = val;
      if (this.masterGain) this.masterGain.gain.value = val ? 0 : 1;
      this._savePrefs();
    },

    setVolume(type, val) {
      val = Math.max(0, Math.min(1, Math.round(val * 10) / 10));
      if (type === 'sfx') {
        this.sfxVolume = val;
        if (this._enginePlaying && this.engineGain) {
          this.engineGain.gain.value = this.muted ? 0 : this.sfxVolume * 0.2;
        }
      } else if (type === 'music') {
        this.musicVolume = val;
        if (this._musicPlaying && this.musicNodes) {
          this.musicNodes.gain.gain.value = this.muted ? 0 : this.musicVolume * 0.3;
        }
      }
      this._savePrefs();
    },

    _resumeCtx() {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
  };

  window.Audio = Audio;
})();
