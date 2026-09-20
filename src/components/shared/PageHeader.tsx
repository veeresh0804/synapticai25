import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  backTo,
  backLabel = 'Back',
  actions,
  className,
}) => (
  <div className={cn('mb-8', className)}>
    {backTo && (
      <Link to={backTo}>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> {backLabel}
        </Button>
      </Link>
    )}
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>
);

export default PageHeader;
