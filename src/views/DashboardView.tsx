import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockInventory } from '../mockData';
import { Package, AlertCircle, MapPin } from 'lucide-react';

export function DashboardView() {
  const { t, language } = useLanguage();

  const totalItems = mockInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockCount = mockInventory.filter(item => item.quantity < 10).length; // Mock condition
  const locationsCount = new Set(mockInventory.map(item => item.location_id)).size;

  const statCards = [
    { label: t.totalItems, value: totalItems, icon: Package, color: 'bg-blue-500' },
    { label: t.lowStock, value: lowStockCount, icon: AlertCircle, color: 'bg-amber-500' },
    { label: t.totalLocations, value: locationsCount, icon: MapPin, color: 'bg-teal-600' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">{t.dashboard}</h2>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.totalItems}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">{totalItems}</h3>
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">+12 Items</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Stock Out (Today)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">84</h3>
            <span className="text-xs text-slate-400">Transactions</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.lowStock}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-[#900033]">0{lowStockCount}</h3>
            <span className="text-xs text-red-600 font-bold uppercase">Check SKU</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.totalLocations}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">{locationsCount}</h3>
            <span className="text-xs text-slate-400">Branches</span>
          </div>
        </div>
      </div>

      {/* Recent Activity placeholder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{t.recentTransactions}</h3>
        </div>
        <div className="p-6 text-center text-gray-500 text-sm">
          No recent transactions to display.
        </div>
      </div>
    </div>
  );
}
