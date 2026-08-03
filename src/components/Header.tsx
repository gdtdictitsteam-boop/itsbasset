import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Settings, User } from 'lucide-react';

export function Header() {
  const { language, t } = useLanguage();

  return (
    <header className="bg-[#A3D8C2] text-[#03291E] flex items-center justify-between px-6 py-3 shadow-sm border-b-4 border-[#6EC8A0] shrink-0">
      <div className="flex items-center space-x-4">
        <div className="bg-[#03291E] p-1 rounded-md shadow-xs">
          <div className="w-10 h-10 bg-[#A3D8C2] rounded flex items-center justify-center font-bold text-lg text-[#03291E]">
            GDT
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-base sm:text-lg font-normal leading-snug tracking-wide text-[#03291E]" style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}>
            {language === 'kh' ? 'ប្រព័ន្ធគ្រប់គ្រងសម្ភារបច្ចេកទេស' : t.systemTitle}
          </h1>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* User Role Admin-GDT */}
        <div className="flex items-center space-x-2.5 bg-[#03291E]/10 px-3 py-1.5 rounded-xl border border-[#03291E]/20 shadow-2xs">
          <div className="w-8 h-8 rounded-full bg-[#03291E] text-[#A3D8C2] flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
            <User size={18} />
          </div>
          <div className="flex flex-col text-left pr-1">
            <span className="text-[9px] font-bold text-[#03291E]/70 uppercase leading-none">User Role</span>
            <span className="text-xs font-bold text-[#03291E] leading-tight">{t.userRole}</span>
          </div>
        </div>

        <button className="p-2 hover:bg-[#03291E]/10 rounded-full transition-colors text-[#03291E]">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}

