import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const SectionCard: React.FC<SectionCardProps> = ({ icon, title, action, children, className, contentClassName }) => (
  <Card className={cn('surface-card animate-rise', className)}>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center justify-between gap-2 text-lg">
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{title}</span>
        </span>
        {action}
      </CardTitle>
    </CardHeader>
    <CardContent className={contentClassName}>{children}</CardContent>
  </Card>
);

export default SectionCard;
