import React, { useEffect, useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import JobCard from '@/components/student/JobCard';
import EmptyState from '@/components/shared/EmptyState';

interface JobWithRecruiter {
  id: string;
  title: string;
  location: string;
  job_type: string;
  description: string | null;
  experience_required: string | null;
  required_skills: string[];
  salary_range: string | null;
  created_at: string;
  recruiters: { company_name: string } | null;
}

type SortKey = 'newest' | 'oldest' | 'title';

const JobListingsPage: React.FC = () => {
  const [jobs, setJobs] = useState<JobWithRecruiter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [salaryFilter, setSalaryFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase
        .from('jobs')
        .select('id, title, location, job_type, description, experience_required, required_skills, salary_range, created_at, recruiters(company_name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      setJobs(((data as unknown) || []) as JobWithRecruiter[]);
      setIsLoading(false);
    };
    fetchJobs();
  }, []);

  // Derive unique filter options from data
  const filterOptions = useMemo(() => {
    const locations = [...new Set(jobs.map(j => j.location).filter(Boolean))].sort();
    const jobTypes = [...new Set(jobs.map(j => j.job_type).filter(Boolean))].sort();
    const skills = [...new Set(jobs.flatMap(j => j.required_skills ?? []))].sort();
    return { locations, jobTypes, skills };
  }, [jobs]);

  // Apply filters + sort
  const filteredJobs = useMemo(() => {
    const list = jobs.filter(job => {
      const skills = job.required_skills ?? [];
      // Search query â€” match title, company, location, or skills
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          (job.title ?? '').toLowerCase().includes(q) ||
          (job.location ?? '').toLowerCase().includes(q) ||
          (job.recruiters?.company_name ?? '').toLowerCase().includes(q) ||
          skills.some(s => (s ?? '').toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      if (locationFilter !== 'all' && job.location !== locationFilter) return false;
      if (jobTypeFilter !== 'all' && job.job_type !== jobTypeFilter) return false;
      if (skillFilter !== 'all' && !skills.includes(skillFilter)) return false;

      if (salaryFilter !== 'all' && job.salary_range) {
        const numbers = job.salary_range.match(/\d+/g)?.map(Number) || [];
        const maxSalary = Math.max(...numbers, 0);
        if (salaryFilter === 'under5' && maxSalary >= 5) return false;
        if (salaryFilter === '5to10' && (maxSalary < 5 || maxSalary > 10)) return false;
        if (salaryFilter === '10to20' && (maxSalary < 10 || maxSalary > 20)) return false;
        if (salaryFilter === 'above20' && maxSalary <= 20) return false;
      } else if (salaryFilter !== 'all' && !job.salary_range) {
        return false;
      }

      return true;
    });
    const sorted = [...list];
    if (sortKey === 'oldest') sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sortKey === 'title') sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [jobs, searchQuery, locationFilter, jobTypeFilter, skillFilter, salaryFilter, sortKey]);

  const activeFilterCount = [locationFilter, jobTypeFilter, skillFilter, salaryFilter].filter(f => f !== 'all').length;

  const clearFilters = () => {
    setSearchQuery('');
    setLocationFilter('all');
    setJobTypeFilter('all');
    setSkillFilter('all');
    setSalaryFilter('all');
  };

  const filterPanel = (
    <div className="surface-card animate-rise space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-bold">Filters</h2>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3 w-3" aria-hidden /> Clear all
          </Button>
        )}
      </div>
      {([
        { label: 'Location', value: locationFilter, onChange: setLocationFilter, allLabel: 'All locations', options: filterOptions.locations },
        { label: 'Work type', value: jobTypeFilter, onChange: setJobTypeFilter, allLabel: 'All types', options: filterOptions.jobTypes },
        { label: 'Skill', value: skillFilter, onChange: setSkillFilter, allLabel: 'All skills', options: filterOptions.skills },
      ] as const).map((f) => (
        <div key={f.label} className="space-y-1.5">
          <label className="eyebrow">{f.label}</label>
          <Select value={f.value} onValueChange={f.onChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{f.allLabel}</SelectItem>
              {f.options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <div className="space-y-1.5">
        <label className="eyebrow">Salary (LPA)</label>
        <Select value={salaryFilter} onValueChange={setSalaryFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any salary</SelectItem>
            <SelectItem value="under5">Under 5 LPA</SelectItem>
            <SelectItem value="5to10">5â€“10 LPA</SelectItem>
            <SelectItem value="10to20">10â€“20 LPA</SelectItem>
            <SelectItem value="above20">Above 20 LPA</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Browse jobs"
        title="Find your next opportunity"
        description="Explore roles matched to your verified skills and career goals."
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search jobs, skills, companies, locationsâ€¦"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-[14px] pl-10"
            aria-label="Search jobs"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            className="h-12 gap-2 rounded-[14px] lg:hidden"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="ml-1 bg-primary-foreground px-1.5 py-0 text-xs text-primary">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="h-12 w-40 rounded-[14px]" aria-label="Sort jobs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title">Title Aâ€“Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {showFilters && <div className="mb-6 lg:hidden">{filterPanel}</div>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label="Job filters">
          <div className="sticky top-[114px]">{filterPanel}</div>
        </aside>

        <section aria-label="Job results" aria-live="polite">
          {!isLoading && (
            <p className="mb-4 text-sm text-muted-foreground">
              {filteredJobs.length === jobs.length
                ? `${jobs.length} job${jobs.length !== 1 ? 's' : ''} available`
                : `${filteredJobs.length} of ${jobs.length} jobs match your filters`}
            </p>
          )}

          {isLoading ? (
            <div className="grid gap-4" aria-label="Loading jobs">
              {[0, 1, 2].map((i) => (
                <div key={i} className="surface-card animate-pulse p-6" aria-hidden>
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 w-2/3 rounded bg-muted" />
                      <div className="h-4 w-1/2 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="surface-card">
              <EmptyState
                icon={<SearchX className="h-6 w-6" aria-hidden />}
                title={jobs.length === 0 ? 'No jobs available yet' : 'No jobs match your filters'}
                description={jobs.length === 0 ? 'New openings from verified recruiters will appear here.' : 'Try broadening your search or clearing a filter.'}
                actionLabel={jobs.length === 0 ? undefined : 'Clear filters'}
                onAction={jobs.length === 0 ? undefined : clearFilters}
              />
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredJobs.map((job) => (
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
        </section>
      </div>
    </PageShell>
  );
};

export default JobListingsPage;
