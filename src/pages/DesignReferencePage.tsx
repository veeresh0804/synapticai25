import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileSearch, Clock, CheckCircle2, Star, ArrowLeft } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import ScoreRing from '@/components/student/ScoreRing';
import StatCard from '@/components/student/StatCard';
import SectionCard from '@/components/shared/SectionCard';
import QuickActionCard from '@/components/student/QuickActionCard';
import SkillChip from '@/components/student/SkillChip';
import JobCard from '@/components/student/JobCard';
import RoadmapStep from '@/components/student/RoadmapStep';
import EmptyState from '@/components/shared/EmptyState';
import PlatformRow from '@/components/student/PlatformRow';
import { Button } from '@/components/ui/button';
import { Github, Code2, Linkedin } from 'lucide-react';

/**
 * DEV-ONLY visual reference gallery. Rendered at /design-reference in
 * development builds only â€” never registered in production routing.
 * Uses the real shared components with realistic static data so all five
 * student artboards can be compared side by side for styling consistency.
 */
const SAMPLE_JOB = {
  id: 'sample-job-1',
  title: 'Backend Developer (Node.js)',
  company: 'Razorpay',
  location: 'Hyderabad',
  jobType: 'Full-time',
  experience: '1â€“3 years',
  description: 'Build and ship production backend systems with a collaborative engineering team.',
  skills: ['Node.js', 'PostgreSQL', 'REST APIs', 'Redis', 'Docker'],
  salary: 'â‚¹8â€“14 LPA',
  matchScore: 82,
};

const Artboard: React.FC<{ n: string; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section aria-label={`Artboard ${n}: ${title}`} className="mb-10">
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">{n}</span>
      <h2 className="font-display text-xl font-bold">{title}</h2>
    </div>
    <div className="surface-card space-y-4 p-5 sm:p-6">{children}</div>
  </section>
);

const DesignReferencePage: React.FC = () => (
  <PageShell>
    <PageHeader
      eyebrow="Design reference Â· dev only"
      title="Student visual system gallery"
      description="All artboards below render the real shared components. Compare spacing, hierarchy, and accents across screens."
      backTo="/"
      backLabel="Back home"
      actions={
        <Link to="/student/dashboard">
          <Button variant="outline" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" aria-hidden /> Live dashboard</Button>
        </Link>
      }
    />

    <Artboard n="1" title="Dashboard â€” hero, stats, actions">
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface-soft rounded-[14px] p-5">
          <p className="eyebrow mb-1">Student dashboard</p>
          <p className="font-display text-2xl font-bold">Welcome back, Venna</p>
          <p className="mt-1 text-sm text-muted-foreground">CMR College â€¢ B.Tech Computer Science</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <ScoreRing value={85} size={96} sublabel="Match" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<FileSearch className="h-6 w-6" aria-hidden />} value={2} label="Applications" hint="+1 this week" />
        <StatCard icon={<Clock className="h-6 w-6" aria-hidden />} value={2} label="Pending" hint="Needs review" iconClassName="bg-warning/15 text-warning" />
        <StatCard icon={<CheckCircle2 className="h-6 w-6" aria-hidden />} value={0} label="Shortlisted" hint="Keep building" iconClassName="bg-success/15 text-success" />
        <StatCard icon={<Star className="h-6 w-6" aria-hidden />} value="85%" label="Profile strength" hint="Verified" iconClassName="bg-info/15 text-info" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <QuickActionCard to="/student/profile" icon={<CheckCircle2 className="h-6 w-6" aria-hidden />} title="Complete your profile" description="Add proof links" />
        <QuickActionCard to="/student/career-path" icon={<Star className="h-6 w-6" aria-hidden />} title="Build career path" description="Recommended for you" accentClassName="bg-success/15 text-success" />
        <QuickActionCard to="/student/portfolio" icon={<Briefcase className="h-6 w-6" aria-hidden />} title="Create AI portfolio" description="Share verified work" accentClassName="bg-info/15 text-info" />
      </div>
    </Artboard>

    <Artboard n="2" title="Browse jobs â€” job card">
      <JobCard job={SAMPLE_JOB} />
      <div className="flex flex-wrap gap-2">
        <SkillChip skill="Node.js" />
        <SkillChip skill="Computer Science" tone="have" showIcon />
        <SkillChip skill="Docker" tone="missing" showIcon />
      </div>
    </Artboard>

    <Artboard n="3" title="Job detail â€” match card">
      <SectionCard title="Your match">
        <div className="flex items-center gap-4">
          <ScoreRing value={82} size={96} sublabel="Match" />
          <p className="text-sm text-muted-foreground">Strong match â€” Node.js and REST API experience align with this role.</p>
        </div>
      </SectionCard>
    </Artboard>

    <Artboard n="4" title="Eligibility â€” roadmap steps">
      <ol className="divide-y divide-border rounded-[14px] border border-border">
        <RoadmapStep index={0} title="Build a Node.js REST API" description="Create authentication, validation, and CRUD endpoints." duration="3 weeks" priority="high" action="Ship a deployed API with README and demo link." />
        <RoadmapStep index={1} title="Add PostgreSQL persistence" description="Design schemas, relationships, indexes, and migrations." duration="2 weeks" priority="medium" />
        <RoadmapStep index={2} title="Containerize with Docker" description="Run the app and database with Docker Compose." duration="2 weeks" priority="low" />
      </ol>
      <EmptyState
        icon={<Briefcase className="h-6 w-6" aria-hidden />}
        title="Empty states stay useful"
        description="Every empty state pairs helpful text with a next action."
        actionLabel="Example action"
        actionTo="/student/jobs"
      />
    </Artboard>

    <Artboard n="5" title="Profile â€” verification rows">
      <div className="max-w-md space-y-2">
        <PlatformRow icon={<Github className="h-5 w-5" aria-hidden />} name="GitHub" status="verified" hint="github.com/venna" />
        <PlatformRow icon={<Code2 className="h-5 w-5" aria-hidden />} name="LeetCode" status="connected" hint="leetcode.com/venna" />
        <PlatformRow icon={<Linkedin className="h-5 w-5" aria-hidden />} name="LinkedIn" status="missing" hint="Add your LinkedIn URL" />
      </div>
    </Artboard>
  </PageShell>
);

export default DesignReferencePage;
