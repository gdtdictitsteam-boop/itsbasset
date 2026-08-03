import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ArrowDownToLine, 
  ArrowRightLeft, 
  PlusCircle, 
  MinusCircle, 
  SlidersHorizontal,
  Database,
  MapPin,
  ShieldCheck,
  Building2
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

interface MenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  restrictedForBranchUser?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { t, language } = useLanguage();
  const { selectedLocationId, setSelectedLocationId, locations } = useLocationContext();
  const { userRole, isCentralAdmin, isBranchUser } = useAuth();

  // Define full menu groups
  const rawMenuGroups: MenuGroup[] = [
    {
      title: language === 'kh' ? 'ព័ត៌មានទូទៅ' : 'General Info',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard, restrictedForBranchUser: false },
        { id: 'inventory', icon: Package, label: t.inventory, restrictedForBranchUser: false },
      ]
    },
    {
      title: language === 'kh' ? 'ព័ត៌មានប្រតិបត្តិការស្តុកកណ្តាល' : 'HQ Operations',
      items: [
        // Restricted items: Stock In & Handover & New SKU are ONLY for CentralAdmin
        { id: 'stockIn', icon: ArrowDownToLine, label: t.stockIn, restrictedForBranchUser: true },
        { id: 'handover', icon: ArrowRightLeft, label: t.handover, restrictedForBranchUser: true },
        { id: 'newSku', icon: PlusCircle, label: t.newSku, restrictedForBranchUser: true },
      ]
    },
    {
      title: language === 'kh' ? 'ព័ត៌មានប្រតិបត្តិការសាខា' : 'Branch Operations',
      items: [
        { id: 'stockOut', icon: MinusCircle, label: t.stockOut, restrictedForBranchUser: false },
        { id: 'adjustment', icon: SlidersHorizontal, label: t.adjustment, restrictedForBranchUser: false },
      ]
    },
    {
      title: language === 'kh' ? 'ប្រព័ន្ធ' : 'System',
      items: [
        { id: 'sql', icon: Database, label: t.sqlCode, restrictedForBranchUser: false },
      ]
    }
  ];

  // Role Filter: Hide Stock In, Handover, and New SKU if the user is BranchUser
  const menuGroups = rawMenuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (isBranchUser && item.restrictedForBranchUser) {
          return false; // Hide from BranchUser
        }
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0); // Hide empty groups

  return (
    <aside className="w-[266px] bg-[#F2F9F6] border-r border-[#CDE5DA] p-4 flex flex-col shrink-0">
      
      {/* Current Active Role Badge */}
      <div className={`p-2.5 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 ${
        isCentralAdmin
          ? 'bg-emerald-100/80 border-emerald-300 text-emerald-950'
          : 'bg-amber-100/80 border-amber-300 text-amber-950'
      }`}>
        {isCentralAdmin ? (
          <ShieldCheck size={18} className="text-emerald-800 shrink-0" />
        ) : (
          <Building2 size={18} className="text-amber-800 shrink-0" />
        )}
        <div className="flex-1 truncate">
          <div className="text-[10px] uppercase font-mono opacity-70 leading-none">Access Level</div>
          <div className="text-xs font-black truncate">{userRole}</div>
        </div>
      </div>

      {/* Location Selector */}
      <div className="bg-[#E1F2EA] p-3.5 rounded-xl border border-[#C2E4D5] mb-6 shadow-2xs">
        <label className="text-[10px] font-bold text-[#2B6A52] uppercase flex items-center justify-between mb-1.5">
          <span>LOCATION (ទីតាំងស្តុក)</span>
          <MapPin size={13} className="text-[#1E6047]" />
        </label>
        <select
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="w-full text-xs font-bold text-[#03291E] bg-[#F7FCFA] border border-[#BDE0D0] rounded-lg p-2 focus:ring-2 focus:ring-[#1E6047]/20 focus:border-[#1E6047] outline-none cursor-pointer truncate shadow-2xs hover:border-[#9FD2BC] transition-colors"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {language === 'kh' ? loc.name_kh : loc.name_en}
            </option>
          ))}
        </select>
      </div>

      {/* Menu Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-6">
        {menuGroups.map((group, groupIdx) => (
          <div key={groupIdx}>
            <h4 className="px-3 text-[11px] font-bold text-[#2B6A52] uppercase mb-2 whitespace-nowrap truncate">{group.title}</h4>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg transition-all text-left ${
                      isActive 
                        ? 'bg-[#9FE3C5] text-[#03291E] border border-[#6EC8A0] font-bold shadow-xs' 
                        : 'text-[#1E6047] hover:bg-[#DDF0E7] hover:text-[#03291E]'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 ${isActive ? 'text-[#03291E]' : 'text-[#1E6047] opacity-85'}`} />
                    <span className={`text-xs md:text-sm whitespace-nowrap truncate ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
