import type { Board, Jar, LevelConfig, LevelData, Move } from './types';
import { JAR_CAPACITY, LEVEL_COUNT } from './constants';
import { levelSeed, mulberry32, shuffle } from './rng';
import { isJarComplete, isWin } from './rules';
import { lowerBound, solve, solveShort } from './solver';

interface Band {
  from: number;
  to: number;
  colors: number;
  extraJars: number; // jars = colors + extraJars
  minMoves: number;
}

/** Difficulty bands. 16-40 and 41-75 are split by colour count. */
const BANDS: Band[] = [
  { from: 1, to: 5, colors: 2, extraJars: 1, minMoves: 4 },
  { from: 6, to: 15, colors: 3, extraJars: 1, minMoves: 7 },
  { from: 16, to: 27, colors: 4, extraJars: 1, minMoves: 10 },
  { from: 28, to: 40, colors: 5, extraJars: 1, minMoves: 13 },
  { from: 41, to: 57, colors: 6, extraJars: 2, minMoves: 15 },
  { from: 58, to: 75, colors: 7, extraJars: 2, minMoves: 18 },
  { from: 76, to: 100, colors: 8, extraJars: 2, minMoves: 21 },
];

export function levelConfig(level: number): LevelConfig {
  const lv = Math.min(Math.max(1, Math.floor(level)), LEVEL_COUNT);
  const band = BANDS.find((b) => lv >= b.from && lv <= b.to)!;
  const span = band.to - band.from;
  return {
    level: lv,
    colors: band.colors,
    jars: band.colors + band.extraJars,
    minMoves: band.minMoves,
    bandPosition: span === 0 ? 0 : (lv - band.from) / span,
  };
}

/** Number of accepted candidates compared per level; more = smoother ramp. */
const CANDIDATES = 8;
const MAX_VARIANTS = 60;
const NODE_LIMIT = 60_000;
const IMPROVE_LIMIT = 30_000;

function deal(cfg: LevelConfig, rand: () => number): Jar[] {
  const candies: number[] = [];
  for (let c = 0; c < cfg.colors; c++) for (let k = 0; k < JAR_CAPACITY; k++) candies.push(c);
  shuffle(candies, rand);
  const jars: Jar[] = [];
  for (let j = 0; j < cfg.jars; j++) jars.push([]);
  // The first `colors` jars are filled, the rest start empty.
  candies.forEach((c, i) => jars[Math.floor(i / JAR_CAPACITY)].push(c));
  return jars;
}

/** Remaps colours so a level shows a varied set of candies, not always 0..n-1. */
function paletteFor(cfg: LevelConfig, rand: () => number): number[] {
  const all = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rand);
  return all.slice(0, cfg.colors);
}

/**
 * Fallback: start solved and play legal moves backwards. Every reverse step
 * takes the top candy of a jar whose new top matches (or which becomes empty)
 * and puts it anywhere with room, so the forward move is always legal.
 */
export function reverseScramble(cfg: LevelConfig, rand: () => number): Jar[] {
  const jars: Jar[] = [];
  for (let j = 0; j < cfg.jars; j++) jars.push(j < cfg.colors ? Array(JAR_CAPACITY).fill(j) : []);
  const steps = 12 + cfg.colors * 8;
  let last: Move | null = null;
  for (let s = 0; s < steps * 4 && s < 2000; s++) {
    const options: Move[] = [];
    for (let from = 0; from < jars.length; from++) {
      const src = jars[from];
      if (!src.length) continue;
      const below = src.length >= 2 ? src[src.length - 2] : -1;
      if (below !== -1 && below !== src[src.length - 1]) continue;
      for (let to = 0; to < jars.length; to++) {
        if (to === from || jars[to].length >= JAR_CAPACITY) continue;
        if (last && last.from === to && last.to === from) continue;
        options.push({ from, to });
      }
    }
    if (!options.length) break;
    const m = options[Math.floor(rand() * options.length)];
    jars[m.to].push(jars[m.from].pop()!);
    last = m;
    if (s >= steps && !jars.some((j) => isJarComplete(j, JAR_CAPACITY))) break;
  }
  return jars;
}

interface Candidate {
  jars: Jar[];
  solution: Move[];
  seed: number;
}

function hasCompleteJar(jars: Jar[]): boolean {
  return jars.some((j) => isJarComplete(j, JAR_CAPACITY));
}

/**
 * Generates a level deterministically from its number. Several random deals
 * are solved; unsolvable or too-easy ones are rejected and the accepted ones
 * are ranked by solution length so difficulty rises through each band.
 */
export function generateLevel(level: number): LevelData {
  const cfg = levelConfig(level);
  const candidates: Candidate[] = [];

  for (let v = 0; v < MAX_VARIANTS && candidates.length < CANDIDATES; v++) {
    const seed = levelSeed(cfg.level, v);
    const rand = mulberry32(seed);
    const jars = deal(cfg, rand);
    const board: Board = { jars, capacity: JAR_CAPACITY };
    if (isWin(board) || hasCompleteJar(jars)) continue;
    if (lowerBound(jars) >= 40) continue; // pathological deals
    const res = solveShort(board, NODE_LIMIT, IMPROVE_LIMIT, 10);
    if (res.status !== 'solved') continue; // unsolvable, or hit the node limit
    if (res.moves.length < cfg.minMoves) continue; // too easy
    candidates.push({ jars, solution: res.moves, seed });
  }

  let picked: Candidate;
  let method: LevelData['method'] = 'deal';
  if (candidates.length) {
    candidates.sort((a, b) => a.solution.length - b.solution.length || a.seed - b.seed);
    picked = candidates[Math.round(cfg.bandPosition * (candidates.length - 1))];
  } else {
    method = 'reverse';
    const seed = levelSeed(cfg.level, 9999);
    const rand = mulberry32(seed);
    let jars = reverseScramble(cfg, rand);
    let res = solve({ jars, capacity: JAR_CAPACITY }, { nodeLimit: NODE_LIMIT * 4 });
    // A reverse scramble is solvable by construction; the solver just gives par.
    if (res.status !== 'solved') {
      jars = reverseScramble(cfg, mulberry32(seed + 1));
      res = solve({ jars, capacity: JAR_CAPACITY }, { nodeLimit: NODE_LIMIT * 8 });
    }
    picked = { jars, solution: res.moves, seed };
  }

  // Recolour with a level-specific palette so different candies show up.
  const palette = paletteFor(cfg, mulberry32(picked.seed ^ 0x51ed));
  const jars = picked.jars.map((j) => j.map((c) => palette[c]));

  return {
    level: cfg.level,
    colors: cfg.colors,
    jars,
    capacity: JAR_CAPACITY,
    par: Math.max(1, picked.solution.length),
    solution: picked.solution,
    method,
    seed: picked.seed,
  };
}
