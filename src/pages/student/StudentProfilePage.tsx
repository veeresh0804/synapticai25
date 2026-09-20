import React, { useState, useEffect, useRef } from 'react';
import { User, Github, Code2, Linkedin, Save, CheckCircle2, Sparkles, Loader2, Star, Trophy, BookOpen, Target, Upload, FileText, ScanSearch, FolderGit2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import ResumeSkillsDisplay, { type ResumeSkills } from '@/components/student/ResumeSkillsDisplay';
import { describeEdgeError, describeEdgeErrorAsync } from '@/lib/edgeError';
import { logger } from '@/lib/logger';
import PageShell from '@/components/shared/PageShell';
import ScoreRing from '@/components/student/ScoreRing';
import SectionCard from '@/components/shared/SectionCard';
import SkillChip from '@/components/student/SkillChip';
import EmptyState from '@/components/shared/EmptyState';
import PlatformRow from '@/components/student/PlatformRow';

interface ProfileAnalysis {
  overall_score: number;
  summary: string;
  technical_skills: string[];
  skill_level: string;
  strengths: string[];
  areas_to_improve: string[];
  recommended_roles: string[];
  github_assessment: { score: number; highlights: string[] };
  leetcode_assessment: { score: number; highlights: string[] };
}

interface ExtractedData {
  github_data: Record<string, unknown>;
  leetcode_data: Record<string, unknown>;
  analysis: ProfileAnalysis;
}

interface EvidenceRepo {
  name: string;
  description: string;
  language: string;
  stars: number;
}

/** Best-effort repo extraction across known github_data shapes; never throws. */
function extractRepos(githubData: unknown): EvidenceRepo[] {
  if (!githubData || typeof githubData !== 'object') return [];
  const g = githubData as Record<string, unknown>;
  const candidates = [g.repos, g.repositories, g.top_repos, g.topRepos];
  const list = candidates.find((c) => Array.isArray(c)) as Array<Record<string, unknown>> | undefined;
  if (!list) return [];
  return list.slice(0, 3).map((r, i) => ({
    name: String(r.name || r.full_name || `Repository ${i + 1}`),
    description: String(r.description || ''),
    language: String(r.language || r.primary_language || ''),
    stars: Number(r.stargazers_count ?? r.stars ?? r.total_stars ?? 0) || 0,
  }));
}

const StudentProfilePage: React.FC = () => {
  const { user, studentProfile, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [links, setLinks] = useState({ leetcode: '', github: '', linkedin: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [existingAnalysis, setExistingAnalysis] = useState<ProfileAnalysis | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [resumeSkills, setResumeSkills] = useState<ResumeSkills | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!studentProfile?.id) return;
    supabase
      .from('student_profiles')
      .select('leetcode_url, github_url, linkedin_url, gemini_analysis, github_data, leetcode_data, resume_skills')
      .eq('student_id', studentProfile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as unknown as { leetcode_url?: string; github_url?: string; linkedin_url?: string; gemini_analysis?: unknown; github_data?: Record<string, unknown>; leetcode_data?: Record<string, unknown>; resume_skills?: unknown };
          setLinks({
            leetcode: d.leetcode_url || '',
            github: d.github_url || '',
            linkedin: d.linkedin_url || '',
          });
          if (d.gemini_analysis && typeof d.gemini_analysis === 'object' && Object.keys(d.gemini_analysis).length > 0) {
            setExistingAnalysis(d.gemini_analysis as ProfileAnalysis);
            setExtracted({
              github_data: d.github_data ?? {},
              leetcode_data: d.leetcode_data ?? {},
              analysis: d.gemini_analysis as ProfileAnalysis,
            });
          }
          if (d.resume_skills && typeof d.resume_skills === 'object' && Object.keys(d.resume_skills).length > 0) {
            setResumeSkills(d.resume_skills as ResumeSkills);
          }
        }
      });
  }, [studentProfile?.id]);

  useEffect(() => {
    if (!studentProfile?.id) return;
    supabase.from('students').select('resume_url').eq('id', studentProfile.id).maybeSingle()
      .then(({ data }) => { if (data?.resume_url) setResumeUrl(data.resume_url); });
  }, [studentProfile?.id]);

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !studentProfile?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    const path = `${user.id}/${Date.now()}_${file.name}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('resumes').upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: 'Upload failed', description: uploadError.message, variant: 'destructive' });
      setIsUploading(false);
      return;
    }
    // Use server-returned path when available so DB reference can't diverge
    const storedPath = (uploadData as unknown as { path?: string } | null)?.path ?? path;
    await supabase.from('students').update({ resume_url: storedPath }).eq('id', studentProfile.id);
    setResumeUrl(storedPath);
    toast({ title: 'Resume uploaded!' });
    setIsUploading(false);
  };

  const handleParseResume = async () => {
    if (!resumeUrl) {
      toast({ title: 'No resume', description: 'Please upload a resume first.', variant: 'destructive' });
      return;
    }
    setIsParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-resume', {});
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Parsing failed', description: describeEdgeError(data), variant: 'destructive' });
        return;
      }
      setResumeSkills(data.resume_skills);
      toast({ title: 'Resume parsed!', description: 'AI has extracted skills from your resume.' });
    } catch (e: unknown) {
      logger.error(e);
      toast({ title: 'Error', description: await describeEdgeErrorAsync(e), variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!studentProfile?.id) return;
    setIsSaving(true);
    const profileComplete = !!(links.leetcode && links.github && links.linkedin);

    const { error: profileError } = await supabase
      .from('student_profiles')
      .update({
        leetcode_url: links.leetcode || null,
        github_url: links.github || null,
        linkedin_url: links.linkedin || null,
      })
      .eq('student_id', studentProfile.id);

    await supabase
      .from('students')
      .update({ profile_complete: profileComplete })
      .eq('id', studentProfile.id);

    if (profileError) {
      toast({ title: 'Error saving profile', description: profileError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Profile updated!', description: 'Your platform links have been saved.' });
      await refreshProfile();
    }
    setIsSaving(false);
  };

  const handleExtract = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-profile', {});
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Extraction failed', description: describeEdgeError(data), variant: 'destructive' });
        return;
      }
      setExtracted(data);
      setExistingAnalysis(data.analysis);
      toast({ title: 'Profile analyzed!', description: 'AI has analyzed your GitHub and LeetCode profiles.' });
    } catch (e: unknown) {
      logger.error(e);
      toast({ title: 'Error', description: describeEdgeError(e), variant: 'destructive' });
    } finally {
      setIsExtracting(false);
    }
  };

  const analysis = extracted?.analysis || existingAnalysis;
  const profileStrength = studentProfile?.profile_complete ? 85 : 35;
  const gh = analysis?.github_assessment;
  const lc = analysis?.leetcode_assessment;
  const repos = extractRepos(extracted?.github_data);
  const platformStatus = (url: string, verified: boolean): 'verified' | 'connected' | 'missing' =>
    !url ? 'missing' : verified ? 'verified' : 'connected';

  return (
    <PageShell>
      {/* Profile header */}
      <section className="surface-card animate-rise mb-6 flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center" aria-label="Profile summary">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-3xl font-bold text-primary" aria-hidden>
          {(studentProfile?.name || 'S').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-display text-2xl font-bold leading-tight md:text-3xl">
            {studentProfile?.name || 'My profile'}
          </h1>
          <p className="mt-1 truncate text-sm font-medium text-muted-foreground">
            {studentProfile?.institution || 'University'} â€¢ {studentProfile?.degree} {studentProfile?.branch}
          </p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{studentProfile?.email}</p>
        </div>
        <div className="shrink-0 lg:w-64">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-muted-foreground">Profile strength</span>
            <span className="font-display font-bold">{profileStrength}%</span>
          </div>
          <Progress value={profileStrength} className="mt-2 h-2" aria-label={`Profile strength ${profileStrength} percent`} />
          <p className="mt-2 text-xs text-muted-foreground">
            {studentProfile?.profile_complete ? 'Complete your proof profile' : 'Add all three platform links to finish'}
          </p>
        </div>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <SectionCard icon={<User className="h-5 w-5 text-primary" aria-hidden />} title="Basic information">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { label: 'Name', value: studentProfile?.name },
                { label: 'Email', value: studentProfile?.email, breakAll: true },
                { label: 'Institution', value: studentProfile?.institution },
                { label: 'Degree', value: studentProfile?.degree && studentProfile?.branch ? `${studentProfile.degree} â€” ${studentProfile.branch}` : studentProfile?.degree },
              ].map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</dt>
                  <dd className={`mt-0.5 font-semibold ${f.breakAll ? 'break-all' : 'break-words'}`}>{f.value || 'â€”'}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard icon={<FileText className="h-5 w-5 text-primary" aria-hidden />} title="Resume / CV">
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleResumeUpload} aria-label="Upload resume" />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploadingâ€¦</> : <><Upload className="h-4 w-4" aria-hidden /> Upload resume</>}
              </Button>
              {resumeUrl && (
                <Button variant="outline" size="sm" className="gap-2" onClick={handleParseResume} disabled={isParsing}>
                  {isParsing ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Parsingâ€¦</> : <><ScanSearch className="h-4 w-4" aria-hidden /> AI analyze</>}
                </Button>
              )}
              {resumeUrl && (
                <span className="flex items-center gap-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Resume uploaded Â· PDF updated
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">PDF, DOC, or DOCX â€” max 5MB</p>
          </SectionCard>

          <SectionCard
            icon={<Link2 className="h-5 w-5 text-primary" aria-hidden />}
            title="Verified platform links"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Code2 className="h-4 w-4 text-primary" aria-hidden /> LeetCode profile URL</Label>
                <Input placeholder="https://leetcode.com/yourusername" value={links.leetcode}
                  onChange={(e) => setLinks(prev => ({ ...prev, leetcode: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Github className="h-4 w-4" aria-hidden /> GitHub profile URL</Label>
                <Input placeholder="https://github.com/yourusername" value={links.github}
                  onChange={(e) => setLinks(prev => ({ ...prev, github: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Linkedin className="h-4 w-4 text-primary" aria-hidden /> LinkedIn profile URL</Label>
                <Input placeholder="https://linkedin.com/in/yourusername" value={links.linkedin}
                  onChange={(e) => setLinks(prev => ({ ...prev, linkedin: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="btn-primary flex-1 gap-2" onClick={handleSave} disabled={isSaving}>
                  <Save className="h-4 w-4" aria-hidden /> {isSaving ? 'Savingâ€¦' : 'Save profile'}
                </Button>
                <Button variant="outline" className="flex-1 gap-2 border-primary/40 text-primary hover:bg-primary/10" onClick={handleExtract}
                  disabled={isExtracting || (!links.github && !links.leetcode)}>
                  {isExtracting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Analyzingâ€¦</>
                  ) : (
                    <><Sparkles className="h-4 w-4" aria-hidden /> AI analyze profile</>
                  )}
                </Button>
              </div>
              {studentProfile?.profile_complete && (
                <p className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Profile complete! AI can now verify your skills.
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {analysis ? (
            <>
              <SectionCard icon={<Sparkles className="h-5 w-5 text-primary" aria-hidden />} title="AI resume analysis">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <ScoreRing value={analysis.overall_score ?? 0} size={104} sublabel="Resume score" />
                  <div className="min-w-0 flex-1">
                    {analysis.skill_level && <Badge className="mb-2 border-primary/30 bg-primary/10 capitalize text-primary">{analysis.skill_level}</Badge>}
                    <p className="text-sm leading-relaxed text-muted-foreground">{analysis.summary}</p>
                  </div>
                </div>
                {(analysis.strengths?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <p className="eyebrow mb-2">Key strengths</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(analysis.strengths ?? []).map((s, i) => (
                        <SkillChip key={`str-${s}-${i}`} skill={s} tone="have" />
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionCard icon={<Star className="h-4 w-4 text-primary" aria-hidden />} title="Strengths">
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.strengths ?? []).map((s, i) => (
                      <SkillChip key={`st2-${s}-${i}`} skill={s} tone="have" />
                    ))}
                  </div>
                </SectionCard>
                <SectionCard icon={<Target className="h-4 w-4 text-primary" aria-hidden />} title="Areas to improve">
                  <div className="flex flex-wrap gap-1.5">
                    {(analysis.areas_to_improve ?? []).map((a, i) => (
                      <SkillChip key={`imp-${a}-${i}`} skill={a} tone="missing" />
                    ))}
                  </div>
                </SectionCard>
              </div>

              <SectionCard icon={<BookOpen className="h-4 w-4 text-primary" aria-hidden />} title="Technical skills">
                <div className="flex flex-wrap gap-2">
                  {(analysis.technical_skills ?? []).map((skill, i) => (
                    <SkillChip key={`skill-${skill}-${i}`} skill={skill} />
                  ))}
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionCard icon={<Github className="h-4 w-4" aria-hidden />} title={`GitHub Â· ${gh?.score ?? 0}`}>
                  <Progress value={Number(gh?.score) || 0} className="mb-3 h-1.5" aria-label={`GitHub score ${gh?.score ?? 0}`} />
                  <ul className="space-y-1.5">
                    {(gh?.highlights ?? []).map((h, i) => (
                      <li key={`gh-${i}`} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden /> {h}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
                <SectionCard icon={<Code2 className="h-4 w-4 text-primary" aria-hidden />} title={`LeetCode Â· ${lc?.score ?? 0}`}>
                  <Progress value={Number(lc?.score) || 0} className="mb-3 h-1.5" aria-label={`LeetCode score ${lc?.score ?? 0}`} />
                  <ul className="space-y-1.5">
                    {(lc?.highlights ?? []).map((h, i) => (
                      <li key={`lc-${i}`} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden /> {h}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>

              {(analysis.recommended_roles?.length ?? 0) > 0 && (
                <SectionCard icon={<Trophy className="h-4 w-4 text-primary" aria-hidden />} title="Recommended roles">
                  <div className="flex flex-wrap gap-2">
                    {(analysis.recommended_roles ?? []).map((role, i) => (
                      <SkillChip key={`role-${role}-${i}`} skill={role} />
                    ))}
                  </div>
                </SectionCard>
              )}
            </>
          ) : (
            <div className="surface-card">
              <EmptyState
                icon={<Sparkles className="h-6 w-6" aria-hidden />}
                title="No AI analysis yet"
                description="Add your GitHub and LeetCode links, save, then run AI analysis to unlock your evidence report."
              />
            </div>
          )}

          <SectionCard icon={<Github className="h-5 w-5 text-primary" aria-hidden />} title="Platform verification">
            <div className="space-y-2">
              <PlatformRow icon={<Github className="h-5 w-5" aria-hidden />} name="GitHub" status={platformStatus(links.github, !!extracted?.github_data)} hint={links.github || 'Add your GitHub URL above'} />
              <PlatformRow icon={<Code2 className="h-5 w-5" aria-hidden />} name="LeetCode" status={platformStatus(links.leetcode, !!extracted?.leetcode_data)} hint={links.leetcode || 'Add your LeetCode URL above'} />
              <PlatformRow icon={<Linkedin className="h-5 w-5" aria-hidden />} name="LinkedIn" status={platformStatus(links.linkedin, false)} hint={links.linkedin || 'Add your LinkedIn URL above'} />
            </div>
          </SectionCard>

          {/* Project evidence */}
          {repos.length > 0 ? (
            <SectionCard icon={<FolderGit2 className="h-5 w-5 text-primary" aria-hidden />} title="Project evidence">
              <div className="grid grid-cols-1 gap-4">
                {repos.map((r, i) => (
                  <div key={`${r.name}-${i}`} className="rounded-[14px] border border-border p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40">
                    <h3 className="break-words font-semibold">{r.name}</h3>
                    {r.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {r.language && <SkillChip skill={r.language} />}
                      {r.stars > 0 && <Badge variant="outline" className="text-xs">â˜… {r.stars}</Badge>}
                      <Badge className="border-success/30 bg-success/10 text-xs text-success">Evidence: verified</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : (
            analysis && (
              <div className="surface-card">
                <EmptyState
                  icon={<FolderGit2 className="h-6 w-6" aria-hidden />}
                  title="No project evidence yet"
                  description="Verify a GitHub profile with public repositories to showcase evidence strength here."
                />
              </div>
            )
          )}
        </div>
      </div>

          {/* Moved project evidence into the right column */}

      {resumeSkills && (
        <div className="mt-4">
          <ResumeSkillsDisplay skills={resumeSkills} />
        </div>
      )}
    </PageShell>
  );
};

export default StudentProfilePage;
