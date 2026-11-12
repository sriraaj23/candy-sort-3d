import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDY_KINDS, getTheme } from '../game';
import { useProgress } from '../store/progressStore';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { getCandyGeometry, getCandyMaterial, getJarGeometry } from './assets';

/** Rotating carousel of all eight candies on a little pedestal. */
export function MenuDisplay() {
  const ring = useRef<THREE.Group>(null);
  const quality = useSettings((s) => s.quality);
  const reduced = useUi((s) => s.reducedMotion);
  const theme = getTheme(useProgress((s) => s.selectedTheme));
  const base = getJarGeometry().base;

  useFrame((state, dt) => {
    const r = ring.current;
    if (!r) return;
    if (!reduced) r.rotation.y += dt * 0.35;
    const t = state.clock.elapsedTime;
    r.children.forEach((c, i) => {
      c.position.y = 1.25 + (reduced ? 0 : Math.sin(t * 1.6 + i * 0.8) * 0.18);
      if (!reduced) c.rotation.y += dt * 0.8;
    });
  });

  return (
    <group dispose={null}>
      <mesh geometry={base} scale={[2.9, 1.2, 2.9]}>
        <meshStandardMaterial color={theme.jarBase} roughness={0.45} />
      </mesh>
      <group ref={ring}>
        {CANDY_KINDS.map((k, i) => {
          const a = (i / CANDY_KINDS.length) * Math.PI * 2;
          const geo = getCandyGeometry(k.id);
          return (
            <group key={k.id} position={[Math.cos(a) * 1.75, 1.25, Math.sin(a) * 1.75]} scale={1.55}>
              <mesh geometry={geo.main} material={getCandyMaterial(k.id, 'main', quality)} />
              {geo.accent && <mesh geometry={geo.accent} material={getCandyMaterial(k.id, 'accent', quality)} />}
            </group>
          );
        })}
      </group>
    </group>
  );
}
