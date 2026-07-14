-- Remove broad student SELECT policy on base table; students must use student_applications view
DROP POLICY IF EXISTS "Students can view own applications" ON public.applications;

-- Allow students to still verify existence (for "already applied" check) via id+job_id only,
-- using a narrow SELECT policy scoped to ownership. The view exposes safe columns; sensitive
-- columns require recruiter or admin role at the base table level.
-- We intentionally do NOT recreate a broad student SELECT on applications.

-- Tighten recruiter UPDATE: keep ownership check and rely on column GRANTs + lock trigger
-- for column-level safety. Recreate with explicit WITH CHECK that re-asserts ownership.
DROP POLICY IF EXISTS "Recruiters can update applications for their jobs" ON public.applications;
CREATE POLICY "Recruiters can update status and feedback on their applications"
ON public.applications
FOR UPDATE
TO authenticated
USING (
  job_id IN (
    SELECT j.id FROM public.jobs j
    WHERE j.recruiter_id IN (
      SELECT r.id FROM public.recruiters r WHERE r.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  job_id IN (
    SELECT j.id FROM public.jobs j
    WHERE j.recruiter_id IN (
      SELECT r.id FROM public.recruiters r WHERE r.user_id = auth.uid()
    )
  )
);

-- Re-grant the narrow column update privileges (idempotent)
REVOKE UPDATE ON public.applications FROM authenticated;
GRANT UPDATE (status, recruiter_feedback) ON public.applications TO authenticated;

-- Ensure students retain INSERT and that the lock trigger is in place
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'lock_application_identity_trg'
  ) THEN
    CREATE TRIGGER lock_application_identity_trg
    BEFORE UPDATE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.lock_application_identity();
  END IF;
END $$;

-- Ensure student_applications view grants
GRANT SELECT ON public.student_applications TO authenticated;