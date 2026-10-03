import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { mockInventory } from '../mockData';
import { 
  Wrench, Package as PackageIcon, RefreshCw, Database, 
  AlertTriangle, CheckCircle2, Boxes, ShieldAlert, Sparkles, X
} from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';
import { 
  isSupabaseConfigured, 
  fetchFullInventoryFromSupabase, 
  seedInitialInventoryToSupabase 
} from '../lib/supabase';
import { InventoryItem } from '../types';

export function InventoryView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const isConfigured = isSupabaseConfigured();
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>(mockInventory);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadInventory = async () => {
    if (!isConfigured) {
      setInventoryList(mockInventory);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchFullInventoryFromSupabase();
      if (data && data.length > 0) {
        setInventoryList(data);
      } else {
        setInventoryList(mockInventory);
      }
    } catch (e) {
      console.warn('Could not fetch inventory from Supabase, using mock fallback:', e);
      setInventoryList(mockInventory);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [isConfigured]);

  const handleSeedStock = async () => {
    if (isConfigured) {
      setIsSeeding(true);
      setNotice(null);
      const res = await seedInitialInventoryToSupabase();
      setIsSeeding(false);
      if (res.success) {
        setNotice({ type: 'success', message: res.message });
        await loadInventory();
      } else {
        setNotice({ type: 'error', message: res.message });
      }
    } else {
      // Local mode reset
      setInventoryList([...mockInventory]);
      setNotice({ 
        type: 'success', 
        message: 'បានកំណត់ចំនួនស្តុកឡើងវិញត្រឹមត្រូវតាមស្ដង់ដារប្រព័ន្ធជោគជ័យ (Standard Stock Restored)!' 
      });
    }
  };

  // Filter items
  const filteredInventory = inventoryList.filter(item => {
    const matchesLocation = 
      selectedLocationId === 'ALL' || 
      selectedLocation.code === 'ALL' || 
      item.location_id === selectedLocationId || 
      (item.location_name_kh && (
        item.location_name_kh.includes(selectedLocation.code) || 
        item.location_name_kh.includes(selectedLocation.name_kh)
      ));
    const matchesTab = activeTab === 'ALL' || item.category === activeTab;
    const matchesSearch = 
      (item.item_code || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.item_name_kh || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.item_name_en || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLocation && matchesTab && matchesSearch;
  });

  // Calculate high-level metrics for quick review
  const totalItemsCount = filteredInventory.length;
  const totalQuantityUnits = filteredInventory.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const lowStockCount = filteredInventory.filter(item => {
    const min = item.min_stock ?? 5;
    return item.quantity > 0 && item.quantity <= min;
  }).length;
  const outOfStockCount = filteredInventory.filter(item => item.quantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.inventory}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            គ្រប់គ្រង និងតាមដានចំនួនស្តុកជាក់ស្តែងតាមប្រភេទ និងទីតាំង (ទម្រង់ Read-Only)
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-auto">
          {/* Re-seed / Reorganize Stock Button */}
          <button
            onClick={handleSeedStock}
            disabled={isSeeding || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 shadow-2xs transition-colors disabled:opacity-50"
            title="រៀបចំ និងកំណត់ចំនួនស្តុកដំបូងឡើងវិញឱ្យបានត្រឹមត្រូវ"
          >
            <Sparkles size={14} className={isSeeding ? 'animate-spin text-teal-600' : 'text-teal-700'} />
            <span>{isSeeding ? 'កំពុងរៀបចំ...' : 'រៀបចំចំនួនស្តុកឡើងវិញ'}</span>
          </button>

          {/* Refresh from Supabase */}
          {isConfigured && (
            <button
              onClick={loadInventory}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors disabled:opacity-50"
              title="ទាញយកទិន្នន័យចុងក្រោយពី Supabase Database"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : 'text-slate-500'} />
              <span>{isLoading ? 'កំពុងទាញ...' : 'ទាញយកទិន្នន័យ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-200 ${
          notice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : notice.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {notice.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700 p-0.5">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Quick Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">មុខសម្ភារៈសរុប</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalItemsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Boxes size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">បរិមាណស្តុកសរុប</p>
            <p className="text-2xl font-black text-teal-800 mt-1">{totalQuantityUnits.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
            <PackageIcon size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ជិតអស់ស្តុក (Low)</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{lowStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">អស់ពីស្តុក (Out)</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{outOfStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>
      
      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        {/* Filter and Search Bar */}
        <div className="bg-slate-50/90 border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              ទូទៅ (All)
            </button>
            <button
              onClick={() => setActiveTab('Tools')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Wrench size={16} />
              <span>សម្ភារ Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('Suppliers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center space-x-2 ${
                activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <PackageIcon size={16} />
              <span>សម្ភារ Suppliers</span>
            </button>
          </div>

          <div className="relative">
            <input 
              type="text" 
              placeholder="ស្វែងរកតាមកូដ ឬឈ្មោះសម្ភារ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-full md:w-72 shadow-2xs font-medium" 
            />
          </div>
        </div>

        {/* Inventory Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3.5 font-bold text-center w-12">ល.រ</th>
                <th className="px-6 py-3.5 font-bold">រូបភាព / កូដ / សម្ភារ:</th>
                <th className="px-4 py-3.5 font-bold text-center">ប្រភេទ</th>
                <th className="px-6 py-3.5 font-bold">ទីតាំងស្តុក</th>
                <th className="px-4 py-3.5 font-bold text-center">កម្រិតអប្បបរមា</th>
                <th className="px-6 py-3.5 font-bold text-right">ចំនួនក្នុងស្តុក</th>
                <th className="px-4 py-3.5 font-bold text-center">ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item, idx) => {
                const minStock = item.min_stock ?? 5;
                const qty = item.quantity ?? 0;
                const isOutOfStock = qty === 0;
                const isLowStock = !isOutOfStock && qty <= minStock;

                return (
                  <tr key={`${item.location_id}-${item.item_id}-${idx}`} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                    {/* Index */}
                    <td className="px-4 py-3.5 font-bold text-slate-500 text-center text-sm">{idx + 1}</td>
                    
                    {/* Item Thumbnail & Name */}
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-3">
                        <ItemAvatar 
                          item={{ 
                            code: item.item_code, 
                            name_kh: item.item_name_kh, 
                            name_en: item.item_name_en, 
                            category: item.category,
                            image_url: item.image_url 
                          }} 
                        />
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

                    {/* Category */}
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                        item.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                        item.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {item.category === 'Tools' ? 'Tools' : item.category === 'Suppliers' ? 'Suppliers' : item.category}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                      {language === 'kh' ? item.location_name_kh : item.location_name_en}
                    </td>

                    {/* Min Stock */}
                    <td className="px-4 py-4 text-xs font-bold text-slate-500 text-center">
                      {minStock} <span className="font-normal text-[11px]">{item.unit}</span>
                    </td>

                    {/* Actual Quantity */}
                    <td className="px-6 py-4 text-sm font-black text-right text-slate-900">
                      <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}>
                        {qty}
                      </span>
                      <span className="text-slate-500 font-medium ml-1.5 text-xs">{item.unit}</span>
                    </td>

                    {/* Stock Status Badge */}
                    <td className="px-4 py-4 text-center">
                      {isOutOfStock ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          អស់ស្តុក
                        </span>
                      ) : isLowStock ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          ជិតអស់ស្តុក
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          មានស្តុក
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 text-sm">
                    {isLoading ? 'កំពុងទាញយកទិន្នន័យពី Supabase...' : 'មិនមានទិន្នន័យសម្ភារៈនៅក្នុងទីតាំងនេះឡើយ'}
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
