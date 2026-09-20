import React from 'react';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const CompanyAvatar: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <div
    aria-hidden
    className={cn(
      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 font-display text-base font-bold text-primary',
      className,
    )}
  >
    {initials(name)}
  </div>
);

export default CompanyAvatar;
