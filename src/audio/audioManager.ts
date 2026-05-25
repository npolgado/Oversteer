// AudioManager — engine, drift, music, one-shot SFX
// Ported from arena-drifter/audio.js. Renamed Audio -> AudioManager to avoid
// shadowing the browser's Audio constructor.
import { Howl, Howler } from 'howler';
import { log, logError } from '@debug/logger';

const _TRACK_NAMES = ['hype', 'neon', 'slipstream', 'tron'] as const;

const audioManager = {
  ctx: null as AudioContext | null,
  masterGain: null as GainNode | null,
  sfxVolume: 0.5,
  musicVolume: 0.5,
  muted: false,
  sounds: {} as Record<string, Howl>,

  engineOsc: null as OscillatorNode | null,
  engineGain: null as GainNode | null,
  engineFilter: null as BiquadFilterNode | null,
  _enginePlaying: false,

  driftNoise: null as AudioBufferSourceNode | null,
  driftGain: null as GainNode | null,
  driftFilter: null as BiquadFilterNode | null,
  _driftPlaying: false,

  _bgTracks: [] as Howl[],
  _currentBg: null as Howl | null,
  _musicPlaying: false,
  _shuffleOrder: [] as number[],
  _shuffleIdx: 0,
  _stopping: false,

  init(): void {
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);

      try {
        const saved = JSON.parse(localStorage.getItem('oversteer_audio_v2') ?? 'null');
        if (saved) {
          this.sfxVolume = Math.max(0.1, saved.sfx ?? 0.5);
          this.musicVolume = Math.max(0.1, saved.music ?? 0.5);
          this.muted = saved.muted ?? false;
        }
      } catch (_) {
        // ignore corrupt prefs
      }

      this.masterGain.gain.value = this.muted ? 0 : 1;
      this._genAllSounds();
      const base = import.meta.env.BASE_URL ?? '/';
      this._bgTracks = _TRACK_NAMES.map(name =>
        new Howl({
          src: [`${base}audio/${name}.mp3`],
          loop: false,
          volume: this.musicVolume,
          onloaderror: (_id: number, err: unknown) => logError('audio', `track "${name}" load error`, err),
          onplayerror: (_id: number, err: unknown) => {
            logError('audio', `track "${name}" play error`, err);
            Howler.ctx?.resume().catch(() => {});
          },
        })
      );

      // Explicit verification line — visible in logs/game.log and debug overlay.
      const soundCount = Object.keys(this.sounds).length;
      const ctxState = this.ctx?.state ?? 'null';
      const gainOk = this.masterGain != null;
      const summary = `ctx=${ctxState}  sounds=${soundCount}/7  masterGain=${gainOk ? 'live' : 'null'}  sfxVol=${this.sfxVolume}  musicVol=${this.musicVolume}  muted=${this.muted}`;
      if (soundCount < 7 || !gainOk) {
        logError('audio', `DEGRADED — ${summary}`);
      } else {
        log('audio', `OK — ${summary}`);
      }
    } catch (e) {
      console.warn('AudioManager init failed:', e);
      logError('audio', 'init failed', e);
    }
  },

  _savePrefs(): void {
    localStorage.setItem('oversteer_audio_v2', JSON.stringify({
      sfx: this.sfxVolume,
      music: this.musicVolume,
      muted: this.muted,
    }));
  },

  _generateWav(fn: (buf: Float32Array, sr: number, len: number) => void, dur: number, sampleRate = 44100): string {
    const len = Math.floor(dur * sampleRate);
    const buf = new Float32Array(len);
    fn(buf, sampleRate, len);

    const numCh = 1, bitsPerSample = 16;
    const byteRate = sampleRate * numCh * bitsPerSample / 8;
    const blockAlign = numCh * bitsPerSample / 8;
    const dataSize = len * blockAlign;
    const abuf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(abuf);
    const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };

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

  _genAllSounds(): void {
    const wav = (fn: (b: Float32Array, sr: number, len: number) => void, dur: number) =>
      ({ src: [this._generateWav(fn, dur)], format: ['wav'], volume: this.sfxVolume });

    // collision: white noise burst + sine thump 100Hz, 0.15s
    this.sounds['collision'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.15;
        b[i] = (Math.random() * 2 - 1) * 0.3 * env + Math.sin(2 * Math.PI * 100 * t) * 0.5 * env;
      }
    }, 0.15));

    // encircle: ascending sine sweep 400→1200Hz + harmonics, 0.4s
    this.sounds['encircle'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.4;
        const freq = 400 + 800 * (t / 0.4);
        b[i] = (Math.sin(2 * Math.PI * freq * t) * 0.4 +
                Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2 +
                Math.sin(2 * Math.PI * freq * 2 * t) * 0.1) * env;
      }
    }, 0.4));

    // near_miss: bandpass noise sweep 500→2kHz, 0.15s
    this.sounds['near_miss'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.15;
        const noise = Math.random() * 2 - 1;
        b[i] = noise * 0.4 * env * Math.sin(2 * Math.PI * (500 + 1500 * t / 0.15) * t);
      }
    }, 0.15));

    // horde_warn: square wave 440Hz, 8Hz on-off pulse, 0.8s
    this.sounds['horde_warn'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.sin(2 * Math.PI * 8 * t) > 0 ? 1 : 0;
        const sq = Math.sin(2 * Math.PI * 440 * t) > 0 ? 0.35 : -0.35;
        b[i] = sq * env * (1 - t / 0.8);
      }
    }, 0.8));

    // combo_sting: sine chord (root + fifth + octave), 0.25s
    this.sounds['combo_sting'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.25;
        b[i] = (Math.sin(2 * Math.PI * 440 * t) * 0.3 +
                Math.sin(2 * Math.PI * 660 * t) * 0.2 +
                Math.sin(2 * Math.PI * 880 * t) * 0.15) * env;
      }
    }, 0.25));

    // ui_click: sine blip 800Hz fast decay, 0.05s
    this.sounds['ui_click'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.05;
        b[i] = Math.sin(2 * Math.PI * 800 * t) * 0.3 * env * env;
      }
    }, 0.05));

    // scrap_pickup: soft metallic tick (high sine + noise, 0.08s)
    this.sounds['scrap_pickup'] = new Howl(wav((b, sr, len) => {
      for (let i = 0; i < len; i++) {
        const t = i / sr, env = 1 - t / 0.08;
        b[i] = (Math.sin(2 * Math.PI * 1200 * t) * 0.2 + (Math.random() * 2 - 1) * 0.05) * env * env;
      }
    }, 0.08));
  },

  play(id: string): void {
    const snd = this.sounds[id];
    if (!snd) {
      log('audio', `play(${id}) — MISSING sound id; nothing to play`);
      return;
    }
    const vol = this.muted ? 0 : this.sfxVolume;
    snd.volume(vol);
    snd.play();
    log('audio', `play(${id})  vol=${vol.toFixed(2)}  muted=${this.muted}  ctx=${this.ctx?.state ?? 'null'}`);
  },

  // --- Engine (live oscillator) ---
  startEngine(): void {
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
    this.engineGain.connect(this.masterGain!);
    this.engineOsc.start();
    this._enginePlaying = true;
  },

  stopEngine(): void {
    if (!this._enginePlaying) return;
    try { this.engineOsc?.stop(); } catch (_) {}
    this._enginePlaying = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
  },

  setEngineSpeed(speedFrac: number): void {
    if (!this._enginePlaying || !this.engineOsc || !this.engineGain) return;
    const f = Math.max(0, Math.min(1, speedFrac));
    this.engineOsc.frequency.value = 80 + 120 * f;
    this.engineGain.gain.value = this.muted ? 0 : (0.1 + 0.3 * f) * this.sfxVolume;
  },

  // --- Drift squeal (live noise) ---
  startDrift(): void {
    if (!this.ctx || this._driftPlaying) return;
    this._resumeCtx();
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
    this.driftGain.connect(this.masterGain!);
    this.driftNoise.start();
    this._driftPlaying = true;
  },

  stopDrift(): void {
    if (!this._driftPlaying) return;
    try { this.driftNoise?.stop(); } catch (_) {}
    this._driftPlaying = false;
    this.driftNoise = null;
    this.driftGain = null;
    this.driftFilter = null;
  },

  setDriftIntensity(slip: number): void {
    if (!this.ctx) return;
    if (slip > 0 && !this._driftPlaying) this.startDrift();
    if (slip <= 0 && this._driftPlaying) { this.stopDrift(); return; }
    if (this._driftPlaying && this.driftGain) {
      this.driftGain.gain.value = this.muted ? 0 : Math.min(1, slip) * 0.25 * this.sfxVolume;
    }
  },

  // --- Background music (file-based, shuffle play-all) ---
  // NOTE: not in original — original arena-drifter JS used random pick-on-start with loop:true.

  _buildShuffle(): void {
    const n = this._bgTracks.length;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this._shuffleOrder = order;
    this._shuffleIdx = 0;
  },

  _playTrackAt(idx: number): void {
    const track = this._bgTracks[idx];
    if (!track) return;
    track.volume(this.musicVolume);
    track.mute(this.muted);
    track.off('end');
    track.once('end', () => {
      if (this._stopping || this._currentBg !== track) return;
      this._shuffleIdx++;
      if (this._shuffleIdx >= this._shuffleOrder.length) this._buildShuffle();
      this._playTrackAt(this._shuffleOrder[this._shuffleIdx]);
    });
    track.play();
    this._currentBg = track;
  },

  startBgMusic(): void {
    if (this._bgTracks.length === 0) {
      logError('audio', 'startBgMusic — _bgTracks empty; audioManager.init() may have failed');
      return;
    }
    if (this._currentBg) {
      this._currentBg.stop();
      this._currentBg = null;
      // Advance so the restarted music plays a fresh track, not the interrupted one.
      this._shuffleIdx++;
      if (this._shuffleIdx >= this._shuffleOrder.length) this._buildShuffle();
    }
    this._stopping = false;
    // Howler manages its own AudioContext; explicitly resume it if suspended
    // so music starts immediately on first call rather than waiting for its
    // own event-listener auto-resume (which fires too late during scene transitions).
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().catch(() => {});
    }
    if (this._shuffleOrder.length === 0) this._buildShuffle();
    this._playTrackAt(this._shuffleOrder[this._shuffleIdx]);
    this._musicPlaying = true;
    log('audio', `startBgMusic  musicVol=${this.musicVolume}  muted=${this.muted}  howlerCtx=${Howler.ctx?.state ?? 'null'}`);
  },

  stopBgMusic(): void {
    if (!this._currentBg) return;
    this._stopping = true;
    this._currentBg.stop();
    this._currentBg = null;
    this._musicPlaying = false;
    // Advance so the next startBgMusic plays a fresh track instead of replaying this one.
    this._shuffleIdx++;
    if (this._shuffleIdx >= this._shuffleOrder.length) this._buildShuffle();
  },

  fadeBgMusic(dur: number): void {
    if (!this._currentBg) return;
    const bg = this._currentBg;
    this._currentBg = null;
    this._musicPlaying = false;
    // Advance so the next startBgMusic plays a fresh track, not the faded-out one.
    this._shuffleIdx++;
    if (this._shuffleIdx >= this._shuffleOrder.length) this._buildShuffle();
    if (this.muted) {
      bg.stop();
      return;
    }
    bg.fade(this.musicVolume, 0, dur * 1000);
    bg.once('fade', () => bg.stop());
  },

  stopAll(): void {
    this.stopEngine();
    this.stopDrift();
    this.stopBgMusic();
  },

  setMuted(val: boolean): void {
    this.muted = val;
    if (this.masterGain) this.masterGain.gain.value = val ? 0 : 1;
    this._currentBg?.mute(val);
    this._savePrefs();
  },

  setVolume(type: 'sfx' | 'music', val: number): void {
    val = Math.max(0, Math.min(1, Math.round(val * 10) / 10));
    if (type === 'sfx') {
      this.sfxVolume = val;
      if (this._enginePlaying && this.engineGain) {
        this.engineGain.gain.value = this.muted ? 0 : this.sfxVolume * 0.2;
      }
    } else if (type === 'music') {
      this.musicVolume = val;
      this._currentBg?.volume(val);
    }
    this._savePrefs();
  },

  _resumeCtx(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(err => logError('audio', '_resumeCtx rejected', err));
    }
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume().catch(() => {});
    }
  },
};

export { audioManager };
