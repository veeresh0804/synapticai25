import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || 'http://localhost:8081';

export type UserType = 'recruiter' | 'student' | 'admin' | null;

export interface RecruiterProfile {
  id: string;
  user_id: string;
  company_name: string;
  recruiter_name: string;
  email: string;
  designation?: string;
  company_website?: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  institution: string;
  degree: string;
  branch: string;
  graduation_year: number;
  profile_complete: boolean;
}

interface AuthContextType {
  user: User | null;
  userType: UserType;
  isAuthenticated: boolean;
  isLoading: boolean;
  recruiterProfile: RecruiterProfile | null;
  studentProfile: StudentProfile | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null; message?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (portal: 'student' | 'recruiter') => Promise<{ error: string | null }>;
  signInWithGoogleIdToken: (idToken: string, portal: 'student' | 'recruiter') => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<UserType>(null);
  const [recruiterProfile, setRecruiterProfile] = useState<RecruiterProfile | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const uid = session.user.id;

        // 1. Check if recruiter profile exists
        const { data: recProfile } = await supabase
          .from('recruiters')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (recProfile) {
          setRecruiterProfile(recProfile);
          setStudentProfile(null);
          setUserType('recruiter');
          setIsLoading(false);
          return;
        }

        // 2. Check if student profile exists
        const { data: studProfile } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (studProfile) {
          setStudentProfile(studProfile);
          setRecruiterProfile(null);
          setUserType('student');
          setIsLoading(false);
          return;
        }

        // 3. Check if admin profile exists (optional role check)
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', uid)
          .eq('role', 'admin')
          .maybeSingle();

        if (adminRole) {
          setUserType('admin');
          setRecruiterProfile(null);
          setStudentProfile(null);
        } else {
          setUserType(null); // Google sign up redirect callback state
        }
      } else {
        setUser(null);
        setUserType(null);
        setRecruiterProfile(null);
        setStudentProfile(null);
      }
    } catch (e) {
      console.error("Error loading session:", e);
      setUser(null);
      setUserType(null);
      setRecruiterProfile(null);
      setStudentProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const refreshProfile = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (!error) {
      await loadSession();
      return { error: null, message: "Check your email to verify your account." };
    }
    return { error: error?.message || null };
  }, [loadSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await loadSession();
    }
    return { error: error?.message || null };
  }, [loadSession]);

  const signInWithGoogle = useCallback(async (portal: 'student' | 'recruiter') => {
    const redirectTo = `${window.location.origin}/auth/callback?portal=${portal}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    } as any);
    return { error: error?.message || null };
  }, []);

  const signInWithGoogleIdToken = useCallback(async (idToken: string, portal: 'student' | 'recruiter') => {
    const client = supabase as any;
    if (typeof client.auth?.signInWithGoogleIdToken !== 'function') {
      return { error: 'Google sign-in is not available in Supabase Cloud mode. Use Continue with Google (OAuth).' };
    }
    const { error } = await client.auth.signInWithGoogleIdToken(idToken, portal);
    if (!error) {
      await loadSession();
    }
    return { error: error?.message || null };
  }, [loadSession]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserType(null);
    setRecruiterProfile(null);
    setStudentProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      userType,
      isAuthenticated: !!user && userType !== null && !isLoading,
      isLoading: isLoading,
      recruiterProfile,
      studentProfile,
      signUp,
      signIn,
      signInWithGoogle,
      signInWithGoogleIdToken,
      logout,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
