export interface AchievementStats {
  levelsCompleted: number;
  threeStarLevels: number;
  bestStreak: number;
  noUndoWins: number;
  themesOwned: number;
  hintsUsed: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward: number;
  check: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'Sweet Start', description: 'Complete your first level.', reward: 20, check: (s) => s.levelsCompleted >= 1 },
  { id: 'levels_10', name: 'Sugar Rush', description: 'Complete 10 levels.', reward: 40, check: (s) => s.levelsCompleted >= 10 },
  { id: 'levels_50', name: 'Candy Connoisseur', description: 'Complete 50 levels.', reward: 100, check: (s) => s.levelsCompleted >= 50 },
  { id: 'levels_100', name: 'Grand Confectioner', description: 'Complete all 100 levels.', reward: 250, check: (s) => s.levelsCompleted >= 100 },
  { id: 'three_star', name: 'Perfect Pick', description: 'Earn 3 stars on a level.', reward: 20, check: (s) => s.threeStarLevels >= 1 },
  { id: 'three_star_25', name: 'Star Collector', description: 'Earn 3 stars on 25 levels.', reward: 80, check: (s) => s.threeStarLevels >= 25 },
  { id: 'streak_7', name: 'Daily Treat', description: 'Claim the daily reward 7 days in a row.', reward: 100, check: (s) => s.bestStreak >= 7 },
  { id: 'no_undo', name: 'No Take-Backs', description: 'Win a level without using Undo.', reward: 30, check: (s) => s.noUndoWins >= 1 },
  { id: 'theme_buyer', name: 'Redecorator', description: 'Unlock a new theme.', reward: 30, check: (s) => s.themesOwned >= 2 },
  { id: 'hint_user', name: 'Little Helper', description: 'Use a hint.', reward: 10, check: (s) => s.hintsUsed >= 1 },
];

/** Ids of achievements newly satisfied by `stats`. */
export function newlyUnlocked(stats: AchievementStats, already: string[]): Achievement[] {
  const have = new Set(already);
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.check(stats));
}
