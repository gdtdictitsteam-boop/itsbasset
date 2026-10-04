import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: 'user-001',
    email: 'admin.its@tax.gov.kh',
    full_name: 'មន្ត្រីកណ្តាល ITSB (រដ្ឋបាល)',
    role: 'CentralAdmin',
    location_id: '1', // HQ-ITSB
  },
  {
    id: 'user-002',
    email: 'officer.7mk@tax.gov.kh',
    full_name: 'លោក សុខ ចាន់ថន (មន្ត្រី ៧មករា)',
    role: 'BranchUser',
    location_id: '2', // 7MK (សាខាពន្ធដារខណ្ឌ៧មករា)
  },
  {
    id: 'user-003',
    email: 'officer.ckm@tax.gov.kh',
    full_name: 'កញ្ញា គង់ សុជាតា (មន្ត្រី ចំការមន)',
    role: 'BranchUser',
    location_id: '3', // CKM (សាខាពន្ធដារខណ្ឌចំការមន)
  },
  {
    id: 'user-004',
    email: 'officer.dpe@tax.gov.kh',
    full_name: 'លោក វ៉ាន់ សុភ័ក្ត្រ (មន្ត្រី ដូនពេញ)',
    role: 'BranchUser',
    location_id: '5', // DPE (សាខាពន្ធដារខណ្ឌដូនពេញ)
  },
  {
    id: 'user-005',
    email: 'officer.tko@tax.gov.kh',
    full_name: 'លោក ហេង វិបុល (មន្ត្រី ទួលគោក)',
    role: 'BranchUser',
    location_id: '6', // TKO (សាខាពន្ធដារខណ្ឌទួលគោក)
  },
  {
    id: 'user-006',
    email: 'officer.kpc@tax.gov.kh',
    full_name: 'លោក ជ័យ វិចិត្រ (មន្ត្រី កំពង់ចាម)',
    role: 'BranchUser',
    location_id: '24', // KPC (សាខាពន្ធដារខេត្តកំពង់ចាម)
  },
];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string; // 'CentralAdmin' | 'BranchUser'
  userDisplayName: string;
  userProfile: UserProfile | null;
  userLocationId: string | null;
  isCentralAdmin: boolean;
  isBranchUser: boolean;
  isConfigured: boolean;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  usersList: UserProfile[];
  fetchUsersList: () => Promise<void>;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  createUserProfile: (profile: Omit<UserProfile, 'id'>) => Promise<{ success: boolean; error?: string }>;
  switchActiveUser: (userId: string) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  signInDemo: (email?: string, role?: string, branchId?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_USER_STORAGE_KEY = 'gdt_inventory_demo_user';
const USERS_LIST_STORAGE_KEY = 'gdt_inventory_user_profiles';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Load user profiles list from storage or defaults
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    try {
      const stored = localStorage.getItem(USERS_LIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_USER_PROFILES;
  });

  // Demo user state
  const [demoUser, setDemoUser] = useState<{ email: string; role: string; name: string; locationId?: string; id?: string } | null>(() => {
    try {
      const stored = localStorage.getItem(DEMO_USER_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {
        id: 'user-001',
        email: 'admin.its@tax.gov.kh',
        role: 'CentralAdmin',
        name: 'មន្ត្រីកណ្តាល ITSB (រដ្ឋបាល)',
        locationId: '1'
      };
    } catch {
      return null;
    }
  });

  const configured = isSupabaseConfigured();

  // Fetch users from Supabase if connected
  const fetchUsersList = useCallback(async () => {
    if (!configured) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!error && data && data.length > 0) {
        setUsersList(data as UserProfile[]);
        try {
          localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(data));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Notice: user_profiles table query in Supabase:', err);
    }
  }, [configured]);

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

    // 2. Fetch users profiles
    fetchUsersList();

    // 3. Listen to auth state changes
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
  }, [configured, fetchUsersList]);

  // Save usersList to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(usersList));
    } catch {
      // ignore
    }
  }, [usersList]);

  // Sign in with Supabase Auth
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!configured) {
      // Fallback demo signin
      const matched = usersList.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (matched) {
        signInDemo(matched.email, matched.role, matched.location_id || undefined);
      } else {
        const defaultRole = email.includes('branch') ? 'BranchUser' : 'CentralAdmin';
        signInDemo(email, defaultRole);
      }
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
      await fetchUsersList();
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
  const signInDemo = (email: string = 'admin.its@tax.gov.kh', role: string = 'CentralAdmin', branchId?: string) => {
    const matched = usersList.find(u => u.email.toLowerCase() === email.toLowerCase());
    const demo = {
      id: matched?.id || 'demo-' + Date.now(),
      email,
      role: matched?.role || role,
      name: matched?.full_name || email.split('@')[0].toUpperCase(),
      locationId: matched?.location_id || branchId || (role === 'CentralAdmin' ? '1' : '2')
    };
    setDemoUser(demo);
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demo));
  };

  // Switch active user easily (used by CentralAdmin to simulate or test roles)
  const switchActiveUser = (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser) return;
    const demo = {
      id: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      name: targetUser.full_name,
      locationId: targetUser.location_id || (targetUser.role === 'CentralAdmin' ? '1' : '2')
    };
    setDemoUser(demo);
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(demo));
  };

  // Update user profile (Name, Role, Location)
  const updateUserProfile = async (id: string, updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    try {
      const updatedList = usersList.map(u => {
        if (u.id === id) {
          return {
            ...u,
            ...updates,
            updated_at: new Date().toISOString()
          };
        }
        return u;
      });

      setUsersList(updatedList);
      try {
        localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      // If active user is updated, update active state too
      if (demoUser && demoUser.id === id) {
        const target = updatedList.find(u => u.id === id);
        if (target) {
          const newDemo = {
            id: target.id,
            email: target.email,
            role: target.role,
            name: target.full_name,
            locationId: target.location_id || undefined
          };
          setDemoUser(newDemo);
          localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(newDemo));
        }
      }

      // Update Supabase if configured
      if (configured) {
        const target = updatedList.find(u => u.id === id);
        if (target) {
          const { error } = await supabase.from('user_profiles').upsert({
            id: target.id,
            email: target.email,
            full_name: target.full_name,
            role: target.role,
            location_id: target.location_id,
            updated_at: new Date().toISOString()
          });
          if (error) {
            console.warn('Notice updating user_profiles in Supabase:', error.message);
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user profile' };
    }
  };

  // Create new user profile
  const createUserProfile = async (profileData: Omit<UserProfile, 'id'>): Promise<{ success: boolean; error?: string }> => {
    try {
      const newId = 'user-' + Date.now();
      const newProfile: UserProfile = {
        ...profileData,
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updatedList = [newProfile, ...usersList];
      setUsersList(updatedList);
      try {
        localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      if (configured) {
        await supabase.from('user_profiles').insert([{
          id: newId,
          email: newProfile.email,
          full_name: newProfile.full_name,
          role: newProfile.role,
          location_id: newProfile.location_id
        }]);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create user profile' };
    }
  };

  // Find effective current profile
  const currentEmail = user?.email || demoUser?.email;
  const userProfile: UserProfile | null = usersList.find(
    u => (currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase()) || (demoUser?.id && u.id === demoUser.id)
  ) || (demoUser ? {
    id: demoUser.id || 'demo-active',
    email: demoUser.email,
    full_name: demoUser.name,
    role: (demoUser.role === 'Admin-GDT' ? 'CentralAdmin' : demoUser.role) as 'CentralAdmin' | 'BranchUser',
    location_id: demoUser.locationId || null
  } : null);

  const effectiveUser = user || (demoUser ? { email: demoUser.email } as any : null);

  const rawRole = userProfile?.role || user?.user_metadata?.role || demoUser?.role || (user ? 'CentralAdmin' : 'CentralAdmin');
  
  // Normalize role string
  const userRole = (rawRole === 'Admin-GDT' || rawRole === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
  const isCentralAdmin = userRole === 'CentralAdmin';
  const isBranchUser = userRole === 'BranchUser';

  const userDisplayName = userProfile?.full_name || 
    user?.user_metadata?.full_name || 
    demoUser?.name || 
    user?.email?.split('@')[0] || 
    'មន្ត្រីកណ្តាល ITSB';

  const userLocationId = userProfile?.location_id || demoUser?.locationId || (isBranchUser ? '2' : null);

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        session,
        loading,
        userRole,
        userDisplayName,
        userProfile,
        userLocationId,
        isCentralAdmin,
        isBranchUser,
        isConfigured: configured,
        isSettingsOpen,
        setIsSettingsOpen,
        usersList,
        fetchUsersList,
        updateUserProfile,
        createUserProfile,
        switchActiveUser,
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
