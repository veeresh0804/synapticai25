
-- Reset privileges cleanly
REVOKE ALL ON public.applications FROM anon, authenticated, public;

-- Authenticated: full SELECT (RLS scopes rows to recruiters/admins), INSERT for students,
-- and column-scoped UPDATE for recruiters. No DELETE.
GRANT SELECT ON public.applications TO authenticated;
GRANT INSERT ON public.applications TO authenticated;
GRANT UPDATE (status, recruiter_feedback) ON public.applications TO authenticated;

-- Service role: full access for edge functions / admin code.
GRANT ALL ON public.applications TO service_role;

-- Safe view for students
GRANT SELECT ON public.student_applications TO authenticated;
REVOKE ALL ON public.student_applications FROM anon;
