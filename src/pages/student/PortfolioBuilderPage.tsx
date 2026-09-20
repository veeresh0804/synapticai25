import React, { useState } from 'react';
import { Briefcase, Code2, Trophy, Star, BarChart3, Loader2, Sparkles, Globe, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { describeEdgeError } from '@/lib/edgeError';
import { logger } from '@/lib/logger';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import SectionCard from '@/components/shared/SectionCard';

const PortfolioBuilderPage: React.FC = () => {
  const { studentProfile } = useAuth();
  const { toast } = useToast();
  const [targetRole, setTargetRole] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [portfolio, setPortfolio] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!studentProfile?.id) return;
    setIsGenerating(true);
    setPortfolio(null);
    try {
      const { data: profileData } = await supabase
        .from('student_profiles')
        .select('*')
        .eq('student_id', studentProfile.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('portfolio-build', {
        body: {
          student_data: studentProfile,
          profile_data: profileData || {},
          target_role: targetRole || 'Software Engineer',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(JSON.stringify(data));
      setPortfolio(data);
    } catch (e: unknown) {
      logger.error(e);
      toast({ title: 'Generation failed', description: describeEdgeError(e), variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyBio = async () => {
    if (portfolio?.summary) {
      try {
        await navigator.clipboard.writeText(portfolio.summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Copied to clipboard!' });
      } catch {
        toast({ title: 'Copy failed', description: 'Clipboard permission denied.', variant: 'destructive' });
      }
    }
  };

  const iconMap: Record<string, React.ReactNode> = {
    trophy: <Trophy className="w-5 h-5 text-primary" />,
    code: <Code2 className="w-5 h-5 text-primary" />,
    star: <Star className="w-5 h-5 text-primary" />,
    chart: <BarChart3 className="w-5 h-5 text-primary" />,
  };

  return (
    <PageShell>
      <div className="max-w-4xl mx-auto">
        <PageHeader
          eyebrow="Portfolio Builder"
          title="AI Portfolio Builder"
          description="Generate a professional portfolio from your profile data."
          backTo="/student/dashboard"
          backLabel="Back"
        />

        <section className="surface-card p-6 mb-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Target Role</label>
              <Input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Full Stack Developer, ML Engineer..." />
            </div>
            <Button onClick={generate} disabled={isGenerating} className="btn-primary gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? 'Generating...' : 'Generate Portfolio'}
            </Button>
          </div>
        </section>

        {portfolio && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <section className="surface-card bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-display font-bold text-primary">{(studentProfile?.name || 'S').charAt(0)}</span>
              </div>
              <h2 className="font-display text-2xl font-bold mb-1">{studentProfile?.name || 'Your Portfolio'}</h2>
              <p className="text-lg text-primary font-medium mb-2">{portfolio.headline || 'Professional Portfolio'}</p>
              <p className="text-muted-foreground max-w-2xl mx-auto">{portfolio.bio || portfolio.summary || ''}</p>
              <div className="flex gap-2 justify-center mt-4 flex-wrap">
                {(portfolio.suggested_roles || []).map((role: string, i: number) => (
                  <Badge key={`${role}-${i}`} className="bg-primary/20 text-primary">{role}</Badge>
                ))}
              </div>
            </section>

            {/* Skills */}
            <SectionCard icon={<Code2 className="w-5 h-5 text-primary" />} title="Skills">
              {Array.isArray(portfolio.skills) ? (
                <div className="flex flex-wrap gap-2">
                  {(portfolio.skills as string[]).map((s: string, i: number) => (
                    <Badge key={`${s}-${i}`} variant="outline">{String(s)}</Badge>
                  ))}
                </div>
              ) : portfolio.skills ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {Object.entries(portfolio.skills).map(([category, skills]: [string, any]) => (
                    <div key={category}>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase mb-2 capitalize">{category.replace('_', ' ')}</h4>
                      <div className="flex flex-wrap gap-2">
                        {(skills as string[])?.map((s: string, i: number) => (
                          <Badge key={`${s}-${i}`} variant="outline">{String(s)}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Add skills to your profile for a richer portfolio.</p>
              )}
            </SectionCard>

            {/* Projects */}
            {portfolio.projects?.length > 0 && (
              <SectionCard icon={<Briefcase className="w-5 h-5 text-primary" />} title="Projects">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portfolio.projects.map((p: Record<string, unknown>, i: number) => (
                    <div key={`proj-${i}`} className="p-4 rounded-[14px] border border-border hover:border-primary/30 transition-colors">
                      <h4 className="font-semibold mb-1">{String(p.name || p.title || `Project ${i + 1}`)}</h4>
                      <p className="text-sm text-muted-foreground mb-3">{String(p.description || '')}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {((p.technologies || p.highlights || []) as string[])?.map((t: string, k: number) => (
                          <Badge key={`${t}-${k}`} variant="secondary" className="text-xs">{String(t)}</Badge>
                        ))}
                      </div>
                      {((p.highlights || []) as string[])?.map((h: string, j: number) => (
                        <p key={j} className="text-xs text-success flex items-center gap-1"><Star className="w-3 h-3" /> {String(h)}</p>
                      ))}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Achievements */}
            {portfolio.achievements?.length > 0 && (
              <SectionCard icon={<Trophy className="w-5 h-5 text-primary" />} title="Achievements">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {portfolio.achievements.map((a: unknown, i: number) => {
                    if (typeof a === 'string') {
                      return (
                        <div key={`ach-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <Star className="w-5 h-5 text-primary shrink-0" />
                          <p className="font-medium text-sm">{a}</p>
                        </div>
                      );
                    }
                    const obj = a as { icon: string; title: string; detail: string };
                    return (
                      <div key={`ach-${i}`} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        {iconMap[obj.icon] || <Star className="w-5 h-5 text-primary" />}
                        <div>
                          <p className="font-medium text-sm">{obj.title}</p>
                          <p className="text-xs text-muted-foreground">{obj.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Summary for copy */}
            <SectionCard 
              icon={<Copy className="w-5 h-5 text-primary" />} 
              title="Professional Summary" 
              action={
                <Button variant="outline" size="sm" onClick={copyBio} className="gap-1">
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              }
            >
              <p className="text-muted-foreground leading-relaxed">{portfolio.summary}</p>
            </SectionCard>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default PortfolioBuilderPage;
