import type { Board, Jar, Move, SolveResult } from './types';
import { applyMove, isJarComplete, isWin } from './rules';

export interface SolveOptions {
  /** Maximum number of expanded states before giving up with status 'limit'. */
  nodeLimit?: number;
  /** Optional maximum solution length (used to search for shorter solutions). */
  maxDepth?: number;
}

const A = 97;

/** Canonical state hash: jars are interchangeable, so sort their encodings. */
export function stateKey(jars: Jar[]): string {
  const parts = jars.map((j) => {
    let s = '';
    for (let i = 0; i < j.length; i++) s += String.fromCharCode(A + j[i]);
    return s;
  });
  parts.sort();
  return parts.join('|');
}

function bottomRun(jar: Jar): number {
  if (!jar.length) return 0;
  let n = 1;
  while (n < jar.length && jar[n] === jar[0]) n++;
  return n;
}

function isMono(jar: Jar): boolean {
  return jar.length > 0 && bottomRun(jar) === jar.length;
}

/**
 * Admissible lower bound on remaining moves: every candy sitting above a
 * different colour must move, and when several jars have the same colour at
 * the bottom, all but one of those bottom runs must move too.
 */
export function lowerBound(jars: Jar[]): number {
  let lb = 0;
  const runs = new Map<number, number[]>();
  for (const jar of jars) {
    if (!jar.length) continue;
    const r = bottomRun(jar);
    lb += jar.length - r;
    const list = runs.get(jar[0]);
    if (list) list.push(r);
    else runs.set(jar[0], [r]);
  }
  for (const list of runs.values()) {
    if (list.length < 2) continue;
    let sum = 0;
    let max = 0;
    for (const r of list) {
      sum += r;
      if (r > max) max = r;
    }
    lb += sum - max;
  }
  return lb;
}

/** Candidate moves, pruned of pointless ones and ordered best-first. */
function orderedMoves(board: Board): Move[] {
  const { jars, capacity } = board;
  const scored: { m: Move; s: number }[] = [];
  let firstEmpty = -1;
  for (let i = 0; i < jars.length; i++)
    if (jars[i].length === 0) {
      firstEmpty = i;
      break;
    }

  for (let from = 0; from < jars.length; from++) {
    const src = jars[from];
    if (!src.length || isJarComplete(src, capacity)) continue;
    const c = src[src.length - 1];
    const srcMono = isMono(src);
    // length of the same-colour run on top of the source
    let topRun = 1;
    while (topRun < src.length && src[src.length - 1 - topRun] === c) topRun++;

    for (let to = 0; to < jars.length; to++) {
      if (to === from) continue;
      const dst = jars[to];
      if (dst.length >= capacity) continue;
      if (dst.length === 0) {
        if (to !== firstEmpty || srcMono) continue; // empty jars are symmetric
        // Moving into an empty jar: better when it unblocks a short run.
        scored.push({ m: { from, to }, s: -10 - topRun });
        continue;
      }
      if (dst[dst.length - 1] !== c) continue;
      const dstMono = isMono(dst);
      let s = 10;
      // Pouring a single-colour jar onto a mixed stack is rarely useful (but
      // can free a jar), so try it last rather than pruning it.
      if (srcMono && !dstMono) s = -30;
      if (dstMono) s += 10 + dst.length * 2;
      if (srcMono && dstMono && src.length > dst.length) s -= 6; // prefer pouring small into big
      if (topRun === 1) s += 3; // reveals a new colour
      scored.push({ m: { from, to }, s });
    }
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.map((x) => x.m);
}

/**
 * Depth-first search with visited-state hashing, an admissible lower bound
 * when a depth cap is given, and a node limit.
 */
export function solve(start: Board, opts: SolveOptions = {}): SolveResult {
  const nodeLimit = opts.nodeLimit ?? 200_000;
  const maxDepth = opts.maxDepth ?? Infinity;
  const bounded = Number.isFinite(maxDepth);
  const visited = new Map<string, number>();
  const path: Move[] = [];
  let nodes = 0;
  let hitLimit = false;

  const dfs = (board: Board, depth: number): boolean => {
    if (isWin(board)) return true;
    if (bounded && depth + lowerBound(board.jars) > maxDepth) return false;
    if (nodes >= nodeLimit) {
      hitLimit = true;
      return false;
    }
    nodes++;
    for (const m of orderedMoves(board)) {
      const next = applyMove(board, m);
      const key = stateKey(next.jars);
      const seen = visited.get(key);
      if (seen !== undefined && seen <= depth + 1) continue;
      visited.set(key, depth + 1);
      path.push(m);
      if (dfs(next, depth + 1)) return true;
      path.pop();
      if (hitLimit) return false;
    }
    return false;
  };

  visited.set(stateKey(start.jars), 0);
  const found = dfs(start, 0);
  if (found) return { status: 'solved', moves: path.slice(), nodes };
  return { status: hitLimit ? 'limit' : 'unsolvable', moves: [], nodes };
}

/**
 * Finds a solution, then repeatedly searches for a strictly shorter one while
 * the node budget allows. The result is a good (often optimal) par.
 */
export function solveShort(start: Board, nodeLimit = 200_000, improveLimit = 60_000, rounds = 12): SolveResult {
  const first = solve(start, { nodeLimit });
  if (first.status !== 'solved') return first;
  let best = first;
  let total = first.nodes;
  for (let r = 0; r < rounds; r++) {
    const target = best.moves.length - 1;
    if (target < lowerBound(start.jars)) break;
    const res = solve(start, { nodeLimit: improveLimit, maxDepth: target });
    total += res.nodes;
    if (res.status !== 'solved') break;
    best = res;
  }
  return { status: 'solved', moves: best.moves, nodes: total };
}
