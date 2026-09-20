import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Building2, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CompanyAvatar from './CompanyAvatar';
import SkillChip from './SkillChip';

export interface JobCardData {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: string;
  experience?: string | null;
  description?: string | null;
  skills: string[];
  salary?: string | null;
  postedAt?: string;
  matchScore?: number;
}

const SAVED_KEY = 'synaptic-saved-jobs';

function readSaved(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

const JobCard: React.FC<{ job: JobCardData }> = ({ job }) => {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readSaved().has(job.id));
  }, [job.id]);

  const toggleSaved = () => {
    const next = readSaved();
    if (next.has(job.id)) next.delete(job.id);
    else next.add(job.id);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable — keep in-memory state only */
    }
    setSaved(next.has(job.id));
  };

  return (
    <article className="surface-card-hover animate-rise p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <CompanyAvatar name={job.company} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="min-w-0 break-words font-display text-lg font-bold leading-snug">
                <Link to={`/student/jobs/${job.id}`} className="rounded hover:text-primary hover:underline focus-visible:outline-none">
                  {job.title}
                </Link>
              </h3>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">{job.company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {typeof job.matchScore === 'number' && (
                <Badge className="border-primary/30 bg-primary/10 font-bold text-primary">
                    {Math.round(job.matchScore)}% match
                  </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSaved}
                aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title} for later`}
                aria-pressed={saved}
                className={saved ? 'text-primary' : 'text-muted-foreground'}
              >
                <Bookmark className={saved ? 'h-4 w-4 fill-current' : 'h-4 w-4'} aria-hidden />
              </Button>
            </div>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{job.location}</span>
            <span className="capitalize">{job.jobType}</span>
            {job.experience && <span>{job.experience}</span>}
            {job.postedAt && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{job.postedAt}</span>}
          </p>
        </div>
      </div>

      {job.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{job.description}</p>}

      {job.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 6).map((s, i) => (
            <SkillChip key={`${s}-${i}`} skill={s} />
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-semibold">{job.salary || 'Salary not disclosed'}</span>
        <Link to={`/student/jobs/${job.id}`}>
          <Button className="btn-primary gap-2" size="sm">
            View details <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
      </div>
    </article>
  );
};

export default JobCard;
