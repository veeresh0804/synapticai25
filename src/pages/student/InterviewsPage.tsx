import React, { useEffect, useState } from 'react';
import { Calendar, Clock, Video, ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

interface Interview {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  notes: string | null;
  status: string;
  job_title?: string;
  company_name?: string;
}

const InterviewsPage: React.FC = () => {
  const { studentProfile } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentProfile?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('interviews')
        .select('*')
        .eq('student_id', studentProfile.id)
        .order('scheduled_at', { ascending: true });

      if (data && data.length > 0) {
        const jobIds = [...new Set(data.map(d => d.job_id))];

        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, recruiters(company_name)')
          .in('id', jobIds);

        const enriched = data.map(iv => {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const job = (jobs as any[])?.find(j => j.id === iv.job_id);
          return {
            ...iv,
            job_title: job?.title || 'Position',
            company_name: job?.recruiters?.company_name || 'Company',
          };
        });
        setInterviews(enriched);
      }
      setIsLoading(false);
    };
    fetch();
  }, [studentProfile?.id]);

  const statusVariant = (s: string) => {
    if (s === 'scheduled') return 'default';
    if (s === 'completed') return 'secondary';
    if (s === 'cancelled') return 'destructive';
    return 'outline';
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          eyebrow="Schedule"
          title="My Interviews"
          description="View and join your scheduled recruiter interviews."
          backTo="/student/dashboard"
          backLabel="Back to dashboard"
        />

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : interviews.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={<Calendar className="w-6 h-6" />}
              title="No interviews scheduled yet"
              description="You'll see them here once a recruiter schedules one."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map(iv => {
              const d = new Date(iv.scheduled_at);
              const isInvalidDate = isNaN(d.getTime());
              return (
                <div key={iv.id} className="surface-card animate-rise p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px] bg-primary/10 text-primary" aria-hidden>
                        <span className="text-[11px] font-semibold uppercase">{isInvalidDate ? 'TBD' : format(d, 'MMM')}</span>
                        <span className="text-lg font-bold leading-none">{isInvalidDate ? '-' : format(d, 'dd')}</span>
                      </div>
                      
                      <div className="space-y-2 min-w-0">
                        <div>
                          <h3 className="font-display font-semibold text-lg break-words">{iv.job_title}</h3>
                          <p className="text-sm font-medium text-muted-foreground">{iv.company_name}</p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            {isInvalidDate ? 'Date TBD' : format(d, 'EEEE, MMMM do, yyyy')}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4" />
                            {isInvalidDate ? 'Time TBD' : format(d, 'p')} Â· {iv.duration_minutes}min
                          </span>
                        </div>
                        
                        {iv.meeting_link && (
                          <div className="mt-2">
                            <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                              <Video className="w-4 h-4" /> Join Meeting <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                        {iv.notes && <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mt-3">{iv.notes}</p>}
                      </div>
                    </div>
                    
                    <div className="shrink-0">
                      <Badge variant={statusVariant(iv.status)} className="capitalize">{iv.status}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default InterviewsPage;
