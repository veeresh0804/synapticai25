import React from 'react';
import { ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface RoadmapResource {
  title: string;
  url?: string;
  type: string;
}

interface RoadmapStepProps {
  index: number;
  title: string;
  description?: string;
  duration?: string;
  priority?: string;
  action?: string;
  resources?: RoadmapResource[];
  onAction?: () => void;
  actionLabel?: string;
}

function priorityClasses(priority?: string): string {
  const p = (priority || '').toLowerCase();
  if (p === 'high') return 'border-destructive/30 bg-destructive/10 text-destructive';
  if (p === 'medium') return 'border-warning/30 bg-warning/10 text-warning';
  return 'border-success/30 bg-success/10 text-success';
}

const RoadmapStep: React.FC<RoadmapStepProps> = ({
  index,
  title,
  description,
  duration,
  priority,
  action,
  resources,
  onAction,
  actionLabel = 'Start step',
}) => (
  <li className="flex gap-4 p-5 sm:gap-5 sm:p-6">
    <div className="flex flex-col items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground" aria-hidden>
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="mt-2 w-px flex-1 bg-border" aria-hidden />
    </div>
    <div className="min-w-0 flex-1 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold leading-snug">{title}</h3>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {priority && <Badge className={priorityClasses(priority)}><span className="capitalize">{priority}</span>&nbsp;priority</Badge>}
        {duration && (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" aria-hidden /> {duration}
          </Badge>
        )}
      </div>
      {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action && (
        <p className="rounded-lg bg-muted/60 p-3 text-sm">
          <span className="font-semibold">Do this: </span>{action}
        </p>
      )}
      {resources && resources.length > 0 && (
        <ul className="space-y-1">
          {resources.map((r, i) => (
            <li key={`${r.title}-${i}`} className="text-sm">
              <Badge variant="secondary" className="mr-2 text-xs">{r.type}</Badge>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {r.title}
                </a>
              ) : (
                <span>{r.title}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {onAction && (
        <Button variant="outline" size="sm" className="gap-1" onClick={onAction}>
          {actionLabel} <ArrowRight className="h-3 w-3" aria-hidden />
        </Button>
      )}
    </div>
  </li>
);

export default RoadmapStep;
