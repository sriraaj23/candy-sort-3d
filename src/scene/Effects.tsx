import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDY_KINDS } from '../game';
import type { Quality } from '../store/settingsStore';

const dummy = new THREE.Object3D();

/** Instanced star burst used when a jar is completed. */
export function SparkleBurst({ color, y, quality }: { color: string; y: number; quality: Quality }) {
  const count = quality === 'low' ? 10 : quality === 'medium' ? 18 : 30;
  const ref = useRef<THREE.InstancedMesh>(null);
  const start = useRef(performance.now());
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const up = 0.6 + Math.random() * 1.6;
        const sp = 1.2 + Math.random() * 1.4;
        return { vx: Math.cos(a) * sp, vy: up * 2.2, vz: Math.sin(a) * sp * 0.6, s: 0.06 + Math.random() * 0.07, r: Math.random() * 6 };
      }),
    [count],
  );
  const geo = useMemo(() => new THREE.OctahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [color]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = (performance.now() - start.current) / 1000;
    const life = Math.max(0, 1 - t / 1.1);
    m.visible = life > 0;
    parts.forEach((p, i) => {
      dummy.position.set(p.vx * t, y + p.vy * t - 4.5 * t * t, p.vz * t + 0.3);
      dummy.rotation.set(p.r + t * 6, p.r + t * 4, 0);
      dummy.scale.setScalar(p.s * life * (1 + Math.sin(t * 30 + i) * 0.25));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    mat.opacity = life;
  });

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}

/** Instanced confetti shower for a level win. */
export function Confetti({ quality, width }: { quality: Quality; width: number }) {
  const count = quality === 'low' ? 50 : quality === 'medium' ? 110 : 200;
  const ref = useRef<THREE.InstancedMesh>(null);
  const start = useRef(performance.now());
  const geo = useMemo(() => new THREE.PlaneGeometry(0.16, 0.26), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true }), []);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * width,
        y: 7 + Math.random() * 5,
        z: (Math.random() - 0.5) * 3 + 0.5,
        vy: 1.6 + Math.random() * 1.8,
        sway: Math.random() * Math.PI * 2,
        spin: 2 + Math.random() * 6,
        delay: Math.random() * 0.8,
      })),
    [count, width],
  );
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const palette = [...CANDY_KINDS.map((k) => k.color), '#ffffff', '#ffe066'];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) m.setColorAt(i, c.set(palette[i % palette.length]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = (performance.now() - start.current) / 1000;
    parts.forEach((p, i) => {
      const lt = Math.max(0, t - p.delay);
      dummy.position.set(p.x + Math.sin(lt * 2 + p.sway) * 0.4, p.y - lt * p.vy, p.z);
      dummy.rotation.set(lt * p.spin, lt * p.spin * 0.7, p.sway);
      dummy.scale.setScalar(t < p.delay ? 0 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    mat.opacity = Math.min(1, Math.max(0, 5 - t) / 1.5);
  });

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}

/** A few small candies drifting slowly in the background (instanced). */
export function DriftParticles({ quality }: { quality: Quality }) {
  const count = quality === 'low' ? 10 : quality === 'medium' ? 22 : 40;
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(0.22, 12, 8), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3 }), []);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 50,
        y: Math.random() * 18 - 2,
        z: -14 - Math.random() * 18,
        s: 0.6 + Math.random() * 0.9,
        sp: 0.15 + Math.random() * 0.25,
        ph: Math.random() * Math.PI * 2,
      })),
    [count],
  );
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) m.setColorAt(i, c.set(CANDY_KINDS[i % 8].color).lerp(new THREE.Color('#ffffff'), 0.35));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [count]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    parts.forEach((p, i) => {
      const y = ((p.y + t * p.sp + 2) % 20) - 2;
      dummy.position.set(p.x + Math.sin(t * 0.3 + p.ph) * 0.8, y, p.z);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />;
}
