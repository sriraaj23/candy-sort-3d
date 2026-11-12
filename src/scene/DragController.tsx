import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { JAR_SPACING, checkMove, jarSlots } from '../game';
import { useGame } from '../store/gameStore';
import { JAR_TOP, LIFT_Y } from './assets';

/**
 * Mutable drag state, read every frame by candies and jars. Kept outside React
 * so dragging never triggers re-renders.
 */
export const drag = {
  active: false,
  from: -1,
  candyId: -1,
  /** Smoothed target point on the drag plane (world space). */
  point: new THREE.Vector3(),
  /** Nearest jar within snap distance, or -1. */
  target: -1,
  valid: false,
};

/** Press that has not yet become a drag (or a tap). */
const press = { id: -1, jar: -1, x: 0, y: 0, lastX: 0, lastY: 0, touch: false, rejected: false };

const DRAG_THRESHOLD_PX = 8;
const TOUCH_LIFT_PX = 56; // keep the candy visible above the thumb
/** Invisible plane just in front of the front row: z = 0.9. */
const PLANE = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.9);

let canvas: HTMLCanvasElement | null = null;

function resetPress() {
  if (canvas && press.id !== -1) {
    try {
      if (canvas.hasPointerCapture(press.id)) canvas.releasePointerCapture(press.id);
    } catch {
      /* already released */
    }
  }
  press.id = -1;
  press.jar = -1;
  press.rejected = false;
}

function endDragState() {
  drag.active = false;
  drag.from = -1;
  drag.candyId = -1;
  drag.target = -1;
  drag.valid = false;
}

/** Called by a jar's hit mesh on pointer down. Mouse and touch share this path. */
export function pressJar(jar: number, e: PointerEvent) {
  if (!canvas) {
    useGame.getState().tapJar(jar);
    return;
  }
  if (press.id !== -1 || drag.active) return; // ignore extra fingers
  if (e.button > 0) return;
  press.id = e.pointerId;
  press.jar = jar;
  press.x = press.lastX = e.clientX;
  press.y = press.lastY = e.clientY;
  press.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  press.rejected = false;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* capture unsupported: window listeners still work */
  }
}

const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const pa = new THREE.Vector3();
const pb = new THREE.Vector3();

function toScreen(v: THREE.Vector3, camera: THREE.Camera, rect: DOMRect) {
  v.project(camera);
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
}

/** Lives inside the board while a level is shown. */
export function DragController() {
  const { gl, camera } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    canvas = el;
    el.style.touchAction = 'none';

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== press.id) return;
      press.lastX = e.clientX;
      press.lastY = e.clientY;
      if (drag.active || press.rejected) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= DRAG_THRESHOLD_PX) return;
      const g = useGame.getState();
      if (!g.beginDrag(press.jar)) {
        press.rejected = true; // empty/complete jar or animating: neither drag nor tap
        return;
      }
      const ids = g.ids[press.jar];
      drag.active = true;
      drag.from = press.jar;
      drag.candyId = ids[ids.length - 1];
      drag.target = -1;
      drag.valid = false;
      drag.point.set(NaN, 0, 0); // filled on the next frame
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== press.id) return;
      if (drag.active) {
        const to = drag.target >= 0 && drag.target !== drag.from ? drag.target : null;
        endDragState();
        useGame.getState().endDrag(to);
      } else if (!press.rejected) {
        useGame.getState().tapJar(press.jar);
      }
      resetPress();
    };

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== press.id) return;
      if (drag.active) {
        endDragState();
        useGame.getState().endDrag(null);
      }
      resetPress();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      if (drag.active) useGame.getState().endDrag(null);
      endDragState();
      resetPress();
      canvas = null;
    };
  }, [gl]);

  useFrame(() => {
    if (!drag.active) return;
    const g = useGame.getState();
    // A modal (or anything else) cleared the selection: abandon the drag.
    if (g.selected !== drag.from || g.status !== 'playing') {
      endDragState();
      resetPress();
      return;
    }
    const rect = gl.domElement.getBoundingClientRect();
    const sx = press.lastX;
    const sy = press.lastY - (press.touch ? TOUCH_LIFT_PX : 0);

    // Pointer -> drag plane.
    ndc.set(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(PLANE, hit)) {
      hit.y = Math.max(0.35, hit.y);
      drag.point.copy(hit);
    }

    // Nearest jar in screen space, with a generous snap zone around each jar.
    const slots = jarSlots(g.jars.length);
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const bottom = toScreen(pa.set(s.x, s.y, s.z), camera, rect);
      const top = toScreen(pb.set(s.x, s.y + JAR_TOP, s.z), camera, rect);
      const side = toScreen(pb.set(s.x + JAR_SPACING / 2, s.y + JAR_TOP / 2, s.z), camera, rect);
      const mid = toScreen(pa.set(s.x, s.y + JAR_TOP / 2, s.z), camera, rect);
      const halfW = Math.abs(side.x - mid.x);
      const halfH = Math.abs(bottom.y - top.y) / 2;
      const liftTop = toScreen(pb.set(s.x, s.y + LIFT_Y + 0.6, s.z), camera, rect).y;
      const dx = Math.abs(sx - mid.x);
      if (dx > halfW * 1.05) continue;
      if (sy < liftTop || sy > bottom.y + halfW * 0.6) continue;
      const score = (dx / halfW) ** 2 + ((sy - mid.y) / (halfH * 1.6)) ** 2;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    }
    drag.target = best;
    drag.valid = best >= 0 && best !== drag.from && checkMove({ jars: g.jars, capacity: g.capacity }, drag.from, best) === 'ok';
  });

  return null;
}
