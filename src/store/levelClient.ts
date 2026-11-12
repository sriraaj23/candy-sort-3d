import type { Board, LevelData, SolveResult } from '../game';
import { generateLevel, solve } from '../game';

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();
const levelCache = new Map<number, Promise<LevelData>>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../game/level.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      // Fall back to main-thread work in small slices if the worker dies.
      workerFailed = true;
      worker = null;
      for (const p of pending.values()) p.reject(new Error('worker failed'));
      pending.clear();
    };
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function call<T>(msg: Record<string, unknown>, fallback: () => T): Promise<T> {
  const w = getWorker();
  if (!w) return new Promise((res) => setTimeout(() => res(fallback()), 0));
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...msg, id });
  }).catch(() => new Promise<T>((res) => setTimeout(() => res(fallback()), 0)));
}

export function getLevel(level: number): Promise<LevelData> {
  let p = levelCache.get(level);
  if (!p) {
    p = call<LevelData>({ type: 'generate', level }, () => generateLevel(level));
    levelCache.set(level, p);
    p.catch(() => levelCache.delete(level));
  }
  return p;
}

export function prefetchLevel(level: number) {
  if (level >= 1 && level <= 100) void getLevel(level);
}

export function solveBoard(board: Board, nodeLimit = 250_000): Promise<SolveResult> {
  return call<SolveResult>({ type: 'solve', board, nodeLimit }, () => solve(board, { nodeLimit }));
}
