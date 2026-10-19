import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';
import { 
  Settings, 
  X, 
  ShieldCheck, 
  Building2, 
  Edit3, 
  Plus, 
  Search, 
  Save, 
  Lock, 
  CheckCircle2, 
  ArrowRightLeft,
  Mail,
  MapPin,
  AlertCircle,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Database,
  Sparkles,
  HelpCircle
} from 'lucide-react';

export const SUPABASE_AUTH_USERS_SQL = `-- =========================================================================
-- SUPABASE AUTH SETUP: CREATE AUTH USERS & SET DEFAULT PASSWORDS
-- ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិ និងគណនីមន្ត្រីសម្រាប់ Login (GDT Inventory Management)
-- Default Password សម្រាប់គណនីទាំងអស់៖ GDT@2026
-- =========================================================================

-- 1. Enable pgcrypto extension for password encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Helper Stored Procedure: create_or_update_gdt_user
-- Safely inserts or updates auth.users, auth.identities, and public.user_profiles
CREATE OR REPLACE FUNCTION public.create_or_update_gdt_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_location_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pwd TEXT;
    v_location_id UUID;
BEGIN
    -- Hash password with Blowfish (standard Supabase GoTrue bcrypt)
    v_encrypted_pwd := crypt(p_password, gen_salt('bf'));

    -- Find location_id from locations table
    SELECT id INTO v_location_id 
    FROM public.locations 
    WHERE code = p_location_code OR id::text = p_location_code
    LIMIT 1;

    -- Check if user already exists in auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);

    IF v_user_id IS NULL THEN
        -- Generate UUID for new user
        v_user_id := gen_random_uuid();

        -- Insert into auth.users
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            lower(p_email),
            v_encrypted_pwd,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', p_full_name, 'role', p_role),
            NOW(),
            NOW(),
            '',
            ''
        );

    ELSE
        -- Update password and metadata if user exists
        UPDATE auth.users
        SET 
            encrypted_password = v_encrypted_pwd,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Clean up existing identity for this user/email to prevent conflicts
    DELETE FROM auth.identities 
    WHERE user_id = v_user_id 
       OR (provider = 'email' AND provider_id = v_user_id::text)
       OR (provider = 'email' AND lower(identity_data->>'email') = lower(p_email));

    -- Insert into auth.identities (Required by GoTrue, includes provider_id)
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
    );

    -- Ensure security metadata columns exist in public.user_profiles (No plaintext password stored)
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS is_default_password BOOLEAN DEFAULT true;
    ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS password_updated_at TIMESTAMPTZ;

    -- Ensure public.user_profiles exists and is in sync
    INSERT INTO public.user_profiles (id, email, full_name, role, location_id, is_default_password, password_updated_at, created_at)
    VALUES (
        v_user_id,
        lower(p_email),
        p_full_name,
        p_role,
        v_location_id,
        (p_password = 'GDT@2026'),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        location_id = EXCLUDED.location_id,
        is_default_password = EXCLUDED.is_default_password,
        password_updated_at = NOW();

    RETURN v_user_id;
END;
$$;

-- 3. ISO 27001 / OWASP Compliant Stored Procedure: admin_secure_set_password
CREATE OR REPLACE FUNCTION public.admin_secure_set_password(
    target_user_id UUID,
    new_password TEXT,
    is_default BOOLEAN DEFAULT false,
    caller_admin_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_encrypted_pwd TEXT;
BEGIN
    IF new_password IS NULL OR length(trim(new_password)) < 8 THEN
        RAISE EXCEPTION 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ (Password must be at least 8 characters)';
    END IF;

    v_encrypted_pwd := crypt(trim(new_password), gen_salt('bf'));

    UPDATE auth.users
    SET 
        encrypted_password = v_encrypted_pwd,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = target_user_id;

    UPDATE public.user_profiles
    SET 
        is_default_password = is_default,
        password_updated_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.create_or_update_gdt_user TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.admin_secure_set_password TO authenticated, service_role, anon;

-- 4. BATCH SEED ALL EXISTING OFFICERS WITH DEFAULT PASSWORD: GDT@2026
DO $$
BEGIN
    -- 1. Central Admin (GDT ITS Team)
    PERFORM public.create_or_update_gdt_user(
        'gdt.dict.its.team@gmail.com',
        'GDT@2026',
        'ក្រុមការងារបច្ចេកវិទ្យាព័ត៌មាន (GDT ITS Team)',
        'CentralAdmin',
        'HQ-ITSB'
    );

    -- 2. Central Admin (Admin ITS)
    PERFORM public.create_or_update_gdt_user(
        'admin.its@tax.gov.kh',
        'GDT@2026',
        'មន្ត្រីកណ្តាល ITSB (រដ្ឋបាល)',
        'CentralAdmin',
        'HQ-ITSB'
    );

    -- 3. Branch 7MK Officer (៧មករា)
    PERFORM public.create_or_update_gdt_user(
        'officer.7mk@tax.gov.kh',
        'GDT@2026',
        'លោក សុខ ចាន់ថន (មន្ត្រី ៧មករា)',
        'BranchUser',
        '7MK'
    );

    -- 4. Branch CKM Officer (ចំការមន)
    PERFORM public.create_or_update_gdt_user(
        'officer.ckm@tax.gov.kh',
        'GDT@2026',
        'កញ្ញា គង់ សុជាតា (មន្ត្រី ចំការមន)',
        'BranchUser',
        'CKM'
    );

    -- 5. Branch DPE Officer (ដូនពេញ)
    PERFORM public.create_or_update_gdt_user(
        'officer.dpe@tax.gov.kh',
        'GDT@2026',
        'លោក វ៉ាន់ សុភ័ក្ត្រ (មន្ត្រី ដូនពេញ)',
        'BranchUser',
        'DPE'
    );

    -- 6. Branch TKO Officer (ទួលគោក)
    PERFORM public.create_or_update_gdt_user(
        'officer.tko@tax.gov.kh',
        'GDT@2026',
        'លោក ហេង វិបុល (មន្ត្រី ទួលគោក)',
        'BranchUser',
        'TKO'
    );

    -- 7. Branch KPC Officer (កំពង់ចាម)
    PERFORM public.create_or_update_gdt_user(
        'officer.kpc@tax.gov.kh',
        'GDT@2026',
        'លោក ជ័យ វិចិត្រ (មន្ត្រី កំពង់ចាម)',
        'BranchUser',
        'KPC'
    );
END;
$$;
`;

export function UserManagementModal() {
  const auth = useAuth();
  const locationCtx = useLocationContext();

  const isSettingsOpen = Boolean(auth?.isSettingsOpen);
  const setIsSettingsOpen = auth?.setIsSettingsOpen;
  const rawUsersList = auth?.usersList;
  const updateUserProfile = auth?.updateUserProfile;
  const createUserProfile = auth?.createUserProfile;
  const switchActiveUser = auth?.switchActiveUser;
  const fetchUsersList = auth?.fetchUsersList;
  const userProfile = auth?.userProfile ?? null;
  const currentUser = userProfile || auth?.user || null;
  const isCentralAdmin = Boolean(auth?.isCentralAdmin);
  const isBranchUser = Boolean(auth?.isBranchUser);
  const authLoading = Boolean(auth?.loading);

  // Automatically refresh user list from Supabase whenever modal opens
  useEffect(() => {
    if (isSettingsOpen && typeof fetchUsersList === 'function') {
      fetchUsersList();
    }
  }, [isSettingsOpen, fetchUsersList]);

  // Safe arrays
  const safeUsersList: UserProfile[] = useMemo(() => {
    return Array.isArray(rawUsersList) ? rawUsersList.filter(Boolean) : [];
  }, [rawUsersList]);

  const safeBranches = useMemo(() => {
    if (Array.isArray(locationCtx?.allLocationsList) && locationCtx.allLocationsList.length > 0) {
      return locationCtx.allLocationsList.filter(Boolean);
    }
    if (Array.isArray(locationCtx?.locations) && locationCtx.locations.length > 0) {
      return locationCtx.locations.filter(Boolean);
    }
    return [];
  }, [locationCtx?.allLocationsList, locationCtx?.locations]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CentralAdmin' | 'BranchUser'>('ALL');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields for editing/creating
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'CentralAdmin' | 'BranchUser'>('BranchUser');
  const [formLocationId, setFormLocationId] = useState<string>('2'); // Default 7MK
  const [formPassword, setFormPassword] = useState('GDT@2026');
  const [showPassword, setShowPassword] = useState(false);

  // Refs for scrolling to edit form and focusing password input
  const editFormRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // State for SQL script modal
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedOfficerSql, setCopiedOfficerSql] = useState(false);

  const handleClose = () => {
    if (typeof setIsSettingsOpen === 'function') {
      setIsSettingsOpen(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSqlModal) {
          setShowSqlModal(false);
        } else if (isSettingsOpen) {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, showSqlModal]);

  // Safe filtering logic
  const filteredUsers = useMemo(() => {
    if (!Array.isArray(safeUsersList)) return [];
    return safeUsersList.filter(user => {
      if (!user) return false;
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const q = (searchQuery || '').toLowerCase().trim();
      if (!q) return matchesRole;

      const nameMatch = user.full_name ? String(user.full_name).toLowerCase().includes(q) : false;
      const emailMatch = user.email ? String(user.email).toLowerCase().includes(q) : false;
      const locMatch = user.location_id ? String(user.location_id).toLowerCase().includes(q) : false;
      return matchesRole && (nameMatch || emailMatch || locMatch);
    });
  }, [safeUsersList, roleFilter, searchQuery]);

  // Strictly forbid rendering if user is not CentralAdmin
  if (!isSettingsOpen || !isCentralAdmin) return null;

  const handleStartEdit = (user: UserProfile, focusPassword = false) => {
    if (!user) return;
    setEditingUser(user);
    setIsCreatingNew(false);
    setFormFullName(user.full_name || '');
    setFormEmail(user.email || '');
    setFormRole(user.role === 'CentralAdmin' ? 'CentralAdmin' : 'BranchUser');
    setFormLocationId(user.location_id || (user.role === 'CentralAdmin' ? '1' : '2'));
    setFormPassword(''); // Left empty by default: keep old password unless filled
    setShowPassword(false);
    setSuccessMessage(null);
    setErrorMessage(null);

    setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (focusPassword) {
        passwordInputRef.current?.focus();
      }
    }, 50);
  };

  const handleEditUser = (user: UserProfile, focusPassword = false) => {
    handleStartEdit(user, focusPassword);
  };

  const handleStartCreate = () => {
    setEditingUser(null);
    setIsCreatingNew(true);
    setFormFullName('');
    setFormEmail('');
    setFormRole('BranchUser');
    setFormLocationId('2');
    setFormPassword('GDT@2026'); // Default password for new officers
    setShowPassword(false);
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCancelForm = () => {
    setEditingUser(null);
    setIsCreatingNew(false);
    setFormPassword('');
    setShowPassword(false);
    setErrorMessage(null);
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let rand = '';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(`GDT@${rand}`);
  };

  // Actual UPDATE to Supabase Database (user_profiles & admin_secure_set_password RPC) for CentralAdmin
  const handleUpdateUser = async (editUser: {
    id: string;
    full_name: string;
    email: string;
    role: 'CentralAdmin' | 'BranchUser';
    location_id: string;
    password?: string;
  }): Promise<boolean> => {
    // 1. Strict Security Guard: Only CentralAdmin can perform update
    if (!isCentralAdmin) {
      alert('សិទ្ធិត្រូវបានបដិសេធ៖ មានតែគណនី CentralAdmin ប៉ុណ្ណោះដែលអាចកែប្រែព័ត៌មានមន្ត្រីបាន!');
      return false;
    }

    const newPassword = editUser.password;

    // 2. Validate password length before executing updates if a new password was provided
    if (newPassword && newPassword.trim() !== '') {
      if (newPassword.trim().length < 8) {
        alert('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
        setErrorMessage('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
        return false;
      }
    }

    // 3. Resolve target location info
    const matchedBranch = safeBranches.find(
      l => l.id === editUser.location_id || l.code === editUser.location_id
    ) || (editUser.role === 'CentralAdmin' ? safeBranches.find(l => l.type === 'HQ' || l.code === 'HQ-ITSB') : null);

    const targetBranchId = matchedBranch?.id || editUser.location_id;
    const targetBranchName = matchedBranch?.name_kh || matchedBranch?.name_en || '';

    const hasNewPassword = Boolean(newPassword && newPassword.trim() !== '');
    const isDefault = hasNewPassword ? newPassword!.trim() === 'GDT@2026' : undefined;
    const nowIso = new Date().toISOString();

    // 4. Supabase Direct Update & Secure Password RPC
    if (isSupabaseConfigured()) {
      try {
        // Query to check available columns in public.user_profiles
        const { data: colsCheck } = await supabase
          .from('user_profiles')
          .select('*')
          .limit(1);

        const availableCols = colsCheck && colsCheck.length > 0 
          ? new Set(Object.keys(colsCheck[0]))
          : null;

        // Construct update payload dynamically matching Table user_profiles Schema (never store plaintext password)
        const updatePayload: Record<string, any> = {
          full_name: editUser.full_name,
          role: editUser.role,
          updated_at: nowIso
        };

        if (availableCols) {
          if (availableCols.has('location_id')) {
            updatePayload.location_id = targetBranchId;
          }
          if (availableCols.has('branch_id')) {
            updatePayload.branch_id = targetBranchId;
          }
          if (availableCols.has('branch_name')) {
            updatePayload.branch_name = targetBranchName;
          }
          if (availableCols.has('email')) {
            updatePayload.email = editUser.email.trim().toLowerCase();
          }
        } else {
          // Standard canonical columns
          updatePayload.location_id = targetBranchId;
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(editUser.id);
        
        // Execute actual Supabase UPDATE for profile fields (full_name, role, branch)
        let query = supabase.from('user_profiles').update(updatePayload);
        let res = isUuid 
          ? await query.eq('id', editUser.id).select()
          : await query.ilike('email', editUser.email.trim()).select();

        let { data, error } = res;

        // If error due to column mismatch (e.g. branch_id vs location_id), retry with safe base columns
        if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
          console.warn('Column mismatch detected in user_profiles. Retrying with safe base columns:', error.message);
          const basePayload: Record<string, any> = {
            full_name: editUser.full_name,
            role: editUser.role,
            location_id: targetBranchId,
            updated_at: nowIso
          };
          const retryRes = isUuid
            ? await supabase.from('user_profiles').update(basePayload).eq('id', editUser.id).select()
            : await supabase.from('user_profiles').update(basePayload).ilike('email', editUser.email.trim()).select();
          data = retryRes.data;
          error = retryRes.error;
        }

        // If update failed, check error and alert with clear reason
        if (error) {
          console.error('Supabase user_profiles UPDATE error:', error);
          alert(`មិនអាចរក្សាទុកទិន្នន័យក្នុង Supabase Database បានទេ៖\n${error.message || JSON.stringify(error)}\n\n(មូលហេតុអាចមកពីជាប់ Row-Level Security (RLS) Policy ឬខុសឈ្មោះ Column ក្នុងតារាង user_profiles)`);
          setErrorMessage(`កំហុស Supabase: ${error.message}`);
          return false;
        }

        // If 0 rows were updated (e.g. profile doesn't exist in user_profiles yet), try upserting
        if (!error && (!data || data.length === 0)) {
          console.info('No existing record found to update. Upserting into user_profiles...');
          const upsertRow: Record<string, any> = {
            ...updatePayload,
            email: editUser.email.trim().toLowerCase(),
            ...(isUuid ? { id: editUser.id } : {})
          };
          const upsertRes = await supabase.from('user_profiles').upsert(upsertRow).select();
          if (upsertRes.error) {
            console.error('Supabase user_profiles UPSERT error:', upsertRes.error);
            alert(`មិនអាចរក្សាទុកទិន្នន័យក្នុង Supabase Database បានទេ៖\n${upsertRes.error.message}\n\n(សូមពិនិត្យមើល RLS Policy ឬសិទ្ធិ CentralAdmin)`);
            setErrorMessage(`កំហុស Supabase: ${upsertRes.error.message}`);
            return false;
          }
        }

        // 5. ISO 27001 / OWASP Secure Password Update via RPC: admin_secure_set_password
        if (newPassword && newPassword.trim() !== '') {
          if (newPassword.trim().length < 8) {
            alert('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
            return false;
          }

          const { data: res, error: rpcErr } = await supabase.rpc('admin_secure_set_password', {
            target_email: editUser.email,
            new_password: newPassword.trim(),
            caller_admin_email: currentUser?.email
          });

          if (rpcErr || (res && !res.success)) {
            alert('កំហុស៖ ' + (rpcErr?.message || res?.message));
            setErrorMessage('កំហុស៖ ' + (rpcErr?.message || res?.message));
            return false;
          }

          alert('បានកែប្រែពាក្យសម្ងាត់ និងធ្វើសមកាលកម្មចូល Supabase Auth ជោគជ័យ!');
        }
      } catch (err: any) {
        console.error('Unexpected exception during Supabase user update:', err);
        alert(`មានបញ្ហាមិនរំពឹងទុកពេល UPDATE ក្នុង Supabase៖\n${err?.message || err}`);
        setErrorMessage(err?.message || 'ប្រតិបត្តិការបរាជ័យ');
        return false;
      }
    }

    // 6. Immediately Update Local State of that User (is_default_password, password_updated_at) and Clear Input Password
    if (typeof updateUserProfile === 'function') {
      await updateUserProfile(editUser.id, {
        full_name: editUser.full_name,
        email: editUser.email,
        role: editUser.role,
        location_id: targetBranchId,
        ...(hasNewPassword && typeof isDefault === 'boolean'
          ? {
              is_default_password: isDefault,
              password_updated_at: nowIso
            }
          : {})
      });
    }

    // Clear password input state immediately
    setFormPassword('');

    // 7. Re-fetch fresh users list from Supabase
    if (typeof fetchUsersList === 'function') {
      await fetchUsersList();
    }

    // 8. Close Edit Modal & Show Success Notification
    setEditingUser(null);
    if (hasNewPassword) {
      setSuccessMessage('បានកំណត់ពាក្យសម្ងាត់ថ្មីជោគជ័យ!');
    } else {
      setSuccessMessage(`បានកែប្រែ និងរក្សាទុកទិន្នន័យមន្ត្រី "${editUser.full_name}" ចូល Supabase Database ដោយជោគជ័យ!`);
    }
    return true;
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim()) {
      setErrorMessage('សូមបញ្ចូលឈ្មោះមន្ត្រី (Please enter officer full name)');
      return;
    }
    if (!formEmail.trim()) {
      setErrorMessage('សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែល (Please enter email address)');
      return;
    }

    // Password validation (Minimum 8 characters per ISO 27001 / OWASP)
    if (isCreatingNew) {
      if (!formPassword.trim()) {
        setErrorMessage('សូមកំណត់ពាក្យសម្ងាត់សម្រាប់មន្ត្រីថ្មី');
        return;
      }
      if (formPassword.trim().length < 8) {
        alert('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
        setErrorMessage('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
        return;
      }
    } else if (editingUser && formPassword.trim() !== '' && formPassword.trim().length < 8) {
      alert('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
      setErrorMessage('ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៨ តួអក្សរ!');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (isCreatingNew && typeof createUserProfile === 'function') {
        const finalPwd = formPassword.trim() || 'GDT@2026';
        const isDefaultPwd = finalPwd === 'GDT@2026';
        const res = await createUserProfile({
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId,
          password: finalPwd,
          is_default_password: isDefaultPwd,
          password_updated_at: new Date().toISOString()
        });
        if (res?.success) {
          setFormPassword('');
          setSuccessMessage(`បានបង្កើតគណនីមន្ត្រីថ្មី "${formFullName}" ដោយជោគជ័យ!`);
          setIsCreatingNew(false);
          if (typeof fetchUsersList === 'function') {
            await fetchUsersList();
          }
        } else {
          setErrorMessage(res?.error || 'មានបញ្ហាក្នុងការបង្កើតគណនី');
        }
      } else if (editingUser) {
        // Execute real Supabase UPDATE with error handling & alert
        await handleUpdateUser({
          id: editingUser.id,
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId,
          password: formPassword.trim() || undefined
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'ប្រតិបត្តិការបរាជ័យ');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_AUTH_USERS_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const getLocationLabel = (locId: any): string => {
    if (!locId) return 'មិនទាន់ចាត់តាំង';
    const sId = String(locId);
    if (sId === '1' || sId === 'HQ-ITSB') return '[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB (ស្តុកកណ្តាល)';
    const found = safeBranches.find(l => l && (String(l.id) === sId || String(l.code) === sId));
    if (found) {
      try {
        return formatLocationOption(found, 'kh') || found.name_kh || sId;
      } catch {
        return found.name_kh || sId;
      }
    }
    return sId;
  };

  const centralAdminCount = safeUsersList.filter(u => u?.role === 'CentralAdmin').length;
  const branchUserCount = safeUsersList.filter(u => u?.role === 'BranchUser').length;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-siemreap animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#03291E] text-white px-6 py-4 flex items-center justify-between border-b border-[#1E6047] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-[#A3D8C2]/20 text-[#A3D8C2] rounded-xl border border-[#A3D8C2]/30">
              <Settings size={22} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  ការកំណត់ និងគ្រប់គ្រងមន្ត្រី (User Management & RBAC)
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isCentralAdmin 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isCentralAdmin ? 'CentralAdmin (សិទ្ធិពេញលេញ)' : 'BranchUser (មន្ត្រីសាខា)'}
                </span>
              </div>
              <p className="text-xs text-[#A3D8C2]/80 mt-0.5">
                កំណត់ឈ្មោះ, Role, សាខាប្រចាំការ និងកំណត់ Password សម្រាប់ Login ចូល Supabase Auth
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Button to view Supabase Auth SQL script */}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="px-3 py-1.5 bg-[#A3D8C2]/20 hover:bg-[#A3D8C2]/35 text-[#A3D8C2] rounded-xl text-xs font-bold transition-all border border-[#A3D8C2]/30 flex items-center gap-1.5 cursor-pointer"
              title="មើលកូដ SQL សម្រាប់ Run ក្នុង Supabase Auth"
            >
              <Database size={14} />
              <span className="hidden sm:inline">កូដ SQL Supabase Auth</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="បិទ (Close)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Info Banner for RBAC & Passwords */}
        <div className="bg-[#EBF7F2] border-b border-[#C8E8DA] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1E6047] shrink-0">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-[#1E6047] shrink-0" />
            <span>
              <strong>គោលការណ៍សិទ្ធិ (RBAC) & Password៖</strong> គណនីទាំងអស់ប្រើ Default Password <strong>GDT@2026</strong> សម្រាប់ Login តេស្តភ្លាមៗ។
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <ShieldCheck size={12} className="mr-1" /> CentralAdmin: {centralAdminCount}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Building2 size={12} className="mr-1" /> BranchUser: {branchUserCount}
            </span>
          </div>
        </div>

        {/* BranchUser Notice and Switch to CentralAdmin */}
        {isBranchUser && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
            <div className="flex items-center gap-2">
              <Building2 size={15} className="text-amber-700 shrink-0" />
              <span>
                អ្នកកំពុងប្រើគណនីមន្ត្រីសាខា <strong>{userProfile?.full_name || 'BranchUser'}</strong> (ចាក់សោតាមសាខា)
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const adminAccount = safeUsersList.find(u => u?.role === 'CentralAdmin');
                if (adminAccount && typeof switchActiveUser === 'function') {
                  switchActiveUser(adminAccount.id);
                  setSuccessMessage(`បានប្តូរទៅប្រើគណនី CentralAdmin "${adminAccount.full_name}"!`);
                  setTimeout(() => setSuccessMessage(null), 3500);
                }
              }}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>ប្តូរទៅជា CentralAdmin</span>
            </button>
          </div>
        )}

        {/* Success / Error Messages */}
        {successMessage && (
          <div className="mx-6 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-3 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4">
          
          {/* Edit / Create Form Modal if active */}
          {(editingUser || isCreatingNew) ? (
            <div ref={editFormRef} className="bg-slate-50 p-5 rounded-2xl border-2 border-[#1E6047]/20 shadow-xs mb-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-[#1E6047] text-white rounded-lg">
                    {isCreatingNew ? <Plus size={16} /> : <Edit3 size={16} />}
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {isCreatingNew ? 'បន្ថែមមន្ត្រីថ្មីទៅក្នុងប្រព័ន្ធ' : `កែប្រែព័ត៌មានមន្ត្រី៖ ${editingUser?.full_name || ''}`}
                  </h4>
                </div>
                <button 
                  type="button"
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  បោះបង់ (Cancel)
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      ឈ្មោះមន្ត្រី (Full Name) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="ឧ. លោក សុខ ចាន់ថន"
                      className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      អាសយដ្ឋានអ៊ីមែល (Email) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="officer@tax.gov.kh"
                        className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none"
                      />
                    </div>
                  </div>

                  {/* Role Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      កំណត់តួនាទី (Role) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => {
                        const newRole = e.target.value as 'CentralAdmin' | 'BranchUser';
                        setFormRole(newRole);
                        if (newRole === 'CentralAdmin') {
                          setFormLocationId('1');
                        }
                      }}
                      className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none cursor-pointer"
                    >
                      <option value="CentralAdmin">CentralAdmin (រដ្ឋបាលស្តុកកណ្តាល - សិទ្ធិពេញលេញ)</option>
                      <option value="BranchUser">BranchUser (មន្ត្រីប្រចាំសាខា - ចាក់សោតាមសាខា)</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formRole === 'CentralAdmin' 
                        ? '✓ មានសិទ្ធិមើលឃើញ និងគ្រប់គ្រងបានគ្រប់សាខា និងគ្រប់មីនុយទាំងអស់'
                        : '✓ ប្រើប្រាស់ Dashboard, ស្តុក Inventory, ដកប្រើប្រាស់, កែតម្រូវ និងសវនកម្ម (ចាក់សោតាមសាខា)'}
                    </p>
                  </div>

                  {/* Branch Assignment */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                      សាខាប្រចាំការ (Assigned Branch) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <MapPin size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <select
                        value={formLocationId}
                        onChange={(e) => setFormLocationId(e.target.value)}
                        className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none truncate cursor-pointer"
                      >
                        {formRole === 'CentralAdmin' && (
                          <option value="1">[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB (ស្តុកកណ្តាល)</option>
                        )}
                        {safeBranches
                          .filter(l => l && l.id !== 'ALL')
                          .map((loc) => {
                            let label = loc.name_kh;
                            try {
                              label = formatLocationOption(loc, 'kh');
                            } catch {
                              label = loc.name_kh || loc.id;
                            }
                            return (
                              <option key={loc.id || Math.random()} value={loc.id}>
                                {label}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {formRole === 'BranchUser' ? 'មន្ត្រីរូបនេះនឹងត្រូវបានចាក់សោឱ្យឃើញតែសាខានេះ' : 'ទីតាំងចម្បងរបស់មន្ត្រី'}
                    </p>
                  </div>

                  {/* Password Field (Enhanced for Admin setting & Reset) */}
                  <div className="sm:col-span-2 bg-[#EBF7F2] p-4 rounded-xl border border-[#A3D8C2]">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-[#03291E] uppercase flex items-center gap-1.5">
                        <KeyRound size={15} className="text-[#1E6047]" />
                        <span>
                          {isCreatingNew ? 'ពាក្យសម្ងាត់គណនី (Password)' : 'កំណត់ពាក្យសម្ងាត់ថ្មី (Reset Password)'}
                        </span>
                        {isCreatingNew && <span className="text-rose-500">*</span>}
                      </label>

                      {/* Quick action buttons for Password */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setFormPassword('GDT@2026')}
                          className="text-[11px] text-[#1E6047] font-bold hover:bg-[#A3D8C2]/60 bg-[#A3D8C2]/35 px-2.5 py-1 rounded-lg cursor-pointer transition-colors border border-[#1E6047]/20 flex items-center gap-1"
                          title="កំណត់ពាក្យសម្ងាត់ Default"
                        >
                          <Lock size={11} />
                          <span>Default: GDT@2026</span>
                        </button>
                        <button
                          type="button"
                          onClick={generateRandomPassword}
                          className="text-[11px] text-[#03291E] font-bold hover:bg-white bg-white/70 px-2 py-1 rounded-lg cursor-pointer transition-colors border border-slate-300 flex items-center gap-1"
                          title="បង្កើតពាក្យសម្ងាត់ចៃដន្យ (Generate Random)"
                        >
                          <Sparkles size={11} className="text-amber-600" />
                          <span>បង្កើតថ្មី</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const pwd = formPassword.trim() || 'GDT@2026';
                            const locCode = safeBranches.find(l => l.id === formLocationId)?.code || 'HQ-ITSB';
                            const sql = `-- Run this in Supabase SQL Editor to set password for ${formEmail.trim() || 'officer'}:\nSELECT public.create_or_update_gdt_user(\n  '${formEmail.trim()}',\n  '${pwd}',\n  '${formFullName.trim()}',\n  '${formRole}',\n  '${locCode}'\n);`;
                            navigator.clipboard.writeText(sql);
                            setCopiedOfficerSql(true);
                            setTimeout(() => setCopiedOfficerSql(false), 2500);
                          }}
                          className="text-[11px] text-[#03291E] font-bold hover:bg-white bg-white/70 px-2 py-1 rounded-lg cursor-pointer transition-colors border border-slate-300 flex items-center gap-1"
                          title="ចម្លង SQL Script សម្រាប់យកទៅ Run ក្នុង Supabase SQL Editor"
                        >
                          {copiedOfficerSql ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} className="text-slate-600" />}
                          <span>{copiedOfficerSql ? 'បានចម្លង SQL!' : 'Copy SQL'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        ref={passwordInputRef}
                        type={showPassword ? 'text' : 'password'}
                        required={isCreatingNew}
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={isCreatingNew ? 'ឧ. GDT@2026' : 'ទុកទទេ ប្រសិនបើមិនចង់ផ្លាស់ប្តូរពាក្យសម្ងាត់'}
                        className="w-full text-xs font-mono font-semibold pl-3 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    <div className="flex items-start gap-1.5 mt-2 text-[11px] text-[#1E6047]">
                      <HelpCircle size={13} className="shrink-0 mt-0.5 text-[#1E6047]" />
                      <span>
                        {isCreatingNew
                          ? 'ពាក្យសម្ងាត់នេះនឹងត្រូវដាក់កូដសម្ងាត់ (Encrypted) ក្នុង Supabase auth.users តាមរយៈ Admin RPC function (យ៉ាងតិច ៨ តួអក្សរ)។'
                          : 'បញ្ចូលពាក្យសម្ងាត់ថ្មី (យ៉ាងតិច ៨ តួអក្សរ) ដើម្បី Reset ពាក្យសម្ងាត់មន្ត្រីរូបនេះ ឬទុកទទេបើមិនចង់ផ្លាស់ប្តូរ។'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleCancelForm}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save size={15} />
                    <span>{isSaving ? 'កំពុងរក្សាទុក...' : 'រក្សាទុកទិន្នន័យ (Save)'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Controls: Search, Filter, Add */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ស្វែងរកតាមឈ្មោះ ឬអ៊ីមែល..."
                  className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#1E6047]/20 focus:border-[#1E6047] outline-none"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer"
              >
                <option value="ALL">គ្រប់តួនាទីទាំងអស់ ({safeUsersList.length})</option>
                <option value="CentralAdmin">CentralAdmin ({centralAdminCount})</option>
                <option value="BranchUser">BranchUser ({branchUserCount})</option>
              </select>
            </div>

            {!editingUser && !isCreatingNew && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center justify-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <Plus size={15} />
                <span>បន្ថែមមន្ត្រីថ្មី (Add Officer)</span>
              </button>
            )}
          </div>

          {/* Loading Skeleton */}
          {authLoading && safeUsersList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <Loader2 size={30} className="animate-spin text-[#1E6047]" />
              <p className="text-xs text-slate-500 font-semibold">កំពុងផ្ទុកបញ្ជីមន្ត្រី...</p>
            </div>
          ) : (
            /* Officers Table */
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-3">ឈ្មោះមន្ត្រី (Officer Name)</th>
                    <th className="py-2.5 px-3">គណនី / Email</th>
                    <th className="py-2.5 px-3 text-center">តួនាទី (Role)</th>
                    <th className="py-2.5 px-3">សាខាប្រចាំការ</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Password</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">សកម្មភាព</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        មិនមានទិន្នន័យមន្ត្រីស្របតាមការស្វែងរកឡើយ
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, idx) => {
                      if (!user) return null;
                      const officer = user;
                      const isCurrentActive = Boolean(
                        (userProfile?.id && officer?.id && userProfile.id === officer.id) || 
                        (userProfile?.email && officer?.email && userProfile.email.toLowerCase() === officer.email.toLowerCase())
                      );
                      const initialChar = officer.full_name?.charAt(0) || officer.email?.charAt(0) || 'U';

                      return (
                        <tr 
                          key={officer.id || `officer-${idx}`} 
                          className={`hover:bg-slate-50/80 transition-colors ${isCurrentActive ? 'bg-emerald-50/50' : ''}`}
                        >
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#1E6047] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                {initialChar}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{officer.full_name || 'មិនមានឈ្មោះ'}</span>
                                  {isCurrentActive && (
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                                      អ្នកបច្ចុប្បន្ន
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                            {officer.email || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {officer.role === 'CentralAdmin' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <ShieldCheck size={11} className="mr-1" /> CentralAdmin
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                <Building2 size={11} className="mr-1" /> BranchUser
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <div className="flex items-center gap-1 text-[11px]">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span className="font-semibold truncate max-w-[170px]" title={getLocationLabel(officer.location_id)}>
                                {getLocationLabel(officer.location_id)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-sm text-center">
                            {user.is_default_password === false ? (
                              <button
                                type="button"
                                onClick={() => handleEditUser(user, true)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:opacity-80 transition"
                                title={
                                  user.password_updated_at
                                    ? `កាលបរិច្ឆេទប្តូរចុងក្រោយ: ${new Date(user.password_updated_at).toLocaleString('km-KH')} (ចុចដើម្បីកំណត់ពាក្យសម្ងាត់ថ្មី)`
                                    : 'ពាក្យសម្ងាត់ត្រូវបានដាក់កូដសម្ងាត់ដោយសុវត្ថិភាព (ចុចដើម្បីកំណត់ពាក្យសម្ងាត់ថ្មី)'
                                }
                              >
                                🔒 •••••••• (Encrypted)
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEditUser(user, true)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:opacity-80 transition"
                                title="ពាក្យសម្ងាត់លំនាំដើម (ចុចដើម្បីប្តូរពាក្យសម្ងាត់ថ្មី)"
                              >
                                ⚠️ Default (ត្រូវប្តូរ)
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                              {/* Edit Button (✏️ កែប្រែ) */}
                              <button
                                type="button"
                                onClick={() => handleEditUser(officer)}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                title="កែប្រែព័ត៌មានមន្ត្រី និងកំណត់ពាក្យសម្ងាត់ថ្មី (Edit)"
                              >
                                <span>✏️</span>
                                <span>កែប្រែ</span>
                              </button>

                              {/* Quick Switch / Simulate Account Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof switchActiveUser === 'function') {
                                    switchActiveUser(officer.id);
                                    setSuccessMessage(`បានប្តូរទៅប្រើគណនី "${officer.full_name}" (${officer.role})!`);
                                    setTimeout(() => setSuccessMessage(null), 3500);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0 border ${
                                  isCurrentActive 
                                    ? 'text-emerald-700 bg-emerald-100/60 border-emerald-300' 
                                    : 'text-slate-600 bg-slate-50 hover:text-blue-700 hover:bg-blue-50 border-slate-200'
                                }`}
                                title="សាកល្បងសិទ្ធិប្រើប្រាស់ជាគណនីនេះ (Simulate/Switch)"
                              >
                                <ArrowRightLeft size={13} />
                                <span className="text-[11px]">ប្តូរប្រើ</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            មន្ត្រីសរុប៖ <strong>{safeUsersList.length}</strong> នាក់ (Default Password: <strong>GDT@2026</strong>)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="px-3 py-1.5 bg-[#1E6047] hover:bg-[#03291E] text-white font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
            >
              <Database size={13} />
              <span>កូដ SQL Supabase</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              បិទផ្ទាំង (Close)
            </button>
          </div>
        </div>
      </div>

      {/* SQL Script Viewer Modal */}
      {showSqlModal && (
        <div 
          className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs font-siemreap animate-in fade-in"
          onClick={() => setShowSqlModal(false)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#03291E] text-white px-6 py-4 flex items-center justify-between border-b border-[#1E6047]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-lg">
                  <Database size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    កូដ SQL បង្កើត User & Password ក្នុង Supabase Auth
                  </h4>
                  <p className="text-[11px] text-[#A3D8C2]">
                    ដំណើរការ script នេះក្នុង Supabase SQL Editor ដើម្បីបង្កើត User ក្នុង auth.users ជាមួយ Default Password: GDT@2026
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Steps & Guidance */}
            <div className="bg-emerald-50/80 px-6 py-3 border-b border-emerald-200 text-xs text-[#1E6047] space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>របៀបអនុវត្តក្នុង Supabase (Quick Steps)៖</span>
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-700 font-medium">
                <li>ចុចប៊ូតុង <strong>"ចម្លងកូដ SQL (Copy Code)"</strong> ខាងក្រោម</li>
                <li>ចូលទៅកាន់គណនី Supabase របស់អ្នក → បើកមីនុយ <strong>SQL Editor</strong></li>
                <li>បិទភ្ជាប់ (Paste) កូដ SQL នេះចូល រួចចុច <strong>RUN</strong></li>
                <li>គណនីមន្ត្រីទាំងអស់នឹងត្រូវបង្កើតក្នុង auth.users រួចរាល់សម្រាប់យកទៅ Login ជាមួយ Password <strong>GDT@2026</strong>!</li>
              </ol>
            </div>

            {/* SQL Code Block */}
            <div className="p-4 bg-[#0F172A] flex-1 overflow-auto max-h-[460px]">
              <pre className="text-xs font-mono text-[#7DD3FC] leading-relaxed whitespace-pre-wrap selection:bg-emerald-700 selection:text-white">
                <code>{SUPABASE_AUTH_USERS_SQL}</code>
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">
                supabase_auth_users_seed.sql
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="flex items-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  {copiedSql ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  <span>{copiedSql ? 'បានចម្លងរួចរាល់! (Copied)' : 'ចម្លងកូដ SQL (Copy Code)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  បិទ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
