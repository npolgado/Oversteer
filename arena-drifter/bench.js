// bench.js — BenchmarkRunner for arena-drifter vanilla build.
// Activated by ?bench=<scenario> URL param.
(function () {
  'use strict';

  const WARMUP_S = 3;
  const COLLECT_S = 10;

  const SCENARIOS = {
    idle_5:   { enemyCount: 5,  drift: false },
    idle_15:  { enemyCount: 15, drift: false },
    idle_30:  { enemyCount: 30, drift: false },
    drift_5:  { enemyCount: 5,  drift: true  },
    drift_15: { enemyCount: 15, drift: true  },
    drift_30: { enemyCount: 30, drift: true  },
  };

  // Pure function — testable independently
  function computeStats(frames) {
    const sorted = [...frames].sort((a, b) => a - b);
    const n = sorted.length;
    const avg = frames.reduce((s, t) => s + t, 0) / n;
    return {
      avgFps: 1000 / avg,
      p50: sorted[Math.floor(n * 0.50)],
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)],
      worstMs: sorted[n - 1],
    };
  }

  const BenchmarkRunner = {
    scenario: null,
    _def: null,
    _phase: 'idle', // 'idle' | 'warmup' | 'collect' | 'done'
    _timer: 0,
    _frames: [],

    /** Call once after Game.init(). Listens for bench_start from parent orchestrator. */
    init() {
      window.addEventListener('message', (e) => {
        if (!e.data || e.data.type !== 'bench_start') return;
        const s = e.data.scenario;
        if (!SCENARIOS[s]) return;
        this.scenario = s;
        this._def = SCENARIOS[s];
        this._phase = 'warmup';
        this._timer = 0;
        this._frames = [];
        this._doSetup();
      });
    },

    _doSetup() {
      const { CFG } = window.OversteerLogic;
      const STATE = window.STATE;
      const Game = window.Game;
      const Enemy = window.Enemy;
      const Waves = window.Waves;

      // Full reset initializes Waves, Props, Camera — required before PLAYING state
      Game.reset();

      const cx = CFG.WORLD_W / 2;
      const cy = CFG.WORLD_H / 2;

      Game.state = STATE.PLAYING;
      Game.player.maxHp = 999999;
      Game.player.hp = 999999;
      Game.player.x = cx;
      Game.player.y = cy;
      Game.player.vx = this._def.drift ? 200 : 0;
      Game.player.vy = 0;
      Game.player.angle = 0;

      // Replace wave-spawned enemies with our preset ring
      Waves.enemies = [];
      const n = this._def.enemyCount;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        Waves.enemies.push(new Enemy('chaser', cx + Math.cos(angle) * 500, cy + Math.sin(angle) * 500));
      }
    },

    /** Call each frame BEFORE Game.update(), passing raw frame time in ms. */
    tick(rawDtMs) {
      if (!this.scenario || this._phase === 'idle' || this._phase === 'done') return;

      // Inject scripted input for drift scenarios
      if (this._def.drift) {
        const k = window.Input.keys;
        k['KeyW'] = true;
        k['KeyA'] = true;
        k['Space'] = true;
      }

      this._timer += rawDtMs / 1000;

      if (this._phase === 'warmup') {
        if (this._timer >= WARMUP_S) {
          this._phase = 'collect';
          this._timer = 0;
          this._frames = [];
        }
      } else if (this._phase === 'collect') {
        this._frames.push(rawDtMs);
        if (this._timer >= COLLECT_S) {
          this._phase = 'done';
          this._report();
        }
      }
    },

    _report() {
      const stats = computeStats(this._frames);
      window.parent.postMessage(
        { type: 'bench_result', build: 'MVP', scenario: this.scenario, ...stats },
        '*'
      );
    },
  };

  // Expose for index.html bootstrap and tests
  window.BenchmarkRunner = BenchmarkRunner;
  window._benchComputeStats = computeStats; // for unit tests
})();
