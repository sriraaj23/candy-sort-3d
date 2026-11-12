import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { sfx } from '../audio/engine';

type Variant = 'pink' | 'green' | 'yellow' | 'blue' | 'white' | 'purple';

const VARIANTS: Record<Variant, string> = {
  pink: 'from-[#ff7eb3] to-[#ff4f93] shadow-[0_6px_0_#c42f6c] text-white',
  green: 'from-[#7ee68a] to-[#3fc35a] shadow-[0_6px_0_#259043] text-white',
  yellow: 'from-[#ffe27a] to-[#ffbf2e] shadow-[0_6px_0_#d18c0f] text-[#7a3b00]',
  blue: 'from-[#8fd6ff] to-[#3fa8f0] shadow-[0_6px_0_#1f78b8] text-white',
  purple: 'from-[#c6a2ff] to-[#9b5cff] shadow-[0_6px_0_#6c34c4] text-white',
  white: 'from-white to-[#fff0f6] shadow-[0_6px_0_#e7a8c4] text-pink-600',
};

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
  size?: 'md' | 'lg';
  ariaLabel?: string;
}

/** Chunky candy button; plays the click sound. */
export function CandyButton({ children, onClick, variant = 'pink', disabled, className = '', size = 'md', ariaLabel }: ButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.95, y: 3 }}
      onClick={() => {
        if (disabled) return;
        sfx('click');
        onClick?.();
      }}
      className={`relative flex min-h-[48px] select-none items-center justify-center gap-2 rounded-full bg-gradient-to-b px-6 font-display font-extrabold tracking-wide ${
        size === 'lg' ? 'min-h-[64px] px-10 text-3xl' : 'text-lg'
      } ${VARIANTS[variant]} ${disabled ? 'cursor-not-allowed opacity-45 saturate-50' : 'cursor-pointer'} ${className}`}
    >
      <span className="pointer-events-none absolute inset-x-4 top-1 h-1/3 rounded-full bg-white/30" />
      <span className="relative flex items-center gap-2">{children}</span>
    </motion.button>
  );
}

export function IconButton({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        sfx('click');
        onClick();
      }}
      className={`icon-btn ${disabled ? 'opacity-40' : ''}`}
    >
      {children}
    </motion.button>
  );
}

/** Original coin glyph: a gold disc with a candy swirl. */
export function CoinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#ffc93c" stroke="#e59a12" strokeWidth="3" />
      <path d="M16 9a7 7 0 1 1-6.6 9.3M16 13a3 3 0 1 1-2.8 4" fill="none" stroke="#fff4c2" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Number that counts smoothly to its new value. */
export function AnimatedNumber({ value, onTick }: { value: number; onTick?: () => void }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    let last = Math.round(mv.get());
    const controls = animate(mv, value, {
      duration: Math.min(1.2, Math.abs(value - mv.get()) / 40 + 0.25),
      ease: 'easeOut',
      onUpdate: (v) => {
        const r = Math.round(v);
        if (onTick && r !== last && r % 2 === 0) onTick();
        last = r;
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <motion.span>{rounded}</motion.span>;
}

export function Stars({ count, size = 18, className = '' }: { count: number; size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-0.5 ${className}`}>
      {[0, 1, 2].map((i) => (
        <StarGlyph key={i} filled={i < count} size={size} />
      ))}
    </span>
  );
}

export function StarGlyph({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z"
        fill={filled ? '#ffd23f' : '#f3d9e5'}
        stroke={filled ? '#e59a12' : '#e2b8cb'}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
