import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ScoreRingProps {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  tone?: 'primary' | 'success' | 'danger';
  className?: string;
}

const TONE_STROKE: Record<NonNullable<ScoreRingProps['tone']>, string> = {
  primary: 'stroke-primary',
  success: 'stroke-success',
  danger: 'stroke-destructive',
};

function toneFor(value: number): NonNullable<ScoreRingProps['tone']> {
  if (value >= 75) return 'success';
  if (value >= 50) return 'primary';
  return 'danger';
}

/** Animated circular score indicator with screen-reader text. */
const ScoreRing: React.FC<ScoreRingProps> = ({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  tone,
  className,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const activeTone = tone || toneFor(clamped);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const offset = circumference - (mounted ? clamped / 100 : 0) * circumference;

  return (
    <div
      className={cn('inline-flex flex-col items-center gap-1', className)}
      role="img"
      aria-label={`${label || 'Score'}: ${clamped} out of 100`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-muted"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(TONE_STROKE[activeTone], 'transition-[stroke-dashoffset] duration-700 ease-out')}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-bold leading-none">{clamped}%</span>
          {sublabel && <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{sublabel}</span>}
        </div>
      </div>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
    </div>
  );
};

export default ScoreRing;
