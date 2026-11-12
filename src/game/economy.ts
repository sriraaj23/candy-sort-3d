export const START_COINS = 100;
export const LEVEL_REWARD = 10;
export const HINT_COST = 20;
export const ADD_JAR_COST = 50;
/** Rewards for day 1..7 of a streak. After day 7 the week starts again. */
export const DAILY_REWARDS = [25, 35, 45, 55, 70, 85, 100];

/** 3 stars at (or near) solver par, 2 stars within 50% extra, else 1. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  const p = Math.max(1, par);
  if (moves <= Math.ceil(p * 1.15)) return 3;
  if (moves <= Math.ceil(p * 1.6)) return 2;
  return 1;
}

export function starThresholds(par: number): { three: number; two: number } {
  const p = Math.max(1, par);
  return { three: Math.ceil(p * 1.15), two: Math.ceil(p * 1.6) };
}

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function keyToUtc(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / 86_400_000);
}

export interface DailyStatus {
  canClaim: boolean;
  /** Streak length after claiming today (or the current one if claimed). */
  streakIfClaimed: number;
  /** 1..7: the slot in the weekly calendar to highlight. */
  dayIndex: number;
  reward: number;
}

export function dailyStatus(lastClaim: string | null, streak: number, today: string): DailyStatus {
  if (lastClaim === today) {
    const idx = ((Math.max(1, streak) - 1) % 7) + 1;
    return { canClaim: false, streakIfClaimed: streak, dayIndex: idx, reward: DAILY_REWARDS[idx - 1] };
  }
  const continues = lastClaim !== null && daysBetween(lastClaim, today) === 1;
  const next = continues ? streak + 1 : 1;
  const idx = ((next - 1) % 7) + 1;
  return { canClaim: true, streakIfClaimed: next, dayIndex: idx, reward: DAILY_REWARDS[idx - 1] };
}
