import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Play } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { LEVEL_COUNT, levelConfig } from '../game';
import { useGame } from '../store/gameStore';
import { useProgress } from '../store/progressStore';
import { useUi } from '../store/uiStore';
import { sfx } from '../audio/engine';
import { CandyButton, IconButton, Stars } from './controls';
import { CoinBadge } from './CoinBadge';

const ROW = 92;
const TOP_PAD = 70;
const BOTTOM_PAD = 140;

/** Horizontal position (percent) of a level node along the winding path. */
const xOf = (i: number) => 50 + Math.sin(i * 0.75) * 30;
/** Level 1 is at the bottom; the path climbs upward. */
const yOf = (i: number) => TOP_PAD + (LEVEL_COUNT - 1 - i) * ROW;

export function startLevel(level: number) {
  useUi.getState().setScreen('game');
  void useGame.getState().loadLevel(level);
}

export function LevelMap() {
  const setScreen = useUi((s) => s.setScreen);
  const maxUnlocked = useProgress((s) => s.maxUnlocked);
  const stars = useProgress((s) => s.stars);
  const scroller = useRef<HTMLDivElement>(null);
  const height = TOP_PAD + LEVEL_COUNT * ROW + BOTTOM_PAD;
  const current = Math.min(maxUnlocked, LEVEL_COUNT);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = yOf(current - 1) - el.clientHeight / 2 + 30;
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setScreen('menu');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setScreen]);

  // Path through all node centres (viewBox uses percent on x, pixels on y).
  const d = Array.from({ length: LEVEL_COUNT }, (_, i) => `${i ? 'L' : 'M'}${xOf(i).toFixed(2)} ${yOf(i) + 30}`).join(' ');

  return (
    <div className="absolute inset-0 flex flex-col bg-gradient-to-b from-[#ffd6e8]/70 via-[#fff0f6]/40 to-[#ffd6e8]/70">
      <div className="z-10 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
        <IconButton label="Back to menu" onClick={() => setScreen('menu')}>
          <ArrowLeft />
        </IconButton>
        <h2 className="candy-text text-3xl sm:text-4xl">Candy Trail</h2>
        <CoinBadge />
      </div>

      <div ref={scroller} className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
        <div className="relative mx-auto w-full max-w-[460px]" style={{ height }}>
          <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
            <path
              d={d}
              fill="none"
              stroke="#ffffff"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.9"
            />
            <path
              d={d}
              fill="none"
              stroke="#ff9cc6"
              strokeWidth="6"
              strokeDasharray="2 16"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {Array.from({ length: LEVEL_COUNT }, (_, i) => {
            const level = i + 1;
            const locked = level > maxUnlocked;
            const isCurrent = level === current;
            const earned = stars[level] ?? 0;
            const cfg = levelConfig(level);
            const bandStart = i === 0 || levelConfig(level - 1).colors !== cfg.colors;
            return (
              <div key={level} className="absolute -translate-x-1/2" style={{ left: `${xOf(i)}%`, top: yOf(i) }}>
                {bandStart && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/80 px-3 py-0.5 text-xs font-extrabold text-pink-600 shadow">
                    {cfg.colors} colours · {cfg.jars} jars
                  </div>
                )}
                <motion.button
                  type="button"
                  aria-label={locked ? `Level ${level}, locked` : `Play level ${level}${earned ? `, ${earned} stars` : ''}`}
                  disabled={locked}
                  whileTap={locked ? undefined : { scale: 0.9 }}
                  animate={isCurrent ? { scale: [1, 1.08, 1] } : undefined}
                  transition={isCurrent ? { duration: 1.4, repeat: Infinity } : undefined}
                  onClick={() => {
                    sfx('click');
                    startLevel(level);
                  }}
                  className={`relative grid h-[60px] w-[60px] place-items-center rounded-full border-4 font-display text-2xl font-extrabold ${
                    locked
                      ? 'cursor-not-allowed border-white/70 bg-[#e9d3de] text-[#b993a6]'
                      : isCurrent
                        ? 'border-white bg-gradient-to-b from-[#ffe27a] to-[#ffbf2e] text-[#8a4200] shadow-[0_5px_0_#d18c0f]'
                        : 'border-white bg-gradient-to-b from-[#ff8fbf] to-[#ff4f93] text-white shadow-[0_5px_0_#c42f6c]'
                  }`}
                >
                  {locked ? <Lock className="h-6 w-6" /> : level}
                </motion.button>
                {!locked && earned > 0 && <Stars count={earned} size={16} className="absolute -bottom-5 left-1/2 -translate-x-1/2" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(18px,env(safe-area-inset-bottom))]">
        <CandyButton size="lg" className="pointer-events-auto" onClick={() => startLevel(current)}>
          <Play className="h-7 w-7 fill-current" /> Level {current}
        </CandyButton>
      </div>
    </div>
  );
}
