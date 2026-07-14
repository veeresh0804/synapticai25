
-- 1) Column-level restriction on applications: students must not read sensitive recruiter fields
REVOKE SELECT ON public.applications FROM authenticated;
GRANT SELECT (id, student_id, job_id, status, applied_at, updated_at)
  ON public.applications TO authenticated;

-- 2) Recruiter-only view for sensitive columns, scoped to jobs they own (or admins)
CREATE OR REPLACE VIEW public.recruiter_application_details
WITH (security_invoker = true, security_barrier = true) AS
SELECT a.id, a.job_id, a.student_id, a.match_analysis, a.recruiter_feedback
FROM public.applications a
WHERE
  public.has_role(auth.uid(), 'admin'::app_role)
  OR a.job_id IN (
    SELECT j.id FROM public.jobs j
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE r.user_id = auth.uid()
  );

GRANT SELECT ON public.recruiter_application_details TO authenticated;
GRANT ALL ON public.recruiter_application_details TO service_role;

-- We still need recruiters to SELECT sensitive columns directly when their RLS policy applies (used by edge function via anon/auth contexts isn't the case — edge functions use service_role).
-- But the RecruiterCRMPage frontend will read from the view. Keep table-level SELECT minimal.

-- 3) Lock down SECURITY DEFINER function execution. RLS evaluation and trigger
--    execution don't require EXECUTE grants on the SQL/PLPGSQL functions in
--    public, so we can revoke from anon/authenticated/public safely.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_student_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_recruiter_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_student_on_interview() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_student_on_shortlist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_application_identity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_applications_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
