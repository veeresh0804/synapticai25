-- Fix "infinite recursion detected in policy for relation students" (42P17).
--
-- Root cause: the students SELECT policy ("Recruiters can view applicants to
-- their jobs") queries public.applications, while the applications policies
-- query public.students. Postgres detects the students <-> applications
-- cycle and aborts EVERY authenticated SELECT on students with 500.
--
-- Fix: RLS-bypassing SECURITY DEFINER helpers + policies that never let two
-- RLS-guarded tables reference each other.

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.my_student_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.my_recruiter_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT id FROM public.recruiters WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_applicant_of_recruiter(_student_id UUID, _recruiter_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE a.student_id = _student_id AND r.user_id = _recruiter_uid
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_job(_job_id UUID, _recruiter_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE j.id = _job_id AND r.user_id = _recruiter_uid
  )
$$;

CREATE OR REPLACE FUNCTION public.can_recruiter_view_resume(_object_name TEXT, _recruiter_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.applications a ON a.student_id = s.id
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE r.user_id = _recruiter_uid
      AND s.user_id::text = (storage.foldername(_object_name))[1]
  )
$$;

REVOKE ALL ON FUNCTION public.my_student_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_recruiter_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_applicant_of_recruiter(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owns_job(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_recruiter_view_resume(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_student_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_recruiter_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_applicant_of_recruiter(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_job(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_recruiter_view_resume(TEXT, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------- students
DROP POLICY IF EXISTS "Recruiters can view student profiles" ON public.students;
DROP POLICY IF EXISTS "Recruiters can view applicants to their jobs" ON public.students;
DROP POLICY IF EXISTS "Students can view own profile" ON public.students;
DROP POLICY IF EXISTS "Students can insert own profile" ON public.students;
DROP POLICY IF EXISTS "Students can update own profile" ON public.students;

CREATE POLICY "Students can view own profile"
  ON public.students FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Students can insert own profile"
  ON public.students FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Students can update own profile"
  ON public.students FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- No reference to applications here: the EXISTS check lives in a
-- SECURITY DEFINER function, so students <-> applications can never recurse.
CREATE POLICY "Recruiters can view applicants to their jobs"
  ON public.students FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'recruiter'::app_role)
    AND public.is_applicant_of_recruiter(students.id, auth.uid())
  );

-- ------------------------------------------------------------ applications
DROP POLICY IF EXISTS "Students can view own applications" ON public.applications;
DROP POLICY IF EXISTS "Students can insert own applications" ON public.applications;
DROP POLICY IF EXISTS "Recruiters can view applications for their jobs" ON public.applications;
DROP POLICY IF EXISTS "Recruiters can update applications for their jobs" ON public.applications;

CREATE POLICY "Students can view own applications"
  ON public.applications FOR SELECT TO authenticated
  USING (student_id = public.my_student_id());
CREATE POLICY "Students can insert own applications"
  ON public.applications FOR INSERT TO authenticated
  WITH CHECK (student_id = public.my_student_id());
CREATE POLICY "Recruiters can view applications for their jobs"
  ON public.applications FOR SELECT TO authenticated
  USING (public.owns_job(job_id, auth.uid()));
CREATE POLICY "Recruiters can update applications for their jobs"
  ON public.applications FOR UPDATE TO authenticated
  USING (public.owns_job(job_id, auth.uid()));

-- -------------------------------------------------------- student_profiles
DROP POLICY IF EXISTS "Students can view own extracted profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can insert own extracted profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can update own extracted profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Recruiters can view student extracted profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Recruiters can view applicant extracted profiles" ON public.student_profiles;

CREATE POLICY "Students can view own extracted profile"
  ON public.student_profiles FOR SELECT TO authenticated
  USING (student_id = public.my_student_id());
CREATE POLICY "Students can insert own extracted profile"
  ON public.student_profiles FOR INSERT TO authenticated
  WITH CHECK (student_id = public.my_student_id());
CREATE POLICY "Students can update own extracted profile"
  ON public.student_profiles FOR UPDATE TO authenticated
  USING (student_id = public.my_student_id());
CREATE POLICY "Recruiters can view applicant extracted profiles"
  ON public.student_profiles FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'recruiter'::app_role)
    AND public.is_applicant_of_recruiter(student_profiles.student_id, auth.uid())
  );

-- --------------------------------------------------------------- interviews
DROP POLICY IF EXISTS "Students can view own interviews" ON public.interviews;

CREATE POLICY "Students can view own interviews"
  ON public.interviews FOR SELECT TO authenticated
  USING (student_id = public.my_student_id());

-- ------------------------------------------------------------------ storage
DROP POLICY IF EXISTS "Recruiters can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Recruiters can view applicant resumes" ON storage.objects;

CREATE POLICY "Recruiters can view applicant resumes"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND public.has_role(auth.uid(), 'recruiter'::app_role)
    AND public.can_recruiter_view_resume(name, auth.uid())
  );
