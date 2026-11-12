import type { Board, Color, Jar, Move } from './types';

export function topColor(jar: Jar): Color | -1 {
  return jar.length ? jar[jar.length - 1] : -1;
}

export function isJarComplete(jar: Jar, capacity: number): boolean {
  if (jar.length !== capacity) return false;
  const c = jar[0];
  for (let i = 1; i < jar.length; i++) if (jar[i] !== c) return false;
  return true;
}

/** A jar can be picked from when it has candies and is not complete. */
export function canSelect(board: Board, index: number): boolean {
  const jar = board.jars[index];
  return !!jar && jar.length > 0 && !isJarComplete(jar, board.capacity);
}

export type MoveCheck = 'ok' | 'same-jar' | 'bad-source' | 'full' | 'color-mismatch' | 'no-jar';

export function checkMove(board: Board, from: number, to: number): MoveCheck {
  if (from === to) return 'same-jar';
  const src = board.jars[from];
  const dst = board.jars[to];
  if (!src || !dst) return 'no-jar';
  if (!canSelect(board, from)) return 'bad-source';
  if (dst.length >= board.capacity) return 'full';
  if (dst.length > 0 && topColor(dst) !== topColor(src)) return 'color-mismatch';
  return 'ok';
}

export function isValidMove(board: Board, from: number, to: number): boolean {
  return checkMove(board, from, to) === 'ok';
}

/** Moves exactly one candy. Returns a new board; untouched jars are shared. */
export function applyMove(board: Board, move: Move): Board {
  const jars = board.jars.slice();
  const src = jars[move.from].slice();
  const candy = src.pop();
  if (candy === undefined) throw new Error('applyMove: empty source jar');
  jars[move.from] = src;
  jars[move.to] = [...jars[move.to], candy];
  return { jars, capacity: board.capacity };
}

/** Reverses a move made earlier: the top candy of `to` returns to `from`. */
export function revertMove(board: Board, move: Move): Board {
  return applyMove(board, { from: move.to, to: move.from });
}

export function isWin(board: Board): boolean {
  return board.jars.every((j) => j.length === 0 || isJarComplete(j, board.capacity));
}

export function validMoves(board: Board): Move[] {
  const moves: Move[] = [];
  const n = board.jars.length;
  for (let from = 0; from < n; from++) {
    if (!canSelect(board, from)) continue;
    for (let to = 0; to < n; to++) {
      if (isValidMove(board, from, to)) moves.push({ from, to });
    }
  }
  return moves;
}

export function hasValidMove(board: Board): boolean {
  const n = board.jars.length;
  for (let from = 0; from < n; from++) {
    if (!canSelect(board, from)) continue;
    for (let to = 0; to < n; to++) if (isValidMove(board, from, to)) return true;
  }
  return false;
}

/** No valid move remains and the puzzle is not solved. */
export function isStuck(board: Board): boolean {
  return !isWin(board) && !hasValidMove(board);
}

/** Checks the board is well formed: every colour appears exactly `capacity` times. */
export function isWellFormed(board: Board): boolean {
  const counts = new Map<Color, number>();
  for (const jar of board.jars) {
    if (jar.length > board.capacity) return false;
    for (const c of jar) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  for (const v of counts.values()) if (v !== board.capacity) return false;
  return true;
}
