import { describe, expect, it } from 'vitest';
import { lowerBound, solve, solveShort, stateKey } from './solver';
import { applyMove, isValidMove, isWin } from './rules';
import type { Board } from './types';

const b = (jars: number[][]): Board => ({ jars, capacity: 4 });

function replay(board: Board, moves: { from: number; to: number }[]): Board {
  let cur = board;
  for (const m of moves) {
    expect(isValidMove(cur, m.from, m.to)).toBe(true);
    cur = applyMove(cur, m);
  }
  return cur;
}

describe('solver', () => {
  it('hashes jar order-independently', () => {
    expect(stateKey([[0, 1], [], [2]])).toBe(stateKey([[2], [0, 1], []]));
  });

  it('solves a simple board with a valid move list', () => {
    const board = b([[0, 1, 0, 1], [1, 0, 1, 0], []]);
    const res = solve(board);
    expect(res.status).toBe('solved');
    expect(isWin(replay(board, res.moves))).toBe(true);
  });

  it('reports unsolvable boards', () => {
    const res = solve(b([[0, 1, 0, 1], [1, 0, 1, 0]]));
    expect(res.status).toBe('unsolvable');
  });

  it('returns an empty solution for a solved board', () => {
    expect(solve(b([[0, 0, 0, 0], []])).moves).toEqual([]);
  });

  it('respects the node limit', () => {
    const board = b([[0, 1, 2, 3], [4, 5, 6, 7], [7, 6, 5, 4], [3, 2, 1, 0], [0, 2, 4, 6], [1, 3, 5, 7], [7, 5, 3, 1], [6, 4, 2, 0], [], []]);
    const res = solve(board, { nodeLimit: 5 });
    expect(['limit', 'solved']).toContain(res.status);
    expect(res.nodes).toBeLessThanOrEqual(5);
  });

  it('solveShort never returns a longer solution and stays valid', () => {
    const board = b([[0, 1, 2, 0], [2, 1, 0, 1], [2, 0, 1, 2], [], []]);
    const a = solve(board);
    const s = solveShort(board);
    expect(s.status).toBe('solved');
    expect(s.moves.length).toBeLessThanOrEqual(a.moves.length);
    expect(s.moves.length).toBeGreaterThanOrEqual(lowerBound(board.jars));
    expect(isWin(replay(board, s.moves))).toBe(true);
  });
});
