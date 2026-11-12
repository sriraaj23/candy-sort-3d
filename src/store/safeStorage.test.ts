import { afterEach, describe, expect, it, vi } from 'vitest';

describe('safeStorage', () => {
  const original = globalThis.localStorage;
  afterEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = original;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('swallows quota / private-mode errors instead of crashing game actions', async () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { safeStorage } = await import('./safeStorage');
    expect(() => safeStorage.setItem('k', 'v')).not.toThrow();
    expect(safeStorage.getItem('k')).toBeNull();
    expect(() => safeStorage.removeItem('k')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1); // warns once, not on every save

    // Store actions keep working with storage unavailable.
    const { useProgress } = await import('./progressStore');
    expect(() => useProgress.getState().addCoins(5)).not.toThrow();
    expect(() => useProgress.getState().recordWin(1, 3, false)).not.toThrow();
    expect(useProgress.getState().stars[1]).toBe(3);
  });

  it('reads and writes normally when storage works', async () => {
    const { safeStorage } = await import('./safeStorage');
    safeStorage.setItem('candy-test', '42');
    expect(safeStorage.getItem('candy-test')).toBe('42');
    safeStorage.removeItem('candy-test');
    expect(safeStorage.getItem('candy-test')).toBeNull();
  });
});
