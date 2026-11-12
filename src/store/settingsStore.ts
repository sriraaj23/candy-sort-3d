import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Quality = 'low' | 'medium' | 'high';

export interface SettingsState {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  quality: Quality;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setQuality: (q: Quality) => void;
}

function defaultQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  if (coarse && cores <= 4) return 'low';
  return 'medium';
}

export const SETTINGS_KEY = 'candy-sort-3d:settings:v1';

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      musicVolume: 0.5,
      sfxVolume: 0.8,
      muted: false,
      quality: defaultQuality(),
      setMusicVolume: (v) => set({ musicVolume: Math.min(1, Math.max(0, v)) }),
      setSfxVolume: (v) => set({ sfxVolume: Math.min(1, Math.max(0, v)) }),
      setMuted: (muted) => set({ muted }),
      setQuality: (quality) => set({ quality }),
    }),
    { name: SETTINGS_KEY, version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
