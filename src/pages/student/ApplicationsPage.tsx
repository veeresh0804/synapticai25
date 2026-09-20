import React, { useEffect, useState } from 'react';
import { FileSearch, Clock, CheckCircle2, XCircle, Building2, Calendar, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';

interface ApplicationWithJob {
  id: string;
  status: string;
  applied_at: string;
  jobs: { title: string; recruiters: { company_name: string } | null } | null;
}

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', class: 'badge-warning', icon: Clock },
  under_review: { label: 'Under Review', class: 'badge-primary', icon: FileSearch },
  shortlisted: { label: 'Shortlisted', class: 'badge-success', icon: CheckCircle2 },
  rejected: { label: 'Rejected', class: 'badge-destructive', icon: XCircle },
  interview: { label: 'Interview', class: 'badge-success', icon: Calendar },
  interview_scheduled: { label: 'Interview', class: 'badge-success', icon: Calendar },
  offered: { label: 'Offered', class: 'badge-success', icon: CheckCircle2 },
  hired: { label: 'Hired', class: 'badge-success', icon: CheckCircle2 },
};

const ApplicationsPage: React.FC = () => {
  const { studentProfile } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentProfile?.id) return;
    const fetchApps = async () => {
      const { data } = await supabase
        .from('student_applications' as any)
        .select('id, status, applied_at, jobs(title, recruiters(company_name))')
        .eq('student_id', studentProfile.id)
        .order('applied_at', { ascending: false });
      setApplications((data ?? []) as unknown as ApplicationWithJob[]);
      setIsLoading(false);
    };
    fetchApps();
  }, [studentProfile?.id]);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    return `${Math.floor(days / 7)} weeks ago`;
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          eyebrow="Tracking"
          title="My Applications"
          description="Track the status of your job applications."
          backTo="/student/dashboard"
          backLabel="Back to dashboard"
        />

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="surface-card">
            <EmptyState
              icon={<FileSearch className="w-6 h-6" />}
              title="No applications yet"
              description="Browse jobs to get started!"
              actionLabel="Browse Jobs"
              actionTo="/student/jobs"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => {
              const config = statusConfig[app.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <div key={app.id} className="surface-card animate-rise p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-display font-semibold text-lg truncate">{app.jobs?.title || 'Job'}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        {app.jobs?.recruiters?.company_name || 'Company'} Â· Applied {timeAgo(app.applied_at)}
                      </p>
                    </div>
                    <Badge className={config.class}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {config.label}
                    </Badge>
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

export default ApplicationsPage;
