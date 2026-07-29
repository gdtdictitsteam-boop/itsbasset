import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { Wrench, Package as PackageIcon, MapPin } from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';
import { supabase } from '../lib/supabase';
import { Item, Location, InventoryItem } from '../types';

export function InventoryView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: itemsData }, { data: locationsData }, { data: inventoryData }] = await Promise.all([
        supabase.from('items').select('*'),
        supabase.from('locations').select('*'),
        supabase.from('inventory').select('*')
      ]);
      if (itemsData) setItems(itemsData);
      if (locationsData) setLocations(locationsData);
      if (inventoryData) setInventory(inventoryData);
    };
    fetchData();
  }, []);

  const enhancedInventory = inventory.map(inv => {
    const item = items.find(i => i.id === inv.item_id);
    const loc = locations.find(l => l.id === inv.location_id);
    return {
      ...inv,
      item_code: item?.code || '',
      item_name_kh: item?.name_kh || '',
      item_name_en: item?.name_en || '',
      category: item?.category || '',
      unit: item?.unit || '',
      location_name_kh: loc?.name_kh || '',
      location_name_en: loc?.name_en || ''
    };
  });

  const filteredInventory = enhancedInventory.filter(item => {
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
        <h2 className="text-2xl font-bold text-[#03291E]">{t.inventory}</h2>
      </div>
      
      <div className="bg-white rounded-2xl border border-[#C2E4D5] shadow-sm overflow-hidden flex flex-col">
        <div className="bg-[#C2E4D5] border-b border-[#B0DAC7] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex space-x-1 bg-[#A3D8C2]/50 p-1 rounded-lg border border-[#90CDB3] self-start">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-[#03291E] hover:bg-[#90CDB3]/50'}`}
            >
              ទូទៅ (All)
            </button>
            <button
              onClick={() => setActiveTab('Tools')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-[#03291E] hover:bg-[#90CDB3]/50'}`}
            >
              <Wrench size={16} />
              <span>សម្ភារ Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('Suppliers')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center space-x-2 ${activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-[#03291E] hover:bg-[#90CDB3]/50'}`}
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
              className="bg-[#F7FCFA] border border-[#BDE0D0] text-[#03291E] placeholder-[#2B6A52] rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1E6047]/20 focus:border-[#1E6047] w-full md:w-64" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#D4ECE0] text-[#03291E] border-b border-[#B0DAC7] text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3 font-bold text-center">ល.រ</th>
                <th className="px-6 py-3 font-bold">កូដ / សម្ភារ:</th>
                <th className="px-6 py-3 font-bold">{t.category}</th>
                <th className="px-6 py-3 font-bold">{t.location}</th>
                <th className="px-6 py-3 font-bold text-right">{t.quantity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAF5EF]">
              {filteredInventory.map((item, idx) => (
                <tr key={idx} className="even:bg-[#F3F9F6] odd:bg-white hover:bg-[#E1F2EA] transition-colors">
                  <td className="px-4 py-3.5 font-bold text-[#2B6A52] text-center text-sm">{idx + 1}</td>
                  <td className="px-6 py-3">
                    <div className="flex items-center space-x-3">
                      <ItemAvatar item={{ code: item.item_code, name_kh: item.item_name_kh, name_en: item.item_name_en, category: item.category }} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[#03291E] text-sm leading-snug line-clamp-1">{item.item_name_kh}</div>
                        <div className="text-[11px] font-mono text-[#2B6A52] mt-0.5 tracking-tight flex items-center gap-1.5 truncate">
                          <span className="font-semibold">{item.item_code}</span>
                          <span>•</span>
                          <span className="truncate">{item.item_name_en}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-[#E1F2EA] text-[#03291E] border-[#A8E6CF]' : 
                      item.category === 'Suppliers' ? 'bg-[#D2EADF] text-[#03291E] border-[#9FE3C5]' : 
                      'bg-[#EAF3EF] text-[#1E6047] border-[#C2E4D5]'
                    }`}>
                      {item.category === 'Tools' ? 'សម្ភារ Tools' : item.category === 'Suppliers' ? 'សម្ភារ Suppliers' : item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#2B6A52] font-semibold">
                    {language === 'kh' ? item.location_name_kh : item.location_name_en}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-right text-[#03291E]">
                    {item.quantity} <span className="text-[#2B6A52] font-medium ml-1 text-xs">{item.unit}</span>
                  </td>
                </tr>
              ))}
              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-[#2B6A52] text-sm">
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
