import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect } from 'react';
import { getTheme } from './game';
import { GameCanvas } from './scene/GameCanvas';
import { installAudio } from './audio/bindings';
import { useProgress } from './store/progressStore';
import { useUi } from './store/uiStore';
import { useGame } from './store/gameStore';
import { MainMenu } from './ui/MainMenu';
import { LevelMap } from './ui/LevelMap';
import { GameHud } from './ui/GameHud';
import { Modals } from './ui/Modals';
import { Toasts } from './ui/Toasts';

export default function App() {
  const screen = useUi((s) => s.screen);
  const reduced = useUi((s) => s.reducedMotion);
  const themeId = useProgress((s) => s.selectedTheme);

  useEffect(() => {
    installAudio();
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => useUi.getState().setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Theme accent for CSS (sliders etc.).
  useEffect(() => {
    const t = getTheme(themeId);
    document.documentElement.style.setProperty('--accent', t.ui.accent);
    document.documentElement.style.setProperty('--accent-soft', t.ui.soft);
  }, [themeId]);

  // Leaving the game screen stops the level.
  useEffect(() => {
    if (screen !== 'game') useGame.getState().leave();
  }, [screen]);

  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <GameCanvas />
      <div className="pointer-events-none fixed inset-0 z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={screen}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`absolute inset-0 ${screen === 'map' ? 'pointer-events-auto' : ''}`}
          >
            {screen === 'menu' && <MainMenu />}
            {screen === 'map' && <LevelMap />}
            {screen === 'game' && <GameHud />}
          </motion.div>
        </AnimatePresence>
      </div>
      <Modals />
      <Toasts />
    </MotionConfig>
  );
}
