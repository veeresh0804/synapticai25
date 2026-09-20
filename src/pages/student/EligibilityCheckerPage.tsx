import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, CheckCircle, XCircle, Target, BookOpen, Lightbulb, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { logger } from '@/lib/logger';

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
    { title: 'Node.js Official Docs — Getting Started', url: 'https://nodejs.org/en/docs', type: 'docs' },
    { title: 'Express.js Guide — Build REST APIs', url: 'https://expressjs.com/en/starter/installing.html', type: 'course' },
  ],
  nodejs: [
    { title: 'Node.js Official Docs — Getting Started', url: 'https://nodejs.org/en/docs', type: 'docs' },
    { title: 'Express.js Guide — Build REST APIs', url: 'https://expressjs.com/en/starter/installing.html', type: 'course' },
  ],
  postgresql: [
    { title: 'PostgreSQL Tutorial — Learn SQL', url: 'https://www.postgresqltutorial.com/', type: 'course' },
    { title: 'PostgreSQL Official Docs', url: 'https://www.postgresql.org/docs/', type: 'docs' },
  ],
  postgres: [
    { title: 'PostgreSQL Tutorial — Learn SQL', url: 'https://www.postgresqltutorial.com/', type: 'course' },
    { title: 'PostgreSQL Official Docs', url: 'https://www.postgresql.org/docs/', type: 'docs' },
  ],
  'rest apis': [
    { title: 'REST API Tutorial — Design Principles', url: 'https://restfulapi.net/', type: 'docs' },
    { title: 'MDN — HTTP & REST Basics', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP', type: 'docs' },
  ],
  'rest api': [
    { title: 'REST API Tutorial — Design Principles', url: 'https://restfulapi.net/', type: 'docs' },
  ],
  redis: [
    { title: 'Redis University — Data Structures & Caching', url: 'https://university.redis.com/', type: 'course' },
    { title: 'Redis Docs — Quick Start', url: 'https://redis.io/docs/getting-started/', type: 'docs' },
  ],
  docker: [
    { title: 'Docker Get Started — Containerize an App', url: 'https://docs.docker.com/get-started/', type: 'docs' },
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
// Guarantees no blank cards — fills shortlist-focused defaults.
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
        `Build production-level ${skill} skills recruiters screen for — complete the project below and add it to your resume/GitHub to lift shortlist chances.`;
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

  const matchColor = (pct: number) => {
    if (pct >= 75) return 'text-green-600';
    if (pct >= 50) return 'text-yellow-600';
    return 'text-red-500';
  };

  const priorityColor = (p: string) => {
    const v = (p || '').toLowerCase();
    if (v === 'high') return 'bg-red-100 text-red-800 border-red-200';
    if (v === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to={`/student/jobs/${jobId}`}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Job
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="w-8 h-8 text-primary" />
              Eligibility Checker
            </h1>
            <p className="text-muted-foreground mt-1">See how well your profile matches this job</p>
          </div>
          <Button className="btn-primary gap-2" onClick={runCheck} disabled={isChecking}>
            {isChecking ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</>
            ) : hasChecked ? (
              <><Sparkles className="w-4 h-4" /> Re-check</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Check Eligibility</>
            )}
          </Button>
        </div>

        {!hasChecked && !isChecking && (
          <Card className="glass-card">
            <CardContent className="pt-6 text-center py-16">
              <Target className="w-16 h-16 text-primary/40 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Check Your Fit</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                AI will analyze your profile against the job requirements and provide a personalized skill gap roadmap.
              </p>
            </CardContent>
          </Card>
        )}

        {isChecking && (
          <Card className="glass-card">
            <CardContent className="pt-6 text-center py-16">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Analyzing Your Profile...</h3>
              <p className="text-muted-foreground">Comparing your skills and experience against the job requirements</p>
            </CardContent>
          </Card>
        )}

        {hasChecked && result && (
          <div className="space-y-6">
            {/* Score Card */}
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className={`text-5xl font-bold ${matchColor(result.match_percentage)}`}>
                      {result.match_percentage}%
                    </span>
                    <Progress value={result.match_percentage} className="h-2 w-32" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <Badge className="mb-2 text-sm">{result.verdict}</Badge>
                    <p className="text-muted-foreground">{result.verdict_detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Matched & Missing Skills */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" /> Skills You Have
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.matched_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.matched_skills.map((s, i) => (
                        <Badge key={`match-${s}-${i}`} className="bg-green-100 text-green-800">{s}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No matching skills identified yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" /> Skills to Develop
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.missing_skills.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.missing_skills.map((s, i) => (
                        <Badge key={`gap-${s}-${i}`} variant="outline" className="text-red-600 border-red-300">{s}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Great — no major skill gaps!</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Learning Roadmap — always rendered when checked so guidance is never blank */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" /> Learning Roadmap
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Prioritized plan to close gaps and boost shortlist chances — highest priority first.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.roadmap.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No roadmap generated yet. Re-check to regenerate, or work through the tips below —
                    each completed project directly improves your shortlist odds.
                  </p>
                ) : (
                  result.roadmap.map((item, i) => (
                    <div key={`res-${i}`} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold min-w-0 break-words">
                          <span className="text-muted-foreground font-normal mr-2">Step {i + 1}.</span>
                          {item.skill}
                        </h4>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={priorityColor(item.priority)}>{item.priority} priority</Badge>
                          <Badge variant="outline" className="gap-1">
                            <Clock className="w-3 h-3" /> {item.timeline}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.action && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            🚀 Shortlist booster — do this
                          </p>
                          <p className="text-sm">{item.action}</p>
                        </div>
                      )}
                      {item.resources.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground">Resources</p>
                          {item.resources.map((res, j) => (
                            <div key={`step-${i}-${j}`} className="flex items-center gap-2 text-sm">
                              <Badge variant="secondary" className="text-xs shrink-0">{res.type}</Badge>
                              {res.url ? (
                                <a href={res.url} target="_blank" rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1">
                                  {res.title} <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span>{res.title}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            {result.tips.length > 0 && (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-primary" /> Tips to Improve
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.tips.map((tip, i) => (
                      <li key={`tip-${i}`} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-bold mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EligibilityCheckerPage;
