import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SCRIPT;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(s);
  });
}

/**
 * Local-database Google Sign-In button (Google Identity Services).
 * Requires VITE_GOOGLE_CLIENT_ID (same value as backend GOOGLE_CLIENT_ID).
 * Verifies the ID token against Google in POST /api/auth/google, then
 * find-or-creates User + Student/Recruiter rows and stores the JWT.
 */
const GoogleSignInButton: React.FC<{ portal: 'student' | 'recruiter' }> = ({ portal }) => {
  const { signInWithGoogleIdToken } = useAuth();
  const { toast } = useToast();
  const btnRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      setError('Google login needs VITE_GOOGLE_CLIENT_ID. See .env.example.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await loadGis();
        if (cancelled || !btnRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: any) => {
            const idToken = resp?.credential;
            if (!idToken) {
              toast({ title: 'Google sign-in failed', description: 'No credential returned.', variant: 'destructive' });
              return;
            }
            const { error: err } = await signInWithGoogleIdToken(idToken, portal);
            if (err) {
              toast({ title: 'Google sign-in failed', description: err, variant: 'destructive' });
            }
            // Success navigation is handled by the login page's auth effect.
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setLoading(false);
          setError(e?.message || 'Failed to load Google Sign-In');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, portal, signInWithGoogleIdToken, toast]);

  if (!clientId) return null;

  return (
    <div className="w-full">
      {loading && (
        <div className="w-full h-11 flex items-center justify-center gap-2 border rounded-md text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading Google…
        </div>
      )}
      {error && !loading && (
        <div className="w-full text-xs text-muted-foreground border rounded-md px-3 py-2">{error}</div>
      )}
      <div ref={btnRef} className={loading ? 'hidden' : 'w-full flex justify-center'} />
    </div>
  );
};

export default GoogleSignInButton;
