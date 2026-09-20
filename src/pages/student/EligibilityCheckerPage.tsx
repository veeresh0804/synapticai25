import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Sparkles, CheckCircle, XCircle, Target, BookOpen, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { logger } from '@/lib/logger';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import ScoreRing from '@/components/student/ScoreRing';
import SectionCard from '@/components/shared/SectionCard';
import SkillChip from '@/components/student/SkillChip';
import RoadmapStep from '@/components/student/RoadmapStep';
import EmptyState from '@/components/shared/EmptyState';

interface Resource {
  title: string;
  url?: string;
  type: string;
}

interface RawRoadmapItem {
  skill?: string;
  topic?: string;
  priority?: string;
  timeline?: string;
  duration?: string;
  resources?: Array<Resource | string>;
  description?: string;
  detail?: string;
  action?: string;
  project_idea?: string;
}

interface RoadmapItem {
  skill: string;
  priority: string;
  timeline: string;
  resources: Resource[];
  description: string;
  action: string;
}

interface EligibilityResult {
  match_percentage: number;
  verdict: string;
  verdict_detail: string;
  matched_skills: string[];
  missing_skills: string[];
  roadmap: RoadmapItem[];
  tips: string[];
}

// Curated fallback links so students always get clickable shortlist guidance
// even when the AI returns plain strings without URLs.
const SKILL_DOCS: Record<string, { title: string; url: string; type: string }[]> = {
  'node.js': [
    { title: 'Node.js Official Docs â€” Getting Started', url: 'https://nodejs.org/en/docs', type: 'docs' },
    { title: 'Express.js Guide â€” Build REST APIs', url: 'https://expressjs.com/en/starter/installing.html', type: 'course' },
  ],
  nodejs: [
    { title: 'Node.js Official Docs â€” Getting Started', url: 'https://nodejs.org/en/docs', type: 'docs' },
    { title: 'Express.js Guide â€” Build REST APIs', url: 'https://expressjs.com/en/starter/installing.html', type: 'course' },
  ],
  postgresql: [
    { title: 'PostgreSQL Tutorial â€” Learn SQL', url: 'https://www.postgresqltutorial.com/', type: 'course' },
    { title: 'PostgreSQL Official Docs', url: 'https://www.postgresql.org/docs/', type: 'docs' },
  ],
  postgres: [
    { title: 'PostgreSQL Tutorial â€” Learn SQL', url: 'https://www.postgresqltutorial.com/', type: 'course' },
    { title: 'PostgreSQL Official Docs', url: 'https://www.postgresql.org/docs/', type: 'docs' },
  ],
  'rest apis': [
    { title: 'REST API Tutorial â€” Design Principles', url: 'https://restfulapi.net/', type: 'docs' },
    { title: 'MDN â€” HTTP & REST Basics', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP', type: 'docs' },
  ],
  'rest api': [
    { title: 'REST API Tutorial â€” Design Principles', url: 'https://restfulapi.net/', type: 'docs' },
  ],
  redis: [
    { title: 'Redis University â€” Data Structures & Caching', url: 'https://university.redis.com/', type: 'course' },
    { title: 'Redis Docs â€” Quick Start', url: 'https://redis.io/docs/getting-started/', type: 'docs' },
  ],
  docker: [
    { title: 'Docker Get Started â€” Containerize an App', url: 'https://docs.docker.com/get-started/', type: 'docs' },
    { title: 'Docker Curriculum (Free Hands-on)', url: 'https://docker-curriculum.com/', type: 'course' },
  ],
};

function docsForSkill(skill: string): Resource[] {
  const key = skill.trim().toLowerCase();
  return (SKILL_DOCS[key] || []).map((r) => ({ ...r }));
}

function normalizeResource(res: Resource | string, skill: string): Resource | null {
  if (typeof res === 'string') {
    const title = res.trim();
    if (!title) return null;
    // If the string itself is a URL, keep it clickable.
    if (/^https?:\/\//i.test(title)) {
      return { title, url: title, type: 'link' };
    }
    // Try to attach a useful URL from curated docs when titles match loosely.
    const curated = docsForSkill(skill).find((d) =>
      d.title.toLowerCase().includes(title.toLowerCase().slice(0, 12)),
    );
    return { title, url: curated?.url, type: curated?.type || 'resource' };
  }
  const title = (res?.title || '').trim();
  if (!title) return null;
  return {
    title,
    url: res.url || docsForSkill(skill)[0]?.url,
    type: res.type || 'resource',
  };
}

// Handles both the old backend shape ({topic, timeline, resources: string[]})
// and the new shape ({skill, priority, timeline, description, resources: []}).
// Guarantees no blank cards â€” fills shortlist-focused defaults.
function normalizeRoadmap(raw: unknown, missingSkills: string[] = []): RoadmapItem[] {
  const list = Array.isArray(raw) ? (raw as RawRoadmapItem[]) : [];
  const normalized: RoadmapItem[] = list
    .filter((it) => it && typeof it === 'object')
    .map((it, idx) => {
      const skill = (it.skill || it.topic || '').trim() || missingSkills[idx] || `Skill gap ${idx + 1}`;
      const rawPriority = (it.priority || '').trim().toLowerCase();
      const priority =
        rawPriority === 'high' || rawPriority === 'medium' || rawPriority === 'low'
          ? rawPriority
          : idx === 0
            ? 'high'
            : idx === 1
              ? 'medium'
              : 'low';
      const timeline = (it.timeline || it.duration || '').trim() || (priority === 'high' ? '3 weeks' : '2 weeks');
      const description =
        (it.description || it.detail || '').trim() ||
        `Build production-level ${skill} skills recruiters screen for â€” complete the project below and add it to your resume/GitHub to lift shortlist chances.`;
      const action =
        (it.action || it.project_idea || '').trim() ||
        `Ship a small ${skill} project (with README + live demo link) and mention it in your application.`;
      const rawResources = Array.isArray(it.resources) ? it.resources : [];
      const resources = rawResources
        .map((r) => normalizeResource(r, skill))
        .filter((r): r is Resource => r !== null);
      const withFallback = resources.length > 0 ? resources : docsForSkill(skill);
      return { skill, priority, timeline, resources: withFallback, description, action };
    });

  // Fallback: if AI returned zero roadmap items but we know missing skills,
  // generate one card per missing skill so the student never sees a blank section.
  if (normalized.length === 0 && missingSkills.length > 0) {
    return missingSkills.slice(0, 5).map((skill, idx) => ({
      skill,
      priority: idx === 0 ? 'high' : idx === 1 ? 'medium' : 'low',
      timeline: idx === 0 ? '3 weeks' : '2 weeks',
      resources: docsForSkill(skill),
      description: `Recruiters for this role filter on ${skill}. Close this gap first to move from screening to shortlist.`,
      action: `Ship a small ${skill} project (with README + live demo link) and mention it in your application.`,
    }));
  }
  return normalized;
}

function normalizeResult(data: unknown): EligibilityResult {
  const d = (data || {}) as Record<string, unknown>;
  const matched = Array.isArray(d.matched_skills) ? (d.matched_skills as string[]) : [];
  const missing = Array.isArray(d.missing_skills) ? (d.missing_skills as string[]) : [];
  const tips = Array.isArray(d.tips) ? (d.tips as string[]) : [];
  return {
    match_percentage: typeof d.match_percentage === 'number' ? d.match_percentage : 0,
    verdict: typeof d.verdict === 'string' ? d.verdict : 'Analysis ready',
    verdict_detail: typeof d.verdict_detail === 'string' ? d.verdict_detail : '',
    matched_skills: matched.filter(Boolean),
    missing_skills: missing.filter(Boolean),
    roadmap: normalizeRoadmap(d.roadmap, missing.filter(Boolean)),
    tips,
  };
}

const EligibilityCheckerPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const { toast } = useToast();

  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const runCheck = async () => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('eligibility-check', {
        body: { job_id: jobId },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Check failed', description: describeEdgeError(data), variant: 'destructive' });
        return;
      }
      setResult(normalizeResult(data));
      setHasChecked(true);
    } catch (e: unknown) {
      logger.error(e);
      toast({ title: 'Error', description: describeEdgeError(e), variant: 'destructive' });
    } finally {
      setIsChecking(false);
    }
  };

  const scrollToRoadmap = () => {
    document.getElementById('learning-roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          eyebrow="Eligibility checker"
          title="See how you match this role"
          description="AI compares your verified profile against the job requirements and builds your improvement plan."
          backTo={`/student/jobs/${jobId}`}
          backLabel="Back to job"
          actions={
            <Button className="btn-primary gap-2" onClick={runCheck} disabled={isChecking}>
              {isChecking ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analyzingâ€¦</>
              ) : hasChecked ? (
                <><Sparkles className="h-4 w-4" aria-hidden /> Re-check eligibility</>
              ) : (
                <><Sparkles className="h-4 w-4" aria-hidden /> Check eligibility</>
              )}
            </Button>
          }
        />

        {!hasChecked && !isChecking && (
          <div className="surface-card">
            <EmptyState
              icon={<Target className="h-6 w-6" aria-hidden />}
              title="Check your fit"
              description="AI will analyze your profile against the job requirements and provide a personalized skill-gap roadmap."
              actionLabel="Check eligibility"
              onAction={runCheck}
            />
          </div>
        )}

        {isChecking && (
          <div className="surface-card">
            <EmptyState
              icon={<Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />}
              title="Analyzing your profileâ€¦"
              description="Comparing your skills and experience against the job requirements."
            />
          </div>
        )}

        {hasChecked && result && (
          <div className="space-y-6">
            {/* Score hero */}
            <section className="surface-card animate-rise flex flex-col items-center gap-6 p-6 text-center sm:p-8 md:flex-row md:text-left" aria-label="Match summary">
              <ScoreRing value={result.match_percentage} size={132} sublabel="Match" />
              <div className="min-w-0 flex-1">
                <Badge className="mb-2 border-primary/30 bg-primary/10 text-sm font-semibold text-primary">{result.verdict}</Badge>
                <p className="text-sm leading-relaxed text-muted-foreground">{result.verdict_detail}</p>
                <p className="mt-2 text-sm font-semibold">
                  {result.missing_skills.length > 0
                    ? `${result.missing_skills.length} skill${result.missing_skills.length === 1 ? '' : 's'} away from a stronger application`
                    : 'No skill gaps â€” ready to apply'}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                  <Button className="btn-primary" size="sm" onClick={scrollToRoadmap}>Start learning plan</Button>
                  <Button variant="outline" size="sm" onClick={runCheck} disabled={isChecking}>Re-check eligibility</Button>
                </div>
              </div>
            </section>

            {/* Matched & Missing Skills */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <SectionCard icon={<CheckCircle className="h-5 w-5 text-success" aria-hidden />} title="Skills you have">
                {result.matched_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.matched_skills.map((s, i) => (
                      <SkillChip key={`match-${s}-${i}`} skill={s} tone="have" showIcon />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No matching skills identified yet.</p>
                )}
              </SectionCard>

              <SectionCard icon={<XCircle className="h-5 w-5 text-destructive" aria-hidden />} title="Skills to develop">
                {result.missing_skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {result.missing_skills.map((s, i) => (
                      <SkillChip key={`gap-${s}-${i}`} skill={s} tone="missing" showIcon />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Great â€” no major skill gaps!</p>
                )}
              </SectionCard>
            </div>

            {/* Learning Roadmap â€” always rendered when checked so guidance is never blank */}
            <SectionCard
              icon={<BookOpen className="h-5 w-5 text-primary" aria-hidden />}
              title="Learning roadmap"
              className="scroll-mt-32"
              contentClassName="p-0"
            >
              <p className="-mt-1 px-6 text-sm text-muted-foreground">
                Prioritized plan to close gaps and boost shortlist chances â€” highest priority first.
              </p>
              <div id="learning-roadmap" className="scroll-mt-32">
                {result.roadmap.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    No roadmap generated yet. Re-check to regenerate, or work through the tips below â€”
                    each completed project directly improves your shortlist odds.
                  </p>
                ) : (
                  <ol className="divide-y divide-border">
                    {result.roadmap.map((item, i) => (
                      <RoadmapStep
                        key={`res-${i}`}
                        index={i}
                        title={item.skill}
                        description={item.description}
                        duration={item.timeline}
                        priority={item.priority}
                        action={item.action}
                        resources={item.resources}
                      />
                    ))}
                  </ol>
                )}
              </div>
            </SectionCard>

            {/* Tips */}
            {result.tips.length > 0 && (
              <SectionCard icon={<Lightbulb className="h-5 w-5 text-primary" aria-hidden />} title="Tips to improve">
                <ul className="space-y-2.5">
                  {result.tips.map((tip, i) => (
                    <li key={`tip-${i}`} className="flex items-start gap-2.5 text-sm leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default EligibilityCheckerPage;
