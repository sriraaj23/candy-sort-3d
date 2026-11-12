import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CANDY_KINDS, type CandyShape } from '../game';
import type { Quality } from '../store/settingsStore';

/**
 * Shared, procedurally built geometry and materials. Everything here is built
 * once and reused by every candy/jar instance (meshes use dispose={null}).
 */

// ---------- dimensions (world units) ----------
const CANDY_BOX = { w: 0.6, h: 0.56, d: 0.6 };
const SLOT_H = 0.64;
export const BASE_H = 0.26;
const JAR_R = 0.6;
export const JAR_TOP = 3.08;
export const LIFT_Y = JAR_TOP + 0.62;

export function slotY(slot: number) {
  return BASE_H + 0.06 + SLOT_H / 2 + slot * SLOT_H;
}

// ---------- helpers ----------
type Geo = THREE.BufferGeometry;

function prep(g: Geo, m?: THREE.Matrix4): Geo {
  if (m) g.applyMatrix4(m);
  g.deleteAttribute('uv');
  return g;
}

const mat4 = (pos: [number, number, number], rot: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));

const sphere = (r: number, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], seg = 20) =>
  prep(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat4(pos, [0, 0, 0], scale));

function merge(list: Geo[]): Geo {
  const out = mergeGeometries(list, false);
  if (!out) throw new Error('mergeGeometries failed');
  list.forEach((g) => g.dispose());
  return out;
}

interface CandyGeo {
  main: Geo;
  accent: Geo | null;
}

/** Scales and centres both parts so every candy fits the same box. */
function normalize(parts: CandyGeo): CandyGeo {
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  parts.main.computeBoundingBox();
  box.copy(parts.main.boundingBox!);
  if (parts.accent) {
    parts.accent.computeBoundingBox();
    tmp.copy(parts.accent.boundingBox!);
    box.union(tmp);
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = Math.min(CANDY_BOX.w / size.x, CANDY_BOX.h / size.y, CANDY_BOX.d / size.z);
  const m = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  parts.main.applyMatrix4(m);
  parts.accent?.applyMatrix4(m);
  parts.main.computeBoundingSphere();
  parts.accent?.computeBoundingSphere();
  return parts;
}

// ---------- candy shapes ----------
function gummyBear(): CandyGeo {
  const parts = [
    sphere(0.22, [0, -0.04, 0], [1, 1.15, 0.85]), // body
    sphere(0.17, [0, 0.24, 0], [1, 0.95, 0.9]), // head
    sphere(0.065, [-0.12, 0.37, 0]),
    sphere(0.065, [0.12, 0.37, 0]),
    sphere(0.075, [0, 0.2, 0.13], [1.1, 0.85, 1]), // snout
    sphere(0.08, [-0.2, 0.04, 0.03], [0.9, 1.3, 0.9]), // arms
    sphere(0.08, [0.2, 0.04, 0.03], [0.9, 1.3, 0.9]),
    sphere(0.095, [-0.12, -0.27, 0.04], [1, 0.9, 1.05]), // legs
    sphere(0.095, [0.12, -0.27, 0.04], [1, 0.9, 1.05]),
  ];
  const eyes = [sphere(0.025, [-0.065, 0.28, 0.14], [1, 1, 0.6], 10), sphere(0.025, [0.065, 0.28, 0.14], [1, 1, 0.6], 10)];
  return { main: merge(parts), accent: merge(eyes) };
}

function hardCandy(): CandyGeo {
  const main = sphere(0.3, [0, 0, 0], [1, 0.84, 1], 28);
  // A white spiral stripe on the front face.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = t * Math.PI * 3.2;
    const r = 0.04 + t * 0.2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.84;
    const z = Math.sqrt(Math.max(0, 0.3 * 0.3 - x * x - (y / 0.84) * (y / 0.84))) + 0.004;
    pts.push(new THREE.Vector3(x, y, z));
  }
  const accent = prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 6, false));
  return { main, accent };
}

function jellyBean(): CandyGeo {
  const g = new THREE.CapsuleGeometry(0.17, 0.3, 10, 20);
  g.rotateZ(Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setY(i, p.getY(i) - 0.55 * x * x); // kidney bend
  }
  g.computeVertexNormals();
  g.rotateZ(0.25);
  prep(g);
  const speckles = [
    sphere(0.022, [-0.12, 0.02, 0.15], [1, 1, 0.5], 8),
    sphere(0.018, [0.06, 0.06, 0.16], [1, 1, 0.5], 8),
    sphere(0.02, [0.18, -0.04, 0.13], [1, 1, 0.5], 8),
  ];
  return { main: g, accent: merge(speckles) };
}

function wrapped(): CandyGeo {
  const body = sphere(0.21, [0, 0, 0], [1.15, 0.92, 0.92], 24);
  const coneL = prep(new THREE.ConeGeometry(0.15, 0.2, 14, 1, false), mat4([-0.37, 0, 0], [0, 0, -Math.PI / 2]));
  const coneR = prep(new THREE.ConeGeometry(0.15, 0.2, 14, 1, false), mat4([0.37, 0, 0], [0, 0, Math.PI / 2]));
  const twistL = prep(new THREE.TorusGeometry(0.05, 0.03, 8, 14), mat4([-0.26, 0, 0], [0, Math.PI / 2, 0]));
  const twistR = prep(new THREE.TorusGeometry(0.05, 0.03, 8, 14), mat4([0.26, 0, 0], [0, Math.PI / 2, 0]));
  return { main: body, accent: merge([coneL, coneR, twistL, twistR]) };
}

function lollipop(): CandyGeo {
  const disc = prep(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 32), mat4([0, 0.08, 0], [Math.PI / 2, 0, 0]));
  const edge = prep(new THREE.TorusGeometry(0.27, 0.06, 10, 32), mat4([0, 0.08, 0]));
  const stick = prep(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 10), mat4([0, -0.27, 0]));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 70; i++) {
    const t = i / 70;
    const a = t * Math.PI * 4;
    const r = 0.03 + t * 0.21;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.08 + Math.sin(a) * r, 0.064));
  }
  const swirl = prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 70, 0.022, 6, false));
  return { main: merge([disc, edge]), accent: merge([stick, swirl]) };
}

function swirlBall(): CandyGeo {
  const ball = sphere(0.28, [0, 0, 0], [1, 1, 1], 28);
  const pts: THREE.Vector3[] = [];
  const R = 0.286;
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const phi = -1.35 + t * 2.7;
    const theta = t * Math.PI * 5;
    pts.push(new THREE.Vector3(Math.cos(phi) * Math.cos(theta) * R, Math.sin(phi) * R, Math.cos(phi) * Math.sin(theta) * R));
  }
  const stripe = prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.03, 6, false));
  return { main: ball, accent: stripe };
}

function marshmallowTwist(): CandyGeo {
  const h = 0.5;
  const g = new THREE.CylinderGeometry(0.2, 0.2, h, 60, 24, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-5) continue;
    const a = Math.atan2(z, x);
    const v = y / (h / 2); // -1..1
    const round = Math.sqrt(Math.max(0.04, 1 - Math.pow(Math.abs(v), 6)));
    const ridge = 1 + 0.16 * Math.cos(5 * a + v * 2.6);
    const k = (ridge * round * 0.2) / r;
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  prep(g);
  const cap = sphere(0.06, [0, h / 2 - 0.01, 0], [1, 0.5, 1], 12);
  return { main: g, accent: cap };
}

function bonbon(): CandyGeo {
  const profile: THREE.Vector2[] = [];
  profile.push(new THREE.Vector2(0, -0.16));
  profile.push(new THREE.Vector2(0.24, -0.16));
  profile.push(new THREE.Vector2(0.28, -0.12));
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    profile.push(new THREE.Vector2(Math.cos(a) * 0.28, -0.12 + Math.sin(a) * 0.3));
  }
  const dome = prep(new THREE.LatheGeometry(profile, 32));
  const drizzle: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    const x = -0.22 + t * 0.44;
    const z = Math.sin(t * Math.PI * 7) * 0.13 * Math.sin(t * Math.PI);
    const yy = -0.12 + 0.3 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (0.28 * 0.28))) + 0.012;
    drizzle.push(new THREE.Vector3(x, yy, z));
  }
  const accent = merge([
    prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(drizzle), 100, 0.018, 6, false)),
    prep(new THREE.TorusGeometry(0.255, 0.028, 8, 32), mat4([0, -0.11, 0], [Math.PI / 2, 0, 0])),
  ]);
  return { main: dome, accent };
}

const BUILDERS: Record<CandyShape, () => CandyGeo> = {
  gummyBear,
  hardCandy,
  jellyBean,
  wrapped,
  lollipop,
  swirlBall,
  marshmallowTwist,
  bonbon,
};

let candyGeos: CandyGeo[] | null = null;
export function getCandyGeometry(color: number): CandyGeo {
  if (!candyGeos) candyGeos = CANDY_KINDS.map((k) => normalize(BUILDERS[k.shape]()));
  return candyGeos[color];
}

// ---------- candy materials ----------
const candyMatCache = new Map<string, THREE.Material>();
export function getCandyMaterial(color: number, part: 'main' | 'accent', quality: Quality): THREE.Material {
  const key = `${color}-${part}-${quality}`;
  let m = candyMatCache.get(key);
  if (m) return m;
  const kind = CANDY_KINDS[color];
  let hex = part === 'main' ? kind.color : kind.accent;
  if (part === 'accent' && kind.shape === 'gummyBear') hex = '#7a1840'; // eyes
  if (quality === 'low') {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.32, metalness: 0, envMapIntensity: 1 });
  } else {
    m = new THREE.MeshPhysicalMaterial({
      color: hex,
      roughness: kind.shape === 'marshmallowTwist' ? 0.55 : 0.26,
      metalness: 0,
      clearcoat: kind.shape === 'marshmallowTwist' ? 0.2 : 0.9,
      clearcoatRoughness: 0.12,
      sheen: kind.shape === 'gummyBear' ? 0.6 : 0,
      sheenColor: new THREE.Color('#ffffff'),
      envMapIntensity: 1.1,
    });
  }
  candyMatCache.set(key, m);
  return m;
}

// ---------- jar geometry ----------
let jarGeos: { glass: Geo; rim: Geo; base: Geo; label: Geo; stripe: Geo; lid: Geo; knob: Geo; highlight: Geo; hit: Geo; hitShort: Geo } | null = null;

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function getJarGeometry() {
  if (jarGeos) return jarGeos;
  const pts = [
    [0, BASE_H - 0.02],
    [0.48, BASE_H - 0.02],
    [0.57, BASE_H + 0.04],
    [JAR_R, BASE_H + 0.16],
    [JAR_R, JAR_TOP - 0.24],
    [JAR_R - 0.02, JAR_TOP - 0.1],
    [JAR_R - 0.05, JAR_TOP],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(40), 40);

  const rim = new THREE.TorusGeometry(JAR_R - 0.04, 0.075, 12, 40);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, JAR_TOP, 0);

  const base = new THREE.CylinderGeometry(0.7, 0.75, BASE_H, 48, 2);
  const bp = base.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const z = bp.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + 0.045 * Math.cos(a * 14); // scalloped edge
    bp.setX(i, x * k);
    bp.setZ(i, z * k);
  }
  base.computeVertexNormals();
  base.translate(0, BASE_H / 2, 0);

  const label = new THREE.ShapeGeometry(roundedRect(0.46, 0.17, 0.07), 6);
  const stripe = new THREE.ShapeGeometry(roundedRect(0.3, 0.05, 0.025), 4);

  const lid = new THREE.CylinderGeometry(JAR_R + 0.02, JAR_R + 0.05, 0.16, 40);
  const knob = new THREE.SphereGeometry(0.13, 18, 12);

  const highlight = new THREE.PlaneGeometry(0.09, JAR_TOP - BASE_H - 0.6);
  const hit = new THREE.CylinderGeometry(0.78, 0.78, LIFT_Y + 0.5, 12);
  hit.translate(0, (LIFT_Y + 0.5) / 2 - 0.1, 0);
  // Front row of a two-row layout: stop at the rim so taps reach the back row.
  const hitShort = new THREE.CylinderGeometry(0.78, 0.78, JAR_TOP + 0.3, 12);
  hitShort.translate(0, (JAR_TOP + 0.3) / 2 - 0.1, 0);

  jarGeos = { glass, rim, base, label, stripe, lid, knob, highlight, hit, hitShort };
  return jarGeos;
}

// ---------- canvas textures ----------
let glowTex: THREE.Texture | null = null;
export function getGlowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

let shadowTex: THREE.Texture | null = null;
function getShadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, 'rgba(60,20,50,0.55)');
  g.addColorStop(1, 'rgba(60,20,50,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const spiralCache = new Map<string, THREE.Texture>();
/** Spiral swirl texture for the giant lollipops. */
export function getSpiralTexture(a: string, b: string): THREE.Texture {
  const key = a + b;
  const hit = spiralCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 256, 256);
  ctx.translate(128, 128);
  ctx.fillStyle = a;
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.02) {
      const ang = arm * (Math.PI / 2) + t * Math.PI * 2.4;
      ctx.lineTo(Math.cos(ang) * t * 130, Math.sin(ang) * t * 130);
    }
    for (let t = 1; t >= 0; t -= 0.02) {
      const ang = arm * (Math.PI / 2) + t * Math.PI * 2.4 + 0.55;
      ctx.lineTo(Math.cos(ang) * t * 130, Math.sin(ang) * t * 130);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  spiralCache.set(key, tex);
  return tex;
}

// ---------- misc shared jar extras ----------
let misc: {
  shadowPlane: Geo;
  glowPlane: Geo;
  arrow: Geo;
  shadowMat: THREE.MeshBasicMaterial;
  arrowMat: THREE.MeshStandardMaterial;
  hitMat: THREE.MeshBasicMaterial;
} | null = null;

export function getJarExtras() {
  if (misc) return misc;
  const shadowPlane = new THREE.PlaneGeometry(2.1, 2.1);
  shadowPlane.rotateX(-Math.PI / 2);
  misc = {
    shadowPlane,
    glowPlane: new THREE.PlaneGeometry(2.6, 4.4),
    arrow: new THREE.ConeGeometry(0.22, 0.42, 4),
    shadowMat: new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    arrowMat: new THREE.MeshStandardMaterial({ color: '#5be37d', emissive: '#2fae55', emissiveIntensity: 0.5 }),
    hitMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  };
  return misc;
}
