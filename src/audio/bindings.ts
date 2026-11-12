import { audio } from './engine';
import { onGameEvent } from '../store/events';
import { useSettings } from '../store/settingsStore';
import { useProgress } from '../store/progressStore';
import { getTheme } from '../game';

let installed = false;

/** Wires the audio engine to user gestures, settings, theme and game events. */
export function installAudio() {
  if (installed) return;
  installed = true;

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => audio.setHidden(document.hidden));

  const applySettings = () => {
    const s = useSettings.getState();
    audio.setVolumes(s.musicVolume, s.sfxVolume, s.muted);
  };
  applySettings();
  useSettings.subscribe(applySettings);

  const applyTheme = () => audio.setTheme(getTheme(useProgress.getState().selectedTheme).music);
  applyTheme();
  useProgress.subscribe((s, prev) => {
    if (s.selectedTheme !== prev.selectedTheme) applyTheme();
  });

  onGameEvent((e) => {
    switch (e.type) {
      case 'select':
        return audio.play('select');
      case 'deselect':
        return audio.play('deselect');
      case 'drop':
        return audio.play('drop');
      case 'invalid':
        return audio.play('invalid');
      case 'jarComplete':
        return audio.play('jarComplete');
      case 'win':
        return setTimeout(() => audio.play('levelComplete'), 250);
      case 'hint':
        return audio.play('hint');
      case 'addJar':
        return audio.play('pop');
      case 'undo':
        return audio.play('deselect');
      case 'restart':
        return audio.play('pop');
    }
  });
}
