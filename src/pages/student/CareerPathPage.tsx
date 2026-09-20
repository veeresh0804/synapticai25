import React, { useState } from 'react';
import { Compass, Loader2, Target, BookOpen, Award, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { describeEdgeError } from '@/lib/edgeError';
import { logger } from '@/lib/logger';

interface MonthlyPlan {
  month: number;
  title: string;
  goals: string[];
  resources: string[];
  project_idea: string;
}

interface CareerPath {
  target_role: string;
  current_level: string;
  readiness_score: number;
  summary: string;
  skill_gaps: string[];
  existing_strengths: string[];
  monthly_plan: MonthlyPlan[];
  recommended_certifications: string[];
  interview_tips: string[];
}

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : [];

function normalizeCareerPath(data: unknown, fallbackRole: string): CareerPath | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;

  // Backend shape A (new/Java + updated edge): monthly_plan[{month,title,goals,resources,project_idea}]
  // Backend shape B (old edge): roadmap[{month,focus,topics,resources,milestones}]
  const rawPlan = Array.isArray(d.monthly_plan) ? d.monthly_plan : Array.isArray(d.roadmap) ? d.roadmap : [];
  const monthly_plan: MonthlyPlan[] = (rawPlan as Record<string, unknown>[]).slice(0, 6).map((m, idx) => {
    const r = (m || {}) as Record<string, unknown>;
    const monthNum = typeof r.month === 'number' ? r.month : idx + 1;
    const title = String(r.title || r.focus || `Month ${monthNum} focus`).trim();
    const goals = asStringArray(r.goals ?? r.topics ?? r.milestones);
    const resources = asStringArray(r.resources);
    const project_idea = String(
      r.project_idea || (Array.isArray(r.milestones) ? (r.milestones as string[])[0] : '') || '',
    ).trim();
    return {
      month: monthNum,
      title: title || `Month ${monthNum}`,
      goals: goals.length > 0 ? goals : [`Focus on ${title}`],
      resources,
      project_idea: project_idea || `Build a portfolio project applying ${title} and push it to GitHub.`,
    };
  });

  const readinessRaw = d.readiness_score ?? d.readinessScore ?? 0;
  const readiness_score = typeof readinessRaw === 'number' ? readinessRaw : Number(readinessRaw) || 0;

  return {
    target_role: String(d.target_role || d.targetRole || fallbackRole || 'Your target role').trim(),
    current_level: String(d.current_level || 'beginner').trim(),
    readiness_score: Math.max(0, Math.min(100, Math.round(readiness_score))),
    summary: String(d.summary || 'Personalized roadmap generated from your profile.').trim(),
    skill_gaps: asStringArray(d.skill_gaps ?? d.skillGaps),
    existing_strengths: asStringArray(d.existing_strengths ?? d.strengths),
    monthly_plan,
    recommended_certifications: asStringArray(d.recommended_certifications),
    interview_tips: asStringArray(d.interview_tips ?? d.tips),
  };
}

const CareerPathPage: React.FC = () => {
  const { toast } = useToast();
  const [targetRole, setTargetRole] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [careerPath, setCareerPath] = useState<CareerPath | null>(null);

  const handleGenerate = async () => {
    if (!targetRole.trim()) {
      toast({ title: 'Enter a target role', variant: 'destructive' });
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('career-path', {
        body: { target_role: targetRole },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Generation failed', description: describeEdgeError(data), variant: 'destructive' });
        return;
      }
      const normalized = normalizeCareerPath(data, targetRole);
      if (!normalized || normalized.monthly_plan.length === 0) {
        toast({
          title: 'Incomplete result — please retry',
          description: 'AI returned an empty roadmap. Hit Generate again.',
          variant: 'destructive',
        });
        return;
      }
      setCareerPath(normalized);
      toast({ title: 'Career path generated!' });
    } catch (e: unknown) {
      logger.error(e);
      toast({ title: 'Error', description: describeEdgeError(e), variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const scoreColor = (score: number) => {
    const s = Number(score) || 0;
    if (s >= 75) return 'text-green-600';
    if (s >= 50) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen pt-20 pb-12">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
          <Compass className="w-8 h-8 text-primary" />
          AI Career Path Generator
        </h1>
        <p className="text-muted-foreground mb-8">Get a personalized 6-month roadmap based on your profile and target role.</p>

        <Card className="glass-card mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="e.g. AI Engineer, Backend Developer, DevOps Engineer..."
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                className="flex-1"
              />
              <Button className="btn-primary gap-2" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isGenerating && (
          <Card className="glass-card mb-6">
            <CardContent className="pt-6 text-center py-16">
              <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Building Your Roadmap...</h3>
              <p className="text-muted-foreground">AI is analyzing your profile and creating a personalized career path</p>
            </CardContent>
          </Card>
        )}

        {careerPath && !isGenerating && (
          <>
            {/* Readiness Score */}
            <Card className="glass-card mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" /> {careerPath.target_role}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-4xl font-bold ${scoreColor(careerPath.readiness_score)}`}>
                      {careerPath.readiness_score}%
                    </span>
                    <span className="text-xs text-muted-foreground">Readiness</span>
                    <Progress value={careerPath.readiness_score} className="h-2 w-24" />
                  </div>
                  <div className="flex-1">
                    <Badge className="mb-2 capitalize">{careerPath.current_level}</Badge>
                    <p className="text-sm text-muted-foreground">{careerPath.summary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Gaps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">✅ Your Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  {(careerPath.existing_strengths || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(careerPath.existing_strengths || []).map((s, i) => (
                        <Badge key={`skill-${s}-${i}`} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Add GitHub / LeetCode / resume to your profile for a richer strengths analysis.</p>
                  )}
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🎯 Skill Gaps</CardTitle>
                </CardHeader>
                <CardContent>
                  {(careerPath.skill_gaps || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(careerPath.skill_gaps || []).map((s, i) => (
                        <Badge key={`gap-${s}-${i}`} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No major gaps detected — focus on the roadmap below.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Monthly Plan */}
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> 6-Month Roadmap
            </h2>
            <div className="space-y-4 mb-6">
              {(careerPath.monthly_plan || []).length === 0 ? (
                <Card className="glass-card">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Roadmap came back empty — please hit Generate again.
                  </CardContent>
                </Card>
              ) : (
                (careerPath.monthly_plan || []).map((month, mi) => (
                <Card key={`month-${month.month}-${mi}`} className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                        {month.month}
                      </span>
                      {month.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Goals</p>
                      <ul className="space-y-1">
                        {(month.goals || []).map((g, i) => (
                          <li key={`task-${mi}-${i}`} className="text-sm flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 text-primary mt-1 shrink-0" /> {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {(month.resources || []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Resources</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(month.resources || []).map((r, i) => (
                            <Badge key={`res-${mi}-${r}-${i}`} variant="secondary" className="text-xs">{r}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">💡 Project Idea</p>
                      <p className="text-sm">{month.project_idea}</p>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
            </div>

            {/* Certifications & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {(careerPath.recommended_certifications || []).length > 0 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" /> Certifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {(careerPath.recommended_certifications || []).map((c, i) => (
                        <li key={`tip-${i}`} className="text-sm flex items-start gap-2">
                          <ChevronRight className="w-3 h-3 text-primary mt-1 shrink-0" /> {c}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
              {(careerPath.interview_tips || []).length > 0 && (
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" /> Interview Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {(careerPath.interview_tips || []).map((t, i) => (
                        <li key={`next-${i}`} className="text-sm flex items-start gap-2">
                          <ChevronRight className="w-3 h-3 text-primary mt-1 shrink-0" /> {t}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CareerPathPage;

