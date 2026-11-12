import { describe, expect, it } from 'vitest';
import { applyMove, canSelect, checkMove, hasValidMove, isJarComplete, isStuck, isWin, revertMove, validMoves } from './rules';
import type { Board } from './types';

const b = (jars: number[][]): Board => ({ jars, capacity: 4 });

describe('rules', () => {
  it('detects complete jars', () => {
    expect(isJarComplete([1, 1, 1, 1], 4)).toBe(true);
    expect(isJarComplete([1, 1, 1], 4)).toBe(false);
    expect(isJarComplete([1, 1, 2, 1], 4)).toBe(false);
  });

  it('only lets non-empty, incomplete jars be selected', () => {
    const board = b([[0, 1], [], [2, 2, 2, 2]]);
    expect(canSelect(board, 0)).toBe(true);
    expect(canSelect(board, 1)).toBe(false);
    expect(canSelect(board, 2)).toBe(false);
  });

  it('validates moves', () => {
    const board = b([[0, 1], [], [1], [0, 0, 0, 2], [2]]);
    expect(checkMove(board, 0, 1)).toBe('ok'); // into empty
    expect(checkMove(board, 0, 2)).toBe('ok'); // same colour
    expect(checkMove(board, 0, 4)).toBe('color-mismatch');
    expect(checkMove(board, 4, 3)).toBe('full');
    expect(checkMove(board, 0, 0)).toBe('same-jar');
    expect(checkMove(board, 1, 0)).toBe('bad-source');
  });

  it('moves exactly one candy and can be reverted', () => {
    const board = b([[0, 1, 1], [1]]);
    const after = applyMove(board, { from: 0, to: 1 });
    expect(after.jars).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(board.jars).toEqual([[0, 1, 1], [1]]); // immutable
    expect(revertMove(after, { from: 0, to: 1 }).jars).toEqual(board.jars);
  });

  it('wins only when every jar is empty or complete', () => {
    expect(isWin(b([[0, 0, 0, 0], [], [1, 1, 1, 1]]))).toBe(true);
    expect(
      isWin(
        b([
          [0, 0, 0, 0],
          [1, 1],
          [1, 1],
        ]),
      ),
    ).toBe(false); // colour split
    expect(
      isWin(
        b([
          [0, 0, 0, 1],
          [1, 1, 1, 0],
        ]),
      ),
    ).toBe(false);
  });

  it('detects stuck boards', () => {
    const stuck = b([
      [0, 1, 0, 1],
      [1, 0, 1, 0],
    ]);
    expect(hasValidMove(stuck)).toBe(false);
    expect(isStuck(stuck)).toBe(true);
    expect(isStuck(b([[0, 0, 0, 0]]))).toBe(false);
    expect(validMoves(b([[0, 1], [], [1]])).length).toBe(4); // 0->1, 0->2, 2->0, 2->1
  });
});
