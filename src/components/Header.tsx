import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { Settings, LogOut, ShieldCheck, Building2, Loader2 } from 'lucide-react';

export function Header() {
  const { language, t } = useLanguage();
  const auth = useAuth();
  const locationCtx = useLocationContext();

  const user = auth?.user ?? null;
  const userRole = auth?.userRole ?? 'CentralAdmin';
  const userDisplayName = auth?.userDisplayName ?? (auth?.user?.email ? auth.user.email.split('@')[0] : 'មន្ត្រីកណ្តាល');
  const isCentralAdmin = Boolean(auth?.isCentralAdmin);
  const isBranchUser = Boolean(auth?.isBranchUser);
  const setIsSettingsOpen = auth?.setIsSettingsOpen;
  const signOut = auth?.signOut;
  const loading = Boolean(auth?.loading);

  const selectedLocation = locationCtx?.selectedLocation;
  const locationCode = selectedLocation?.code || selectedLocation?.id || 'Branch';

  const handleOpenSettings = () => {
    if (typeof setIsSettingsOpen === 'function') {
      setIsSettingsOpen(true);
    }
  };

  const handleSignOut = () => {
    if (typeof signOut === 'function') {
      signOut();
    }
  };

  return (
    <header className="bg-[#A3D8C2] text-[#03291E] flex items-center justify-between px-6 py-3 shadow-sm border-b-4 border-[#6EC8A0] shrink-0 font-siemreap">
      <div className="flex items-center space-x-4">
        <div className="bg-[#03291E] p-1 rounded-md shadow-xs">
          <div className="w-10 h-10 bg-[#A3D8C2] rounded flex items-center justify-center font-bold text-lg text-[#03291E]">
            GDT
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-base sm:text-lg font-normal leading-snug tracking-wide text-[#03291E]" style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}>
            {language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស' : (t?.systemTitle || 'GDT Inventory System')}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Real User Role & Identity Badge */}
        <div className="flex items-center space-x-2.5 bg-[#03291E]/10 px-3 py-1.5 rounded-xl border border-[#03291E]/20 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-[#03291E] text-[#A3D8C2] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {loading ? (
              <Loader2 size={16} className="animate-spin text-[#A3D8C2]" />
            ) : isCentralAdmin ? (
              <ShieldCheck size={18} />
            ) : (
              <Building2 size={18} />
            )}
          </div>
          <div className="flex flex-col text-left pr-1">
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-bold uppercase leading-none px-1.5 py-0.5 rounded ${
                isCentralAdmin ? 'bg-emerald-900/20 text-emerald-950 font-black' : 'bg-amber-900/20 text-amber-950 font-black'
              }`}>
                {userRole}
              </span>
              {isBranchUser && (
                <span className="text-[9px] font-bold text-[#03291E]/80 truncate max-w-[120px]">
                  ({locationCode})
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-[#03291E] leading-tight max-w-[150px] truncate" title={userDisplayName}>
              {userDisplayName || user?.email || t?.userRole || 'User'}
            </span>
          </div>
        </div>

        {/* Setting Button (⚙️) - Opens User Management Modal */}
        <button
          type="button"
          onClick={handleOpenSettings}
          className="p-2 hover:bg-[#03291E]/15 rounded-full transition-all text-[#03291E] relative group hover:scale-105 active:scale-95 cursor-pointer"
          title="ការកំណត់ និងគ្រប់គ្រងមន្ត្រី (Settings & RBAC)"
          aria-label="Settings"
        >
          <Settings size={20} className="group-hover:rotate-45 transition-transform duration-300" />
          {isCentralAdmin && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-700 rounded-full ring-2 ring-[#A3D8C2]" />
          )}
        </button>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer"
          title="Logout (ចាកចេញ)"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">ចាកចេញ</span>
        </button>
      </div>
    </header>
  );
}
