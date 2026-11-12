import { create } from 'zustand';
import {
  ADD_JAR_COST,
  HINT_COST,
  applyMove,
  canSelect,
  checkMove,
  isJarComplete,
  isStuck,
  isWin,
  revertMove,
  starsFor,
  type Board,
  type Jar,
  type LevelData,
  type Move,
} from '../game';
import { getLevel, prefetchLevel, solveBoard } from './levelClient';
import { useProgress, type WinResult } from './progressStore';
import { useUi } from './uiStore';
import { emit } from './events';

export const MOVE_MS = 360;
export const MOVE_MS_REDUCED = 140;

export type GameStatus = 'idle' | 'loading' | 'playing' | 'won';

export interface CandySpot {
  jar: number;
  slot: number;
}

interface GameState {
  status: GameStatus;
  level: number;
  data: LevelData | null;
  capacity: number;
  jars: Jar[];
  /** Stable candy ids, same shape as `jars`, so the scene can animate them. */
  ids: number[][];
  /** Candy id -> colour (fixed for the level). */
  colors: number[];
  /** Candy id -> jar/slot, recomputed after every change. */
  spots: CandySpot[];
  initialJars: Jar[];
  initialIds: number[][];
  selected: number | null;
  history: Move[];
  usedUndo: boolean;
  addedJar: boolean;
  hint: Move | null;
  hintPending: boolean;
  /** Bumps every time a jar is shaken by an invalid move. */
  shake: { jar: number; n: number };
  /** Time (performance.now) until which input is ignored. */
  busyUntil: number;
  /** Bumps on every board change; used to discard stale async hint results. */
  version: number;
  result: WinResult | null;
  /** Increments on every level load so the scene remounts candies. */
  session: number;

  loadLevel: (level: number) => Promise<void>;
  tapJar: (index: number) => void;
  /** Starts dragging the top candy of `from`. Returns false if not allowed. */
  beginDrag: (from: number) => boolean;
  /** Drops the dragged candy on jar `to` (null = released over no jar / cancelled). */
  endDrag: (to: number | null) => void;
  undo: () => void;
  restart: () => void;
  useHint: () => Promise<void>;
  addJar: () => void;
  leave: () => void;
}

const board = (s: Pick<GameState, 'jars' | 'capacity'>): Board => ({ jars: s.jars, capacity: s.capacity });

function spotsFor(ids: number[][], count: number): CandySpot[] {
  const spots: CandySpot[] = new Array(count);
  ids.forEach((jar, j) => jar.forEach((id, slot) => (spots[id] = { jar: j, slot })));
  return spots;
}

function moveIds(ids: number[][], m: Move): number[][] {
  const next = ids.slice();
  const src = next[m.from].slice();
  const id = src.pop()!;
  next[m.from] = src;
  next[m.to] = [...next[m.to], id];
  return next;
}

function moveDuration() {
  return useUi.getState().reducedMotion ? MOVE_MS_REDUCED : MOVE_MS;
}

let followUp: ReturnType<typeof setTimeout> | null = null;
function schedule(fn: () => void, ms: number) {
  if (followUp) clearTimeout(followUp);
  followUp = setTimeout(() => {
    followUp = null;
    fn();
  }, ms);
}

export const useGame = create<GameState>()((set, get) => {
  /** Runs after a candy lands: win and stuck checks. */
  const afterMove = () => {
    const s = get();
    if (s.status !== 'playing') return;
    const b = board(s);
    if (isWin(b)) {
      const stars = starsFor(s.history.length, s.data?.par ?? s.history.length);
      const result = useProgress.getState().recordWin(s.level, stars, s.usedUndo);
      set({ status: 'won', result, selected: null, hint: null });
      emit({ type: 'win' });
      prefetchLevel(s.level + 1);
      setTimeout(
        () => {
          if (get().status === 'won' && get().result === result) useUi.getState().openModal('victory');
        },
        useUi.getState().reducedMotion ? 400 : 1500,
      );
      return;
    }
    if (isStuck(b)) {
      emit({ type: 'stuck' });
      useUi.getState().openModal('stuck');
    }
  };

  const setBoard = (jars: Jar[], ids: number[][], extra: Partial<GameState> = {}) => {
    set((s) => ({ jars, ids, spots: spotsFor(ids, s.colors.length), version: s.version + 1, hint: null, ...extra }));
  };

  /** The single move path shared by tap and drag-and-drop. Assumes it is valid. */
  const performMove = (from: number, to: number) => {
    const s = get();
    const move = { from, to };
    const nextBoard = applyMove(board(s), move);
    const dur = moveDuration();
    setBoard(nextBoard.jars, moveIds(s.ids, move), {
      selected: null,
      history: [...s.history, move],
      busyUntil: performance.now() + dur,
    });
    emit({ type: 'move', from, to });
    const completes = isJarComplete(nextBoard.jars[to], s.capacity);
    schedule(() => {
      emit({ type: 'drop', jar: to });
      if (completes) emit({ type: 'jarComplete', jar: to });
      afterMove();
    }, dur);
  };

  return {
    status: 'idle',
    level: 1,
    data: null,
    capacity: 4,
    jars: [],
    ids: [],
    colors: [],
    spots: [],
    initialJars: [],
    initialIds: [],
    selected: null,
    history: [],
    usedUndo: false,
    addedJar: false,
    hint: null,
    hintPending: false,
    shake: { jar: -1, n: 0 },
    busyUntil: 0,
    version: 0,
    result: null,
    session: 0,

    loadLevel: async (level) => {
      if (followUp) clearTimeout(followUp);
      set({ status: 'loading', level, selected: null, hint: null, result: null });
      useProgress.getState().setCurrentLevel(level);
      const data = await getLevel(level);
      if (get().level !== level) return; // another level was requested meanwhile
      const colors: number[] = [];
      const ids: number[][] = data.jars.map((jar) =>
        jar.map((c) => {
          colors.push(c);
          return colors.length - 1;
        }),
      );
      set({
        status: 'playing',
        data,
        capacity: data.capacity,
        jars: data.jars,
        ids,
        colors,
        spots: spotsFor(ids, colors.length),
        initialJars: data.jars,
        initialIds: ids,
        selected: null,
        history: [],
        usedUndo: false,
        addedJar: false,
        hint: null,
        hintPending: false,
        busyUntil: 0,
        version: get().version + 1,
        result: null,
        session: get().session + 1,
      });
      emit({ type: 'levelStart' });
      prefetchLevel(level + 1);
    },

    tapJar: (index) => {
      const s = get();
      if (s.status !== 'playing' || performance.now() < s.busyUntil) return;
      if (useUi.getState().modals.length) return;
      const b = board(s);
      if (s.selected === null) {
        if (!canSelect(b, index)) {
          if (s.jars[index]?.length) {
            set({ shake: { jar: index, n: s.shake.n + 1 } });
            emit({ type: 'invalid', jar: index });
          }
          return;
        }
        set({ selected: index });
        emit({ type: 'select', jar: index });
        return;
      }
      if (s.selected === index) {
        set({ selected: null });
        emit({ type: 'deselect', jar: index });
        return;
      }
      const from = s.selected;
      const check = checkMove(b, from, index);
      if (check !== 'ok') {
        // Tapping another selectable jar with a different colour on top would
        // be invalid; we shake it and keep the current selection.
        set({ shake: { jar: index, n: s.shake.n + 1 } });
        emit({ type: 'invalid', jar: index });
        return;
      }
      performMove(from, index);
    },

    beginDrag: (from) => {
      const s = get();
      if (s.status !== 'playing' || performance.now() < s.busyUntil) return false;
      if (useUi.getState().modals.length) return false;
      if (!canSelect(board(s), from)) return false; // empty or completed jar
      set({ selected: from });
      emit({ type: 'select', jar: from });
      return true;
    },

    endDrag: (to) => {
      const s = get();
      const from = s.selected;
      if (from === null || s.status !== 'playing') return;
      // Dropped on nothing, back on its own jar, or input blocked: just return.
      if (to === null || to === from || useUi.getState().modals.length) {
        set({ selected: null });
        return;
      }
      if (checkMove(board(s), from, to) !== 'ok') {
        set({ selected: null, shake: { jar: to, n: s.shake.n + 1 } });
        emit({ type: 'invalid', jar: to });
        return;
      }
      performMove(from, to);
    },

    undo: () => {
      const s = get();
      if (s.status !== 'playing' || !s.history.length || performance.now() < s.busyUntil) return;
      const move = s.history[s.history.length - 1];
      const prev = revertMove(board(s), move);
      const dur = moveDuration();
      setBoard(prev.jars, moveIds(s.ids, { from: move.to, to: move.from }), {
        selected: null,
        history: s.history.slice(0, -1),
        usedUndo: true,
        busyUntil: performance.now() + dur,
      });
      emit({ type: 'undo' });
      schedule(() => emit({ type: 'drop', jar: move.from }), dur);
      const ui = useUi.getState();
      if (ui.modals[ui.modals.length - 1] === 'stuck') ui.closeModal();
    },

    restart: () => {
      const s = get();
      if (s.status !== 'playing' && s.status !== 'won') return;
      if (followUp) clearTimeout(followUp);
      const jars = s.addedJar ? [...s.initialJars, []] : s.initialJars;
      const ids = s.addedJar ? [...s.initialIds, []] : s.initialIds;
      setBoard(jars, ids, {
        status: 'playing',
        selected: null,
        history: [],
        usedUndo: false,
        busyUntil: performance.now() + moveDuration(),
        result: null,
      });
      emit({ type: 'restart' });
    },

    useHint: async () => {
      const s = get();
      if (s.status !== 'playing' || s.hintPending) return;
      if (useProgress.getState().coins < HINT_COST) return;
      const version = s.version;
      set({ hintPending: true });
      const res = await solveBoard(board(s));
      const now = get();
      set({ hintPending: false });
      if (now.version !== version || now.status !== 'playing') return; // board changed meanwhile
      if (res.status === 'solved' && res.moves.length) {
        if (!useProgress.getState().spend(HINT_COST)) return;
        useProgress.getState().recordHint();
        set({ hint: res.moves[0], selected: null });
        emit({ type: 'hint' });
      } else {
        useUi.getState().toast({
          kind: 'warn',
          title: 'No solution from here',
          body: now.addedJar ? 'Try Undo or Restart.' : 'Try Undo or Add Jar.',
        });
        emit({ type: 'invalid', jar: -1 });
      }
    },

    addJar: () => {
      const s = get();
      if (s.status !== 'playing' || s.addedJar) return;
      if (!useProgress.getState().spend(ADD_JAR_COST)) return;
      setBoard([...s.jars, []], [...s.ids, []], { addedJar: true, selected: null });
      emit({ type: 'addJar' });
      const ui = useUi.getState();
      if (ui.modals[ui.modals.length - 1] === 'stuck') ui.closeModal();
    },

    leave: () => {
      if (followUp) clearTimeout(followUp);
      set({ status: 'idle', selected: null, hint: null });
    },
  };
});
