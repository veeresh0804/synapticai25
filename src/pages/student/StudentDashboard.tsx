import React, { useEffect, useState } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';
import {
  Briefcase, FileSearch, CheckCircle2, Clock, TrendingUp,
  ArrowRight, Building2, MapPin, Star, AlertCircle, Calendar, XCircle, Video,
  Sparkles, ShieldCheck, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { APPLICATION_STATUS } from '@/lib/constants';
import PageShell from '@/components/shared/PageShell';
import ScoreRing from '@/components/student/ScoreRing';
import StatCard from '@/components/student/StatCard';
import SectionCard from '@/components/shared/SectionCard';
import QuickActionCard from '@/components/student/QuickActionCard';
import JobCard from '@/components/student/JobCard';
import EmptyState from '@/components/shared/EmptyState';

/** Joined shapes returned by Supabase .select() with nested relations */
interface AppWithJob {
  id: string;
  status: string;
  applied_at: string;
  jobs: { title: string; recruiters: { company_name: string } | null } | null;
}

interface InterviewWithJob {
  id: string;
  scheduled_at: string;
  duration_minutes: number | null;
  meeting_link: string | null;
  status: string;
  jobs: { title: string; recruiters: { company_name: string } | null } | null;
}

interface JobWithRecruiter {
  id: string;
  title: string;
  location: string;
  job_type: string;
  description: string | null;
  experience_required: string | null;
  salary_range: string | null;
  required_skills: string[];
  created_at: string;
  recruiters: { company_name: string } | null;
}

const StudentDashboard: React.FC = () => {
  const { studentProfile } = useAuth();
  const profileStrength = studentProfile?.profile_complete ? 85 : 35;

type Job = Database['public']['Tables']['jobs']['Row'];
type Interview = Database['public']['Tables']['interviews']['Row'];
type Application = Database['public']['Tables']['applications']['Row'];

  const [stats, setStats] = useState({ total: 0, pending: 0, shortlisted: 0, rejected: 0, interview: 0 });
  const [recentJobs, setRecentJobs] = useState<JobWithRecruiter[]>([]);
  const [upcomingInterviews, setUpcomingInterviews] = useState<InterviewWithJob[]>([]);
  const [recentApps, setRecentApps] = useState<AppWithJob[]>([]);

  useEffect(() => {
    if (!studentProfile?.id) return;

    // Fetch application stats
    supabase
      // Legacy table not present in generated Supabase types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('student_applications' as any)
      .select('id, status, applied_at, jobs(title, recruiters(company_name))')
      .eq('student_id', studentProfile.id)
      .order('applied_at', { ascending: false })
      .then(({ data }) => {
        const apps = (data ?? []) as unknown as AppWithJob[];
        setStats({
          total: apps.length,
          pending: apps.filter(a => a.status === APPLICATION_STATUS.PENDING || a.status === APPLICATION_STATUS.UNDER_REVIEW).length,
          shortlisted: apps.filter(a => a.status === APPLICATION_STATUS.SHORTLISTED).length,
          rejected: apps.filter(a => a.status === APPLICATION_STATUS.REJECTED).length,
          interview: apps.filter(a => a.status === APPLICATION_STATUS.INTERVIEW_SCHEDULED).length,
        });
        setRecentApps(apps.slice(0, 5));
      });

    // Fetch upcoming interviews
    supabase
      .from('interviews')
      .select('id, scheduled_at, duration_minutes, meeting_link, status, jobs(title, recruiters(company_name))')
      .eq('student_id', studentProfile.id)
      .gte('scheduled_at', new Date().toISOString())
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(3)
      .then(({ data }) => setUpcomingInterviews((data ?? []) as unknown as InterviewWithJob[]));

    // Fetch recent jobs
    supabase
      .from('jobs')
      .select('id, title, location, job_type, description, experience_required, salary_range, required_skills, created_at, recruiters(company_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => setRecentJobs((data ?? []) as unknown as JobWithRecruiter[]));
  }, [studentProfile?.id]);

  const firstName = (studentProfile?.name || 'Student').split(' ')[0];
  const nextAction = !studentProfile?.profile_complete
    ? { title: 'Verify your GitHub profile', text: 'Recruiters shortlist candidates with real, verifiable work. Connect GitHub and run AI analysis.', to: '/student/profile', cta: 'Verify now' }
    : stats.total === 0
      ? { title: 'Apply to your first role', text: 'Your profile is ready. Browse open roles and check your eligibility before applying.', to: '/student/jobs', cta: 'Browse jobs' }
      : { title: 'Build your career path', text: 'Turn your applications into offers with a focused 6-month learning plan.', to: '/student/career-path', cta: 'View plan' };

  return (
    <PageShell>
      {/* Hero */}
      <section className="surface-card animate-rise mb-6 grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Student dashboard</p>
          <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 truncate text-sm font-medium text-muted-foreground">
            {studentProfile?.institution || 'University'} â€¢ {studentProfile?.degree} {studentProfile?.branch}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Build stronger proof for your next opportunity. Verified skills and real projects
            move you from applicant to shortlist.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/student/jobs">
              <Button className="btn-primary gap-2">
                <Briefcase className="h-5 w-5" aria-hidden /> Browse jobs
              </Button>
            </Link>
            <Link to="/student/profile">
              <Button variant="outline" className="gap-2">
                <TrendingUp className="h-4 w-4" aria-hidden /> Improve profile
              </Button>
            </Link>
          </div>
        </div>
        <div className="surface-soft flex items-center justify-center gap-5 rounded-[14px] p-5">
          <ScoreRing value={profileStrength} size={112} sublabel="Match" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-display text-lg font-bold leading-snug">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden /> AI readiness
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Profile strength</p>
            <Progress value={profileStrength} className="mt-2 h-2 w-36" aria-label={`Profile strength ${profileStrength} percent`} />
            {!studentProfile?.profile_complete && (
              <Link to="/student/profile" className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <AlertCircle className="h-3 w-3" aria-hidden /> Complete your profile
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section aria-label="Application statistics" className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<FileSearch className="h-6 w-6" aria-hidden />} value={stats.total} label="Applications" hint="+1 this week" />
        <StatCard icon={<Clock className="h-6 w-6" aria-hidden />} value={stats.pending} label="Pending" hint="Needs review" iconClassName="bg-warning/15 text-warning" />
        <StatCard icon={<CheckCircle2 className="h-6 w-6" aria-hidden />} value={stats.shortlisted} label="Shortlisted" hint="Keep building" iconClassName="bg-success/15 text-success" />
        <StatCard icon={<Star className="h-6 w-6" aria-hidden />} value={`${profileStrength}%`} label="Profile strength" hint={studentProfile?.profile_complete ? 'Verified' : 'Incomplete'} iconClassName="bg-info/15 text-info" />
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions" className="mb-6">
        <h2 className="mb-3 font-display text-lg font-bold">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard to="/student/profile" icon={<ShieldCheck className="h-6 w-6" aria-hidden />} title="Complete your profile" description="Add proof links" />
          <QuickActionCard to="/student/career-path" icon={<Star className="h-6 w-6" aria-hidden />} title="Build career path" description="Recommended for you" accentClassName="bg-success/15 text-success" />
          <QuickActionCard to="/student/portfolio" icon={<TrendingUp className="h-6 w-6" aria-hidden />} title="Create AI portfolio" description="Share verified work" accentClassName="bg-info/15 text-info" />
          <QuickActionCard to="/student/interview-sim" icon={<Briefcase className="h-6 w-6" aria-hidden />} title="Mock interview" description="Practice with AI" accentClassName="bg-warning/15 text-warning" />
        </div>
      </section>

      {/* Interviews + tracker */}
      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          icon={<Calendar className="h-5 w-5 text-primary" aria-hidden />}
          title="Upcoming interviews"
          action={<Link to="/student/interviews"><Button variant="ghost" size="sm" className="gap-1 text-primary">View all <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>}
        >
          {upcomingInterviews.length === 0 ? (
            <EmptyState
              icon={<Video className="h-6 w-6" aria-hidden />}
              title="No interviews yet"
              description="When a recruiter schedules you, it appears here. Sharpen your answers meanwhile."
              actionLabel="Practice a mock interview"
              actionTo="/student/interview-sim"
            />
          ) : (
            <ul className="space-y-3">
              {upcomingInterviews.map((interview) => {
                const date = new Date(interview.scheduled_at);
                return (
                  <li key={interview.id} className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/30">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                      <span className="text-[11px] font-semibold">{date.toLocaleDateString('en', { month: 'short' })}</span>
                      <span className="text-lg font-bold leading-none">{date.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-semibold">{interview.jobs?.title || 'Interview'}</h4>
                      <p className="truncate text-xs text-muted-foreground">{interview.jobs?.recruiters?.company_name || 'Company'} â€¢ {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {interview.meeting_link && (
                      <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1"><Video className="h-3 w-3" aria-hidden /> Join</Button>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          icon={<FileSearch className="h-5 w-5 text-primary" aria-hidden />}
          title="Application tracker"
          action={<Link to="/student/applications"><Button variant="ghost" size="sm" className="gap-1 text-primary">View all <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>}
        >
          <dl className="mb-4 grid grid-cols-2 gap-2.5">
            {[
              { icon: <Clock className="h-4 w-4 text-warning" aria-hidden />, v: stats.pending, l: 'Pending' },
              { icon: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />, v: stats.shortlisted, l: 'Shortlisted' },
              { icon: <Calendar className="h-4 w-4 text-primary" aria-hidden />, v: stats.interview, l: 'Interviews' },
              { icon: <XCircle className="h-4 w-4 text-destructive" aria-hidden />, v: stats.rejected, l: 'Rejected' },
            ].map((s) => (
              <div key={s.l} className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5">
                {s.icon}
                <div><dt className="sr-only">{s.l}</dt><dd className="text-lg font-bold leading-none">{s.v}</dd><dd className="text-xs text-muted-foreground">{s.l}</dd></div>
              </div>
            ))}
          </dl>
          {recentApps.length > 0 ? (
            <div className="space-y-2">
              <p className="eyebrow">Recent applications</p>
              <ul>
                {recentApps.slice(0, 3).map((app) => (
                  <li key={app.id} className="flex items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
                    <span className="truncate font-medium">{app.jobs?.title || 'Job'}</span>
                    <Badge variant={app.status === 'shortlisted' ? 'default' : app.status === 'rejected' ? 'destructive' : 'secondary'} className="shrink-0 text-xs capitalize">{app.status?.replaceAll('_', ' ')}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState
              icon={<Inbox className="h-6 w-6" aria-hidden />}
              title="No applications yet"
              description="Browse open roles and submit your first application."
              actionLabel="Browse jobs"
              actionTo="/student/jobs"
            />
          )}
        </SectionCard>
      </section>

      {/* Next best action */}
      <section className="surface-card animate-rise mb-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Sparkles className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-1">Your next best action</p>
          <h2 className="font-display text-xl font-bold">{nextAction.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{nextAction.text}</p>
        </div>
        <Link to={nextAction.to} className="shrink-0">
          <Button className="btn-primary w-full gap-2 sm:w-auto">{nextAction.cta} <ArrowRight className="h-4 w-4" aria-hidden /></Button>
        </Link>
      </section>

      {/* Recent jobs */}
      <SectionCard
        icon={<Briefcase className="h-5 w-5 text-primary" aria-hidden />}
        title="Latest job openings"
        action={<Link to="/student/jobs"><Button variant="ghost" size="sm" className="gap-1 text-primary">View all <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>}
      >
        {recentJobs.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" aria-hidden />}
            title="No jobs available yet"
            description="New openings from verified recruiters will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {recentJobs.map((job) => (
              <JobCard
                key={job.id}
                job={{
                  id: job.id,
                  title: job.title,
                  company: job.recruiters?.company_name || 'Company',
                  location: job.location,
                  jobType: job.job_type,
                  experience: job.experience_required,
                  description: job.description,
                  skills: job.required_skills ?? [],
                  salary: job.salary_range,
                }}
              />
            ))}
          </div>
        )}
        <p className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          Showing the 4 most recent openings â€” <Link to="/student/jobs" className="font-semibold text-primary hover:underline">browse all jobs</Link>
        </p>
      </SectionCard>
    </PageShell>
  );
};

export default StudentDashboard;
