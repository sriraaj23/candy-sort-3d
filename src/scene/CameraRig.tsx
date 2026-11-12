import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { jarSlots } from '../game';
import { useGame } from '../store/gameStore';
import { useUi } from '../store/uiStore';
import { LIFT_Y } from './assets';
import { damp } from './anim';

interface Margins {
  top: number;
  bottom: number;
  side: number;
}

const scratch = new THREE.PerspectiveCamera();
const v = new THREE.Vector3();

/**
 * Finds a camera position that frames every point inside the free part of the
 * screen (between the HUD bars), for any aspect ratio.
 */
export function fitCamera(points: THREE.Vector3[], fov: number, width: number, height: number, m: Margins, elevationDeg: number) {
  scratch.fov = fov;
  scratch.aspect = width / height;
  scratch.near = 0.1;
  scratch.far = 500;
  scratch.updateProjectionMatrix();

  const box = new THREE.Box3().setFromPoints(points);
  const center = box.getCenter(new THREE.Vector3());
  const el = (elevationDeg * Math.PI) / 180;
  const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));

  const topN = 1 - (2 * m.top) / height;
  const botN = -1 + (2 * m.bottom) / height;
  const sideN = 1 - (2 * m.side) / width;
  const availH = topN - botN;
  const availW = 2 * sideN;

  const look = center.clone();
  const place = (d: number) => {
    scratch.position.copy(look).addScaledVector(dir, d);
    scratch.lookAt(look);
    scratch.updateMatrixWorld();
  };
  const extents = () => {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const p of points) {
      v.copy(p).project(scratch);
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    }
    return { minX, maxX, minY, maxY };
  };

  let lo = 2;
  let hi = 200;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    place(mid);
    const e = extents();
    if (e.maxX - e.minX <= availW && e.maxY - e.minY <= availH) hi = mid;
    else lo = mid;
  }
  const dist = hi;

  // Shift so the framed content sits in the middle of the free area.
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    place(dist);
    const e = extents();
    const dx = (e.minX + e.maxX) / 2;
    const dy = (e.minY + e.maxY) / 2 - (topN + botN) / 2;
    const halfH = Math.tan((fov * Math.PI) / 360) * dist;
    const halfW = halfH * scratch.aspect;
    right.setFromMatrixColumn(scratch.matrixWorld, 0);
    up.setFromMatrixColumn(scratch.matrixWorld, 1);
    look.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
  }
  place(dist);
  return { position: scratch.position.clone(), look: look.clone() };
}

function gamePoints(count: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const s of jarSlots(count)) {
    for (const dx of [-0.8, 0.8])
      for (const dz of [-0.8, 0.8]) {
        pts.push(new THREE.Vector3(s.x + dx, s.y - 0.05, s.z + dz));
        pts.push(new THREE.Vector3(s.x + dx, s.y + LIFT_Y + 0.45, s.z + dz));
      }
  }
  return pts;
}

function menuPoints(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (const x of [-2.3, 2.3]) for (const z of [-2.3, 2.3]) for (const y of [0, 2.8]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
}

export function CameraRig() {
  const screen = useUi((s) => s.screen);
  const count = useGame((s) => s.jars.length);
  const { size, camera } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 1.5, 0));
  const first = useRef(true);

  const target = useMemo(() => {
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    if (screen === 'game' && count > 0) {
      const compact = h < 520;
      return fitCamera(gamePoints(count), fov, w, h, { top: compact ? 62 : 84, bottom: compact ? 86 : 118, side: 14 }, 17);
    }
    const portrait = h > w;
    return fitCamera(menuPoints(), fov, w, h, { top: h * (portrait ? 0.3 : 0.27), bottom: h * (portrait ? 0.44 : 0.4), side: 20 }, 12);
  }, [screen, count, size.width, size.height, camera]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    if (first.current) {
      camera.position.copy(target.position);
      lookAt.current.copy(target.look);
      first.current = false;
    } else {
      const k = damp(5, dt);
      camera.position.lerp(target.position, k);
      lookAt.current.lerp(target.look, k);
    }
    camera.lookAt(lookAt.current);
  });
  return null;
}
