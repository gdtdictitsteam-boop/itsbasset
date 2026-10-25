import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  MinusCircle,
  BarChart3,
  Package,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  isCenter?: boolean;
}

export function MobileBottomNav({ currentView, onNavigate }: MobileBottomNavProps) {
  const { isCentralAdmin } = useAuth();

  const navItems: NavItem[] = isCentralAdmin
    ? [
        { id: 'dashboard', label: 'ទំព័រដើម', icon: LayoutDashboard },
        { id: 'stockIn', label: 'បញ្ចូលស្តុក', icon: PlusCircle },
        { id: 'handover', label: 'ប្រគល់សាខា', icon: ArrowLeftRight, isCenter: true },
        { id: 'stockOut', label: 'ដកប្រើប្រាស់', icon: MinusCircle },
        { id: 'executiveReport', label: 'របាយការណ៍', icon: BarChart3 },
      ]
    : [
        { id: 'dashboard', label: 'ទំព័រដើម', icon: LayoutDashboard },
        { id: 'inventory', label: 'ស្តុកសាខា', icon: Package },
        { id: 'stockOut', label: 'ដកប្រើប្រាស់', icon: MinusCircle, isCenter: true },
        { id: 'adjustment', label: 'កែតម្រូវ', icon: SlidersHorizontal },
        { id: 'executiveReport', label: 'របាយការណ៍', icon: BarChart3 },
      ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="no-print lg:hidden print:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          if (item.isCenter) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center justify-center cursor-pointer group focus:outline-none"
              >
                <div
                  className={`-mt-6 w-14 h-14 rounded-full bg-gradient-to-tr from-[#0b3d2e] to-emerald-600 text-white shadow-lg shadow-emerald-900/30 ring-4 flex items-center justify-center active:scale-95 transition-all ${
                    isActive
                      ? 'ring-emerald-200 scale-105'
                      : 'ring-white group-hover:scale-105'
                  }`}
                >
                  <Icon size={22} strokeWidth={2.2} />
                </div>
                <span
                  className={`text-[10px] mt-0.5 leading-tight text-center whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-[#0b3d2e] font-extrabold'
                      : 'text-slate-700 font-bold group-hover:text-[#0b3d2e]'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer mx-0.5 ${
                isActive
                  ? 'bg-emerald-50 text-[#0b3d2e] font-bold rounded-xl py-1 px-2'
                  : 'text-slate-500 hover:text-[#0b3d2e] font-medium py-1 px-2 rounded-xl'
              }`}
            >
              <Icon size={19} strokeWidth={isActive ? 2.4 : 2} />
              <span className="text-[10px] leading-tight text-center whitespace-nowrap truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
