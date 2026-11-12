import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CANDY_KINDS, getTheme, isJarComplete } from '../game';
import { MOVE_MS, MOVE_MS_REDUCED, useGame } from '../store/gameStore';
import { useProgress } from '../store/progressStore';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { BASE_H, JAR_TOP, getCandyMaterial, getGlowTexture, getJarExtras, getJarGeometry } from './assets';
import { damp, easeOutBounce } from './anim';
import { SparkleBurst } from './Effects';
import { drag, pressJar } from './DragController';
import { useJarSlots } from './layoutHooks';

const HINT_FROM = new THREE.Color('#ffd23f');
const HINT_TO = new THREE.Color('#5be37d');
const BAD = new THREE.Color('#ff3b4a');
const tint = new THREE.Color();

export function Jar({ index }: { index: number }) {
  const slots = useJarSlots();
  const slot = slots[index];
  const completeColor = useGame((s) => {
    const jar = s.jars[index];
    return jar && isJarComplete(jar, s.capacity) ? jar[0] : -1;
  });
  const selected = useGame((s) => s.selected === index);
  const hintRole = useGame((s) => (s.hint ? (s.hint.from === index ? 1 : s.hint.to === index ? 2 : 0) : 0));
  const shakeN = useGame((s) => (s.shake.jar === index ? s.shake.n : -1));
  const quality = useSettings((s) => s.quality);
  const themeId = useProgress((s) => s.selectedTheme);
  const reduced = useUi((s) => s.reducedMotion);
  const theme = getTheme(themeId);
  const geos = getJarGeometry();
  const extras = getJarExtras();

  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const st = useRef({ shakeAt: -1, lidAt: -1, placed: false, pulseAt: -1 });
  const [burst, setBurst] = useState(0);
  const prevComplete = useRef(completeColor);

  // Detect completion transitions to drop the lid and burst sparkles.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (completeColor >= 0 && prevComplete.current < 0) {
      // Wait for the last candy to land before the lid drops.
      const delay = reduced ? MOVE_MS_REDUCED : MOVE_MS;
      st.current.lidAt = performance.now() + delay;
      st.current.pulseAt = performance.now() + delay;
      if (!reduced) timer = setTimeout(() => setBurst((b) => b + 1), delay + 120);
    }
    prevComplete.current = completeColor;
    return () => clearTimeout(timer);
  }, [completeColor, reduced]);

  useEffect(() => {
    if (shakeN > 0) st.current.shakeAt = performance.now();
  }, [shakeN]);

  const glassMat = useMemo(() => {
    if (quality === 'high') {
      return new THREE.MeshPhysicalMaterial({
        color: theme.jarTint,
        transmission: 0.92,
        thickness: 0.15,
        roughness: 0.06,
        ior: 1.3,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
        clearcoat: 1,
        envMapIntensity: 1.2,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: theme.jarTint,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 1.6,
    });
  }, [quality, theme.jarTint]);
  useEffect(() => () => glassMat.dispose(), [glassMat]);

  const parts = useMemo(
    () => ({
      rim: new THREE.MeshStandardMaterial({ color: theme.jarRim, roughness: 0.3, emissive: theme.jarRim, emissiveIntensity: 0 }),
      base: new THREE.MeshStandardMaterial({ color: theme.jarBase, roughness: 0.45 }),
      label: new THREE.MeshStandardMaterial({ color: theme.label, roughness: 0.6 }),
      stripe: new THREE.MeshStandardMaterial({ color: theme.jarRim, roughness: 0.6 }),
      highlight: new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    }),
    [theme],
  );
  useEffect(() => () => Object.values(parts).forEach((m) => m.dispose()), [parts]);

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: getGlowTexture(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => glowMat.dispose(), [glowMat]);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.button !== undefined && e.button > 0) return;
    pressJar(index, e.nativeEvent);
  };

  useFrame((_, dtRaw) => {
    const g = group.current;
    if (!g || !slot) return;
    const dt = Math.min(dtRaw, 0.05);
    const now = performance.now();
    const s = st.current;
    // Glide to the slot (layout changes when a jar is added).
    if (!s.placed) {
      g.position.set(slot.x, slot.y, slot.z);
      s.placed = true;
    } else {
      g.position.x += (slot.x - g.position.x) * damp(10, dt);
      g.position.y += (slot.y - g.position.y) * damp(10, dt);
      g.position.z += (slot.z - g.position.z) * damp(10, dt);
    }
    const b = body.current!;
    // Shake on invalid move.
    let shake = 0;
    if (s.shakeAt > 0) {
      const t = (now - s.shakeAt) / 380;
      if (t >= 1) s.shakeAt = -1;
      else shake = Math.sin(t * Math.PI * 8) * 0.1 * (1 - t) * (reduced ? 0.4 : 1);
    }
    b.position.x = shake;
    // Drag-over feedback, read straight from the mutable drag state.
    const dragOver = drag.active && drag.target === index && drag.from !== index;
    const dropOk = dragOver && drag.valid;
    const dropBad = dragOver && !drag.valid;
    const targetScale = dropOk ? 1.09 : selected ? 1.06 : 1;
    const sc = b.scale.x + (targetScale - b.scale.x) * damp(18, dt);
    b.scale.setScalar(sc);

    // Lid drop.
    if (lid.current) {
      const l = lid.current;
      if (completeColor >= 0 && now >= s.lidAt) {
        l.visible = true;
        const t = s.lidAt > 0 ? Math.min(1, (now - s.lidAt) / (reduced ? 120 : 520)) : 1;
        l.position.y = JAR_TOP + 0.08 + (1 - easeOutBounce(t)) * 1.8;
      } else l.visible = false;
    }

    // Glow: selection, hint and completion pulse.
    const gm = glowMat;
    if (glow.current) {
      let opacity = 0;
      if (dropOk) {
        gm.color.set(theme.ui.accent);
        opacity = 0.75;
      } else if (dropBad) {
        gm.color.copy(BAD);
        opacity = 0.6;
      } else if (selected) {
        gm.color.set(theme.ui.accent);
        opacity = 0.55;
      } else if (hintRole) {
        gm.color.copy(hintRole === 1 ? HINT_FROM : HINT_TO);
        opacity = 0.45 + Math.sin(now / 160) * 0.25;
      } else if (completeColor >= 0) {
        gm.color.set(CANDY_KINDS[completeColor].color);
        const p = s.pulseAt > 0 && now >= s.pulseAt ? Math.max(0, 1 - (now - s.pulseAt) / 1200) : 0;
        opacity = 0.28 + p * 0.6 + (reduced ? 0 : Math.sin(now / 600 + index) * 0.06);
      }
      gm.opacity += (opacity - gm.opacity) * damp(12, dt);
      glow.current.visible = gm.opacity > 0.01;
    }
    parts.rim.emissiveIntensity = selected || dropOk ? 0.35 : hintRole ? 0.2 : 0;
    // Red tint on the glass and rim when the hovered drop would be invalid.
    tint.set(theme.jarTint);
    if (dropBad) tint.lerp(BAD, 0.55);
    glassMat.color.lerp(tint, damp(14, dt));
    tint.set(theme.jarRim);
    if (dropBad) tint.copy(BAD);
    parts.rim.emissive.lerp(tint, damp(14, dt));
    if (dropBad) parts.rim.emissiveIntensity = 0.45;

    if (arrow.current) {
      arrow.current.visible = hintRole === 2;
      arrow.current.position.y = JAR_TOP + 1.25 + (reduced ? 0 : Math.abs(Math.sin(now / 220)) * 0.3);
      arrow.current.rotation.y += dt * 2;
    }
  });

  if (!slot) return null;
  return (
    <group ref={group} dispose={null}>
      {quality === 'medium' && <mesh geometry={extras.shadowPlane} material={extras.shadowMat} position-y={0.012} renderOrder={-1} />}
      <mesh ref={glow} geometry={extras.glowPlane} material={glowMat} position={[0, 1.6, -0.75]} renderOrder={-1} visible={false} />
      <group ref={body}>
        <mesh geometry={geos.base} material={parts.base} castShadow={quality === 'high'} receiveShadow={quality === 'high'} />
        <mesh geometry={geos.label} material={parts.label} position={[0, BASE_H / 2, 0.76]} />
        <mesh geometry={geos.stripe} material={parts.stripe} position={[0, BASE_H / 2, 0.765]} />
        <mesh geometry={geos.glass} material={glassMat} renderOrder={2} />
        <mesh
          geometry={geos.highlight}
          material={parts.highlight}
          position={[-0.36, (JAR_TOP + BASE_H) / 2, 0.47]}
          rotation-y={-0.65}
          renderOrder={3}
        />
        <mesh
          geometry={geos.highlight}
          material={parts.highlight}
          position={[0.42, (JAR_TOP + BASE_H) / 2 + 0.3, 0.41]}
          rotation-y={0.8}
          scale={[0.5, 0.5, 1]}
          renderOrder={3}
        />
        <mesh geometry={geos.rim} material={parts.rim} />
        <group ref={lid} visible={false}>
          {completeColor >= 0 && (
            <>
              <mesh geometry={geos.lid} material={getCandyMaterial(completeColor, 'main', quality)} />
              <mesh geometry={geos.knob} material={getCandyMaterial(completeColor, 'accent', quality)} position-y={0.12} />
            </>
          )}
        </group>
      </group>
      <mesh ref={arrow} geometry={extras.arrow} material={extras.arrowMat} visible={false} rotation-x={Math.PI} />
      {burst > 0 && (
        <SparkleBurst key={burst} color={completeColor >= 0 ? CANDY_KINDS[completeColor].color : '#ffffff'} y={JAR_TOP} quality={quality} />
      )}
      <mesh
        geometry={slot.row === 0 && slots.length > 5 ? geos.hitShort : geos.hit}
        material={extras.hitMat}
        onPointerDown={onDown}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      />
    </group>
  );
}
