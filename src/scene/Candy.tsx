import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { jarSlots } from '../game';
import { MOVE_MS, MOVE_MS_REDUCED, useGame } from '../store/gameStore';
import { useSettings } from '../store/settingsStore';
import { useUi } from '../store/uiStore';
import { LIFT_Y, getCandyGeometry, getCandyMaterial, slotY } from './assets';
import { clamp01, damp, easeInOutCubic } from './anim';
import { drag } from './DragController';

const tmp = new THREE.Vector3();

interface Props {
  id: number;
  /** Small delay so a fresh level's candies drop in one after another. */
  introDelay: number;
}

/**
 * One candy. It reads its jar/slot from the store and animates itself:
 * rest -> lift (selected) -> arc to the new jar -> squash landing.
 */
export function Candy({ id, introDelay }: Props) {
  const color = useGame((s) => s.colors[id]);
  // Encoded as a number so the component only re-renders when it really moves.
  const code = useGame((s) => {
    const sp = s.spots[id];
    return sp ? sp.jar * 16 + sp.slot : -1;
  });
  const lifted = useGame((s) => {
    const sp = s.spots[id];
    return s.selected !== null && sp?.jar === s.selected && sp.slot === s.jars[s.selected].length - 1;
  });
  const won = useGame((s) => s.status === 'won');
  const quality = useSettings((s) => s.quality);
  const reduced = useUi((s) => s.reducedMotion);

  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const anim = useRef({
    jar: -1,
    arc: null as null | { from: THREE.Vector3; start: number; dur: number },
    land: -1,
    born: performance.now() + introDelay,
    winAt: -1,
    spin: 0,
    dragging: false,
    tiltX: 0,
    tiltZ: 0,
  });

  const jar = Math.floor(code / 16);
  const slot = code % 16;
  const geo = getCandyGeometry(color);
  const baseYaw = (((id * 47) % 30) - 15) * (Math.PI / 180);

  useFrame((_, dtRaw) => {
    const g = group.current;
    const inn = inner.current;
    if (!g || !inn || code < 0) return;
    const dt = Math.min(dtRaw, 0.05);
    const now = performance.now();
    const a = anim.current;
    const s = useGame.getState();
    const slots = jarSlots(s.jars.length);
    const js = slots[jar];
    if (!js) return;

    const target = tmp.set(js.x, js.y + (lifted ? LIFT_Y : slotY(slot)), js.z);

    // First frame: start above the jar and drop in.
    if (a.jar === -1) {
      a.jar = jar;
      g.position.set(target.x, target.y + (reduced ? 0 : 3.2), target.z);
      g.visible = false;
    }

    if (now < a.born) return;
    g.visible = true;

    if (won) {
      if (a.winAt < 0) a.winAt = now + 350 + (id % 8) * 60;
      if (now > a.winAt && !reduced) {
        const t = (now - a.winAt) / 1000;
        g.position.y += dt * (1.5 + t * 2.2);
        g.position.x += Math.sin(t * 3 + id) * dt * 0.6;
        inn.rotation.y += dt * 2;
        return;
      }
    }

    // Being dragged: follow the pointer with smoothing and tilt with motion.
    if (drag.active && drag.candyId === id) {
      if (!Number.isNaN(drag.point.x)) {
        const px = g.position.x;
        const py = g.position.y;
        g.position.lerp(drag.point, damp(22, dt));
        const vx = (g.position.x - px) / Math.max(dt, 1e-3);
        const vy = (g.position.y - py) / Math.max(dt, 1e-3);
        const k = damp(12, dt);
        a.tiltZ += (THREE.MathUtils.clamp(-vx * 0.05, -0.5, 0.5) - a.tiltZ) * k;
        a.tiltX += (THREE.MathUtils.clamp(vy * 0.03, -0.35, 0.35) - a.tiltX) * k;
      }
      a.dragging = true;
      a.arc = null;
      a.land = -1;
      a.spin = 0;
      inn.scale.set(1.08, 1.08, 1.08);
      inn.rotation.set(a.tiltX, baseYaw, a.tiltZ);
      inn.position.y = 0;
      return;
    }
    // Released: a valid drop changes jar (arc below); otherwise arc back home.
    if (a.dragging) {
      a.dragging = false;
      inn.scale.set(1, 1, 1);
      if (jar === a.jar) {
        a.arc = { from: g.position.clone(), start: now, dur: reduced ? MOVE_MS_REDUCED : MOVE_MS * 0.85 };
      }
    }
    if (a.tiltX || a.tiltZ) {
      const k = damp(10, dt);
      a.tiltX -= a.tiltX * k;
      a.tiltZ -= a.tiltZ * k;
      if (Math.abs(a.tiltX) + Math.abs(a.tiltZ) < 1e-3) a.tiltX = a.tiltZ = 0;
      inn.rotation.x = a.tiltX;
      inn.rotation.z = a.tiltZ;
    }

    // Jar changed -> fly along an arc from wherever we are now.
    if (jar !== a.jar) {
      a.jar = jar;
      const dur = reduced ? MOVE_MS_REDUCED : MOVE_MS;
      a.arc = { from: g.position.clone(), start: now, dur };
    }

    if (a.arc) {
      const t = clamp01((now - a.arc.start) / a.arc.dur);
      const e = easeInOutCubic(t);
      const from = a.arc.from;
      const dist = from.distanceTo(target);
      const peak = Math.max(from.y, target.y) + 0.5 + dist * 0.12;
      const x = from.x + (target.x - from.x) * e;
      const z = from.z + (target.z - from.z) * e;
      // Quadratic Bezier in y through a raised control point.
      const cy = 2 * peak - 0.5 * (from.y + target.y);
      const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * target.y;
      g.position.set(x, y, z);
      a.spin = reduced ? 0 : e * Math.PI * 2;
      if (t >= 1) {
        a.arc = null;
        a.spin = 0;
        a.land = reduced ? -1 : now;
      }
    } else {
      // Rest / lift: smooth approach (~150 ms for a lift).
      g.position.lerp(target, damp(lifted ? 26 : 20, dt));
    }

    inn.rotation.y = baseYaw + a.spin;

    // Squash and bounce after landing.
    if (a.land > 0) {
      const t = (now - a.land) / 260;
      if (t >= 1) {
        a.land = -1;
        inn.scale.set(1, 1, 1);
      } else {
        const sq = Math.sin(t * Math.PI) * (1 - t) * 0.35;
        inn.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);
      }
    }
    // Gentle bob while lifted.
    if (lifted && !a.arc) inn.position.y = Math.sin(now / 220) * 0.04;
    else inn.position.y *= 0.8;
  });

  return (
    <group ref={group} dispose={null}>
      <group ref={inner}>
        <mesh geometry={geo.main} material={getCandyMaterial(color, 'main', quality)} castShadow={quality === 'high'} />
        {geo.accent && <mesh geometry={geo.accent} material={getCandyMaterial(color, 'accent', quality)} />}
      </group>
    </group>
  );
}
