import React from 'react';
import { cn } from '@/lib/utils';

/** Centered 1280px page container with 72px-navbar offset + 42px content gap. */
const PageShell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className="relative min-h-screen pb-12">
    {/* Subtle atmospheric radial gradient near the page header */}
    <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background" aria-hidden="true" />
    <div className={cn('page-shell relative z-10 pt-[114px]', className)}>{children}</div>
  </div>
);

export default PageShell;
