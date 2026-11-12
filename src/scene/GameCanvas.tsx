import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Suspense, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { useGame } from '../store/gameStore';
import { World } from './Environment';
import { CameraRig } from './CameraRig';
import { Board } from './Board';
import { MenuDisplay } from './MenuDisplay';

function Content() {
  const screen = useUi((s) => s.screen);
  const hasBoard = useGame((s) => s.status !== 'idle' && s.status !== 'loading' && s.jars.length > 0);
  return (
    <>
      <World />
      <CameraRig />
      {screen === 'game' ? hasBoard && <Board /> : <MenuDisplay />}
    </>
  );
}

/** Pixel-ratio range per quality level; never above 2. */
const DPR: Record<string, [number, number]> = { low: [1, 1.25], medium: [1, 1.6], high: [1, 2] };

export function GameCanvas() {
  const quality = useSettings((s) => s.quality);
  const [min, max] = DPR[quality];
  const device = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const [dpr, setDpr] = useState(() => Math.min(max, device));
  useEffect(() => setDpr(Math.min(max, device)), [max, device]);

  return (
    <Canvas
      className="!fixed inset-0"
      style={{ touchAction: 'none' }}
      dpr={dpr}
      shadows={quality === 'high' ? 'soft' : false}
      camera={{ fov: 38, near: 0.1, far: 500, position: [0, 4, 16] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      {/* Drops resolution when the frame rate sags, raises it again when it recovers. */}
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(min, +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(max, device, +(d + 0.25).toFixed(2)))}
      />
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </Canvas>
  );
}
