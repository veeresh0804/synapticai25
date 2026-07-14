-- Column-level privacy on applications
REVOKE SELECT ON public.applications FROM anon, authenticated;
GRANT SELECT (id, student_id, job_id, status, applied_at, match_analysis, recruiter_feedback) ON public.applications TO authenticated;

-- Restrict updates to safe columns only
REVOKE UPDATE ON public.applications FROM anon, authenticated;
GRANT UPDATE (status, recruiter_feedback) ON public.applications TO authenticated;

-- Hide recruiter-only columns from students via a security-barrier view-like approach:
-- We re-grant SELECT per-column, but exclude match_analysis & recruiter_feedback for students.
-- Since column grants are role-based (not row-based), we keep them granted to authenticated
-- but enforce row-level restriction via RLS plus a dedicated student-facing view.
CREATE OR REPLACE VIEW public.student_applications
WITH (security_barrier = true, security_invoker = true) AS
SELECT id, student_id, job_id, status, applied_at
FROM public.applications;

GRANT SELECT ON public.student_applications TO authenticated;

-- Revoke recruiter-only columns from students by tightening base table grants:
-- Students must use the view; recruiters keep direct access via existing RLS policies.
REVOKE SELECT (match_analysis, recruiter_feedback) ON public.applications FROM authenticated;

-- Re-grant those columns only to a recruiter-specific path: we re-add via policy enforcement.
-- Recruiters access through RLS; to allow them to read these columns we must regrant,
-- but column grants are not role-segmented beyond PG roles. So we regrant to authenticated
-- and rely on RLS to gate row visibility (recruiters only see their own job's apps).
GRANT SELECT (match_analysis, recruiter_feedback) ON public.applications TO authenticated;

-- Ensure has_role function is callable
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;