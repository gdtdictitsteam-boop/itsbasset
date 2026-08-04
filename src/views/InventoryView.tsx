import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { mockInventory } from '../mockData';
import { Wrench, Package as PackageIcon, MapPin } from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';
import { isSupabaseConfigured } from '../lib/supabase';

export function InventoryView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [inventory, setInventory] = useState<any[]>(isSupabaseConfigured() ? [] : mockInventory);
  
  useEffect(() => {
    async function fetchInventory() {
      if (isSupabaseConfigured()) {
        const { supabase } = await import('../lib/supabase');
        const { data, error } = await supabase
          .from('inventory')
          .select(`
            *,
            items ( code, name_kh, name_en, category, unit ),
            locations ( name_kh, name_en )
          `);
          
        if (data && !error) {
          const formatted = data.map((inv: any) => ({
            ...inv,
            item_code: inv.items?.code || '',
            item_name_kh: inv.items?.name_kh || '',
            item_name_en: inv.items?.name_en || '',
            category: inv.items?.category || '',
            unit: inv.items?.unit || '',
            location_name_kh: inv.locations?.name_kh || '',
            location_name_en: inv.locations?.name_en || ''
          }));
          setInventory(formatted);
        }
      }
    }
    fetchInventory();
  }, []);

  const filteredInventory = inventory.filter(item => {
    const matchesLocation = selectedLocationId === 'ALL' || selectedLocation.code === 'ALL' || item.location_id === selectedLocationId || item.location_name_kh.includes(selectedLocation.code) || item.location_name_kh.includes(selectedLocation.name_kh);
    const matchesTab = activeTab === 'ALL' || item.category === activeTab;
    const matchesSearch = item.item_code.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.item_name_kh.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.item_name_en.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLocation && matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-900">{t.inventory}</h2>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        <div className="bg-slate-50/90 border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              ទូទៅ (All)
            </button>
            <button
              onClick={() => setActiveTab('Tools')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              <Wrench size={16} />
              <span>សម្ភារ Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('Suppliers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              <PackageIcon size={16} />
              <span>សម្ភារ Suppliers</span>
            </button>
          </div>
          <div className="relative">
            <input 
              type="text" 
              placeholder="ស្វែងរកសម្ភារ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-full md:w-64 shadow-2xs font-medium" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3.5 font-bold text-center">ល.រ</th>
                <th className="px-6 py-3.5 font-bold">កូដ / សម្ភារ:</th>
                <th className="px-6 py-3.5 font-bold">{t.category}</th>
                <th className="px-6 py-3.5 font-bold">{t.location}</th>
                <th className="px-6 py-3.5 font-bold text-right">{t.quantity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item, idx) => (
                <tr key={idx} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-slate-500 text-center text-sm">{idx + 1}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center space-x-3">
                      <ItemAvatar item={{ code: item.item_code, name_kh: item.item_name_kh, name_en: item.item_name_en, category: item.category }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{item.item_name_kh}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5 tracking-tight flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-slate-700">{item.item_code}</span>
                          <span>•</span>
                          <span className="truncate">{item.item_name_en}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                      item.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {item.category === 'Tools' ? 'សម្ភារ Tools' : item.category === 'Suppliers' ? 'សម្ភារ Suppliers' : item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                    {language === 'kh' ? item.location_name_kh : item.location_name_en}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-right text-slate-900">
                    {item.quantity} <span className="text-slate-500 font-medium ml-1 text-xs">{item.unit}</span>
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
