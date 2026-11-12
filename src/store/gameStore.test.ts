import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from './gameStore';
import { useProgress } from './progressStore';
import { useUi } from './uiStore';
import { HINT_COST, ADD_JAR_COST, START_COINS, isValidMove } from '../game';

const ready = () => useGame.setState({ busyUntil: 0 });

async function load(level: number) {
  const p = useGame.getState().loadLevel(level);
  await vi.runAllTimersAsync();
  await p;
}

describe('game store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useProgress.getState().resetProgress();
    useUi.setState({ modals: [], toasts: [] });
  });
  afterEach(() => vi.useRealTimers());

  it('persists progress under a versioned key', () => {
    useProgress.getState().addCoins(7);
    const saved = JSON.parse(localStorage.getItem('candy-sort-3d:progress:v1')!);
    expect(saved.version).toBe(1);
    expect(saved.state.coins).toBe(START_COINS + 7);
  });

  it('plays level 1 to a 3-star win using the solver solution', async () => {
    await load(1);
    const g = useGame.getState();
    expect(g.status).toBe('playing');
    for (const m of g.data!.solution) {
      ready();
      useGame.getState().tapJar(m.from);
      expect(useGame.getState().selected).toBe(m.from);
      useGame.getState().tapJar(m.to);
      expect(useGame.getState().selected).toBe(null);
      vi.advanceTimersByTime(400);
    }
    await vi.runAllTimersAsync();
    expect(useGame.getState().status).toBe('won');
    const p = useProgress.getState();
    expect(p.stars[1]).toBe(3);
    expect(p.maxUnlocked).toBe(2);
    expect(p.coins).toBeGreaterThanOrEqual(START_COINS + 10);
    expect(p.achievements).toContain('first_win');
    expect(p.achievements).toContain('no_undo');
    expect(useUi.getState().modals).toContain('victory');
  });

  it('deselects, rejects invalid moves (keeping selection) and undoes', async () => {
    await load(2);
    const s = useGame.getState();
    const b = { jars: s.jars, capacity: s.capacity };
    // find a jar pair that is an invalid move target
    let from = -1;
    let bad = -1;
    for (let i = 0; i < s.jars.length && bad < 0; i++)
      for (let j = 0; j < s.jars.length; j++)
        if (i !== j && s.jars[i].length && !isValidMove(b, i, j)) {
          from = i;
          bad = j;
          break;
        }
    expect(bad).toBeGreaterThanOrEqual(0);
    useGame.getState().tapJar(from);
    useGame.getState().tapJar(from);
    expect(useGame.getState().selected).toBe(null); // tap again = deselect
    useGame.getState().tapJar(from);
    const before = useGame.getState().jars;
    useGame.getState().tapJar(bad);
    expect(useGame.getState().selected).toBe(from); // selection kept
    expect(useGame.getState().jars).toBe(before);
    expect(useGame.getState().shake.jar).toBe(bad);

    // valid move then undo restores the board
    const m = useGame.getState().data!.solution[0];
    useGame.setState({ selected: null });
    const start = JSON.stringify(useGame.getState().jars);
    useGame.getState().tapJar(m.from);
    useGame.getState().tapJar(m.to);
    expect(useGame.getState().history.length).toBe(1);
    // input is ignored while animating
    useGame.getState().tapJar(m.to);
    expect(useGame.getState().selected).toBe(null);
    ready();
    useGame.getState().undo();
    expect(JSON.stringify(useGame.getState().jars)).toBe(start);
    expect(useGame.getState().usedUndo).toBe(true);
  });

  it('charges for hints and add jar, once per level, and disables when broke', async () => {
    await load(3);
    const hintP = useGame.getState().useHint();
    await vi.runAllTimersAsync();
    await hintP;
    const hint = useGame.getState().hint;
    expect(hint).not.toBeNull();
    expect(useProgress.getState().coins).toBe(START_COINS - HINT_COST + 10); // +10 'Little Helper'
    const jarsBefore = useGame.getState().jars.length;
    useGame.getState().addJar();
    useGame.getState().addJar();
    expect(useGame.getState().jars.length).toBe(jarsBefore + 1);
    expect(useProgress.getState().coins).toBe(START_COINS - HINT_COST + 10 - ADD_JAR_COST);
    useProgress.setState({ coins: 5 });
    const p2 = useGame.getState().useHint();
    await vi.runAllTimersAsync();
    await p2;
    expect(useProgress.getState().coins).toBe(5);
  });

  it('restart resets the board and keeps a purchased jar', async () => {
    await load(4);
    useGame.getState().addJar();
    const initial = JSON.stringify([...useGame.getState().initialJars, []]);
    const m = useGame.getState().data!.solution[0];
    ready();
    useGame.getState().tapJar(m.from);
    useGame.getState().tapJar(m.to);
    useGame.getState().restart();
    expect(JSON.stringify(useGame.getState().jars)).toBe(initial);
    expect(useGame.getState().history.length).toBe(0);
  });

  it('an unsolvable hint costs nothing and suggests Undo or Add Jar', async () => {
    await load(1);
    useGame.setState({
      jars: [
        [1, 0, 1, 1],
        [0, 1, 0],
      ],
      ids: [
        [0, 1, 2, 3],
        [4, 5, 6],
      ],
      colors: [1, 0, 1, 1, 0, 1, 0],
      busyUntil: 0,
    });
    const coins = useProgress.getState().coins;
    const seen: string[] = [];
    const unsub = useUi.subscribe((u) => u.toasts.forEach((t) => seen.push(t.body ?? '')));
    const p = useGame.getState().useHint();
    await vi.runAllTimersAsync();
    await p;
    unsub();
    expect(useGame.getState().hint).toBeNull();
    expect(useProgress.getState().coins).toBe(coins);
    expect(seen.some((b) => /Undo or Add Jar/.test(b))).toBe(true);
  });

  it('discards a hint if the board changed while solving', async () => {
    await load(2);
    const m = useGame.getState().data!.solution[0];
    const coins = useProgress.getState().coins;
    const p = useGame.getState().useHint();
    useGame.getState().tapJar(m.from);
    useGame.getState().tapJar(m.to); // board changes before the solver answers
    await vi.runAllTimersAsync();
    await p;
    expect(useProgress.getState().coins).toBe(coins);
  });

  it('shows the stuck popup when no move is possible', async () => {
    await load(1);
    // [1,0,1] / [0,1,0,1]: moving 1 -> 0 leaves [1,0,1,1] / [0,1,0] with no valid move.
    useGame.setState({
      jars: [
        [1, 0, 1],
        [0, 1, 0, 1],
      ],
      ids: [
        [0, 1, 2],
        [3, 4, 5, 6],
      ],
      colors: [1, 0, 1, 0, 1, 0, 1],
      capacity: 4,
      busyUntil: 0,
      selected: null,
    });
    useGame.getState().tapJar(1);
    useGame.getState().tapJar(0);
    await vi.runAllTimersAsync();
    expect(useGame.getState().jars).toEqual([
      [1, 0, 1, 1],
      [0, 1, 0],
    ]);
    expect(useUi.getState().modals).toContain('stuck');
    // Undo closes the popup.
    ready();
    useGame.getState().undo();
    expect(useUi.getState().modals).not.toContain('stuck');
  });

  it('drag and drop uses the same move path as tapping', async () => {
    await load(5);
    const m = useGame.getState().data!.solution[0];
    const startJars = JSON.stringify(useGame.getState().jars);

    // valid drop records an undoable move
    expect(useGame.getState().beginDrag(m.from)).toBe(true);
    expect(useGame.getState().selected).toBe(m.from);
    useGame.getState().endDrag(m.to);
    expect(useGame.getState().history).toEqual([m]);
    expect(useGame.getState().selected).toBe(null);

    // no new drag while the candy animates
    expect(useGame.getState().beginDrag(m.to)).toBe(false);
    ready();
    await vi.runAllTimersAsync();
    useGame.getState().undo();
    expect(JSON.stringify(useGame.getState().jars)).toBe(startJars);
    ready();

    // invalid drop shakes the target, deselects and leaves the board alone
    const s = useGame.getState();
    const b = { jars: s.jars, capacity: s.capacity };
    let from = -1;
    let bad = -1;
    for (let i = 0; i < s.jars.length && bad < 0; i++)
      for (let j = 0; j < s.jars.length; j++)
        if (i !== j && s.jars[i].length && !isValidMove(b, i, j)) {
          from = i;
          bad = j;
          break;
        }
    const shakes = s.shake.n;
    useGame.getState().beginDrag(from);
    useGame.getState().endDrag(bad);
    expect(useGame.getState().selected).toBe(null);
    expect(useGame.getState().shake).toEqual({ jar: bad, n: shakes + 1 });
    expect(JSON.stringify(useGame.getState().jars)).toBe(startJars);

    // released over nothing / cancelled: no move, no shake
    useGame.getState().beginDrag(from);
    useGame.getState().endDrag(null);
    expect(useGame.getState().selected).toBe(null);
    expect(useGame.getState().shake.n).toBe(shakes + 1);
    expect(useGame.getState().history.length).toBe(0);
  });

  it('empty and completed jars cannot start a drag', async () => {
    await load(1);
    useGame.setState({
      jars: [[0, 0, 0, 0], [], [1, 1, 1], [1]],
      ids: [[0, 1, 2, 3], [], [4, 5, 6], [7]],
      colors: [0, 0, 0, 0, 1, 1, 1, 1],
      busyUntil: 0,
      selected: null,
    });
    expect(useGame.getState().beginDrag(0)).toBe(false);
    expect(useGame.getState().beginDrag(1)).toBe(false);
    expect(useGame.getState().beginDrag(3)).toBe(true);
    useGame.getState().endDrag(2); // completes jar 2 and wins
    await vi.runAllTimersAsync();
    expect(useGame.getState().status).toBe('won');
  });
});
