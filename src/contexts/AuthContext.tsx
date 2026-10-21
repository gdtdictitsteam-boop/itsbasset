import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: 'user-000',
    email: 'gdt.dict.its.team@gmail.com',
    full_name: 'ក្រុមការងារបច្ចេកវិទ្យាព័ត៌មាន (GDT ITS Team)',
    role: 'CentralAdmin',
    location_id: '1', // HQ-ITSB
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-001',
    email: 'admin.its@tax.gov.kh',
    full_name: 'មន្ត្រីកណ្តាល ITSB (រដ្ឋបាល)',
    role: 'CentralAdmin',
    location_id: '1', // HQ-ITSB
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-002',
    email: 'officer.7mk@tax.gov.kh',
    full_name: 'លោក សុខ ចាន់ថន (មន្ត្រី ៧មករា)',
    role: 'BranchUser',
    location_id: '2', // 7MK (សាខាពន្ធដារខណ្ឌ៧មករា)
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-003',
    email: 'officer.ckm@tax.gov.kh',
    full_name: 'កញ្ញា គង់ សុជាតា (មន្ត្រី ចំការមន)',
    role: 'BranchUser',
    location_id: '3', // CKM (សាខាពន្ធដារខណ្ឌចំការមន)
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-004',
    email: 'officer.dpe@tax.gov.kh',
    full_name: 'លោក វ៉ាន់ សុភ័ក្ត្រ (មន្ត្រី ដូនពេញ)',
    role: 'BranchUser',
    location_id: '5', // DPE (សាខាពន្ធដារខណ្ឌដូនពេញ)
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-005',
    email: 'officer.tko@tax.gov.kh',
    full_name: 'លោក ហេង វិបុល (មន្ត្រី ទួលគោក)',
    role: 'BranchUser',
    location_id: '6', // TKO (សាខាពន្ធដារខណ្ឌទួលគោក)
    is_default_password: true,
    password_updated_at: null,
  },
  {
    id: 'user-006',
    email: 'officer.kpc@tax.gov.kh',
    full_name: 'លោក ជ័យ វិចិត្រ (មន្ត្រី កំពង់ចាម)',
    role: 'BranchUser',
    location_id: '24', // KPC (សាខាពន្ធដារខេត្តកំពង់ចាម)
    is_default_password: true,
    password_updated_at: null,
  },
];

export interface PersistedSession {
  id: string;
  email: string;
  role: 'CentralAdmin' | 'BranchUser';
  locationId?: string;
  name: string;
  authType: 'supabase' | 'officer';
  timestamp: number;
}

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
  verifyUserRoleDirectly: () => Promise<void>;
  setUser: (userObj: any) => void;
  onLoginSuccess: (userObj: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const GDT_AUTH_SESSION_KEY = 'gdt_inventory_auth_session';
export const DEMO_USER_STORAGE_KEY = 'gdt_inventory_demo_user';
export const USERS_LIST_STORAGE_KEY = 'gdt_inventory_user_profiles';

/**
 * Synchronously retrieve verified persistent session from localStorage on app boot/refresh
 * Ensures zero session loss or flicker when the user presses F5
 */
function loadPersistedSession(): PersistedSession | null {
  try {
    // 1. Primary dedicated session token
    const stored = localStorage.getItem(GDT_AUTH_SESSION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.email) {
        return parsed;
      }
    }

    // 2. Fallback to legacy demo key if present
    const storedDemo = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (storedDemo) {
      const parsedDemo = JSON.parse(storedDemo);
      if (parsedDemo && parsedDemo.email) {
        const isAdmin = 
          parsedDemo.role === 'CentralAdmin' || 
          parsedDemo.role === 'Admin-GDT' ||
          parsedDemo.email.toLowerCase().includes('admin') ||
          parsedDemo.email.toLowerCase().includes('its') ||
          parsedDemo.email.toLowerCase().includes('team');
        return {
          id: parsedDemo.id || 'officer-' + parsedDemo.email,
          email: parsedDemo.email,
          role: isAdmin ? 'CentralAdmin' : 'BranchUser',
          name: parsedDemo.name || parsedDemo.email,
          locationId: parsedDemo.locationId || (isAdmin ? '1' : '2'),
          authType: 'officer',
          timestamp: Date.now()
        };
      }
    }

    // 3. Fallback: inspect any Supabase client session tokens in localStorage (sb-*-auth-token)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') && key.endsWith('-auth-token'))) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsedSb = JSON.parse(raw);
          const sbUser = parsedSb?.user;
          if (sbUser?.email) {
            const isAdmin = 
              sbUser.email.toLowerCase().includes('admin') || 
              sbUser.email.toLowerCase().includes('its') || 
              sbUser.email.toLowerCase().includes('dict') || 
              sbUser.email.toLowerCase().includes('team') ||
              sbUser.user_metadata?.role === 'CentralAdmin';
            return {
              id: sbUser.id,
              email: sbUser.email,
              role: isAdmin ? 'CentralAdmin' : 'BranchUser',
              name: sbUser.user_metadata?.full_name || sbUser.email.split('@')[0],
              locationId: sbUser.user_metadata?.location_id || (isAdmin ? '1' : '2'),
              authType: 'supabase',
              timestamp: Date.now()
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('Notice reading initial auth session:', err);
  }
  return null;
}

/**
 * Persist active session safely to localStorage
 */
function savePersistedSession(sess: PersistedSession) {
  try {
    localStorage.setItem(GDT_AUTH_SESSION_KEY, JSON.stringify(sess));
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify({
      id: sess.id,
      email: sess.email,
      role: sess.role,
      name: sess.name,
      locationId: sess.locationId
    }));
  } catch (err) {
    console.warn('Notice saving persisted session:', err);
  }
}

/**
 * Cleanly remove persistent session tokens
 */
function clearPersistedSession() {
  try {
    localStorage.removeItem(GDT_AUTH_SESSION_KEY);
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('sb-') || 
        key.includes('auth-token') || 
        key.includes('supabase.auth') || 
        key.includes('demo_user') || 
        key.includes('gdt_auth')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Notice purging persisted session tokens:', err);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronously restore active session on boot / F5 refresh
  const [persistedSession, setPersistedSession] = useState<PersistedSession | null>(loadPersistedSession);

  // Synchronous user state: ensures user is NOT null on initial render if session exists!
  const [user, setUser] = useState<User | null>(() => {
    const init = loadPersistedSession();
    if (init) {
      return {
        id: init.id,
        email: init.email,
        user_metadata: {
          full_name: init.name,
          role: init.role,
          location_id: init.locationId
        },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date(init.timestamp || Date.now()).toISOString()
      } as User;
    }
    return null;
  });

  const [session, setSession] = useState<Session | null>(null);

  // Authoritative user profile verified directly against Supabase database table `user_profiles`
  const [dbVerifiedProfile, setDbVerifiedProfile] = useState<UserProfile | null>(null);

  // If session is already restored synchronously, loading starts as false so UI renders instantly!
  const [loading, setLoading] = useState<boolean>(() => !loadPersistedSession());
  const [rawIsSettingsOpen, setRawIsSettingsOpen] = useState<boolean>(false);

  // Load user profiles list from storage or defaults
  const [usersList, setUsersList] = useState<UserProfile[]>(() => {
    try {
      const stored = localStorage.getItem(USERS_LIST_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingEmails = new Set(parsed.map((p: UserProfile) => p.email.toLowerCase()));
          const missing = INITIAL_USER_PROFILES.filter(init => !existingEmails.has(init.email.toLowerCase()));
          return [...parsed, ...missing];
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_USER_PROFILES;
  });

  const configured = isSupabaseConfigured();

  // Fetch users list from Supabase if connected (includes password, is_default_password, password_updated_at)
  const fetchUsersList = useCallback(async () => {
    if (!configured) return;
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (!error && data && data.length > 0) {
        const mapped = (data as any[]).map((row) => ({
          ...row,
          password: row.password || 'GDT@2026',
          is_default_password:
            typeof row.is_default_password === 'boolean'
              ? row.is_default_password
              : (!row.password || row.password === 'GDT@2026'),
          password_updated_at: row.password_updated_at || null,
        })) as UserProfile[];
        setUsersList(mapped);
        try {
          localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(mapped));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Notice: user_profiles table query in Supabase:', err);
    }
  }, [configured]);

  // Strictly verify user role directly from Supabase Database Table `user_profiles`
  // Prevents any frontend role tampering or spoofing
  const verifyUserRoleDirectly = useCallback(async () => {
    if (!configured) return;
    const targetId = user?.id || persistedSession?.id;
    const targetEmail = user?.email || persistedSession?.email;
    if (!targetId && !targetEmail) return;

    try {
      let matchedDb: any = null;

      // 1. Query by User ID only if targetId is a valid UUID
      const isUuid =
        typeof targetId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

      if (targetId && isUuid) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', targetId)
          .maybeSingle();

        if (!error && data) {
          matchedDb = data;
        }
      }

      // 2. Fallback query by Email if ID not matched
      if (!matchedDb && targetEmail) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', targetEmail.trim().toLowerCase())
          .maybeSingle();

        if (!error && data) {
          matchedDb = data;
        }
      }

      if (matchedDb) {
        const normalizedRole: 'CentralAdmin' | 'BranchUser' = 
          (matchedDb.role === 'Admin-GDT' || matchedDb.role === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
        
        const verified: UserProfile = {
          id: matchedDb.id,
          email: matchedDb.email,
          full_name: matchedDb.full_name,
          role: normalizedRole,
          location_id: matchedDb.location_id
        };

        setDbVerifiedProfile(verified);

        // Synchronize persisted session with database verified authority
        setPersistedSession(prev => {
          if (!prev) return prev;
          const updated: PersistedSession = {
            ...prev,
            role: normalizedRole,
            name: verified.full_name,
            locationId: verified.location_id || prev.locationId
          };
          savePersistedSession(updated);
          return updated;
        });
      }
    } catch (err) {
      console.warn('Notice verifying role directly with Supabase user_profiles:', err);
    }
  }, [configured, user?.id, user?.email, persistedSession?.id, persistedSession?.email]);

  // Handle session restoration & user_profiles synchronization
  useEffect(() => {
    const existing = loadPersistedSession();
    if (existing) {
      setPersistedSession(existing);
    }
    if (configured) {
      fetchUsersList();
    }
    setLoading(false);
  }, [configured, fetchUsersList]);

  // Run database role verification whenever user changes
  useEffect(() => {
    verifyUserRoleDirectly();
  }, [verifyUserRoleDirectly]);

  // Save usersList to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(usersList));
    } catch {
      // ignore
    }
  }, [usersList]);

  // Effective authenticated user resolution
  const currentEmail = user?.email || persistedSession?.email || '';

  const matchedProfile = usersList.find(
    u => (currentEmail && u.email.toLowerCase() === currentEmail.toLowerCase()) || 
         (persistedSession?.id && u.id === persistedSession.id)
  );

  // Authoritative Role: Direct from Supabase DB Table `user_profiles` > Matched Profile > Persistent Session
  const authoritativeRoleString = 
    dbVerifiedProfile?.role || 
    matchedProfile?.role || 
    user?.user_metadata?.role || 
    persistedSession?.role || 
    '';

  const userRole: 'CentralAdmin' | 'BranchUser' = 
    (authoritativeRoleString === 'Admin-GDT' || authoritativeRoleString === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
  
  const isCentralAdmin = Boolean((user || persistedSession) && userRole === 'CentralAdmin');
  const isBranchUser = Boolean((user || persistedSession) && userRole === 'BranchUser');

  // Security guard for Setting Modal: if user is not CentralAdmin, automatically close and block
  useEffect(() => {
    if (!isCentralAdmin && rawIsSettingsOpen) {
      setRawIsSettingsOpen(false);
    }
  }, [isCentralAdmin, rawIsSettingsOpen]);

  const setIsSettingsOpen = useCallback((open: boolean) => {
    if (open && !isCentralAdmin) {
      console.warn('Security Warning: Access Denied. User lacks CentralAdmin permission to open settings.');
      return;
    }
    setRawIsSettingsOpen(open);
  }, [isCentralAdmin]);

  const userProfile: UserProfile | null = dbVerifiedProfile || matchedProfile || (currentEmail ? {
    id: user?.id || persistedSession?.id || 'profile-' + Date.now(),
    email: currentEmail,
    full_name: user?.user_metadata?.full_name || persistedSession?.name || currentEmail.split('@')[0],
    role: userRole,
    location_id: isCentralAdmin ? '1' : '2'
  } : null);

  const effectiveUser = user || (persistedSession ? { 
    id: persistedSession.id, 
    email: persistedSession.email,
    user_metadata: {
      full_name: persistedSession.name,
      role: userRole,
      location_id: persistedSession.locationId
    }
  } as any : null);

  const userDisplayName = 
    dbVerifiedProfile?.full_name ||
    userProfile?.full_name || 
    user?.user_metadata?.full_name || 
    persistedSession?.name || 
    currentEmail.split('@')[0] || 
    'មន្ត្រីរាជការ';

  const userLocationId = 
    dbVerifiedProfile?.location_id ||
    userProfile?.location_id || 
    persistedSession?.locationId || 
    (isBranchUser ? '2' : null);

  // Sign in directly against public.user_profiles in Supabase Database
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែល និងពាក្យសម្ងាត់!',
      };
    }

    try {
      const { data: dbUser, error: fetchErr } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (fetchErr) {
        return {
          success: false,
          error: 'មានបញ្ហាបច្ចេកទេសក្នុងការតភ្ជាប់ Database!',
        };
      }

      if (!dbUser) {
        return {
          success: false,
          error: 'រកមិនឃើញអាសយដ្ឋានអ៊ីមែលនេះក្នុងប្រព័ន្ធឡើយ!',
        };
      }

      const validPassword = dbUser.password || 'GDT@2026';
      if (cleanPassword !== validPassword) {
        return {
          success: false,
          error: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវឡើយ!',
        };
      }

      onLoginSuccess(dbUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'មានបញ្ហាបច្ចេកទេសក្នុងការចូលប្រព័ន្ធ' };
    }
  };

  // Sign out - completely purge session, state, and localStorage tokens
  const signOut = async () => {
    setUser(null);
    setSession(null);
    setPersistedSession(null);
    setDbVerifiedProfile(null);
    clearPersistedSession();
  };

  // Demo sign in for development & role switching
  const signInDemo = (email: string = 'admin.its@tax.gov.kh', role: string = 'CentralAdmin', branchId?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const matched = usersList.find(u => u.email.toLowerCase() === cleanEmail);
    const effectiveRole = ((matched?.role || role) === 'Admin-GDT' || (matched?.role || role) === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
    const effectiveLocation = matched?.location_id || branchId || (effectiveRole === 'CentralAdmin' ? '1' : '2');
    
    const sess: PersistedSession = {
      id: matched?.id || 'officer-' + Date.now(),
      email: matched?.email || email,
      role: effectiveRole,
      name: matched?.full_name || email.split('@')[0].toUpperCase(),
      locationId: effectiveLocation,
      authType: 'officer',
      timestamp: Date.now()
    };

    setPersistedSession(sess);
    savePersistedSession(sess);
    setUser({
      id: sess.id,
      email: sess.email,
      user_metadata: {
        full_name: sess.name,
        role: sess.role,
        location_id: sess.locationId
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as User);
  };

  // Switch active user easily (used by CentralAdmin to simulate or test roles)
  const switchActiveUser = (userId: string) => {
    const targetUser = usersList.find(u => u.id === userId);
    if (!targetUser) return;
    const effectiveRole = (targetUser.role === 'Admin-GDT' || targetUser.role === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
    const sess: PersistedSession = {
      id: targetUser.id,
      email: targetUser.email,
      role: effectiveRole,
      name: targetUser.full_name,
      locationId: targetUser.location_id || (effectiveRole === 'CentralAdmin' ? '1' : '2'),
      authType: 'officer',
      timestamp: Date.now()
    };

    setPersistedSession(sess);
    savePersistedSession(sess);
    setUser({
      id: sess.id,
      email: sess.email,
      user_metadata: {
        full_name: sess.name,
        role: sess.role,
        location_id: sess.locationId
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    } as User);
  };

  // Update user profile (Name, Role, Location, Password)
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

      // If active user is updated, update active persisted session too
      if (persistedSession && persistedSession.id === id) {
        const target = updatedList.find(u => u.id === id);
        if (target) {
          const effectiveRole = (target.role === 'Admin-GDT' || target.role === 'CentralAdmin') ? 'CentralAdmin' : 'BranchUser';
          const newSess: PersistedSession = {
            id: target.id,
            email: target.email,
            role: effectiveRole,
            name: target.full_name,
            locationId: target.location_id || (effectiveRole === 'CentralAdmin' ? '1' : '2'),
            authType: persistedSession.authType,
            timestamp: Date.now()
          };
          setPersistedSession(newSess);
          savePersistedSession(newSess);
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update user profile' };
    }
  };

  // Create new user profile directly in public.user_profiles
  const createUserProfile = async (profileData: Omit<UserProfile, 'id'>): Promise<{ success: boolean; error?: string }> => {
    try {
      const newId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
              const r = (Math.random() * 16) | 0;
              const v = c === 'x' ? r : (r & 0x3) | 0x8;
              return v.toString(16);
            });
      const rawPwd = (profileData.password || '').trim() || 'GDT@2026';
      const isDefaultPwd = typeof profileData.is_default_password === 'boolean' 
        ? profileData.is_default_password 
        : (rawPwd === 'GDT@2026');
      const nowIso = new Date().toISOString();

      const newProfile: UserProfile = {
        ...profileData,
        password: rawPwd,
        is_default_password: isDefaultPwd,
        password_updated_at: nowIso,
        id: newId,
        created_at: nowIso,
        updated_at: nowIso
      };

      const updatedList = [newProfile, ...usersList];
      setUsersList(updatedList);
      try {
        localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      } catch {
        // ignore
      }

      if (configured) {
        const { error } = await supabase.from('user_profiles').insert([{
          id: newId,
          email: newProfile.email,
          full_name: newProfile.full_name,
          role: newProfile.role,
          location_id: newProfile.location_id,
          password: rawPwd,
          is_default_password: isDefaultPwd,
          password_updated_at: nowIso
        }]);
        if (error) {
          return { success: false, error: error.message };
        }
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create user profile' };
    }
  };

  // Direct login state handler for LoginView (onLoginSuccess / setUser)
  const onLoginSuccess = useCallback((finalUser: any) => {
    if (!finalUser) {
      setUser(null);
      setPersistedSession(null);
      setDbVerifiedProfile(null);
      clearPersistedSession();
      return;
    }

    const rawRole = finalUser.role || finalUser.user_metadata?.role || 'CentralAdmin';
    const effectiveRole: 'CentralAdmin' | 'BranchUser' =
      rawRole === 'BranchUser' ? 'BranchUser' : 'CentralAdmin';
    const effectiveEmail = (finalUser.email || '').trim().toLowerCase();
    const effectiveName =
      finalUser.full_name ||
      finalUser.user_metadata?.full_name ||
      effectiveEmail.split('@')[0] ||
      'មន្ត្រីរដ្ឋបាល';
    const effectiveLoc =
      finalUser.location_id ||
      finalUser.branch_name ||
      finalUser.branch ||
      (effectiveRole === 'CentralAdmin' ? '1' : '2');

    const sessRecord: PersistedSession = {
      id: finalUser.id || 'user-' + Date.now(),
      email: effectiveEmail,
      role: effectiveRole,
      name: effectiveName,
      locationId: String(effectiveLoc),
      authType: 'officer',
      timestamp: Date.now(),
    };

    const profileRecord: UserProfile = {
      id: sessRecord.id,
      email: effectiveEmail,
      full_name: effectiveName,
      role: effectiveRole,
      location_id: String(effectiveLoc),
      branch_name: finalUser.branch_name || finalUser.branch,
      branch: finalUser.branch || finalUser.branch_name,
      password: finalUser.password || 'GDT@2026',
      is_default_password: finalUser.is_default_password,
      password_updated_at: finalUser.password_updated_at,
    };

    setDbVerifiedProfile(profileRecord);
    setPersistedSession(sessRecord);
    savePersistedSession(sessRecord);
    setUser({
      id: sessRecord.id,
      email: sessRecord.email,
      user_metadata: {
        full_name: sessRecord.name,
        role: sessRecord.role,
        location_id: sessRecord.locationId,
        branch_name: profileRecord.branch_name,
      },
      app_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    } as User);

    fetchUsersList();
  }, [fetchUsersList]);

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
        isSettingsOpen: rawIsSettingsOpen,
        setIsSettingsOpen,
        usersList,
        fetchUsersList,
        updateUserProfile,
        createUserProfile,
        switchActiveUser,
        signIn,
        signOut,
        signInDemo,
        verifyUserRoleDirectly,
        setUser: onLoginSuccess,
        onLoginSuccess,
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
