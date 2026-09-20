import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleCallback = async () => {
      const urlError = searchParams.get('error') || searchParams.get('error_description');
      const portal = searchParams.get('portal') as 'student' | 'recruiter' | null;
      const fallbackPortal = portal === 'recruiter' ? 'recruiter' : 'student';
      if (urlError) {
        toast({ title: 'Sign-in cancelled', description: String(urlError), variant: 'destructive' });
        navigate(`/${fallbackPortal}/login`);
        return;
      }

      // Supabase JS v2 auto-exchanges the hash tokens on initialisation.
      // Retry briefly — first getSession() can race the exchange.
      let session = null as Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];
      let error = null as unknown;
      for (let i = 0; i < 5; i++) {
        const res = await supabase.auth.getSession();
        session = res.data.session;
        error = res.error;
        if (session?.user || error) break;
        await new Promise((r) => setTimeout(r, 400));
      }

      if (error || !session?.user) {
        toast({
          title: 'Sign-in failed',
          description: (error as Error)?.message || 'Could not complete Google sign-in. Please try again.',
          variant: 'destructive',
        });
        navigate(`/${fallbackPortal}/login`);
        return;
      }

      const uid = session.user.id;

      // Check if this user already has a profile for this portal
      if (fallbackPortal === 'recruiter') {
        const { data } = await supabase
          .from('recruiters')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();
        if (data) {
          navigate('/recruiter/dashboard');
        } else {
          navigate('/recruiter/register?via=google');
        }
      } else {
        const { data } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle();
        if (data) {
          navigate('/student/dashboard');
        } else {
          navigate('/student/register?via=google');
        }
      }
    };

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
};

export default AuthCallbackPage;
