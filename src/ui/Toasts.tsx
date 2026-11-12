import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Trophy } from 'lucide-react';
import { useUi } from '../store/uiStore';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(70px,calc(env(safe-area-inset-top)+64px))] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            initial={{ y: -30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            onClick={() => dismiss(t.id)}
            className="panel pointer-events-auto flex min-h-[48px] max-w-sm items-center gap-3 px-4 py-2 text-left"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${t.kind === 'achievement' ? 'bg-[#ffd23f] text-[#7a3b00]' : 'bg-pink-100 text-pink-600'}`}>
              {t.kind === 'achievement' ? <Trophy className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-display text-base font-extrabold text-pink-700">
                {t.kind === 'achievement' ? `Achievement: ${t.title}` : t.title}
              </span>
              {t.body && <span className="block text-sm font-bold text-pink-600/80">{t.body}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
