import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { Settings, LogOut, ShieldCheck, Building2, Loader2, Menu } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseConnectionModal } from './SupabaseConnectionModal';
import logoStock from '../logostock1.png';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { language, t } = useLanguage();
  const auth = useAuth();
  const locationCtx = useLocationContext();
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);

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

  const isDbConfigured = isSupabaseConfigured();

  const handleOpenSettings = () => {
    if (isCentralAdmin && typeof setIsSettingsOpen === 'function') {
      setIsSettingsOpen(true);
    }
  };

  const handleSignOut = async () => {
    if (typeof signOut === 'function') {
      await signOut();
    }
  };

  return (
    <>
    <header className="bg-[#A3D8C2] text-[#03291E] flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 shadow-sm border-b-4 border-[#6EC8A0] shrink-0 font-siemreap gap-2">
      <div className="flex items-center space-x-2 sm:space-x-3.5 min-w-0">
        {/* Hamburger Menu Button for Mobile & Tablet (< lg) */}
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-1 rounded-xl text-[#03291E] hover:bg-[#03291E]/15 active:scale-95 transition-all cursor-pointer shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="បើកមីនុយ (Open Menu)"
            aria-label="Open Navigation Menu"
          >
            <Menu size={22} />
          </button>
        )}

        <img
          src={logoStock}
          alt="GDT Inventory Logo"
          className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-lg shadow-sm shrink-0"
        />
        <div className="flex flex-col justify-center min-w-0">
          <h1 className="text-xs sm:text-base md:text-lg font-normal leading-snug tracking-wide text-[#03291E] truncate" style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}>
            {language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស' : (t?.systemTitle || 'GDT Inventory System')}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-1.5 sm:space-x-3 shrink-0">
        {/* Real User Role & Identity Badge */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 bg-[#03291E]/10 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-[#03291E]/20 shadow-2xs">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#03291E] text-[#A3D8C2] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            {loading ? (
              <Loader2 size={15} className="animate-spin text-[#A3D8C2]" />
            ) : isCentralAdmin ? (
              <ShieldCheck size={16} />
            ) : (
              <Building2 size={16} />
            )}
          </div>
          <div className="hidden xs:flex sm:flex flex-col text-left pr-0.5 sm:pr-1">
            <div className="flex items-center gap-1">
              <span className={`text-[8px] sm:text-[9px] font-bold uppercase leading-none px-1 sm:px-1.5 py-0.5 rounded ${
                isCentralAdmin ? 'bg-emerald-900/20 text-emerald-950 font-black' : 'bg-amber-900/20 text-amber-950 font-black'
              }`}>
                {userRole}
              </span>
              {isBranchUser && (
                <span className="hidden md:inline text-[9px] font-bold text-[#03291E]/80 truncate max-w-[100px]">
                  ({locationCode})
                </span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-[#03291E] leading-tight max-w-[90px] sm:max-w-[150px] truncate" title={userDisplayName}>
              {userDisplayName || user?.email || t?.userRole || 'User'}
            </span>
          </div>
        </div>

        {/* Setting Button (⚙️) - Only visible and accessible for CentralAdmin */}
        {isCentralAdmin && (
          <button
            type="button"
            onClick={handleOpenSettings}
            className="p-2 hover:bg-[#03291E]/15 rounded-full transition-all text-[#03291E] relative group hover:scale-105 active:scale-95 cursor-pointer shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center"
            title="ការកំណត់ និងគ្រប់គ្រងមន្ត្រី (Settings & RBAC)"
            aria-label="Settings"
          >
            <Settings size={19} className="group-hover:rotate-45 transition-transform duration-300" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-700 rounded-full ring-2 ring-[#A3D8C2]" />
          </button>
        )}

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center justify-center space-x-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer shrink-0 min-h-[36px]"
          title="Logout (ចាកចេញ)"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">ចាកចេញ</span>
        </button>
      </div>
    </header>

    <SupabaseConnectionModal 
      isOpen={isDbModalOpen} 
      onClose={() => setIsDbModalOpen(false)} 
    />
    </>
  );
}
