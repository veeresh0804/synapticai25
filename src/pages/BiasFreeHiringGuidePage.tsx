import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, EyeOff, Scale, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Seo from '@/components/Seo';

const BiasFreeHiringGuidePage: React.FC = () => {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Bias-Free Hiring with AI: A Guide to Anonymized Candidate Screening',
    description:
      'How anonymizing candidate profiles and using verified skill signals from GitHub and LeetCode leads to more equitable hiring outcomes.',
    author: { '@type': 'Organization', name: 'SynapticAI' },
    publisher: { '@type': 'Organization', name: 'SynapticAI' },
    mainEntityOfPage: 'https://synapticai25.vercel.app/resources/bias-free-hiring-guide',
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <Seo
        title="Bias-Free Hiring with AI: Anonymized Screening Guide"
        description="Reduce hiring bias with anonymized profiles and verified GitHub & LeetCode signals. A practical guide to equitable AI recruitment."
        path="/resources/bias-free-hiring-guide"
        ogType="article"
        jsonLd={jsonLd}
      />
      <article className="container mx-auto px-4 max-w-3xl space-y-8">
        <header className="space-y-4">
          <p className="text-sm uppercase tracking-wider text-primary">Hiring Guide</p>
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Bias-Free Hiring with AI: A Guide to Anonymized Candidate Screening
          </h1>
          <p className="text-lg text-muted-foreground">
            Names, colleges, and gender shouldn't decide who gets an interview. Combining anonymized
            profiles with verified skill signals from GitHub and LeetCode lets teams hire on evidence —
            not on patterns that reproduce historical bias.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Why traditional screening reproduces bias</h2>
          <p className="text-muted-foreground">
            Resume screening surfaces signals correlated with race, gender, and socioeconomic status —
            elite school names, "prestige" employers, and language patterns. Even well-intentioned
            recruiters anchor on these signals, and so do AI models trained on historical hiring data.
            The result: equally qualified candidates from non-traditional backgrounds get filtered out
            before a human ever reviews them.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">The anonymized + evidence-based approach</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5 space-y-2">
              <EyeOff className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Hide identity signals</h3>
              <p className="text-sm text-muted-foreground">
                Strip names, photos, gender, and college from the ranking view. Recruiters see skills
                and evidence first, identity only after shortlisting.
              </p>
            </div>
            <div className="glass-card p-5 space-y-2">
              <GitBranch className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Anchor on verified work</h3>
              <p className="text-sm text-muted-foreground">
                GitHub commits, LeetCode solutions, and project repositories are objective artifacts.
                They reward what a candidate built, not where they studied.
              </p>
            </div>
            <div className="glass-card p-5 space-y-2">
              <Scale className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Score against a rubric</h3>
              <p className="text-sm text-muted-foreground">
                Define what "good" looks like before reviewing candidates. Apply the same rubric to
                every applicant so comparisons are consistent.
              </p>
            </div>
            <div className="glass-card p-5 space-y-2">
              <Shield className="w-6 h-6 text-primary" />
              <h3 className="font-semibold">Audit the AI</h3>
              <p className="text-sm text-muted-foreground">
                Run job descriptions through a bias detector. Track shortlist demographics over time
                and adjust when patterns appear.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">A four-step playbook</h2>
          <ol className="space-y-3 list-decimal pl-6 text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Anonymize the ranking screen.</span>{' '}
              Show skills, project scores, and assessment results. Hide name, photo, gender, and
              institution until a candidate is shortlisted.
            </li>
            <li>
              <span className="font-medium text-foreground">Verify before you weigh.</span>{' '}
              Pull GitHub activity, LeetCode rating, and project artifacts. Weight verified evidence
              higher than self-reported resume claims.
            </li>
            <li>
              <span className="font-medium text-foreground">Run JD bias detection.</span>{' '}
              Many JDs unintentionally exclude candidates with gendered language or unnecessary
              "10+ years" filters. Detect and rewrite before posting.
            </li>
            <li>
              <span className="font-medium text-foreground">Review shortlist diversity.</span>{' '}
              Track shortlist demographics by role. If a pipeline narrows on one dimension, revisit
              the rubric and the sourcing channels.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What to measure</h2>
          <p className="text-muted-foreground">
            Track four numbers: applicant pool composition, shortlist composition, interview-to-offer
            rate by group, and offer-acceptance rate. A fair system shows similar conversion rates
            across groups at each stage. Sustained gaps mean a step in the funnel is filtering on
            something other than skill.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">How SynapticAI implements this</h2>
          <p className="text-muted-foreground">
            SynapticAI's ranking engine weights resume signals at 40%, GitHub and LeetCode evidence at
            30%, AI profile analysis at 20%, and education at 10% — deliberately capping the
            education weight so verified work dominates. The bias detector flags loaded language in
            job descriptions before they're published, and the candidate view defaults to a
            skills-first layout that surfaces evidence over identity.
          </p>
        </section>

        <div className="pt-4">
          <Link to="/recruiter/register">
            <Button className="btn-primary group">
              Start hiring on evidence
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </article>
    </div>
  );
};

export default BiasFreeHiringGuidePage;
