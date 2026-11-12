import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROGRESS_KEY, useProgress } from './progressStore';
import { useUi } from './uiStore';
import { DAILY_REWARDS, LEVEL_COUNT, LEVEL_REWARD, START_COINS } from '../game';

const p = () => useProgress.getState();

describe('progress store', () => {
  beforeEach(() => {
    vi.useRealTimers();
    p().resetProgress();
    useUi.setState({ toasts: [] });
  });

  it('starts with 100 coins and only Candy Land', () => {
    expect(p().coins).toBe(START_COINS);
    expect(p().unlockedThemes).toEqual(['candyland']);
    expect(p().maxUnlocked).toBe(1);
  });

  it('spend refuses when broke and never goes negative', () => {
    expect(p().spend(START_COINS + 1)).toBe(false);
    expect(p().coins).toBe(START_COINS);
    expect(p().spend(START_COINS)).toBe(true);
    expect(p().coins).toBe(0);
  });

  it('keeps the best stars, unlocks the next level, caps at 100', () => {
    p().recordWin(1, 3, true);
    p().recordWin(1, 1, true);
    expect(p().stars[1]).toBe(3);
    expect(p().maxUnlocked).toBe(2);
    p().recordWin(LEVEL_COUNT, 2, true);
    expect(p().maxUnlocked).toBe(LEVEL_COUNT);
    expect(p().totalWins).toBe(3);
  });

  it('pays achievements exactly once and toasts them', () => {
    p().recordWin(1, 1, true); // first_win (+20) only; undo was used, 1 star
    expect(p().achievements).toEqual(['first_win']);
    expect(p().coins).toBe(START_COINS + LEVEL_REWARD + 20);
    p().recordWin(2, 1, true);
    expect(p().coins).toBe(START_COINS + 2 * LEVEL_REWARD + 20);
    expect(useUi.getState().toasts.filter((t) => t.kind === 'achievement')).toHaveLength(1);
  });

  it('buys, selects and refuses themes correctly', () => {
    expect(p().buyTheme('frosted')).toBe(false); // 300 > 100
    p().addCoins(1000);
    expect(p().buyTheme('frosted')).toBe(true);
    expect(p().selectedTheme).toBe('frosted');
    expect(p().achievements).toContain('theme_buyer');
    const coins = p().coins;
    expect(p().buyTheme('frosted')).toBe(true); // already owned: free
    expect(p().coins).toBe(coins);
    p().selectTheme('cocoa'); // not owned: ignored
    expect(p().selectedTheme).toBe('frosted');
    p().selectTheme('candyland');
    expect(p().selectedTheme).toBe('candyland');
  });

  it('claims the daily reward once per day and builds a streak', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 10));
    expect(p().claimDaily()).toBe(DAILY_REWARDS[0]);
    expect(p().claimDaily()).toBe(0); // same day
    for (let d = 2; d <= 7; d++) {
      vi.setSystemTime(new Date(2026, 0, d, 9));
      expect(p().claimDaily()).toBe(DAILY_REWARDS[d - 1]);
    }
    expect(p().dailyStreak).toBe(7);
    expect(p().achievements).toContain('streak_7');
    vi.setSystemTime(new Date(2026, 0, 10, 9)); // missed two days
    expect(p().claimDaily()).toBe(DAILY_REWARDS[0]);
    expect(p().dailyStreak).toBe(1);
    expect(p().bestStreak).toBe(7);
    vi.useRealTimers();
  });

  it('reset restores defaults and is saved', () => {
    p().addCoins(500);
    p().recordWin(1, 3, false);
    p().resetProgress();
    expect(p().coins).toBe(START_COINS);
    expect(p().stars).toEqual({});
    expect(JSON.parse(localStorage.getItem(PROGRESS_KEY)!).state.coins).toBe(START_COINS);
  });

  it('survives a reload: saved state rehydrates, stale ids are dropped', async () => {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        state: {
          coins: 777,
          maxUnlocked: 12,
          stars: { 3: 2 },
          unlockedThemes: ['candyland', 'old-theme'],
          selectedTheme: 'old-theme',
          achievements: ['first_win', 'gone'],
        },
      }),
    );
    await useProgress.persist.rehydrate();
    expect(p().coins).toBe(777);
    expect(p().maxUnlocked).toBe(12);
    expect(p().stars[3]).toBe(2);
    expect(p().unlockedThemes).toEqual(['candyland']);
    expect(p().selectedTheme).toBe('candyland');
    expect(p().achievements).toEqual(['first_win']);
    expect(typeof p().spend).toBe('function'); // actions survive merge
  });
});
