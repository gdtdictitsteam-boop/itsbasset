import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  ArrowDownToLine, 
  ArrowRightLeft, 
  Clock, 
  PlusCircle, 
  MinusCircle, 
  SlidersHorizontal,
  Database,
  History,
  MapPin,
  ShieldCheck,
  Building2,
  Lock
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

interface MenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const { t, language } = useLanguage();
  const { selectedLocationId, setSelectedLocationId, selectedLocation, locations, isLocationLocked } = useLocationContext();
  const { userRole, isCentralAdmin, isBranchUser } = useAuth();

  // For CentralAdmin: Full access to all menus across all sections
  const centralAdminMenuGroups: MenuGroup[] = [
    {
      title: language === 'kh' ? 'ព័ត៌មានទូទៅ' : 'General Info',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
        { id: 'inventory', icon: Package, label: t.inventory },
      ]
    },
    {
      title: language === 'kh' ? 'ព័ត៌មានប្រតិបត្តិការស្តុកកណ្តាល' : 'HQ Operations',
      items: [
        { id: 'stockIn', icon: ArrowDownToLine, label: t.stockIn },
        { id: 'handover', icon: ArrowRightLeft, label: t.handover },
        { id: 'newSku', icon: PlusCircle, label: t.newSku },
      ]
    },
    {
      title: language === 'kh' ? 'ព័ត៌មានប្រតិបត្តិការសាខា' : 'Branch Operations',
      items: [
        { id: 'pendingTransfers', icon: Clock, label: language === 'kh' ? 'សម្ភារកំពុងផ្ទេរ' : 'Pending Transfers' },
        { id: 'stockOut', icon: MinusCircle, label: t.stockOut },
        { id: 'adjustment', icon: SlidersHorizontal, label: t.adjustment },
      ]
    },
    {
      title: language === 'kh' ? 'ប្រព័ន្ធ' : 'System',
      items: [
        { id: 'auditTrail', icon: History, label: language === 'kh' ? 'ប្រវត្តិសវនកម្ម (Audit Trail)' : 'Audit Trail' },
        { id: 'sql', icon: Database, label: t.sqlCode },
      ]
    }
  ];

  // For BranchUser: ONLY 3 allowed functions per RBAC requirements:
  // 1. "ដកប្រើប្រាស់ (Stock Out)"
  // 2. "កែតម្រូវស្តុក (Adjustment)"
  // 3. "ប្រវត្តិសវនកម្ម (Audit Trail)"
  const branchUserMenuGroups: MenuGroup[] = [
    {
      title: language === 'kh' ? 'ប្រតិបត្តិការសាខា' : 'Branch Operations',
      items: [
        { id: 'stockOut', icon: MinusCircle, label: t.stockOut },
        { id: 'adjustment', icon: SlidersHorizontal, label: t.adjustment },
        { id: 'auditTrail', icon: History, label: language === 'kh' ? 'ប្រវត្តិសវនកម្ម (Audit Trail)' : 'Audit Trail' },
      ]
    }
  ];

  const menuGroups = isBranchUser ? branchUserMenuGroups : centralAdminMenuGroups;

  return (
    <aside className="w-[266px] bg-[#F2F9F6] border-r border-[#CDE5DA] p-4 flex flex-col shrink-0 font-siemreap">
      
      {/* Current Active Role Badge */}
      <div className={`p-2.5 rounded-xl border mb-4 text-xs font-bold flex items-center gap-2 ${
        isCentralAdmin
          ? 'bg-emerald-100/90 border-emerald-300 text-emerald-950 shadow-2xs'
          : 'bg-amber-100/90 border-amber-300 text-amber-950 shadow-2xs'
      }`}>
        {isCentralAdmin ? (
          <ShieldCheck size={18} className="text-emerald-800 shrink-0" />
        ) : (
          <Building2 size={18} className="text-amber-800 shrink-0" />
        )}
        <div className="flex-1 truncate">
          <div className="text-[10px] uppercase font-mono opacity-75 leading-none">Access Level (កម្រិតសិទ្ធិ)</div>
          <div className="text-xs font-black truncate">{userRole}</div>
        </div>
      </div>

      {/* Location Selector (Locked for BranchUser, Full select for CentralAdmin) */}
      <div className="bg-[#E1F2EA] p-3.5 rounded-xl border border-[#C2E4D5] mb-6 shadow-2xs">
        <label className="text-[10px] font-bold text-[#2B6A52] uppercase flex items-center justify-between mb-1.5">
          <span>{isBranchUser ? 'សាខារបស់លោកអ្នក (BRANCH)' : 'LOCATION (ទីតាំងស្តុក)'}</span>
          {isBranchUser ? (
            <span className="flex items-center text-[10px] text-amber-800 font-bold bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
              <Lock size={10} className="mr-1 text-amber-700" /> ចាក់សោ
            </span>
          ) : (
            <MapPin size={13} className="text-[#1E6047]" />
          )}
        </label>

        {isBranchUser ? (
          // Locked view for BranchUser: cannot change branch, cannot view other branches or HQ
          <div className="w-full text-xs font-bold text-[#03291E] bg-[#F7FCFA] border border-amber-300 rounded-lg p-2.5 flex items-center justify-between shadow-2xs">
            <span className="truncate" title={formatLocationOption(selectedLocation, language)}>
              {formatLocationOption(selectedLocation, language)}
            </span>
            <Lock size={13} className="text-amber-700 shrink-0 ml-1.5" />
          </div>
        ) : (
          // Free selector for CentralAdmin: can choose any location or ALL
          <select
            value={selectedLocation.id}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full text-xs font-bold text-[#03291E] bg-[#F7FCFA] border border-[#BDE0D0] rounded-lg p-2 focus:ring-2 focus:ring-[#1E6047]/20 focus:border-[#1E6047] outline-none cursor-pointer truncate shadow-2xs hover:border-[#9FD2BC] transition-colors"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {formatLocationOption(loc, language)}
              </option>
            ))}
          </select>
        )}

        {isBranchUser && (
          <p className="text-[10px] text-amber-900/80 font-medium mt-1.5 italic">
            * គណនីមន្ត្រីសាខា ត្រូវបានកំណត់ឱ្យឃើញតែទិន្នន័យសាខានេះប៉ុណ្ណោះ
          </p>
        )}
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
                    className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-lg transition-all text-left cursor-pointer ${
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
