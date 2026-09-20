import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SkillChipProps {
  skill: string;
  tone?: 'have' | 'missing' | 'neutral';
  showIcon?: boolean;
  className?: string;
}

const SkillChip: React.FC<SkillChipProps> = ({ skill, tone = 'neutral', showIcon = false, className }) => {
  if (tone === 'have') {
    return (
      <Badge className={cn('gap-1 border border-success/30 bg-success/10 font-medium text-success', className)}>
        {showIcon && <CheckCircle2 className="h-3 w-3" aria-hidden />}
        {skill}
      </Badge>
    );
  }
  if (tone === 'missing') {
    return (
      <Badge variant="outline" className={cn('gap-1 border-destructive/40 font-medium text-destructive', className)}>
        {showIcon && <AlertCircle className="h-3 w-3" aria-hidden />}
        {skill}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={className}>
      {skill}
    </Badge>
  );
};

export default SkillChip;
