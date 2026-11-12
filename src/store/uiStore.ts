import { create } from 'zustand';

export type Screen = 'menu' | 'map' | 'game';
export type Modal = 'pause' | 'restart' | 'stuck' | 'victory' | 'daily' | 'settings' | 'themes' | 'achievements' | 'reset';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  kind: 'info' | 'achievement' | 'warn';
}

interface UiState {
  screen: Screen;
  modals: Modal[];
  toasts: Toast[];
  reducedMotion: boolean;
  dailyPromptShown: boolean;
  setScreen: (s: Screen) => void;
  openModal: (m: Modal) => void;
  closeModal: () => void;
  closeAll: () => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
  setReducedMotion: (v: boolean) => void;
  markDailyPrompt: () => void;
}

let toastId = 1;

export const useUi = create<UiState>()((set) => ({
  screen: 'menu',
  modals: [],
  toasts: [],
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  dailyPromptShown: false,
  setScreen: (screen) => set({ screen, modals: [] }),
  openModal: (m) => set((s) => (s.modals[s.modals.length - 1] === m ? s : { modals: [...s.modals.filter((x) => x !== m), m] })),
  closeModal: () => set((s) => ({ modals: s.modals.slice(0, -1) })),
  closeAll: () => set({ modals: [] }),
  toast: (t) => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.kind === 'achievement' ? 3600 : 2600);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  markDailyPrompt: () => set({ dailyPromptShown: true }),
}));

export const topModal = (s: UiState): Modal | null => s.modals[s.modals.length - 1] ?? null;
