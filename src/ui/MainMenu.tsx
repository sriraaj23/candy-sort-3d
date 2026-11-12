import { motion } from 'framer-motion';
import { Gift, Palette, Play, Settings, Trophy } from 'lucide-react';
import { useEffect } from 'react';
import { LEVEL_COUNT, dailyStatus, dayKey } from '../game';
import { useProgress } from '../store/progressStore';
import { useUi } from '../store/uiStore';
import { CandyButton, StarGlyph } from './controls';
import { CoinBadge } from './CoinBadge';

export function Logo() {
  const reduced = useUi((s) => s.reducedMotion);
  return (
    <motion.h1
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1, rotate: reduced ? 0 : [0, -1.5, 1.5, 0] }}
      transition={{ scale: { type: 'spring', stiffness: 260, damping: 14 }, rotate: { duration: 5, repeat: Infinity, ease: 'easeInOut' } }}
      className="candy-text select-none text-center leading-[0.85]"
    >
      <span className="block bg-gradient-to-b from-white to-[#ffe1ee] bg-clip-text text-[clamp(44px,12vw,92px)] [-webkit-text-stroke:3px_#ff4f93] [paint-order:stroke_fill]">
        Candy Sort
      </span>
      <span className="mt-1 inline-block rounded-full bg-gradient-to-b from-[#ffe27a] to-[#ffbf2e] px-5 text-[clamp(26px,6vw,44px)] text-[#a34a00] shadow-[0_5px_0_#d18c0f] [text-shadow:none]">
        3D
      </span>
    </motion.h1>
  );
}

export function MainMenu() {
  const setScreen = useUi((s) => s.setScreen);
  const openModal = useUi((s) => s.openModal);
  const maxUnlocked = useProgress((s) => s.maxUnlocked);
  const stars = useProgress((s) => s.stars);
  const lastClaim = useProgress((s) => s.lastDailyClaim);
  const streak = useProgress((s) => s.dailyStreak);
  const daily = dailyStatus(lastClaim, streak, dayKey(new Date()));
  const totalStars = Object.values(stars).reduce((a, b) => a + b, 0);
  const completed = Object.keys(stars).length;

  // Offer the daily reward once per session when it is available.
  useEffect(() => {
    const ui = useUi.getState();
    if (daily.canClaim && !ui.dailyPromptShown) {
      ui.markDailyPrompt();
      const t = setTimeout(() => useUi.getState().openModal('daily'), 700);
      return () => clearTimeout(t);
    }
  }, [daily.canClaim]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
      <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-2">
        <div className="chip h-11 text-base" aria-label="Level progress">
          <span>
            Level {Math.min(maxUnlocked, LEVEL_COUNT)}/{LEVEL_COUNT}
          </span>
          <span className="mx-1 h-5 w-px bg-pink-200" />
          <StarGlyph filled size={18} />
          <span>{totalStars}</span>
        </div>
        <CoinBadge />
      </div>

      <div className="mt-2 sm:mt-6">
        <Logo />
      </div>

      <div className="flex-1" />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 20 }}
        className="pointer-events-auto flex w-full max-w-md flex-col items-center gap-4"
      >
        <CandyButton size="lg" variant="pink" className="w-full max-w-xs" onClick={() => setScreen('map')} ariaLabel="Play">
          <Play className="h-8 w-8 fill-current" /> PLAY
        </CandyButton>
        <p className="-mt-1 text-sm font-extrabold text-pink-700/80">
          {completed} of {LEVEL_COUNT} levels sweetened
        </p>
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <CandyButton variant="purple" onClick={() => openModal('themes')} className="px-3 text-base">
            <Palette className="h-5 w-5" /> THEMES
          </CandyButton>
          <CandyButton variant="yellow" onClick={() => openModal('daily')} className="px-3 text-base">
            <Gift className="h-5 w-5" /> DAILY
            {daily.canClaim && <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-red-500" />}
            {daily.canClaim && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-red-500" />}
          </CandyButton>
          <CandyButton variant="blue" onClick={() => openModal('settings')} className="px-3 text-base">
            <Settings className="h-5 w-5" /> SETTINGS
          </CandyButton>
          <CandyButton variant="green" onClick={() => openModal('achievements')} className="px-3 text-base">
            <Trophy className="h-5 w-5" /> AWARDS
          </CandyButton>
        </div>
      </motion.div>
    </div>
  );
}
