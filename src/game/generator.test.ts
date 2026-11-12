import { describe, expect, it } from 'vitest';
import { generateLevel, levelConfig, reverseScramble } from './generator';
import { mulberry32 } from './rng';
import { applyMove, isJarComplete, isValidMove, isWin, isWellFormed } from './rules';
import { solve } from './solver';
import { jarSlots } from './layout';
import type { Board, LevelData } from './types';

const expected = (lv: number) => {
  if (lv <= 5) return { colors: [2], jars: () => 3 };
  if (lv <= 15) return { colors: [3], jars: () => 4 };
  if (lv <= 40) return { colors: [4, 5], jars: (c: number) => c + 1 };
  if (lv <= 75) return { colors: [6, 7], jars: (c: number) => c + 2 };
  return { colors: [8], jars: () => 10 };
};

describe('level config', () => {
  it('matches the difficulty table', () => {
    for (let lv = 1; lv <= 100; lv++) {
      const cfg = levelConfig(lv);
      const e = expected(lv);
      expect(e.colors).toContain(cfg.colors);
      expect(cfg.jars).toBe(e.jars(cfg.colors));
    }
  });

  it('lays out one row up to 5 jars, two rows above', () => {
    expect(new Set(jarSlots(5).map((s) => s.row)).size).toBe(1);
    expect(new Set(jarSlots(6).map((s) => s.row)).size).toBe(2);
    expect(jarSlots(10).length).toBe(10);
  });
});

describe('reverse-scramble fallback', () => {
  it('always produces a well-formed, unsolved, solvable board', () => {
    for (const lv of [1, 10, 30, 60, 90]) {
      const cfg = levelConfig(lv);
      for (let seed = 1; seed <= 5; seed++) {
        const jars = reverseScramble(cfg, mulberry32(seed * 7919 + lv));
        const board: Board = { jars, capacity: 4 };
        expect(jars.length).toBe(cfg.jars);
        expect(isWellFormed(board)).toBe(true);
        expect(isWin(board)).toBe(false);
        expect(solve(board, { nodeLimit: 400_000 }).status, `level ${lv} seed ${seed}`).toBe('solved');
      }
    }
  });
});

describe('all 100 levels', () => {
  const levels: LevelData[] = [];

  it('generates every level deterministically', () => {
    for (let lv = 1; lv <= 100; lv++) levels.push(generateLevel(lv));
    expect(levels.length).toBe(100);
    // Same seed -> same level
    expect(generateLevel(37)).toEqual(levels[36]);
    expect(generateLevel(88)).toEqual(levels[87]);
  });

  it('every level is well formed, unsolved and solvable', () => {
    for (const lvl of levels) {
      const board: Board = { jars: lvl.jars, capacity: lvl.capacity };
      const cfg = levelConfig(lvl.level);
      expect(lvl.jars.length, `level ${lvl.level} jars`).toBe(cfg.jars);
      expect(isWellFormed(board), `level ${lvl.level} well formed`).toBe(true);
      expect(isWin(board), `level ${lvl.level} starts solved`).toBe(false);
      expect(lvl.jars.some((j) => isJarComplete(j, 4)), `level ${lvl.level} starts with a full jar`).toBe(false);

      // The stored solution replays to a win...
      let cur = board;
      for (const m of lvl.solution) {
        expect(isValidMove(cur, m.from, m.to), `level ${lvl.level} solution move`).toBe(true);
        cur = applyMove(cur, m);
      }
      expect(isWin(cur), `level ${lvl.level} solution wins`).toBe(true);
      expect(lvl.par).toBe(lvl.solution.length);

      // ...and an independent solver run also finds a solution.
      const res = solve(board, { nodeLimit: 400_000 });
      expect(res.status, `level ${lvl.level} solver`).toBe('solved');
    }
  });

  it('is not trivially easy and gets harder', () => {
    for (const lvl of levels) expect(lvl.par, `level ${lvl.level} par`).toBeGreaterThanOrEqual(levelConfig(lvl.level).minMoves - 0);
    const avg = (a: number, z: number) => levels.slice(a - 1, z).reduce((s, l) => s + l.par, 0) / (z - a + 1);
    expect(avg(76, 100)).toBeGreaterThan(avg(1, 5));
    expect(avg(41, 75)).toBeGreaterThan(avg(6, 15));
  });
});
