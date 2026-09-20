-- Fix double increment_applications_count trigger + add missing FK indexes.
-- Two triggers (trigger_increment_applications_count and on_application_created)
-- both fire on INSERT, doubling applications_count.

DROP TRIGGER IF EXISTS on_application_created ON public.applications;
DROP TRIGGER IF EXISTS trigger_increment_applications_count ON public.applications;
DROP TRIGGER IF EXISTS on_application_insert ON public.applications;

CREATE TRIGGER on_application_created
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.increment_applications_count();

-- Hot-path FK / RLS indexes (Postgres does not auto-index FKs)
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter_id ON public.jobs (recruiter_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_id ON public.applications (student_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON public.interviews (application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_job_id ON public.interviews (job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_student_id ON public.interviews (student_id);
CREATE INDEX IF NOT EXISTS idx_interviews_recruiter_id ON public.interviews (recruiter_id);
CREATE INDEX IF NOT EXISTS idx_student_profiles_student_id ON public.student_profiles (student_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
