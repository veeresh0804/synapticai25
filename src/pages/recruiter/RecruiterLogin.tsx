import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import Seo from '@/components/Seo';
import PageShell from '@/components/shared/PageShell';

const RecruiterLogin: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, isLoading: authLoading, isAuthenticated, userType, logout, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    if (error) {
      toast({ title: 'Login failed', description: error, variant: 'destructive' });
      setIsLoading(false);
    }
    // Do NOT navigate here â€” let the useEffect below handle it
  };

  const handleGoogleSignIn = async () => {
    const { error } = await signInWithGoogle('recruiter');
    if (error) {
      toast({ title: 'Google sign-in failed', description: error, variant: 'destructive' });
    }
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!authLoading) {
      if (isAuthenticated) {
        if (userType === 'recruiter') {
          navigate('/recruiter/dashboard');
        } else if (userType === 'student') {
          toast({ title: 'Wrong portal', description: 'You are signed in as a student. Redirecting to the Student portal.', variant: 'destructive' });
          setIsLoading(false);
          navigate('/student/dashboard');
        } else if (userType === 'admin') {
          setIsLoading(false);
          navigate('/admin/dashboard');
        }
      } else if (user) {
        navigate('/auth/callback?portal=recruiter');
      } else {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, userType, user, navigate]);

  return (
    <PageShell className="flex items-center justify-center">
      <Seo
        title="Recruiter Login | SynapticAI"
        description="Sign in to SynapticAI's recruiter portal to manage jobs, rank candidates, and run AI-powered hiring workflows."
        path="/recruiter/login"
      />
      <div className="container mx-auto px-4 max-w-md">
        <Card className="surface-card animate-fade-in">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Recruiter Login</h1>
            <CardDescription>Sign in to manage your hiring pipeline</CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {googleClientId ? (
                <GoogleSignInButton portal="recruiter" />
              ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center gap-3 h-11"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google (Supabase Cloud)
              </Button>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="w-4 h-4" /> Email</Label>
                <Input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="recruiter@company.com" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> Password</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Signing in...</> : 'Sign In'}
              </Button>
            </CardContent>
          </form>

          <CardFooter className="flex flex-col space-y-4">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline text-center">Forgot password?</Link>
            <p className="text-sm text-muted-foreground text-center">
              Don't have an account? <Link to="/recruiter/register" className="text-primary hover:underline">Register</Link>
            </p>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground text-center">â† Back to Home</Link>
          </CardFooter>
        </Card>
      </div>
    </PageShell>
  );
};

export default RecruiterLogin;
