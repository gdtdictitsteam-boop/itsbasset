import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { UserProfile } from '../types';
import { 
  Settings, 
  X, 
  UserCheck, 
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
  AlertCircle
} from 'lucide-react';

export function UserManagementModal() {
  const { 
    isSettingsOpen, 
    setIsSettingsOpen, 
    usersList, 
    updateUserProfile, 
    createUserProfile, 
    switchActiveUser, 
    userProfile,
    isCentralAdmin
  } = useAuth();

  const { locations } = useLocationContext();

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

  if (!isSettingsOpen) return null;

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return usersList.filter(user => {
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        user.full_name?.toLowerCase().includes(q) || 
        user.email?.toLowerCase().includes(q) ||
        (user.location_id && user.location_id.toLowerCase().includes(q));
      return matchesRole && matchesSearch;
    });
  }, [usersList, roleFilter, searchQuery]);

  const handleStartEdit = (user: UserProfile) => {
    setEditingUser(user);
    setIsCreatingNew(false);
    setFormFullName(user.full_name || '');
    setFormEmail(user.email || '');
    setFormRole(user.role);
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
      if (isCreatingNew) {
        const res = await createUserProfile({
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId
        });
        if (res.success) {
          setSuccessMessage('បានបង្កើតគណនីមន្ត្រីថ្មីដោយជោគជ័យ!');
          setIsCreatingNew(false);
        } else {
          setErrorMessage(res.error || 'មានបញ្ហាក្នុងការបង្កើតគណនី');
        }
      } else if (editingUser) {
        const res = await updateUserProfile(editingUser.id, {
          full_name: formFullName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          location_id: formLocationId
        });
        if (res.success) {
          setSuccessMessage(`បានកែប្រែមន្ត្រី "${formFullName}" ដោយជោគជ័យ!`);
          setEditingUser(null);
        } else {
          setErrorMessage(res.error || 'មានបញ្ហាក្នុងការកែប្រែគណនី');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'ប្រតិបត្តិការបរាជ័យ');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const getLocationLabel = (locId: string | null) => {
    if (!locId) return 'មិនទាន់ចាត់តាំង';
    if (locId === '1' || locId === 'HQ-ITSB') return '[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB (ស្តុកកណ្តាល)';
    const found = locations.find(l => l.id === locId || l.code === locId);
    if (found) return formatLocationOption(found, 'kh');
    return locId;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-siemreap animate-in fade-in duration-200">
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
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  CentralAdmin Only
                </span>
              </div>
              <p className="text-xs text-[#A3D8C2]/80 mt-0.5">
                កំណត់ឈ្មោះមន្ត្រី, កំណត់ Role (CentralAdmin ឬ BranchUser) និងចាត់តាំងសាខាប្រចាំការ
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close"
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
              <ShieldCheck size={12} className="mr-1" /> CentralAdmin: {usersList.filter(u => u.role === 'CentralAdmin').length}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Building2 size={12} className="mr-1" /> BranchUser: {usersList.filter(u => u.role === 'BranchUser').length}
            </span>
          </div>
        </div>

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
                    {isCreatingNew ? 'បន្ថែមមន្ត្រីថ្មីទៅក្នុងប្រព័ន្ធ' : `កែប្រែព័ត៌មានមន្ត្រី៖ ${editingUser?.full_name}`}
                  </h4>
                </div>
                <button 
                  onClick={handleCancelForm}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
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
                      className="w-full text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none"
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
                        className="w-full text-xs font-semibold pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#1E6047]/30 focus:border-[#1E6047] outline-none truncate"
                      >
                        {formRole === 'CentralAdmin' && (
                          <option value="1">[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB (ស្តុកកណ្តាល)</option>
                        )}
                        {locations
                          .filter(l => l.id !== 'ALL')
                          .map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {formatLocationOption(loc, 'kh')}
                            </option>
                          ))}
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
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    បោះបង់
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
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
                className="text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                <option value="ALL">គ្រប់តួនាទីទាំងអស់ ({usersList.length})</option>
                <option value="CentralAdmin">CentralAdmin ({usersList.filter(u => u.role === 'CentralAdmin').length})</option>
                <option value="BranchUser">BranchUser ({usersList.filter(u => u.role === 'BranchUser').length})</option>
              </select>
            </div>

            {!editingUser && !isCreatingNew && (
              <button
                onClick={handleStartCreate}
                className="flex items-center justify-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
              >
                <Plus size={15} />
                <span>បន្ថែមមន្ត្រីថ្មី (Add Officer)</span>
              </button>
            )}
          </div>

          {/* Officers Table */}
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
                    const isCurrentActive = userProfile?.id === officer.id || userProfile?.email === officer.email;
                    return (
                      <tr 
                        key={officer.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${isCurrentActive ? 'bg-emerald-50/50' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1E6047] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                              {officer.full_name?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{officer.full_name}</span>
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
                          {officer.email}
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
                              onClick={() => handleStartEdit(officer)}
                              className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="កែប្រែមន្ត្រី (Edit)"
                            >
                              <Edit3 size={15} />
                            </button>

                            {/* Quick Switch / Simulate Account Button */}
                            <button
                              onClick={() => {
                                switchActiveUser(officer.id);
                                setSuccessMessage(`បានប្តូរទៅប្រើគណនី "${officer.full_name}" (${officer.role})!`);
                                setTimeout(() => setSuccessMessage(null), 3500);
                              }}
                              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
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

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            មន្ត្រីសរុប៖ <strong>{usersList.length}</strong> នាក់
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors"
          >
            បិទផ្ទាំង (Close)
          </button>
        </div>
      </div>
    </div>
  );
}
