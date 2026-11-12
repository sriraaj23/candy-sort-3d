import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  ACHIEVEMENTS,
  LEVEL_COUNT,
  LEVEL_REWARD,
  START_COINS,
  THEMES,
  dailyStatus,
  dayKey,
  newlyUnlocked,
  type AchievementStats,
  type ThemeId,
} from '../game';
import { useUi } from './uiStore';

export const PROGRESS_KEY = 'candy-sort-3d:progress:v1';

interface ProgressData {
  coins: number;
  currentLevel: number;
  maxUnlocked: number;
  stars: Record<number, number>;
  unlockedThemes: ThemeId[];
  selectedTheme: ThemeId;
  achievements: string[];
  dailyStreak: number;
  bestStreak: number;
  lastDailyClaim: string | null;
  noUndoWins: number;
  hintsUsed: number;
  totalWins: number;
}

export interface WinResult {
  stars: number;
  coins: number;
  firstClear: boolean;
  newBest: boolean;
}

interface ProgressState extends ProgressData {
  spend: (cost: number) => boolean;
  addCoins: (n: number) => void;
  setCurrentLevel: (lv: number) => void;
  recordWin: (level: number, stars: number, usedUndo: boolean) => WinResult;
  recordHint: () => void;
  buyTheme: (id: ThemeId) => boolean;
  selectTheme: (id: ThemeId) => void;
  claimDaily: () => number;
  resetProgress: () => void;
}

const initial = (): ProgressData => ({
  coins: START_COINS,
  currentLevel: 1,
  maxUnlocked: 1,
  stars: {},
  unlockedThemes: ['candyland'],
  selectedTheme: 'candyland',
  achievements: [],
  dailyStreak: 0,
  bestStreak: 0,
  lastDailyClaim: null,
  noUndoWins: 0,
  hintsUsed: 0,
  totalWins: 0,
});

export function statsOf(p: ProgressData): AchievementStats {
  const values = Object.values(p.stars);
  return {
    levelsCompleted: values.filter((s) => s > 0).length,
    threeStarLevels: values.filter((s) => s >= 3).length,
    bestStreak: p.bestStreak,
    noUndoWins: p.noUndoWins,
    themesOwned: p.unlockedThemes.length,
    hintsUsed: p.hintsUsed,
  };
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      /** Unlocks any newly earned achievements, pays their reward and toasts. */
      const checkAchievements = () => {
        const s = get();
        const fresh = newlyUnlocked(statsOf(s), s.achievements);
        if (!fresh.length) return;
        set({
          achievements: [...s.achievements, ...fresh.map((a) => a.id)],
          coins: s.coins + fresh.reduce((sum, a) => sum + a.reward, 0),
        });
        for (const a of fresh) {
          useUi.getState().toast({ kind: 'achievement', title: a.name, body: `${a.description} +${a.reward} coins` });
        }
      };

      return {
        ...initial(),
        spend: (cost) => {
          if (get().coins < cost) return false;
          set((s) => ({ coins: s.coins - cost }));
          return true;
        },
        addCoins: (n) => set((s) => ({ coins: s.coins + n })),
        setCurrentLevel: (lv) => set({ currentLevel: Math.min(Math.max(1, lv), LEVEL_COUNT) }),
        recordWin: (level, stars, usedUndo) => {
          const s = get();
          const prev = s.stars[level] ?? 0;
          set({
            coins: s.coins + LEVEL_REWARD,
            stars: { ...s.stars, [level]: Math.max(prev, stars) },
            maxUnlocked: Math.min(LEVEL_COUNT, Math.max(s.maxUnlocked, level + 1)),
            noUndoWins: s.noUndoWins + (usedUndo ? 0 : 1),
            totalWins: s.totalWins + 1,
          });
          checkAchievements();
          return { stars, coins: LEVEL_REWARD, firstClear: prev === 0, newBest: stars > prev };
        },
        recordHint: () => {
          set((s) => ({ hintsUsed: s.hintsUsed + 1 }));
          checkAchievements();
        },
        buyTheme: (id) => {
          const s = get();
          const theme = THEMES.find((t) => t.id === id);
          if (!theme) return false;
          if (s.unlockedThemes.includes(id)) return true;
          if (s.coins < theme.price) return false;
          set({ coins: s.coins - theme.price, unlockedThemes: [...s.unlockedThemes, id], selectedTheme: id });
          checkAchievements();
          return true;
        },
        selectTheme: (id) => {
          if (get().unlockedThemes.includes(id)) set({ selectedTheme: id });
        },
        claimDaily: () => {
          const s = get();
          const today = dayKey(new Date());
          const st = dailyStatus(s.lastDailyClaim, s.dailyStreak, today);
          if (!st.canClaim) return 0;
          set({
            coins: s.coins + st.reward,
            dailyStreak: st.streakIfClaimed,
            bestStreak: Math.max(s.bestStreak, st.streakIfClaimed),
            lastDailyClaim: today,
          });
          checkAchievements();
          return st.reward;
        },
        resetProgress: () => set(initial()),
      };
    },
    {
      name: PROGRESS_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => {
        const data: Partial<ProgressState> = { ...s };
        for (const k of Object.keys(data) as (keyof ProgressState)[]) if (typeof data[k] === 'function') delete data[k];
        return data as ProgressData;
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressData>;
        const merged = { ...current, ...p };
        // Guard against stale ids from older saves.
        merged.unlockedThemes = (merged.unlockedThemes ?? ['candyland']).filter((t) => THEMES.some((x) => x.id === t));
        if (!merged.unlockedThemes.includes('candyland')) merged.unlockedThemes.unshift('candyland');
        if (!merged.unlockedThemes.includes(merged.selectedTheme)) merged.selectedTheme = 'candyland';
        merged.achievements = (merged.achievements ?? []).filter((a) => ACHIEVEMENTS.some((x) => x.id === a));
        return merged;
      },
    },
  ),
);
