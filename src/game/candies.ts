/** Pure data describing the eight candy kinds. Index = colour id. */
export type CandyShape =
  | 'gummyBear'
  | 'hardCandy'
  | 'jellyBean'
  | 'wrapped'
  | 'lollipop'
  | 'swirlBall'
  | 'marshmallowTwist'
  | 'bonbon';

export interface CandyKind {
  id: number;
  name: string;
  shape: CandyShape;
  color: string;
  accent: string;
}

export const CANDY_KINDS: CandyKind[] = [
  { id: 0, name: 'Strawberry Gummy Bear', shape: 'gummyBear', color: '#ff6fa8', accent: '#ffd1e3' },
  { id: 1, name: 'Cherry Drop', shape: 'hardCandy', color: '#e8233c', accent: '#ffb3bd' },
  { id: 2, name: 'Lemon Bean', shape: 'jellyBean', color: '#ffd93b', accent: '#fff3b0' },
  { id: 3, name: 'Orange Twist Wrap', shape: 'wrapped', color: '#ff8a1f', accent: '#ffe0bd' },
  { id: 4, name: 'Apple Pop', shape: 'lollipop', color: '#5ccf3a', accent: '#fffdf5' },
  { id: 5, name: 'Sky Swirl', shape: 'swirlBall', color: '#3fb4ff', accent: '#ffffff' },
  { id: 6, name: 'Grape Twist', shape: 'marshmallowTwist', color: '#9b5cff', accent: '#e4d4ff' },
  { id: 7, name: 'Cocoa Bonbon', shape: 'bonbon', color: '#7a4626', accent: '#c98d5c' },
];
