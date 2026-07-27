import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Settings, Globe } from 'lucide-react';

export function Header() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="bg-[#064E3B] text-white flex items-center justify-between px-6 py-3 shadow-md border-b-4 border-[#900033] shrink-0">
      <div className="flex items-center space-x-4">
        <div className="bg-white p-1 rounded-md">
          <div className="w-10 h-10 bg-[#064E3B] rounded flex items-center justify-center font-bold text-lg text-white">
            GDT
          </div>
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold leading-none tracking-wide" style={{ fontFamily: "'Kantumruuy Pro', sans-serif" }}>{t.systemTitle}</h1>
          <span className="text-xs tracking-widest opacity-80 font-semibold uppercase">{language === 'kh' ? translations.en.systemTitle : translations.en.systemTitle}</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex border border-white/20 rounded overflow-hidden">
          <button
            onClick={() => setLanguage('kh')}
            className={`px-3 py-1 text-xs font-bold ${language === 'kh' ? 'bg-white text-[#064E3B]' : 'bg-transparent text-white hover:bg-white/10'}`}
          >
            ខ្មែរ
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-xs font-bold ${language === 'en' ? 'bg-white text-[#064E3B]' : 'bg-transparent text-white hover:bg-white/10'}`}
          >
            EN
          </button>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </div>
    </header>
  );
}

// Quick hack for english title in header
const translations = {
  en: { systemTitle: 'TECHNICAL INVENTORY SYSTEM' }
};
