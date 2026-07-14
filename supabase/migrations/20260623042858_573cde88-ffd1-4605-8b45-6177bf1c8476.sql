
-- Scope recruiter SELECT on students
DROP POLICY IF EXISTS "Recruiters can view student profiles" ON public.students;
CREATE POLICY "Recruiters can view applicants to their jobs"
ON public.students FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'recruiter'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE a.student_id = students.id AND r.user_id = auth.uid()
  )
);

-- Scope recruiter SELECT on student_profiles
DROP POLICY IF EXISTS "Recruiters can view student extracted profiles" ON public.student_profiles;
CREATE POLICY "Recruiters can view applicant extracted profiles"
ON public.student_profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'recruiter'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.applications a
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE a.student_id = student_profiles.student_id AND r.user_id = auth.uid()
  )
);

-- Scope recruiter resume access in storage
DROP POLICY IF EXISTS "Recruiters can view resumes" ON storage.objects;
CREATE POLICY "Recruiters can view applicant resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND has_role(auth.uid(), 'recruiter'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.applications a ON a.student_id = s.id
    JOIN public.jobs j ON j.id = a.job_id
    JOIN public.recruiters r ON r.id = j.recruiter_id
    WHERE r.user_id = auth.uid()
      AND s.user_id::text = (storage.foldername(storage.objects.name))[1]
  )
);

-- Add explicit student SELECT policy on applications (defense in depth)
CREATE POLICY "Students can view own applications"
ON public.applications FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
);

-- Lock down has_role EXECUTE; only callable via security definer chain in policies (RLS bypasses EXECUTE check via owner)
-- Actually RLS-invoked functions need EXECUTE for the calling role. Keep EXECUTE for authenticated for policy use,
-- but revoke from anon and PUBLIC to satisfy linter for anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
