/// <reference lib="webworker" />
// Runs level generation and the hint solver off the main thread.
import { generateLevel } from './generator';
import { solve } from './solver';
import type { Board } from './types';

export type WorkerRequest =
  { id: number; type: 'generate'; level: number } | { id: number; type: 'solve'; board: Board; nodeLimit: number };

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'generate') {
      (self as unknown as Worker).postMessage({ id: msg.id, ok: true, result: generateLevel(msg.level) });
    } else {
      (self as unknown as Worker).postMessage({ id: msg.id, ok: true, result: solve(msg.board, { nodeLimit: msg.nodeLimit }) });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: msg.id, ok: false, error: String(err) });
  }
};
