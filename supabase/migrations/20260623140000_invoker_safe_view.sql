-- Eliminate the SECURITY DEFINER lint on recruiter_application_details.
--
-- New design (no definer objects left):
--  * This view becomes SECURITY INVOKER with ONLY the six recruiter-safe
--    columns (the same columns the authenticated role may SELECT directly).
--    Row filtering comes from the underlying applications RLS policies,
--    so students see only their own rows and recruiters only their jobs'.
--  * The two sensitive columns (match_analysis, recruiter_feedback) are no
--    longer exposed through ANY view. Recruiter reads go through the
--    application-feedback edge function (service_role + explicit ownership
--    check); match_analysis is served inside rank-candidates responses.

DROP VIEW IF EXISTS public.recruiter_application_details;

CREATE VIEW public.recruiter_application_details
WITH (security_invoker = true, security_barrier = true) AS
SELECT a.id, a.job_id, a.student_id, a.status, a.applied_at, a.updated_at
FROM public.applications a;

REVOKE ALL ON public.recruiter_application_details FROM PUBLIC, anon;
GRANT SELECT ON public.recruiter_application_details TO authenticated;
GRANT ALL ON public.recruiter_application_details TO service_role;
