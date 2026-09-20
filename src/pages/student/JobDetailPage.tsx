import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Clock, CheckCircle2, Target, Sparkles, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PageShell from '@/components/shared/PageShell';
import CompanyAvatar from '@/components/student/CompanyAvatar';
import SkillChip from '@/components/student/SkillChip';
import EmptyState from '@/components/shared/EmptyState';

interface JobDetail {
  id: string;
  title: string;
  description: string;
  location: string;
  job_type: string;
  experience_required: string | null;
  required_skills: string[];
  preferred_skills: string[] | null;
  salary_range: string | null;
  recruiters: { company_name: string } | null;
}

const JobDetailPage: React.FC = () => {
  const { jobId } = useParams();
  const { studentProfile } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    const fetchJob = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, description, location, job_type, experience_required, required_skills, preferred_skills, salary_range, recruiters(company_name)')
        .eq('id', jobId)
        .single();
      setJob(data as unknown as JobDetail | null);
      setIsLoading(false);
    };
    fetchJob();

    // Check if already applied
    if (studentProfile?.id) {
      supabase
      // Legacy table not present in generated Supabase types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('student_applications' as any)
        .select('id')
        .eq('job_id', jobId)
        .eq('student_id', studentProfile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setHasApplied(true);
        });
    }
  }, [jobId, studentProfile?.id]);

  const handleApply = async () => {
    if (!studentProfile?.id || !jobId) {
      toast({ title: 'Please complete your profile first', variant: 'destructive' });
      return;
    }
    if (!studentProfile.profile_complete) {
      toast({ title: 'Incomplete profile', description: 'Please complete your profile before applying.', variant: 'destructive' });
      return;
    }
    setIsApplying(true);
    const { error } = await supabase.from('applications').insert({
      job_id: jobId,
      student_id: studentProfile.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Already applied to this job' });
      } else {
        toast({ title: 'Error applying', description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: 'Application submitted!', description: 'You can track it in My Applications.' });
      setHasApplied(true);
    }
    setIsApplying(false);
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="surface-card animate-pulse p-8" aria-label="Loading job details">
          <div className="h-8 w-2/3 rounded bg-muted" />
          <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
          <div className="mt-6 space-y-2">
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-4 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </PageShell>
    );
  }

  if (!job) {
    return (
      <PageShell>
        <div className="surface-card">
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title="Job not found"
            description="This opening may have been closed or removed."
            actionLabel="Back to jobs"
            actionTo="/student/jobs"
          />
        </div>
      </PageShell>
    );
  }

  const company = job.recruiters?.company_name || 'Company';
  const required = job.required_skills ?? [];
  const preferred = job.preferred_skills ?? [];

  return (
    <PageShell>
      <Link to="/student/jobs">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden /> Back to jobs
        </Button>
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Main column */}
        <article className="surface-card animate-rise min-w-0 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <CompanyAvatar name={company} className="h-14 w-14 text-lg" />
            <div className="min-w-0">
              <h1 className="break-words font-display text-2xl font-bold leading-tight md:text-3xl">{job.title}</h1>
              <p className="mt-1 font-semibold text-muted-foreground">{company}</p>
            </div>
          </div>

          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden />{job.location}</span>
            <span className="capitalize">{job.job_type}</span>
            {job.experience_required && <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden />{job.experience_required}</span>}
          </p>
          {job.salary_range && (
            <p className="mt-3 flex items-center gap-1.5 font-display text-lg font-bold">
              <IndianRupee className="h-5 w-5 text-primary" aria-hidden />{job.salary_range}
            </p>
          )}

          <section className="mt-8" aria-label="Job description">
            <h2 className="mb-2 font-display text-lg font-bold">Job description</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{job.description}</p>
          </section>

          <section className="mt-6" aria-label="Required skills">
            <h2 className="mb-3 font-display text-lg font-bold">Required skills</h2>
            <div className="flex flex-wrap gap-2">
              {required.map((skill, i) => (
                <SkillChip key={`${skill}-${i}`} skill={skill} />
              ))}
            </div>
          </section>

          {preferred.length > 0 && (
            <section className="mt-6" aria-label="Preferred skills">
              <h2 className="mb-3 font-display text-lg font-bold">Preferred skills</h2>
              <div className="flex flex-wrap gap-2">
                {preferred.map((skill, i) => (
                  <SkillChip key={`${skill}-${i}`} skill={skill} />
                ))}
              </div>
            </section>
          )}
        </article>

        {/* Sticky match card */}
        <aside className="surface-card animate-rise p-6 lg:sticky lg:top-[114px]" aria-label="Your match">
          <p className="eyebrow mb-3">Your match</p>
          <div className="surface-soft rounded-[14px] p-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>
                Run the AI eligibility check to see your real match score and a personalized
                plan for the {required.length > 0 ? `${required.length} required skills` : 'requirements'} above.
              </span>
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <Button className="btn-primary w-full gap-2" onClick={handleApply} disabled={isApplying || hasApplied}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {hasApplied ? 'Already applied' : isApplying ? 'Applyingâ€¦' : 'Apply now'}
            </Button>
            <Link to={`/student/jobs/${jobId}/eligibility`} className="block">
              <Button variant="outline" className="w-full gap-2">
                <Target className="h-4 w-4" aria-hidden /> Check eligibility
              </Button>
            </Link>
          </div>

          {hasApplied && (
            <p className="mt-3 rounded-lg bg-success/10 p-3 text-center text-xs font-semibold text-success">
              Application submitted â€” track it in My Applications.
            </p>
          )}

          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">At a glance</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Company</dt><dd className="truncate font-semibold">{company}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Location</dt><dd className="font-semibold">{job.location}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Type</dt><dd className="font-semibold capitalize">{job.job_type}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Skills</dt><dd className="font-semibold">{required.length + preferred.length}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{job.job_type}</Badge>
              {job.experience_required && <Badge variant="outline">{job.experience_required}</Badge>}
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
};

export default JobDetailPage;
