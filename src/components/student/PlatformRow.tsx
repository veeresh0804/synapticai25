import React from 'react';
import { BadgeCheck, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PlatformRowProps {
  icon: React.ReactNode;
  name: string;
  status: 'verified' | 'connected' | 'missing';
  hint?: string;
}

const STATUS_META: Record<PlatformRowProps['status'], { label: string; className: string }> = {
  verified: { label: 'Verified', className: 'border-success/30 bg-success/10 text-success' },
  connected: { label: 'Connected', className: 'border-info/30 bg-info/10 text-info' },
  missing: { label: 'Not added', className: '' },
};

const PlatformRow: React.FC<PlatformRowProps> = ({ icon, name, status, hint }) => {
  const meta = STATUS_META[status];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {status === 'missing' ? (
        <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
          <Link2 className="h-3 w-3" aria-hidden /> {meta.label}
        </Badge>
      ) : (
        <Badge className={`shrink-0 gap-1 border ${meta.className}`}>
          <BadgeCheck className="h-3 w-3" aria-hidden /> {meta.label}
        </Badge>
      )}
    </div>
  );
};

export default PlatformRow;
