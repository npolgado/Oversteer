// Logic-only benchmark — measures game systems without rendering or Pixi.
// Run: npx vitest bench src/bench/logicBench.bench.ts

import { bench, describe } from 'vitest';
import { CFG } from '@core/config';
import { makePlayerState, type PlayerState } from '@gameplay/player/playerState';
import { updatePlayer, type PlayerUpdateContext } from '@gameplay/player/playerUpdate';
import { makeEnemyState, type EnemyState } from '@gameplay/enemies/enemyState';
import { updateEnemy } from '@gameplay/enemies/enemyUpdate';
import { makeTrailState, pushTrailPoint } from '@gameplay/trail/trailState';
import { updateTrail } from '@gameplay/trail/trailUpdate';
import { checkPlayerEnemyCollision, checkNearMiss } from '@gameplay/combat/collision';
import { makeWaveState, startWave, updateWave } from '@gameplay/spawning/waveManager';
import { makePropsState, generateProps, checkPlayerCollision as checkPlayerPropCollision, updatePropCooldowns } from '@gameplay/world/propsSystem';
import { updateScoring, makeScoringState } from '@gameplay/scoring';
import { updateNearMissStreak, applyHpRegen, updateScraps } from '@gameplay/pureLogic';

const DT = 1 / 60;

function makeMovingPlayer(): PlayerState {
  const p = makePlayerState();
  p.x = CFG.WORLD_W / 2;
  p.y = CFG.WORLD_H / 2;
  p.vx = 200;
  p.vy = 50;
  p.heading = 0;
  return p;
}

function makeDriftingPlayer(): PlayerState {
  const p = makeMovingPlayer();
  p.drifting = true;
  p.driftTime = 1.0;
  return p;
}

function makeEnemyRing(n: number): EnemyState[] {
  const cx = CFG.WORLD_W / 2;
  const cy = CFG.WORLD_H / 2;
  const enemies: EnemyState[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    enemies.push(makeEnemyState('chaser', cx + Math.cos(angle) * 500, cy + Math.sin(angle) * 500, 0));
  }
  return enemies;
}

function alwaysVisible(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Individual system benchmarks
// ---------------------------------------------------------------------------

describe('player update', () => {
  bench('idle (no input)', () => {
    const p = makePlayerState();
    const ctx: PlayerUpdateContext = { dt: DT, gameClock: 1.0, up: false, down: false, left: false, right: false, drift: false };
    updatePlayer(p, ctx);
  });

  bench('drifting + turning', () => {
    const p = makeDriftingPlayer();
    const ctx: PlayerUpdateContext = { dt: DT, gameClock: 1.0, up: true, down: false, left: true, right: false, drift: true };
    updatePlayer(p, ctx);
  });
});

describe('enemy update', () => {
  bench('1 enemy', () => {
    const player = makeMovingPlayer();
    const e = makeEnemyState('chaser', player.x + 300, player.y, 0);
    updateEnemy(e, player, DT, 1.0, alwaysVisible);
  });

  bench('15 enemies', () => {
    const player = makeMovingPlayer();
    const enemies = makeEnemyRing(15);
    for (const e of enemies) updateEnemy(e, player, DT, 1.0, alwaysVisible);
  });

  bench('30 enemies', () => {
    const player = makeMovingPlayer();
    const enemies = makeEnemyRing(30);
    for (const e of enemies) updateEnemy(e, player, DT, 1.0, alwaysVisible);
  });
});

describe('collision checks', () => {
  bench('nearMiss × 15 enemies', () => {
    const player = makeMovingPlayer();
    const enemies = makeEnemyRing(15);
    for (const e of enemies) checkNearMiss(player, e);
  });

  bench('playerEnemyCollision × 15 enemies', () => {
    const player = makeMovingPlayer();
    const enemies = makeEnemyRing(15);
    for (const e of enemies) checkPlayerEnemyCollision(player, e);
  });
});

describe('trail update', () => {
  bench('trail with 100 points, 15 enemies', () => {
    const player = makeDriftingPlayer();
    const trail = makeTrailState();
    for (let i = 0; i < 100; i++) {
      pushTrailPoint(trail, player.x + i * 10, player.y + Math.sin(i * 0.3) * 50);
    }
    const enemies = makeEnemyRing(15);
    updateTrail(trail, player, enemies, DT);
  });

  bench('trail with 300 points, 15 enemies', () => {
    const player = makeDriftingPlayer();
    const trail = makeTrailState();
    for (let i = 0; i < 300; i++) {
      pushTrailPoint(trail, player.x + i * 5, player.y + Math.sin(i * 0.3) * 50);
    }
    const enemies = makeEnemyRing(15);
    updateTrail(trail, player, enemies, DT);
  });
});

describe('wave spawning', () => {
  bench('updateWave tick (combat phase)', () => {
    const ws = makeWaveState();
    startWave(ws);
    updateWave(ws, DT, 500, 10);
  });
});

describe('props system', () => {
  bench('prop collision + cooldowns', () => {
    const ps = makePropsState();
    generateProps(ps);
    const player = makeMovingPlayer();
    checkPlayerPropCollision(ps, player);
    updatePropCooldowns(ps, DT);
  });
});

describe('scoring + per-frame timers', () => {
  bench('updateScoring + nearMissStreak + hpRegen', () => {
    const player = makeDriftingPlayer();
    const scoring = makeScoringState(0);
    updateScoring(scoring, player.drifting, player.driftTime, player.scoreMult, player.comboMaster, DT);
    updateNearMissStreak(player, DT);
    applyHpRegen(player, DT);
  });
});

// ---------------------------------------------------------------------------
// Full-pipeline scenario benchmarks (mirrors benchmark.html scenarios)
// ---------------------------------------------------------------------------

describe('full pipeline (all systems, 1 frame)', () => {
  function runOneFrame(enemyCount: number, drift: boolean): void {
    const player = drift ? makeDriftingPlayer() : makeMovingPlayer();
    const enemies = makeEnemyRing(enemyCount);
    const trail = makeTrailState();
    for (let i = 0; i < 80; i++) {
      pushTrailPoint(trail, player.x + i * 8, player.y + Math.sin(i * 0.4) * 40);
    }
    const ws = makeWaveState();
    startWave(ws);
    const scoring = makeScoringState(0);
    const props = makePropsState();
    generateProps(props);

    // Player
    const ctx: PlayerUpdateContext = {
      dt: DT, gameClock: 1.0,
      up: true, down: false, left: drift, right: false, drift,
    };
    updatePlayer(player, ctx);

    // Scoring
    updateScoring(scoring, player.drifting, player.driftTime, player.scoreMult, player.comboMaster, DT);
    updateNearMissStreak(player, DT);
    applyHpRegen(player, DT);

    // Wave
    updateWave(ws, DT, scoring.score, enemies.length);

    // Enemies
    for (const e of enemies) updateEnemy(e, player, DT, 1.0, alwaysVisible);

    // Collision
    for (const e of enemies) {
      checkNearMiss(player, e);
      checkPlayerEnemyCollision(player, e);
    }

    // Trail
    updateTrail(trail, player, enemies, DT);

    // Props
    checkPlayerPropCollision(props, player);
    updatePropCooldowns(props, DT);
  }

  bench('idle_5',   () => runOneFrame(5,  false));
  bench('idle_15',  () => runOneFrame(15, false));
  bench('idle_30',  () => runOneFrame(30, false));
  bench('drift_5',  () => runOneFrame(5,  true));
  bench('drift_15', () => runOneFrame(15, true));
  bench('drift_30', () => runOneFrame(30, true));
});
