import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  hint?: string;
  iconClassName?: string;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, value, label, hint, iconClassName, className }) => (
  <div className={cn('surface-card animate-rise p-5', className)}>
    <div className="flex items-center gap-4">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', iconClassName ?? 'bg-primary/15 text-primary')}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  </div>
);

export default StatCard;
