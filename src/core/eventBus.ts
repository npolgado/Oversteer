// ---------------------------------------------------------------------------
// eventBus.ts — typed pub/sub event bus for Oversteer
// ---------------------------------------------------------------------------

export type GameEvents = {
  /** An enemy was destroyed (trail encirclement, bomb, etc.) */
  enemyKilled: { x: number; y: number; type: string; isElite?: boolean };

  /** Player passed very close to an enemy or hazard zone */
  nearMiss: { x: number; y: number };

  /** Request to spawn a particle burst at a world position */
  spawnParticles: { x: number; y: number; type: string; count: number; color?: number };

  /** Display a message in the EventLog HUD */
  eventLog: { text: string; color: string };

  /** Player score changed */
  scoreChanged: { score: number; delta: number };

  /** Drift/encirclement combo level changed */
  comboChanged: { level: number };

  /** Player took damage */
  playerDamaged: { amount: number; x: number; y: number };

  /** Player HP reached 0 */
  playerDied: Record<string, never>;

  /** A new combat wave began */
  waveStarted: { wave: number };

  /** The combat phase of a wave ended (break phase begins) */
  waveEnded: { wave: number };

  /** Player selected an upgrade card */
  upgradeApplied: { id: string };

  /** Trail loop closed and killed enemies */
  encirclement: { count: number; x: number; y: number };

  /** Active biome changed (fired by BiomeManager.setBiome) */
  biomeChanged: { id: string };

  // NOTE: not in original — emitted by GameLoop on pause/resume to suppress false blank-screen errors
  /** Game paused (full-screen overlay visible, blank-screen check should be suppressed) */
  gamePaused: Record<string, never>;

  /** Game unpaused (overlay dismissed, blank-screen check can resume) */
  gameResumed: Record<string, never>;
};

// Handler map: event key → set of typed callbacks
type HandlerMap = {
  [K in keyof GameEvents]?: Set<(data: GameEvents[K]) => void>;
};

export class EventBus {
  private handlers: HandlerMap = {};

  on<K extends keyof GameEvents>(
    event: K,
    handler: (data: GameEvents[K]) => void,
  ): void {
    if (!this.handlers[event]) {
      this.handlers[event] = new Set() as HandlerMap[K];
    }
    (this.handlers[event] as Set<(data: GameEvents[K]) => void>).add(handler);
  }

  off<K extends keyof GameEvents>(
    event: K,
    handler: (data: GameEvents[K]) => void,
  ): void {
    (this.handlers[event] as Set<(data: GameEvents[K]) => void> | undefined)
      ?.delete(handler);
  }

  emit<K extends keyof GameEvents>(event: K, data: GameEvents[K]): void {
    const set = this.handlers[event] as
      | Set<(data: GameEvents[K]) => void>
      | undefined;
    if (!set) return;
    for (const handler of set) {
      handler(data);
    }
  }
}

/** Singleton event bus shared across all game systems. */
export const eventBus = new EventBus();
