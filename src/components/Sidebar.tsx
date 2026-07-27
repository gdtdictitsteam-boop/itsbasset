import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Package, 
  ArrowDownToLine, 
  ArrowRightLeft, 
  PlusCircle, 
  MinusCircle, 
  SlidersHorizontal,
  Database
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { t, language } = useLanguage();

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
    { id: 'inventory', icon: Package, label: t.inventory },
    { id: 'stockIn', icon: ArrowDownToLine, label: t.stockIn },
    { id: 'handover', icon: ArrowRightLeft, label: t.handover },
    { id: 'newSku', icon: PlusCircle, label: t.newSku },
    { id: 'stockOut', icon: MinusCircle, label: t.stockOut },
    { id: 'adjustment', icon: SlidersHorizontal, label: t.adjustment },
    { id: 'sql', icon: Database, label: t.sqlCode },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 p-4 flex flex-col shrink-0">
      {/* User Info */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"></path></svg>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] font-bold text-slate-400 uppercase">User Role</p>
            <p className="text-sm font-bold truncate">{t.userRole}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
          <p className="text-xs font-semibold">{t.userLocation.replace('Location: ', '').replace('ទីតាំង៖ ', '')}</p>
        </div>
      </div>

      {/* Menu Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const showDivider = item.id === 'stockOut';
            return (
              <React.Fragment key={item.id}>
                {showDivider && (
                  <div className="py-2">
                    <div className="border-t border-slate-100"></div>
                  </div>
                )}
                <button
                  onClick={() => setCurrentView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isActive 
                      ? 'bg-[#900033]/5 text-[#900033] border border-[#900033]/10' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={20} className={isActive ? '' : 'opacity-70'} />
                  <span className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                </button>
              </React.Fragment>
            );
          })}
      </nav>
    </aside>
  );
}
