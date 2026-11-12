import { describe, expect, it } from 'vitest';
import { dailyStatus, daysBetween, starsFor, DAILY_REWARDS } from './economy';
import { newlyUnlocked, ACHIEVEMENTS } from './achievements';

describe('economy', () => {
  it('awards stars against par', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(15, 10)).toBe(2);
    expect(starsFor(40, 10)).toBe(1);
  });

  it('computes day differences', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('runs the daily streak', () => {
    let s = dailyStatus(null, 0, '2026-01-01');
    expect(s).toMatchObject({ canClaim: true, streakIfClaimed: 1, reward: 25 });
    s = dailyStatus('2026-01-01', 1, '2026-01-01');
    expect(s.canClaim).toBe(false);
    s = dailyStatus('2026-01-01', 1, '2026-01-02');
    expect(s).toMatchObject({ canClaim: true, streakIfClaimed: 2, reward: DAILY_REWARDS[1] });
    s = dailyStatus('2026-01-06', 6, '2026-01-07');
    expect(s.reward).toBe(100);
    s = dailyStatus('2026-01-01', 5, '2026-01-04'); // missed days
    expect(s).toMatchObject({ streakIfClaimed: 1, reward: 25 });
  });

  it('unlocks achievements once', () => {
    const stats = { levelsCompleted: 1, threeStarLevels: 0, bestStreak: 0, noUndoWins: 1, themesOwned: 1, hintsUsed: 0 };
    const first = newlyUnlocked(stats, []).map((a) => a.id);
    expect(first).toEqual(['first_win', 'no_undo']);
    expect(newlyUnlocked(stats, first)).toEqual([]);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(6);
  });
});
