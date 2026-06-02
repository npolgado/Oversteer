// Audio shuffle and volume-floor tests.
// The audioManager is a singleton, so we bypass init() for shuffle tests
// and directly inject mock Howl instances into _bgTracks.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('howler', () => ({
  Howl: class MockHowl {
    play = vi.fn();
    stop = vi.fn();
    volume = vi.fn();
    mute = vi.fn();
    off = vi.fn();
    once = vi.fn();
    fade = vi.fn();
  },
  Howler: { ctx: null },
}));

vi.mock('@debug/logger', () => ({ log: vi.fn(), logError: vi.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock Howl that captures its 'end' and 'fade' callbacks so tests can fire them. */
function makeMockHowl() {
  let _endCb: (() => void) | undefined;
  return {
    play: vi.fn(),
    stop: vi.fn(),
    volume: vi.fn(),
    mute: vi.fn(),
    off: vi.fn(),
    fade: vi.fn(),
    once: vi.fn((event: string, cb: () => void) => {
      if (event === 'end') _endCb = cb;
    }),
    fireEnd() { _endCb?.(); },
  };
}

/** Reset audioManager shuffle/music state between tests (singleton hygiene). */
async function resetAudio() {
  const { audioManager } = await import('../audioManager');
  const am = audioManager as any;
  am._bgTracks = [];
  am._currentBg = null;
  am._musicPlaying = false;
  am._shuffleOrder = [];
  am._shuffleIdx = 0;
  am._stopping = false;
  // Reset volume to defaults
  am.sfxVolume = 0.5;
  am.musicVolume = 0.5;
  am.muted = false;
  return audioManager;
}

// ---------------------------------------------------------------------------
// _buildShuffle
// ---------------------------------------------------------------------------

describe('_buildShuffle', () => {
  it('produces a permutation of [0..N-1]', async () => {
    const am = await resetAudio();
    (am as any)._bgTracks = [null, null, null, null]; // 4 tracks
    (am as any)._activePackIds = [0, 1, 2, 3];
    (am as any)._buildShuffle();
    const order: number[] = (am as any)._shuffleOrder;
    expect(order).toHaveLength(4);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('resets _shuffleIdx to 0', async () => {
    const am = await resetAudio();
    (am as any)._bgTracks = [null, null];
    (am as any)._shuffleIdx = 7; // stale value
    (am as any)._buildShuffle();
    expect((am as any)._shuffleIdx).toBe(0);
  });

  it('produces a length-1 permutation for a single track', async () => {
    const am = await resetAudio();
    (am as any)._bgTracks = [null];
    (am as any)._activePackIds = [0];
    (am as any)._buildShuffle();
    expect((am as any)._shuffleOrder).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// Natural track-end advancement
// ---------------------------------------------------------------------------

describe('natural track-end advances shuffle index', () => {
  it('end handler increments _shuffleIdx and plays next track', async () => {
    const am = await resetAudio();
    const t0 = makeMockHowl();
    const t1 = makeMockHowl();
    (am as any)._bgTracks = [t0, t1];
    (am as any)._shuffleOrder = [0, 1];
    (am as any)._shuffleIdx = 0;

    // Manually invoke _playTrackAt(0) to set up the end callback
    (am as any)._playTrackAt(0);
    expect(t0.play).toHaveBeenCalledOnce();

    // Fire the end event — should advance to idx=1 and play t1
    t0.fireEnd();
    expect((am as any)._shuffleIdx).toBe(1);
    expect(t1.play).toHaveBeenCalledOnce();
  });

  it('end handler rebuilds shuffle on overflow', async () => {
    const am = await resetAudio();
    const t0 = makeMockHowl();
    const t1 = makeMockHowl();
    (am as any)._bgTracks = [t0, t1];
    (am as any)._activePackIds = [0, 1];
    (am as any)._shuffleOrder = [0, 1];
    (am as any)._shuffleIdx = 1; // last slot

    (am as any)._playTrackAt(1);
    t1.fireEnd();

    // After overflow rebuild, shuffleIdx resets to 0 and a new order is built
    expect((am as any)._shuffleIdx).toBe(0);
    expect((am as any)._shuffleOrder).toHaveLength(2);
  });

  it('_stopping=true prevents end handler from advancing', async () => {
    const am = await resetAudio();
    const t0 = makeMockHowl();
    const t1 = makeMockHowl();
    (am as any)._bgTracks = [t0, t1];
    (am as any)._shuffleOrder = [0, 1];
    (am as any)._shuffleIdx = 0;

    (am as any)._playTrackAt(0);
    (am as any)._stopping = true;
    t0.fireEnd();

    // Handler should bail — idx stays at 0, t1 not played
    expect((am as any)._shuffleIdx).toBe(0);
    expect(t1.play).not.toHaveBeenCalled();
  });

  it('end handler bails when _currentBg has changed (guard against stale callbacks)', async () => {
    const am = await resetAudio();
    const t0 = makeMockHowl();
    const t1 = makeMockHowl();
    const t2 = makeMockHowl();
    (am as any)._bgTracks = [t0, t1, t2];
    (am as any)._shuffleOrder = [0, 1, 2];
    (am as any)._shuffleIdx = 0;

    (am as any)._playTrackAt(0); // _currentBg = t0
    // Simulate a mid-play switch to t2 (another scene transition)
    (am as any)._currentBg = t2 as any;

    t0.fireEnd(); // stale callback — _currentBg !== t0

    // t1 must NOT have been started
    expect(t1.play).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// F1 regression: stop → start plays a different shuffle slot
// ---------------------------------------------------------------------------

describe('F1 regression — stop/start does not replay the same track', () => {
  it('stopBgMusic advances _shuffleIdx so next start plays the next slot', async () => {
    const am = await resetAudio();
    const tracks = [makeMockHowl(), makeMockHowl(), makeMockHowl(), makeMockHowl()];
    (am as any)._bgTracks = tracks;
    (am as any)._shuffleOrder = [0, 1, 2, 3];
    (am as any)._shuffleIdx = 1; // currently at slot 1 (track at index 1)
    (am as any)._currentBg = tracks[1] as any;
    (am as any)._musicPlaying = true;

    (am as any).stopBgMusic();

    const idxAfterStop = (am as any)._shuffleIdx;
    expect(idxAfterStop).toBe(2); // must have advanced past slot 1
  });

  it('startBgMusic after startBgMusic (force-restart) advances past interrupted track', async () => {
    const am = await resetAudio();
    const tracks = [makeMockHowl(), makeMockHowl(), makeMockHowl()];
    (am as any)._bgTracks = tracks;
    (am as any)._shuffleOrder = [0, 1, 2];
    (am as any)._shuffleIdx = 0;
    (am as any)._currentBg = tracks[0] as any;
    (am as any)._musicPlaying = true;

    // Force-restart while track 0 is playing
    (am as any).startBgMusic();

    // After the restart, track played should be _shuffleOrder[1], not [0]
    const playedTrackIdx = (am as any)._shuffleOrder[0]; // idx advanced past old 0
    expect(tracks[playedTrackIdx].play).not.toHaveBeenCalled();
    // The currently-playing track (new _currentBg) should NOT be track[0]
    const newCurrent = (am as any)._currentBg;
    expect(newCurrent).not.toBe(tracks[0]);
  });

  it('fadeBgMusic advances _shuffleIdx so next start plays fresh', async () => {
    const am = await resetAudio();
    const tracks = [makeMockHowl(), makeMockHowl()];
    (am as any)._bgTracks = tracks;
    (am as any)._shuffleOrder = [0, 1];
    (am as any)._shuffleIdx = 0;
    (am as any)._currentBg = tracks[0] as any;
    (am as any)._musicPlaying = true;

    (am as any).fadeBgMusic(0.5);

    expect((am as any)._shuffleIdx).toBe(1); // advanced
    expect((am as any)._currentBg).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// F8: Volume floor — sfx/music loaded from prefs are clamped to 0.1 minimum
// ---------------------------------------------------------------------------

describe('volume floor — loaded prefs clamped to 0.1', () => {
  let mockCtx: ReturnType<typeof makeMockAudioCtx>;

  function makeMockAudioCtx() {
    const gain = { connect: vi.fn(), gain: { value: 0 } };
    return {
      state: 'running',
      createGain: vi.fn(() => gain),
      createOscillator: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn(), frequency: { value: 0 }, type: '' })),
      createBiquadFilter: vi.fn(() => ({ connect: vi.fn(), type: '', frequency: { value: 0 }, Q: { value: 0 } })),
      createBuffer: vi.fn(() => ({ getChannelData: vi.fn(() => new Float32Array(1000)) })),
      createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), loop: false, buffer: null, playbackRate: { value: 1 } })),
      destination: {},
    };
  }

  beforeEach(() => {
    mockCtx = makeMockAudioCtx();
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) =>
        key === 'oversteer_audio_v2'
          ? JSON.stringify({ sfx: 0, music: 0, muted: false })
          : null
      ),
      setItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sfxVolume and musicVolume are both 0.1 when prefs saved 0', async () => {
    const am = await resetAudio();
    try { (am as any).init(); } catch (_) { /* AudioContext mock may be partial */ }
    expect(am.sfxVolume).toBe(0.1);
    expect(am.musicVolume).toBe(0.1);
  });

  it('sfxVolume stays at saved value when above 0.1', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) =>
        key === 'oversteer_audio_v2'
          ? JSON.stringify({ sfx: 0.7, music: 0.4, muted: false })
          : null
      ),
      setItem: vi.fn(),
    });
    const am = await resetAudio();
    try { (am as any).init(); } catch (_) {}
    expect(am.sfxVolume).toBeCloseTo(0.7);
    expect(am.musicVolume).toBeCloseTo(0.4);
  });
});
