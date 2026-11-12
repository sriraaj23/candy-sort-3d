/** Tiny event bus so audio and effects can react to game events. */
export type GameEvent =
  | { type: 'select'; jar: number }
  | { type: 'deselect'; jar: number }
  | { type: 'move'; from: number; to: number }
  | { type: 'drop'; jar: number }
  | { type: 'invalid'; jar: number }
  | { type: 'jarComplete'; jar: number }
  | { type: 'win' }
  | { type: 'stuck' }
  | { type: 'undo' }
  | { type: 'restart' }
  | { type: 'hint' }
  | { type: 'addJar' }
  | { type: 'levelStart' };

type Handler = (e: GameEvent) => void;
const handlers = new Set<Handler>();

export function emit(e: GameEvent) {
  for (const h of handlers) h(e);
}

export function onGameEvent(h: Handler): () => void {
  handlers.add(h);
  return () => handlers.delete(h);
}
