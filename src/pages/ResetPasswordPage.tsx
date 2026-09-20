import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Seo from '@/components/Seo';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event from the auth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    // Also check hash for type=recovery (in case event already fired)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Local mock mode: Forgot page sets sb_recovery flag since there is no SMTP.
    // Allow the form to open so demo users aren't stuck on "Invalid Link".
    try {
      if (localStorage.getItem('sb_recovery')) setIsRecovery(true);
    } catch { /* ignore */ }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      toast({ title: 'Weak password', description: 'Use 8+ characters with letters and numbers (avoid common passwords like password1).', variant: 'destructive' });
      return;
    }
    if (['password1', '12345678', 'password123'].includes(password.toLowerCase())) {
      toast({ title: 'Too common', description: 'Please choose a less predictable password.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
      navigate('/student/login');
    }
    setIsLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md text-center">
          <Card className="glass-card animate-fade-in">
            <CardHeader>
              <CardTitle className="text-2xl">Invalid Link</CardTitle>
              <CardDescription>This password reset link is invalid or has expired. Please request a new one.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/forgot-password')} className="btn-primary">Request New Link</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 flex items-center justify-center">
      <Seo
        title="Set a New Password | SynapticAI"
        description="Choose a new password for your SynapticAI account and get back to hiring or applying."
        path="/reset-password"
      />
      <div className="container mx-auto px-4 max-w-md">
        <Card className="glass-card animate-fade-in">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold leading-none tracking-tight">Set New Password</h1>
            <CardDescription>Enter your new password below.</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> New Password</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} required value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> Confirm Password</Label>
                <Input type="password" required value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="btn-primary w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</> : 'Update Password'}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
