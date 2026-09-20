import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickActionCardProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  accentClassName?: string;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ to, icon, title, description, accentClassName }) => (
  <Link to={to} className="group block h-full rounded-[18px] focus-visible:outline-none">
    <div className="surface-card-hover flex h-full items-center gap-4 p-5">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', accentClassName ?? 'bg-primary/15 text-primary')}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{title}</h3>
        <p className="truncate text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </div>
  </Link>
);

export default QuickActionCard;
