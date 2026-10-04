import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
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
  Loader2
} from 'lucide-react';

export function UserManagementModal() {
  const auth = useAuth();
  const locationCtx = useLocationContext();

  const isSettingsOpen = Boolean(auth?.isSettingsOpen);
  const setIsSettingsOpen = auth?.setIsSettingsOpen;
  const rawUsersList = auth?.usersList;
  const updateUserProfile = auth?.updateUserProfile;
  const createUserProfile = auth?.createUserProfile;
  const switchActiveUser = auth?.switchActiveUser;
  const userProfile = auth?.userProfile ?? null;
  const isCentralAdmin = Boolean(auth?.isCentralAdmin);
  const isBranchUser = Boolean(auth?.isBranchUser);
  const authLoading = Boolean(auth?.loading);

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

  const handleClose = () => {
    if (typeof setIsSettingsOpen === 'function') {
      setIsSettingsOpen(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSettingsOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

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

  if (!isSettingsOpen) return null;

  const handleStartEdit = (user: UserProfile) => {
    if (!user) return;
    setEditingUser(user);
    setIsCreatingNew(false);
    setFormFullName(user.full_name || '');
    setFormEmail(user.email || '');
    setFormRole(user.role === 'CentralAdmin' ? 'CentralAdmin' : 'BranchUser');
    setFormLocationId(user.location_id || (user.role === 'CentralAdmin' ? '1' : '2'));
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleStartCreate = () => {
    setEditingUser(null);
    setIsCreatingNew(true);
    setFormFullName('');
    setFormEmail('');
    setFormRole('BranchUser');
    setFormLocationId('2');
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const handleCancelForm = () => {
    setEditingUser(null);
    setIsCreatingNew(false);
    setErrorMessage(null);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formFullName.trim()) {
      setErrorMessage('សូមបញ្ចូលឈ្មោះមន្ត្រី');
      return;
    }
    if (!formEmail.trim()) {
      setErrorMessage('សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែល');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (isCreatingNew && typeof createUserProfile === 'function') {
        const res = await createUserProfile({
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId
        });
        if (res?.success) {
          setSuccessMessage('បានបង្កើតគណនីមន្ត្រីថ្មីដោយជោគជ័យ!');
          setIsCreatingNew(false);
        } else {
          setErrorMessage(res?.error || 'មានបញ្ហាក្នុងការបង្កើតគណនី');
        }
      } else if (editingUser && typeof updateUserProfile === 'function') {
        const res = await updateUserProfile(editingUser.id, {
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId
        });
        if (res?.success) {
          setSuccessMessage(`បានកែប្រែមន្ត្រី "${formFullName}" ដោយជោគជ័យ!`);
          setEditingUser(null);
        } else {
          setErrorMessage(res?.error || 'មានបញ្ហាក្នុងការកែប្រែគណនី');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'ប្រតិបត្តិការបរាជ័យ');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
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
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
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
                  កំណត់ឈ្មោះមន្ត្រី, កំណត់ Role (CentralAdmin ឬ BranchUser) និងចាត់តាំងសាខាប្រចាំការ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              title="បិទ (Close)"
            >
              <X size={20} />
            </button>
          </div>

          {/* Info Banner for RBAC */}
          <div className="bg-[#EBF7F2] border-b border-[#C8E8DA] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1E6047] shrink-0">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-[#1E6047] shrink-0" />
              <span>
                <strong>គោលការណ៍សិទ្ធិ (RBAC)៖</strong> គណនី <strong>BranchUser</strong> ត្រូវបានចាក់សោឃើញតែសាខាខ្លួន និងប្រើបានតែ ៣ មីនុយ (ដកប្រើប្រាស់, កែតម្រូវ, សវនកម្ម)។
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
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-[#1E6047]/20 shadow-xs mb-4 animate-in fade-in">
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
                          : '✓ ឃើញតែសាខាដែលបានចាត់តាំង និងប្រើបានតែ ៣ មីនុយ (ដកប្រើប្រាស់, កែតម្រូវ, សវនកម្ម)'}
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
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3 text-center w-10">#</th>
                      <th className="py-2.5 px-3">ឈ្មោះមន្ត្រី (Officer Name)</th>
                      <th className="py-2.5 px-3">គណនី / Email</th>
                      <th className="py-2.5 px-3 text-center">តួនាទី (Role)</th>
                      <th className="py-2.5 px-3">សាខាប្រចាំការ (Assigned Branch)</th>
                      <th className="py-2.5 px-3 text-center w-36">សកម្មភាព</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          មិនមានទិន្នន័យមន្ត្រីស្របតាមការស្វែងរកឡើយ
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((officer, idx) => {
                        if (!officer) return null;
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
                                <span className="font-semibold truncate max-w-[200px]" title={getLocationLabel(officer.location_id)}>
                                  {getLocationLabel(officer.location_id)}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(officer)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                  title="កែប្រែមន្ត្រី (Edit)"
                                >
                                  <Edit3 size={15} />
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
                                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                    isCurrentActive 
                                      ? 'text-emerald-700 bg-emerald-100/60' 
                                      : 'text-slate-500 hover:text-blue-700 hover:bg-blue-50'
                                  }`}
                                  title="សាកល្បងសិទ្ធិប្រើប្រាស់ជាគណនីនេះ (Simulate/Switch)"
                                >
                                  <ArrowRightLeft size={13} />
                                  <span className="text-[10px] hidden sm:inline">ប្តូរប្រើ</span>
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
              មន្ត្រីសរុប៖ <strong>{safeUsersList.length}</strong> នាក់
            </div>
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
  );
}
