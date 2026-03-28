// ---------------------------------------------------------------------------
// saveManager.ts — typed localStorage wrapper for Oversteer persistence
// ---------------------------------------------------------------------------

export interface AudioPrefs {
  sfx: number;
  music: number;
  muted: boolean;
}

// ---------------------------------------------------------------------------
// Storage keys (must match the keys used in the legacy arena-drifter JS code)
// ---------------------------------------------------------------------------
const KEY_HIGHSCORE = 'oversteer_highscore_v1';
const KEY_MAP = 'oversteer_map_v1';
const KEY_AUDIO = 'oversteer_audio_v1';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
const DEFAULT_HIGHSCORE = 0;
const DEFAULT_MAP = 'arena';
const DEFAULT_AUDIO: AudioPrefs = { sfx: 0.7, music: 0.4, muted: false };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage may be unavailable (private browsing quota, etc.) — fail silently
  }
}

// ---------------------------------------------------------------------------
// SaveManager class
// ---------------------------------------------------------------------------

export class SaveManager {
  // --- High score -----------------------------------------------------------

  getHighScore(): number {
    const value = readItem<unknown>(KEY_HIGHSCORE, DEFAULT_HIGHSCORE);
    return typeof value === 'number' && isFinite(value)
      ? value
      : DEFAULT_HIGHSCORE;
  }

  setHighScore(score: number): void {
    writeItem(KEY_HIGHSCORE, score);
  }

  // --- Selected map ---------------------------------------------------------

  getSelectedMap(): string {
    const value = readItem<unknown>(KEY_MAP, DEFAULT_MAP);
    return typeof value === 'string' && value.length > 0 ? value : DEFAULT_MAP;
  }

  setSelectedMap(mapId: string): void {
    writeItem(KEY_MAP, mapId);
  }

  // --- Audio preferences ----------------------------------------------------

  getAudioPrefs(): AudioPrefs {
    const value = readItem<unknown>(KEY_AUDIO, DEFAULT_AUDIO);
    // Validate shape — fall back to default if any field is missing or wrong type
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).sfx === 'number' &&
      typeof (value as Record<string, unknown>).music === 'number' &&
      typeof (value as Record<string, unknown>).muted === 'boolean'
    ) {
      return value as AudioPrefs;
    }
    return { ...DEFAULT_AUDIO };
  }

  setAudioPrefs(prefs: AudioPrefs): void {
    writeItem(KEY_AUDIO, prefs);
  }
}

/** Singleton save manager shared across all game systems. */
export const saveManager = new SaveManager();
