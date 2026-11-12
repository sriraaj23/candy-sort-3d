import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Lightbulb, Loader2, Pause, PlusCircle, RotateCcw, Undo2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { ADD_JAR_COST, HINT_COST, starThresholds } from '../game';
import { useGame } from '../store/gameStore';
import { useProgress } from '../store/progressStore';
import { useUi } from '../store/uiStore';
import { sfx } from '../audio/engine';
import { CoinIcon, IconButton } from './controls';
import { CoinBadge } from './CoinBadge';

function BarButton({
  icon,
  label,
  cost,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  cost?: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      aria-label={cost ? `${label}, costs ${cost} coins` : label}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.92, y: 2 }}
      onClick={() => {
        if (disabled) return;
        sfx('click');
        onClick();
      }}
      className={`relative flex h-[64px] min-w-[64px] flex-1 flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#fff0f6] px-1 text-pink-600 shadow-[0_5px_0_#e7a8c4] sm:h-[70px] sm:max-w-[120px] ${
        disabled ? 'opacity-45 saturate-50' : ''
      }`}
    >
      {icon}
      <span className="font-display text-[13px] font-extrabold leading-tight sm:text-sm">{label}</span>
      {cost !== undefined && (
        <span className="absolute -right-1.5 -top-2.5 flex items-center gap-0.5 rounded-full bg-[#ffbf2e] px-1.5 py-0.5 text-[11px] font-extrabold text-[#7a3b00] shadow">
          <CoinIcon size={12} />
          {cost}
        </span>
      )}
    </motion.button>
  );
}

export function GameHud() {
  const level = useGame((s) => s.level);
  const status = useGame((s) => s.status);
  const moves = useGame((s) => s.history.length);
  const par = useGame((s) => s.data?.par ?? 0);
  const canUndo = useGame((s) => s.history.length > 0 && s.status === 'playing');
  const addedJar = useGame((s) => s.addedJar);
  const hintPending = useGame((s) => s.hintPending);
  const coins = useProgress((s) => s.coins);
  const setScreen = useUi((s) => s.setScreen);
  const openModal = useUi((s) => s.openModal);
  const playing = status === 'playing';
  const th = starThresholds(par);

  // Keyboard: Esc pauses, Ctrl/Cmd+Z or U undoes, H hints.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === 'Escape') {
        if (ui.modals.length) ui.closeModal();
        else if (useGame.getState().status === 'playing') ui.openModal('pause');
        return;
      }
      if (ui.modals.length) return;
      if ((e.key === 'z' && (e.metaKey || e.ctrlKey)) || e.key === 'u') useGame.getState().undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const starsNow = moves <= th.three ? 3 : moves <= th.two ? 2 : 1;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
      <div className="pointer-events-auto flex items-start justify-between gap-2 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <IconButton label="Back to level map" onClick={() => setScreen('map')}>
          <ArrowLeft />
        </IconButton>
        <div className="flex flex-col items-center">
          <div className="candy-text whitespace-nowrap text-[26px] leading-none min-[400px]:text-3xl sm:text-4xl">Level {level}</div>
          {par > 0 && (
            <div className="mt-1 flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-extrabold text-pink-700 shadow sm:text-sm">
              Moves {moves}
              <span className="text-pink-400">·</span>
              <span className="flex">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < starsNow ? 'text-[#f5b301]' : 'text-pink-200'}>
                    ★
                  </span>
                ))}
              </span>
              <span className="hidden text-pink-400 min-[380px]:inline">≤{starsNow === 3 ? th.three : starsNow === 2 ? th.two : '∞'}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CoinBadge compact />
          <IconButton label="Pause" onClick={() => openModal('pause')} disabled={!playing}>
            <Pause className="fill-current" />
          </IconButton>
        </div>
      </div>

      <div className="flex justify-center px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex w-full max-w-lg items-end justify-center gap-2.5 sm:gap-4">
          <BarButton icon={<Undo2 className="h-6 w-6" />} label="Undo" onClick={() => useGame.getState().undo()} disabled={!canUndo} />
          <BarButton icon={<RotateCcw className="h-6 w-6" />} label="Restart" onClick={() => openModal('restart')} disabled={!playing || moves === 0} />
          <BarButton
            icon={hintPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Lightbulb className="h-6 w-6" />}
            label="Hint"
            cost={HINT_COST}
            onClick={() => void useGame.getState().useHint()}
            disabled={!playing || hintPending || coins < HINT_COST}
          />
          <BarButton
            icon={<PlusCircle className="h-6 w-6" />}
            label={addedJar ? 'Added' : 'Add Jar'}
            cost={addedJar ? undefined : ADD_JAR_COST}
            onClick={() => useGame.getState().addJar()}
            disabled={!playing || addedJar || coins < ADD_JAR_COST}
          />
        </div>
      </div>

      <AnimatePresence>
        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 grid place-items-center"
          >
            <div className="panel flex items-center gap-3 px-6 py-4 font-display text-xl font-extrabold text-pink-600">
              <Loader2 className="h-6 w-6 animate-spin" /> Mixing candies…
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
