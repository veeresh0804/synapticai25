import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

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
    const token = localStorage.getItem('sb_token');
    if (!token) {
      setUser(null);
      setUserType(null);
      setRecruiterProfile(null);
      setStudentProfile(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:8081/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser({ id: data.id, email: data.email } as any);
        setUserType(data.role as UserType);
        if (data.role === 'student') {
          setStudentProfile(data.profile);
          setRecruiterProfile(null);
        } else if (data.role === 'recruiter') {
          setRecruiterProfile(data.profile);
          setStudentProfile(null);
        }
      } else {
        localStorage.removeItem('sb_token');
        setUser(null);
        setUserType(null);
        setRecruiterProfile(null);
        setStudentProfile(null);
      }
    } catch (e) {
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
    });
    return { error: error?.message || null };
  }, []);

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
