import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockInventory } from '../mockData';
import { Wrench, Package as PackageIcon } from 'lucide-react';

export function InventoryView() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInventory = mockInventory.filter(item => {
    const matchesTab = activeTab === 'ALL' || item.category === activeTab;
    const matchesSearch = item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.item_name_kh.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.item_name_en.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">{t.inventory}</h2>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex flex-col">
        <div className="border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ទូទៅ (All)
            </button>
            <button
              onClick={() => setActiveTab('Tools')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Tools' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Wrench size={16} />
              <span>សម្ភារ Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('Suppliers')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Suppliers' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <PackageIcon size={16} />
              <span>សម្ភារ Suppliers</span>
            </button>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="ស្វែងរក..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033] w-full md:w-64" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-bold">{t.code}</th>
                <th className="px-6 py-3 font-bold">{t.itemName}</th>
                <th className="px-6 py-3 font-bold">{t.category}</th>
                <th className="px-6 py-3 font-bold">{t.location}</th>
                <th className="px-6 py-3 font-bold text-right">{t.quantity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{item.item_code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">
                    {language === 'kh' ? item.item_name_kh : item.item_name_en}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      item.category === 'Suppliers' ? 'bg-teal-50 text-teal-700 border-teal-200' : 
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {item.category === 'Tools' ? 'សម្ភារ Tools' : item.category === 'Suppliers' ? 'សម្ភារ Suppliers' : item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {language === 'kh' ? item.location_name_kh : item.location_name_en}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-right text-slate-800">
                    {item.quantity} <span className="text-slate-400 font-medium ml-1 text-xs">{item.unit}</span>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    មិនមានទិន្នន័យ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
