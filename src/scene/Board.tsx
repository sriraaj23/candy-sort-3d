import { useMemo } from 'react';
import { getTheme, JAR_SPACING, ROW_DEPTH, ROW_LIFT } from '../game';
import { useGame } from '../store/gameStore';
import { useProgress } from '../store/progressStore';
import { useSettings } from '../store/settingsStore';
import { Candy } from './Candy';
import { Jar } from './Jar';
import { Confetti } from './Effects';
import { DragController } from './DragController';
import { useJarSlots } from './layoutHooks';

/** Raised step for the back row of jars when there are two rows. */
function Shelf() {
  const slots = useJarSlots();
  const back = slots.filter((s) => s.row === 1).length;
  const theme = getTheme(useProgress((s) => s.selectedTheme));
  const shadows = useSettings((s) => s.quality) === 'high';
  if (!back) return null;
  const width = back * JAR_SPACING + 0.6;
  return (
    <group position={[0, ROW_LIFT / 2, -ROW_DEPTH]}>
      <mesh receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[width, ROW_LIFT, 1.9]} />
        <meshStandardMaterial color={theme.ground} roughness={0.55} />
      </mesh>
      {/* frosting trim along the front edge */}
      <mesh position={[0, ROW_LIFT / 2 - 0.02, 0.95]} rotation-z={Math.PI / 2}>
        <capsuleGeometry args={[0.1, width - 0.2, 4, 12]} />
        <meshStandardMaterial color={theme.jarRim} roughness={0.4} />
      </mesh>
    </group>
  );
}

export function Board() {
  const jarCount = useGame((s) => s.jars.length);
  const candyCount = useGame((s) => s.colors.length);
  const session = useGame((s) => s.session);
  const won = useGame((s) => s.status === 'won');
  const quality = useSettings((s) => s.quality);

  const jars = useMemo(() => Array.from({ length: jarCount }, (_, i) => i), [jarCount]);
  const candies = useMemo(() => Array.from({ length: candyCount }, (_, i) => i), [candyCount]);

  return (
    <group key={session}>
      <Shelf />
      <DragController />
      {jars.map((i) => (
        <Jar key={i} index={i} />
      ))}
      {candies.map((id) => (
        <Candy key={id} id={id} introDelay={id * 28} />
      ))}
      {won && <Confetti quality={quality} width={Math.min(10, jarCount * 1.6 + 2)} />}
    </group>
  );
}
