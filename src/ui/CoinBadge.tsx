import { useProgress } from '../store/progressStore';
import { AnimatedNumber, CoinIcon } from './controls';

export function CoinBadge({ compact }: { compact?: boolean }) {
  const coins = useProgress((s) => s.coins);
  return (
    <div
      className={`chip h-11 justify-center ${compact ? 'min-w-[64px] px-2 text-base' : 'min-w-[88px] text-lg'}`}
      aria-label={`${coins} coins`}
    >
      <CoinIcon />
      <AnimatedNumber value={coins} />
    </div>
  );
}
