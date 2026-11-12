import { useMemo } from 'react';
import { jarSlots, type JarSlot } from '../game';
import { useGame } from '../store/gameStore';

export function useJarSlots(): JarSlot[] {
  const count = useGame((s) => s.jars.length);
  return useMemo(() => jarSlots(count), [count]);
}
