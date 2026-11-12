import type { StateStorage } from 'zustand/middleware';

/**
 * localStorage wrapper that never throws. Private browsing, blocked cookies or
 * a full quota make localStorage throw; the game should keep running and
 * simply not save, instead of crashing inside a store update.
 */
let cached: Storage | null | undefined;
function resolve(): Storage | null {
  if (cached !== undefined) return cached;
  try {
    const s = globalThis.localStorage;
    const probe = '__candy_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    cached = s;
  } catch (err) {
    warnOnce(err);
    cached = null;
  }
  return cached;
}

let warned = false;
function warnOnce(err: unknown) {
  if (warned) return;
  warned = true;
  console.warn('[candy-sort-3d] Saving is unavailable; progress will not persist.', err);
}

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return resolve()?.getItem(name) ?? null;
    } catch (err) {
      warnOnce(err);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      resolve()?.setItem(name, value);
    } catch (err) {
      warnOnce(err);
    }
  },
  removeItem: (name) => {
    try {
      resolve()?.removeItem(name);
    } catch (err) {
      warnOnce(err);
    }
  },
};
