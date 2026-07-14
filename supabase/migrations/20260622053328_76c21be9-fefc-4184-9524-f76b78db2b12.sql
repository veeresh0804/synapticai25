
-- 1) Column-level revoke: hide sensitive recruiter-only columns from base table reads.
REVOKE SELECT (match_analysis, recruiter_feedback) ON public.applications FROM authenticated;
REVOKE SELECT (match_analysis, recruiter_feedback) ON public.applications FROM anon;

-- 2) Restrict recruiter writes to status and recruiter_feedback only.
REVOKE UPDATE ON public.applications FROM authenticated;
REVOKE UPDATE ON public.applications FROM anon;
GRANT UPDATE (status, recruiter_feedback) ON public.applications TO authenticated;

-- 3) Immutability trigger for identity fields (function already exists).
DROP TRIGGER IF EXISTS lock_application_identity_trg ON public.applications;
CREATE TRIGGER lock_application_identity_trg
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.lock_application_identity();
