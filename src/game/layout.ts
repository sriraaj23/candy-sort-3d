/** Jar layout in world units. Pure maths shared by the scene and tests. */
export const JAR_SPACING = 1.55;
export const ROW_DEPTH = 2.1; // back row z offset
export const ROW_LIFT = 2.35; // back row y offset (sits on a step)

export interface JarSlot {
  x: number;
  y: number;
  z: number;
  row: 0 | 1;
}

const cache = new Map<number, JarSlot[]>();

/** One row for up to 5 jars, otherwise two rows (back row gets the extra). Cached per count. */
export function jarSlots(count: number): JarSlot[] {
  let slots = cache.get(count);
  if (!slots) {
    slots = buildSlots(count);
    cache.set(count, slots);
  }
  return slots;
}

function buildSlots(count: number): JarSlot[] {
  if (count <= 5) {
    return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * JAR_SPACING, y: 0, z: 0, row: 0 as const }));
  }
  const back = Math.ceil(count / 2);
  const front = count - back;
  const slots: JarSlot[] = [];
  for (let i = 0; i < back; i++) slots.push({ x: (i - (back - 1) / 2) * JAR_SPACING, y: ROW_LIFT, z: -ROW_DEPTH, row: 1 });
  for (let i = 0; i < front; i++) slots.push({ x: (i - (front - 1) / 2) * JAR_SPACING, y: 0, z: 0, row: 0 });
  return slots;
}
