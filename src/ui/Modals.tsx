import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Gift,
  Home,
  Lock,
  Map as MapIcon,
  Play,
  PlusCircle,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
  Trophy,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ACHIEVEMENTS, ADD_JAR_COST, DAILY_REWARDS, LEVEL_COUNT, THEMES, dailyStatus, dayKey, type ThemeId } from '../game';
import { sfx } from '../audio/engine';
import { useGame } from '../store/gameStore';
import { useProgress } from '../store/progressStore';
import { useSettings, type Quality } from '../store/settingsStore';
import { topModal, useUi, type Modal } from '../store/uiStore';
import { AnimatedNumber, CandyButton, CoinIcon, StarGlyph } from './controls';
import { startLevel } from './LevelMap';

function Shell({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ scale: 0.7, opacity: 0, y: 30 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.85, opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={`panel relative max-h-[calc(100dvh-32px)] w-full overflow-y-auto px-5 pb-6 pt-5 ${wide ? 'max-w-xl' : 'max-w-sm'}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-4 flex items-center justify-center">
        <h2 className="rounded-full bg-gradient-to-b from-[#ff8fbf] to-[#ff4f93] px-6 py-1 font-display text-2xl font-extrabold text-white shadow-[0_4px_0_#c42f6c]">
          {title}
        </h2>
      </div>
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            sfx('click');
            onClose();
          }}
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-pink-100 text-pink-600 active:scale-95"
        >
          <X />
        </button>
      )}
      {children}
    </motion.div>
  );
}

const close = () => useUi.getState().closeModal();

// ---------------------------------------------------------------- pause
function PauseModal() {
  const ui = useUi.getState();
  return (
    <Shell title="Paused" onClose={close}>
      <div className="flex flex-col gap-3">
        <CandyButton variant="green" onClick={close}>
          <Play className="h-5 w-5 fill-current" /> Resume
        </CandyButton>
        <CandyButton variant="yellow" onClick={() => ui.openModal('restart')}>
          <RotateCcw className="h-5 w-5" /> Restart
        </CandyButton>
        <CandyButton variant="blue" onClick={() => ui.openModal('settings')}>
          <SettingsIcon className="h-5 w-5" /> Settings
        </CandyButton>
        <CandyButton variant="white" onClick={() => ui.setScreen('map')}>
          <MapIcon className="h-5 w-5" /> Level Map
        </CandyButton>
        <CandyButton variant="white" onClick={() => ui.setScreen('menu')}>
          <Home className="h-5 w-5" /> Main Menu
        </CandyButton>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- restart
function RestartModal() {
  return (
    <Shell title="Restart?" onClose={close}>
      <p className="mb-5 text-center text-lg font-bold text-pink-700">Start this level over? Your moves will be reset.</p>
      <div className="grid grid-cols-2 gap-3">
        <CandyButton variant="white" onClick={close}>
          No
        </CandyButton>
        <CandyButton
          variant="yellow"
          onClick={() => {
            useUi.getState().closeAll();
            useGame.getState().restart();
          }}
        >
          <RotateCcw className="h-5 w-5" /> Yes
        </CandyButton>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- stuck
function StuckModal() {
  const coins = useProgress((s) => s.coins);
  const addedJar = useGame((s) => s.addedJar);
  const canUndo = useGame((s) => s.history.length > 0);
  return (
    <Shell title="No Moves Left!">
      <p className="mb-5 text-center text-lg font-bold text-pink-700">The jars are jammed. Pick a way out:</p>
      <div className="flex flex-col gap-3">
        <CandyButton variant="blue" disabled={!canUndo} onClick={() => useGame.getState().undo()}>
          <Undo2 className="h-5 w-5" /> Undo (free)
        </CandyButton>
        <CandyButton variant="green" disabled={addedJar || coins < ADD_JAR_COST} onClick={() => useGame.getState().addJar()}>
          <PlusCircle className="h-5 w-5" /> Add Jar
          <span className="flex items-center gap-1 rounded-full bg-white/30 px-2 text-base">
            <CoinIcon size={16} /> {ADD_JAR_COST}
          </span>
        </CandyButton>
        <CandyButton
          variant="yellow"
          onClick={() => {
            useUi.getState().closeAll();
            useGame.getState().restart();
          }}
        >
          <RotateCcw className="h-5 w-5" /> Restart
        </CandyButton>
      </div>
      {addedJar && <p className="mt-3 text-center text-sm font-bold text-pink-500">Extra jar already used this level.</p>}
    </Shell>
  );
}

// ---------------------------------------------------------------- victory
function VictoryModal() {
  const level = useGame((s) => s.level);
  const result = useGame((s) => s.result);
  const moves = useGame((s) => s.history.length);
  const reduced = useUi((s) => s.reducedMotion);
  const [coinShown, setCoinShown] = useState(0);
  const stars = result?.stars ?? 1;

  useEffect(() => {
    const t = setTimeout(() => setCoinShown(result?.coins ?? 0), reduced ? 0 : 900);
    return () => clearTimeout(t);
  }, [result, reduced]);

  const last = level >= LEVEL_COUNT;
  return (
    <Shell title={last ? 'All Done!' : 'Sweet!'}>
      <div className="mb-2 flex items-end justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: reduced ? 0 : 0.2 + i * 0.22, type: 'spring', stiffness: 300, damping: 12 }}
            className={i === 1 ? '-translate-y-3' : ''}
            onAnimationComplete={() => i < stars && sfx('pop')}
          >
            <StarGlyph filled={i < stars} size={i === 1 ? 74 : 58} />
          </motion.div>
        ))}
      </div>
      <p className="text-center font-display text-xl font-extrabold text-pink-700">
        Level {level} cleared in {moves} moves
      </p>
      {result?.newBest && !result.firstClear && <p className="text-center text-sm font-extrabold text-green-600">New best!</p>}
      <div className="mx-auto my-4 flex w-fit items-center gap-2 rounded-full bg-[#fff4cc] px-5 py-2 text-2xl font-extrabold text-[#a35f00]">
        <CoinIcon size={28} /> +<AnimatedNumber value={coinShown} onTick={() => sfx('coin')} />
      </div>
      {last && (
        <p className="mb-3 text-center font-bold text-pink-600">
          You sorted every jar in the land. Replay any level to collect more stars!
        </p>
      )}
      <div className="flex flex-col gap-3">
        {!last && (
          <CandyButton variant="green" size="lg" onClick={() => startLevel(level + 1)}>
            Next Level <Play className="h-7 w-7 fill-current" />
          </CandyButton>
        )}
        <div className="grid grid-cols-2 gap-3">
          <CandyButton variant="yellow" onClick={() => startLevel(level)}>
            <RotateCcw className="h-5 w-5" /> Replay
          </CandyButton>
          <CandyButton variant="white" onClick={() => useUi.getState().setScreen('map')}>
            <MapIcon className="h-5 w-5" /> Map
          </CandyButton>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- daily
function DailyModal() {
  const lastClaim = useProgress((s) => s.lastDailyClaim);
  const streak = useProgress((s) => s.dailyStreak);
  const claim = useProgress((s) => s.claimDaily);
  const [claimed, setClaimed] = useState(0);
  const st = dailyStatus(lastClaim, streak, dayKey(new Date()));

  // Time until local midnight, for the "come back" message.
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.ceil((midnight.getTime() - now.getTime()) / 60000);
  const wait = `${Math.floor(mins / 60)}h ${mins % 60}m`;

  return (
    <Shell title="Daily Treat" onClose={close} wide>
      <p className="mb-4 text-center font-bold text-pink-700">
        Come back every day for bigger rewards. Miss a day and the streak starts over.
      </p>
      <div className="mb-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
        {DAILY_REWARDS.map((r, i) => {
          const day = i + 1;
          const done = st.canClaim ? day < st.dayIndex : day <= st.dayIndex;
          const today = st.canClaim && day === st.dayIndex;
          return (
            <div
              key={day}
              className={`relative flex flex-col items-center rounded-2xl border-4 py-2 ${
                today ? 'border-[#ffbf2e] bg-[#fff4cc]' : done ? 'border-green-300 bg-green-50' : 'border-pink-100 bg-white'
              } ${day === 7 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <span className="text-xs font-extrabold text-pink-500">Day {day}</span>
              {day === 7 ? <Gift className="my-1 h-7 w-7 text-pink-500" /> : <CoinIcon size={26} />}
              <span className="font-display text-lg font-extrabold text-[#a35f00]">{r}</span>
              {done && (
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-green-500 text-white">
                  <Check className="h-4 w-4" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {claimed > 0 ? (
        <motion.div
          initial={{ scale: 0.6 }}
          animate={{ scale: 1 }}
          className="flex items-center justify-center gap-2 font-display text-3xl font-extrabold text-[#a35f00]"
        >
          <CoinIcon size={34} /> +{claimed}
        </motion.div>
      ) : st.canClaim ? (
        <CandyButton
          variant="yellow"
          size="lg"
          className="w-full"
          onClick={() => {
            const got = claim();
            if (got) {
              setClaimed(got);
              sfx('coin');
              setTimeout(() => sfx('coin'), 120);
            }
          }}
        >
          <Gift className="h-7 w-7" /> Claim {st.reward}
        </CandyButton>
      ) : (
        <p className="text-center font-display text-xl font-extrabold text-pink-600">Claimed! Next treat in {wait}</p>
      )}
      <p className="mt-3 text-center text-sm font-bold text-pink-500">Current streak: {claimed ? st.streakIfClaimed : streak} day(s)</p>
    </Shell>
  );
}

// ---------------------------------------------------------------- settings
function Slider({ label, value, onChange, icon }: { label: string; value: number; onChange: (v: number) => void; icon: ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between font-extrabold text-pink-700">
        <span className="flex items-center gap-2">
          {icon} {label}
        </span>
        <span className="text-pink-500">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={() => sfx('select')}
        className="candy-range"
        style={{ ['--pct' as string]: `${value * 100}%` }}
      />
    </label>
  );
}

function SettingsModal() {
  const s = useSettings();
  const quality: Quality[] = ['low', 'medium', 'high'];
  return (
    <Shell title="Settings" onClose={close}>
      <div className="flex flex-col gap-2">
        <Slider label="Music" icon={<span aria-hidden>♪</span>} value={s.musicVolume} onChange={s.setMusicVolume} />
        <Slider label="Sound" icon={<Volume2 className="h-5 w-5" />} value={s.sfxVolume} onChange={s.setSfxVolume} />
        <button
          type="button"
          role="switch"
          aria-checked={s.muted}
          onClick={() => {
            s.setMuted(!s.muted);
            sfx('click');
          }}
          className="flex min-h-[52px] items-center justify-between rounded-2xl bg-pink-50 px-4 font-extrabold text-pink-700"
        >
          <span className="flex items-center gap-2">
            {s.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />} Mute all
          </span>
          <span className={`relative h-8 w-14 rounded-full transition-colors ${s.muted ? 'bg-[#ff4f93]' : 'bg-pink-200'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${s.muted ? 'left-7' : 'left-1'}`} />
          </span>
        </button>
        <div className="mt-2">
          <p className="mb-2 font-extrabold text-pink-700">Graphics quality</p>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-pink-50 p-1.5" role="radiogroup" aria-label="Graphics quality">
            {quality.map((q) => (
              <button
                key={q}
                type="button"
                role="radio"
                aria-checked={s.quality === q}
                onClick={() => {
                  sfx('click');
                  s.setQuality(q);
                }}
                className={`min-h-[46px] rounded-xl font-display text-lg font-extrabold capitalize ${
                  s.quality === q ? 'bg-gradient-to-b from-[#ff8fbf] to-[#ff4f93] text-white shadow-[0_3px_0_#c42f6c]' : 'text-pink-500'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs font-bold text-pink-500">
            {s.quality === 'low'
              ? 'No shadows, fewer particles. Best for older phones.'
              : s.quality === 'medium'
                ? 'Soft contact shadows. Recommended.'
                : 'Soft shadows, real glass and extra sparkle.'}
          </p>
        </div>
        <CandyButton variant="white" className="mt-3 !text-red-500" onClick={() => useUi.getState().openModal('reset')}>
          <Trash2 className="h-5 w-5" /> Reset progress
        </CandyButton>
      </div>
    </Shell>
  );
}

function ResetModal() {
  return (
    <Shell title="Reset?" onClose={close}>
      <p className="mb-5 text-center text-lg font-bold text-pink-700">
        This erases all levels, stars, coins, themes and achievements. It can&apos;t be undone.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <CandyButton variant="white" onClick={close}>
          Keep
        </CandyButton>
        <CandyButton
          variant="pink"
          onClick={() => {
            useProgress.getState().resetProgress();
            useGame.getState().leave();
            const ui = useUi.getState();
            ui.setScreen('menu');
            ui.toast({ kind: 'info', title: 'Progress reset', body: 'A fresh bag of candy awaits.' });
          }}
        >
          <Trash2 className="h-5 w-5" /> Reset
        </CandyButton>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- themes
function ThemesModal() {
  const coins = useProgress((s) => s.coins);
  const owned = useProgress((s) => s.unlockedThemes);
  const selected = useProgress((s) => s.selectedTheme);
  const buy = useProgress((s) => s.buyTheme);
  const select = useProgress((s) => s.selectTheme);
  return (
    <Shell title="Themes" onClose={close} wide>
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => {
          const has = owned.includes(t.id);
          const active = selected === t.id;
          return (
            <div key={t.id} className={`overflow-hidden rounded-3xl border-4 bg-white ${active ? 'border-[#ff4f93]' : 'border-pink-100'}`}>
              <div className="relative h-24 sm:h-28" style={{ background: `linear-gradient(${t.skyTop}, ${t.skyBottom})` }}>
                <div className="absolute bottom-0 left-[-10%] h-14 w-1/2 rounded-t-full" style={{ background: t.mountains[0] }} />
                <div className="absolute bottom-0 left-[30%] h-20 w-1/2 rounded-t-full" style={{ background: t.mountains[1] }} />
                <div className="absolute bottom-0 right-[-10%] h-12 w-1/2 rounded-t-full" style={{ background: t.mountains[2] }} />
                <div className="absolute inset-x-0 bottom-0 h-4" style={{ background: t.ground }} />
                <div
                  className="absolute right-3 top-3 h-8 w-8 rounded-full border-4"
                  style={{ background: t.lollipop[0], borderColor: t.lollipop[1] }}
                />
                {!has && (
                  <div className="absolute inset-0 grid place-items-center bg-black/20">
                    <Lock className="h-8 w-8 text-white drop-shadow" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="font-display text-lg font-extrabold text-pink-700">{t.name}</p>
                <p className="mb-3 text-xs font-bold text-pink-500">{t.description}</p>
                {active ? (
                  <div className="flex min-h-[48px] items-center justify-center gap-1 rounded-full bg-pink-50 font-extrabold text-pink-600">
                    <Check className="h-5 w-5" /> In use
                  </div>
                ) : has ? (
                  <CandyButton variant="blue" className="w-full" onClick={() => select(t.id as ThemeId)}>
                    Use
                  </CandyButton>
                ) : (
                  <CandyButton
                    variant="yellow"
                    className="w-full"
                    disabled={coins < t.price}
                    onClick={() => {
                      if (buy(t.id)) sfx('coin');
                    }}
                  >
                    <CoinIcon size={18} /> {t.price}
                  </CandyButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------- achievements
function AchievementsModal() {
  const got = useProgress((s) => s.achievements);
  return (
    <Shell title="Awards" onClose={close} wide>
      <p className="mb-3 text-center font-extrabold text-pink-600">
        {got.length} / {ACHIEVEMENTS.length} unlocked
      </p>
      <ul className="flex flex-col gap-2">
        {ACHIEVEMENTS.map((a) => {
          const has = got.includes(a.id);
          return (
            <li key={a.id} className={`flex items-center gap-3 rounded-2xl p-3 ${has ? 'bg-[#fff4cc]' : 'bg-pink-50'}`}>
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${has ? 'bg-[#ffd23f] text-[#7a3b00]' : 'bg-pink-100 text-pink-300'}`}
              >
                {has ? <Trophy className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
              </span>
              <span className="flex-1">
                <span className={`block font-display text-lg font-extrabold ${has ? 'text-[#8a4a00]' : 'text-pink-700'}`}>{a.name}</span>
                <span className="block text-sm font-bold text-pink-500">{a.description}</span>
              </span>
              <span className="flex items-center gap-1 font-extrabold text-[#a35f00]">
                <CoinIcon size={16} />
                {a.reward}
              </span>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

const MODALS: Record<Modal, () => JSX.Element> = {
  pause: PauseModal,
  restart: RestartModal,
  stuck: StuckModal,
  victory: VictoryModal,
  daily: DailyModal,
  settings: SettingsModal,
  themes: ThemesModal,
  achievements: AchievementsModal,
  reset: ResetModal,
};

/** Popups that must be answered (no backdrop dismiss). */
const BLOCKING: Modal[] = ['stuck', 'victory'];

export function Modals() {
  const modal = useUi(topModal);
  const Comp = modal ? MODALS[modal] : null;
  return (
    <AnimatePresence>
      {modal && Comp && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 grid place-items-center bg-[#5a1838]/35 p-4"
          onClick={() => {
            if (!BLOCKING.includes(modal)) close();
          }}
        >
          <AnimatePresence mode="wait">
            <Comp key={modal} />
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
