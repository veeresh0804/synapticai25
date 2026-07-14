-- Fix 1: Recruiters can overwrite any column on applications
-- We need to ensure that UPDATE privileges are strictly limited to safe columns.
REVOKE UPDATE ON public.applications FROM authenticated;
REVOKE UPDATE ON public.applications FROM anon;
GRANT UPDATE (status, recruiter_feedback) ON public.applications TO authenticated;

-- Fix 2: Students can read match_analysis and recruiter_feedback via direct table access
-- A previous migration (20260622061841) granted full SELECT on the table, negating column restrictions.
-- We must revoke the broad table-level SELECT and grant only column-level SELECT for safe columns.
REVOKE SELECT ON public.applications FROM authenticated;
REVOKE SELECT ON public.applications FROM anon;
GRANT SELECT (id, student_id, job_id, status, applied_at, updated_at) ON public.applications TO authenticated;

-- Since authenticated users no longer have SELECT on match_analysis and recruiter_feedback,
-- the recruiter_application_details view must be security_invoker = false (security definer).
-- This allows the view to run as the owner and read the columns, while the view's WHERE
-- clause safely restricts rows to the current auth.uid().
CREATE OR REPLACE VIEW public.recruiter_application_details
WITH (security_barrier = true, security_invoker = false) AS
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

-- Fix 3: Warning: Any authenticated user can insert notifications for any other user
-- The notifications table currently has no restrictive INSERT policy, or there might be an
-- overly permissive one not tracked in migrations. We establish a strict owner-only insert policy.
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.notifications;
DROP POLICY IF EXISTS "insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert" ON public.notifications;

CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);
