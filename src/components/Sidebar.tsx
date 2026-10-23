import React, { useEffect } from 'react';
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
  History,
  MapPin,
  FileBarChart2,
  X
} from 'lucide-react';
import logoStock from '../logostock1.png';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
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

export function Sidebar({ currentView, setCurrentView, isOpen = false, onClose }: SidebarProps) {
  const { t, language } = useLanguage();
  const { selectedLocationId, setSelectedLocationId, selectedLocation, locations, isLocationLocked } = useLocationContext();
  const { userRole, isCentralAdmin, isBranchUser } = useAuth();

  // Lock background body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // For CentralAdmin: Full access to all menus across all sections
  const centralAdminMenuGroups: MenuGroup[] = [
    {
      title: language === 'kh' ? 'ព័ត៌មានទូទៅ' : 'General Info',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
        { id: 'inventory', icon: Package, label: t.inventory },
        { id: 'executiveReport', icon: FileBarChart2, label: language === 'kh' ? 'របាយការណ៍រួម (Reports)' : 'Executive Report' },
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
        { id: 'stockOut', icon: MinusCircle, label: t.stockOut },
        { id: 'adjustment', icon: SlidersHorizontal, label: t.adjustment },
      ]
    },
    {
      title: language === 'kh' ? 'ប្រព័ន្ធ' : 'System',
      items: [
        { id: 'auditTrail', icon: History, label: language === 'kh' ? 'ប្រវត្តិសវនកម្ម (Audit Trail)' : 'Audit Trail' },
      ]
    }
  ];

  // For BranchUser: Full access to Dashboard, Inventory, Executive Report (locked to branch), plus branch operations:
  const branchUserMenuGroups: MenuGroup[] = [
    {
      title: language === 'kh' ? 'ព័ត៌មានទូទៅ' : 'General Info',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: t.dashboard },
        { id: 'inventory', icon: Package, label: t.inventory },
        { id: 'executiveReport', icon: FileBarChart2, label: language === 'kh' ? 'របាយការណ៍រួម (Reports)' : 'Executive Report' },
      ]
    },
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

  const handleSelectMenu = (viewId: string) => {
    setCurrentView(viewId);
    if (onClose) {
      onClose();
    }
  };

  const renderLocationSelector = () => (
    <div className="bg-[#E1F2EA] p-3.5 rounded-xl border border-[#C2E4D5] shadow-2xs shrink-0">
      <label className="text-[10px] font-bold text-[#2B6A52] uppercase flex items-center justify-between mb-1.5">
        <span>{isBranchUser ? 'សាខារបស់លោកអ្នក (BRANCH)' : 'LOCATION (ទីតាំងស្តុក)'}</span>
        <MapPin size={13} className="text-[#1E6047]" />
      </label>

      {isBranchUser ? (
        // Locked view for BranchUser: cannot change branch, cannot view other branches or HQ
        <div className="w-full text-xs font-bold text-[#03291E] bg-[#F7FCFA] border border-[#BDE0D0] rounded-lg p-2.5 flex items-center justify-between shadow-2xs min-h-[40px]">
          <span 
            className="truncate" 
            title={formatLocationOption(selectedLocation)}
          >
            {formatLocationOption(selectedLocation)}
          </span>
        </div>
      ) : (
        // Free selector for CentralAdmin: can choose any location or ALL
        <select
          value={selectedLocation.id}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="w-full text-xs font-bold text-[#03291E] bg-[#F7FCFA] border border-[#BDE0D0] rounded-lg p-2 min-h-[40px] focus:ring-2 focus:ring-[#1E6047]/20 focus:border-[#1E6047] outline-none cursor-pointer truncate shadow-2xs hover:border-[#9FD2BC] transition-colors"
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {formatLocationOption(loc)}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const renderMenuGroups = () => (
    <>
      {menuGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="pt-2 first:pt-0">
          <h4 className="px-3 text-[11px] font-bold text-[#2B6A52] uppercase mb-1.5 whitespace-nowrap truncate">{group.title}</h4>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMenu(item.id)}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2.5 min-h-[44px] rounded-lg transition-all text-left cursor-pointer ${
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
    </>
  );

  return (
    <>
      {/* Desktop Static Sidebar (lg and up) */}
      <aside className="hidden lg:flex w-[266px] bg-[#F2F9F6] border-r border-[#CDE5DA] p-4 flex-col shrink-0 font-siemreap">
        <div className="mb-6">
          {renderLocationSelector()}
        </div>
        <nav className="flex-1 overflow-y-auto space-y-5">
          {renderMenuGroups()}
        </nav>
      </aside>

      {/* Always-Mounted Mobile & Tablet Slide-Over Drawer (< lg) for 60fps Smooth Transition */}
      <div
        className={`lg:hidden fixed inset-0 z-50 font-siemreap ${
          isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop Overlay */}
        <div
          className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
            isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sliding Sidebar Panel («មីនុយប្រព័ន្ធ GDT») */}
        <aside
          className={`fixed top-0 left-0 bottom-0 w-[82vw] max-w-[300px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform border-r border-[#CDE5DA] ${
            isOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full pointer-events-none'
          }`}
        >
          {/* Drawer Header with Logo and Close Button */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#CDE5DA] bg-[#F2F9F6] shrink-0">
            <div className="flex items-center space-x-2.5 min-w-0">
              <img
                src={logoStock}
                alt="GDT Logo"
                className="w-8 h-8 object-contain rounded-lg shadow-2xs shrink-0"
              />
              <span
                className="text-xs font-normal text-[#03291E] truncate"
                style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
              >
                មីនុយប្រព័ន្ធ GDT
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#03291E] hover:bg-[#DDF0E7] active:scale-90 transition-transform duration-150 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
              title="បិទមីនុយ (Close Menu)"
              aria-label="Close Menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Location Selector Box inside Drawer */}
          <div className="px-3 pt-3 pb-2 bg-[#F2F9F6]/60 border-b border-[#CDE5DA]/60 shrink-0">
            {renderLocationSelector()}
          </div>

          {/* Smooth Internal Scrollable Menu List */}
          <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-1 bg-[#F2F9F6]/30">
            {renderMenuGroups()}
          </nav>
        </aside>
      </div>
    </>
  );
}

