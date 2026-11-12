/** A candy colour id, 0..7. Each colour always maps to the same shape. */
export type Color = number;
/** A jar holds candies listed bottom -> top. */
export type Jar = Color[];

export interface Board {
  jars: Jar[];
  capacity: number;
}

export interface Move {
  from: number;
  to: number;
}

export interface LevelConfig {
  level: number;
  colors: number;
  jars: number;
  /** A level whose best known solution is shorter than this is rejected. */
  minMoves: number;
  /** 0..1 position of this level inside its difficulty band. */
  bandPosition: number;
}

export interface LevelData {
  level: number;
  colors: number;
  jars: Jar[];
  capacity: number;
  /** Length of the best solution the solver found; used for stars. */
  par: number;
  solution: Move[];
  method: 'deal' | 'reverse';
  seed: number;
}

export type SolveStatus = 'solved' | 'unsolvable' | 'limit';

export interface SolveResult {
  status: SolveStatus;
  moves: Move[];
  nodes: number;
}
