import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string; // 'CentralAdmin' | 'BranchUser' | 'Admin-GDT'
  userDisplayName: string;
  isCentralAdmin: boolean;
  isBranchUser: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signInDemo: (email?: string, role?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_STORAGE_KEY = 'gdt_inventory_demo_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoUser, setDemoUser] = useState<{ email: string; role: string; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.warn('Error fetching Supabase auth session:', err);
      setLoading(false);
    });

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setDemoUser(null);
        localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured]);

  // Sign in with Supabase Auth
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!configured) {
      // Fallback demo signin if Supabase credentials are missing
      const defaultRole = email.includes('branch') ? 'BranchUser' : 'CentralAdmin';
      signInDemo(email, defaultRole);
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setDemoUser(null);
      localStorage.removeItem(DEMO_USER_STORAGE_KEY);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'មានបញ្ហាបរាជ័យក្នុងការចូលប្រព័ន្ធ' };
    }
  };

  // Sign out
  const signOut = async () => {
    if (configured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout notice:', err);
      }
    }
    setUser(null);
    setSession(null);
    setDemoUser(null);
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
  };

  // Demo sign in for development & offline testing
  const signInDemo = (email: string = 'admin.its@tax.gov.kh', role: string = 'CentralAdmin') => {
    const demo = {
      email,
      role,
      name: email.split('@')[0].toUpperCase(),
    };
    setDemoUser(demo);
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demo));
  };

  // Calculate user role & display name
  const effectiveUser = user || (demoUser ? { email: demoUser.email } as any : null);

  const rawRole = user?.user_metadata?.role || demoUser?.role || (user ? 'CentralAdmin' : 'Guest');
  
  // Normalize role string
  const userRole = rawRole === 'Admin-GDT' ? 'CentralAdmin' : rawRole;
  const isCentralAdmin = userRole === 'CentralAdmin' || userRole === 'Admin-GDT';
  const isBranchUser = userRole === 'BranchUser';

  const userDisplayName = user?.user_metadata?.full_name || 
    user?.email?.split('@')[0] || 
    demoUser?.name || 
    demoUser?.email || 
    'CentralAdmin';

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session,
        loading,
        userRole,
        userDisplayName,
        isCentralAdmin,
        isBranchUser,
        isConfigured: configured,
        signIn,
        signOut,
        signInDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
