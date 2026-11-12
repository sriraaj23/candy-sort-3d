export type ThemeId = 'candyland' | 'frosted' | 'cocoa';

export interface ThemeMusic {
  /** Semitone offsets of the scale used by the generative music. */
  scale: number[];
  root: number; // MIDI note
  bpm: number;
  wave: 'sine' | 'triangle';
  padWave: 'sine' | 'triangle';
  brightness: number; // filter cutoff multiplier
  /** Chord roots in semitones relative to `root`, one per bar. */
  progression: number[];
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  price: number;
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundEdge: string;
  mountains: string[];
  lollipop: [string, string];
  cloud: string;
  fog: string;
  jarTint: string;
  jarRim: string;
  jarBase: string;
  label: string;
  keyLight: string;
  ambient: string;
  ui: { accent: string; soft: string };
  music: ThemeMusic;
}

export const THEMES: Theme[] = [
  {
    id: 'candyland',
    name: 'Candy Land',
    description: 'Pink skies, sugar peaks and marshmallow clouds.',
    price: 0,
    skyTop: '#ffb6d5',
    skyBottom: '#fff0f6',
    ground: '#ffd6e8',
    groundEdge: '#ff9cc6',
    mountains: ['#ffc2dc', '#ffd9a8', '#d7c4ff', '#bff0de'],
    lollipop: ['#ff5d8f', '#ffffff'],
    cloud: '#ffffff',
    fog: '#ffe3ef',
    jarTint: '#fff4fa',
    jarRim: '#ff8fbf',
    jarBase: '#ffb3d1',
    label: '#fff7d6',
    keyLight: '#fff3e8',
    ambient: '#ffe6f2',
    ui: { accent: '#ff4f93', soft: '#ffe1ee' },
    music: { scale: [0, 2, 4, 7, 9], root: 64, bpm: 92, wave: 'triangle', padWave: 'sine', brightness: 1, progression: [0, -3, 5, 7] },
  },
  {
    id: 'frosted',
    name: 'Frosted Peaks',
    description: 'Mint ice, snowy sugar hills and cool blue light.',
    price: 300,
    skyTop: '#9fd8ff',
    skyBottom: '#eefbff',
    ground: '#dff6ff',
    groundEdge: '#8fd3f5',
    mountains: ['#ffffff', '#c8ecff', '#bdf5e4', '#d9dcff'],
    lollipop: ['#3fb4ff', '#ffffff'],
    cloud: '#f5fdff',
    fog: '#e3f6ff',
    jarTint: '#f0fbff',
    jarRim: '#6cc6f0',
    jarBase: '#a9e2fb',
    label: '#ffffff',
    keyLight: '#eef8ff',
    ambient: '#dff2ff',
    ui: { accent: '#2f9fe0', soft: '#dff3ff' },
    music: { scale: [0, 2, 3, 7, 10], root: 62, bpm: 80, wave: 'sine', padWave: 'triangle', brightness: 1.4, progression: [0, -4, 5, 3] },
  },
  {
    id: 'cocoa',
    name: 'Cocoa Twilight',
    description: 'Warm caramel dusk over chocolate hills.',
    price: 500,
    skyTop: '#6b4aa0',
    skyBottom: '#ffb98a',
    ground: '#c98d5c',
    groundEdge: '#8a5530',
    mountains: ['#8a5530', '#b06f43', '#e6a36b', '#5b3a7a'],
    lollipop: ['#ffb02e', '#fff3d9'],
    cloud: '#ffe2cc',
    fog: '#d99a85',
    jarTint: '#fff3e6',
    jarRim: '#e89a4f',
    jarBase: '#a8683a',
    label: '#ffe9c7',
    keyLight: '#ffd9b0',
    ambient: '#c9a0d8',
    ui: { accent: '#d9772b', soft: '#ffe9d6' },
    music: { scale: [0, 3, 5, 7, 10], root: 57, bpm: 72, wave: 'sine', padWave: 'sine', brightness: 0.7, progression: [0, -2, -4, -5] },
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
