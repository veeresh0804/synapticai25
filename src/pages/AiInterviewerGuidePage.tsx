import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BrainCircuit, Shield, Clock, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';

const AiInterviewerGuidePage: React.FC = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'AI Interviewer Guide: How AI Interviewing Improves Hiring',
    description:
      'A practical guide to AI interviewer tools â€” how they speed up hiring, reduce bias, and improve candidate experience.',
    author: { '@type': 'Organization', name: 'SynapticAI' },
    publisher: { '@type': 'Organization', name: 'SynapticAI' },
    mainEntityOfPage: 'https://synapticai25.vercel.app/resources/ai-interviewer-guide',
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <Seo
        title="AI Interviewer Guide: Faster, Fairer Hiring | SynapticAI"
        description="Learn how AI interviewer tools reduce time-to-hire, eliminate bias, and surface real candidate signal. A practical guide for modern recruiters."
        path="/resources/ai-interviewer-guide"
        ogType="article"
        jsonLd={jsonLd}
      />
      <article className="container mx-auto px-4 max-w-3xl space-y-8">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-primary">Hiring Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            AI Interviewer Guide: How AI Interviewing Improves Hiring
          </h1>
          <p className="text-lg text-muted-foreground">
            AI interviewers help recruiting teams screen more candidates in less time â€” without sacrificing
            quality. This guide explains what an AI interviewer is, when to use one, and how to evaluate
            results responsibly.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What is an AI interviewer?</h2>
          <p className="text-muted-foreground">
            An AI interviewer is a software agent that conducts structured conversations with candidates â€”
            asking role-specific questions, scoring responses against a rubric, and producing an evidence
            trail recruiters can review. Modern systems use large language models to handle live
            conversation while keeping evaluation criteria deterministic.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Why teams adopt AI interviewing</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="surface-card p-5 space-y-2">
              <Clock className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Faster time-to-shortlist</h3>
              <p className="text-sm text-muted-foreground">
                Screen hundreds of applicants in parallel instead of scheduling one phone screen at a time.
              </p>
            </div>
            <div className="surface-card p-5 space-y-2">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Reduced interviewer bias</h3>
              <p className="text-sm text-muted-foreground">
                Every candidate gets the same questions and the same rubric, removing first-impression bias.
              </p>
            </div>
            <div className="surface-card p-5 space-y-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Evidence-based decisions</h3>
              <p className="text-sm text-muted-foreground">
                Recordings, transcripts, and rubric scores give hiring managers something to defend.
              </p>
            </div>
            <div className="surface-card p-5 space-y-2">
              <BrainCircuit className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Better candidate experience</h3>
              <p className="text-sm text-muted-foreground">
                Candidates interview on their own schedule and get faster feedback loops.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How SynapticAI approaches AI interviewing</h2>
          <p className="text-muted-foreground">
            SynapticAI pairs AI mock interviews for candidates with evidence-based ranking for recruiters. We
            score candidates on verified signal from GitHub, LeetCode, and resume content â€” not just on
            interview transcripts â€” so AI interview output is one input among many, never the sole decision.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Responsible deployment checklist</h2>
          <ul className="space-y-2 text-muted-foreground list-disc pl-6">
            <li>Disclose AI involvement to candidates upfront.</li>
            <li>Pair AI scores with a human review before a reject decision.</li>
            <li>Audit rubric outputs quarterly for adverse impact.</li>
            <li>Offer an alternative interview path for accessibility needs.</li>
          </ul>
        </section>

        <div className="pt-4 flex flex-wrap gap-3">
          <Link to="/recruiter/login">
            <Button className="btn-primary">Try the recruiter portal <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </Link>
          <Link to="/student/login">
            <Button variant="outline">Practice with the AI interviewer</Button>
          </Link>
        </div>
      </article>
    </div>
  );
};

export default AiInterviewerGuidePage;
