import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, actionTo, onAction, className }) => (
  <div className={cn('flex flex-col items-center px-4 py-10 text-center', className)}>
    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      {icon}
    </div>
    <h3 className="font-semibold">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {actionLabel && actionTo && (
      <Link to={actionTo} className="mt-4">
        <Button className="btn-primary" size="sm">{actionLabel}</Button>
      </Link>
    )}
    {actionLabel && !actionTo && onAction && (
      <Button className="btn-primary mt-4" size="sm" onClick={onAction}>{actionLabel}</Button>
    )}
  </div>
);

export default EmptyState;
