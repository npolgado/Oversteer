import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, logError } from '../logger';
import {
  initWatchdog,
  watchdogSceneSwitchStart,
  watchdogSceneSwitchComplete,
  watchdogSceneUpdated,
  watchdogMenuEntered,
  watchdogMenuInputReceived,
} from '../watchdog';

vi.mock('../logger', () => ({
  log: vi.fn(),
  logError: vi.fn(),
}));

const _log = log as ReturnType<typeof vi.fn>;
const _logError = logError as ReturnType<typeof vi.fn>;

function makeMockApp() {
  const callbacks: Array<(ticker: unknown) => void> = [];
  const app = {
    ticker: {
      add: vi.fn((fn: (ticker: unknown) => void) => {
        callbacks.push(fn);
        return 0; // Pixi ticker returns a ticket id
      }),
    },
  };
  return { app, tick: () => callbacks.forEach(fn => fn({})) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('watchdog — first-paint', () => {
  it('fires logError if ticker never runs within 5s', () => {
    const { app } = makeMockApp();
    initWatchdog(app);
    vi.advanceTimersByTime(5001);
    expect(_logError).toHaveBeenCalledWith('watchdog', expect.stringContaining('NO FIRST PAINT'));
  });

  it('does NOT fire if ticker runs before the deadline', () => {
    const { app, tick } = makeMockApp();
    initWatchdog(app);
    tick(); // simulate one frame — clears the timeout
    vi.advanceTimersByTime(5001);
    expect(_logError).not.toHaveBeenCalledWith('watchdog', expect.stringContaining('NO FIRST PAINT'));
  });

  it('fires only once even if timer is not explicitly cleared', () => {
    const { app } = makeMockApp();
    initWatchdog(app);
    vi.advanceTimersByTime(5001);
    vi.advanceTimersByTime(5001); // second advance
    const calls = (_logError.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('NO FIRST PAINT')
    );
    expect(calls.length).toBe(1);
  });
});

describe('watchdog — scene-switch', () => {
  it('fires logError if switchTo does not COMPLETE within 5s', () => {
    const { app } = makeMockApp();
    initWatchdog(app);
    watchdogSceneSwitchStart('MenuScene');
    vi.advanceTimersByTime(5001);
    expect(_logError).toHaveBeenCalledWith('watchdog', expect.stringContaining('switchTo(MenuScene) did not COMPLETE'));
  });

  it('does NOT fire if watchdogSceneSwitchComplete is called in time', () => {
    const { app } = makeMockApp();
    initWatchdog(app);
    watchdogSceneSwitchStart('MenuScene');
    watchdogSceneSwitchComplete('MenuScene');
    vi.advanceTimersByTime(5001);
    const calls = (_logError.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('switchTo(MenuScene)')
    );
    expect(calls.length).toBe(0);
  });

  it('handles overlapping switchTo calls — only latest name matters', () => {
    const { app } = makeMockApp();
    initWatchdog(app);
    watchdogSceneSwitchStart('BootScene');
    watchdogSceneSwitchStart('MenuScene'); // cancels previous timer
    vi.advanceTimersByTime(5001);
    expect(_logError).toHaveBeenCalledWith('watchdog', expect.stringContaining('switchTo(MenuScene)'));
    const bootCalls = (_logError.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('switchTo(BootScene)')
    );
    expect(bootCalls.length).toBe(0);
  });
});

describe('watchdog — AFK menu alert uses log, not logError (Fix 6 regression)', () => {
  it('fires log (not logError) after 30s of menu inactivity', () => {
    watchdogMenuEntered();
    vi.advanceTimersByTime(30_001);
    expect(_log).toHaveBeenCalledWith('watchdog', expect.stringContaining('MenuScene active'));
    expect(_logError).not.toHaveBeenCalledWith('watchdog', expect.stringContaining('MenuScene active'));
  });

  it('does NOT fire if watchdogMenuInputReceived is called in time', () => {
    watchdogMenuEntered();
    watchdogMenuInputReceived();
    vi.advanceTimersByTime(30_001);
    const calls = (_log.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('MenuScene active')
    );
    expect(calls.length).toBe(0);
  });
});

describe('watchdog — update stall', () => {
  it('fires logError when 121 frames pass without watchdogSceneUpdated', () => {
    const { app, tick } = makeMockApp();
    initWatchdog(app);
    for (let i = 0; i < 121; i++) tick();
    expect(_logError).toHaveBeenCalledWith('watchdog', expect.stringContaining('scene.update() has not fired'));
  });

  it('does NOT fire when watchdogSceneUpdated resets the counter', () => {
    const { app, tick } = makeMockApp();
    initWatchdog(app);
    for (let i = 0; i < 50; i++) tick();
    watchdogSceneUpdated();
    for (let i = 0; i < 50; i++) tick();
    const calls = (_logError.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('scene.update() has not fired')
    );
    expect(calls.length).toBe(0);
  });

  it('re-arms after 600 frames of silence to allow second alert', () => {
    const { app, tick } = makeMockApp();
    initWatchdog(app);
    for (let i = 0; i < 601; i++) tick(); // passes 120 threshold AND re-arm threshold
    watchdogSceneUpdated(); // clears alert state
    for (let i = 0; i < 121; i++) tick(); // should fire again
    const calls = (_logError.mock.calls as unknown[][]).filter(
      c => typeof c[1] === 'string' && (c[1] as string).includes('scene.update() has not fired')
    );
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});
