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
      const portal = searchParams.get('portal') as 'student' | 'recruiter' | null;
      const fallbackPortal = portal === 'recruiter' ? 'recruiter' : 'student';

      // Supabase JS v2 auto-exchanges the hash tokens on initialisation.
      // We just need to wait for the session to be available.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        toast({
          title: 'Sign-in failed',
          description: error?.message || 'Could not complete Google sign-in. Please try again.',
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
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">Signing you in…</p>
    </div>
  );
};

export default AuthCallbackPage;
