import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useInventoryContext } from '../contexts/InventoryContext';
import { 
  Wrench, Package as PackageIcon, RefreshCw, Database, 
  AlertTriangle, CheckCircle2, Boxes, ShieldAlert, Sparkles, X,
  Layers, MapPin, Building2
} from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';

export function InventoryView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const { inventory, items, locations, isLoading, refreshInventory, reseedStandardStock } = useInventoryContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'byLocation' | 'consolidated'>('consolidated');
  const [isSeeding, setIsSeeding] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleSeedStock = async () => {
    setIsSeeding(true);
    setNotice(null);
    const res = await reseedStandardStock();
    setIsSeeding(false);
    if (res.success) {
      setNotice({ type: 'success', message: res.message });
    } else {
      setNotice({ type: 'error', message: res.message });
    }
  };

  // Helper to check if inventory row belongs to HQ
  const isHqRow = (inv: any) => {
    if (inv.location_id === '1' || inv.location_id === 'HQ-ITSB') return true;
    const loc = locations.find(l => l.id === inv.location_id || l.code === inv.location_id);
    if (loc) return loc.type === 'HQ' || loc.code === 'HQ-ITSB';
    return Boolean(inv.location_name_kh && (inv.location_name_kh.includes('HQ') || inv.location_name_kh.includes('ថ្នាក់កណ្តាល')));
  };

  // Helper to check if inventory row matches current location filter
  const matchesLocationFilter = (inv: any) => {
    if (selectedLocationId === 'ALL' || selectedLocation.code === 'ALL') return true;
    if (inv.location_id === selectedLocationId || inv.location_id === selectedLocation.code) return true;

    const rowLoc = locations.find(l => l.id === inv.location_id || l.code === inv.location_id);
    if (rowLoc) {
      if (rowLoc.code === selectedLocation.code) return true;
      if (rowLoc.id === selectedLocation.id) return true;
    }

    const isSelHq = selectedLocation.type === 'HQ' || selectedLocation.code === 'HQ-ITSB' || selectedLocation.id === '1';
    if (isSelHq && (inv.location_id === '1' || inv.location_id === 'HQ-ITSB' || (inv.location_name_kh && inv.location_name_kh.includes('HQ')))) {
      return true;
    }

    if (selectedLocation.code && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.code)) return true;
    if (selectedLocation.name_kh && inv.location_name_kh && 
        (inv.location_name_kh.includes(selectedLocation.name_kh) || selectedLocation.name_kh.includes(inv.location_name_kh))) return true;

    return false;
  };

  // 1. Consolidated mode: One row per item (Summed across matching locations)
  const consolidatedItems = items.map((item, idx) => {
    // Filter matching inventory for this item
    const matchingInv = inventory.filter(inv => {
      const matchItem = inv.item_code === item.code || inv.item_id === item.id;
      if (!matchItem) return false;
      return matchesLocationFilter(inv);
    });

    let hqQty = 0;
    let branchQty = 0;
    matchingInv.forEach(inv => {
      if (isHqRow(inv)) {
        hqQty += (inv.quantity || 0);
      } else {
        branchQty += (inv.quantity || 0);
      }
    });

    const totalQty = hqQty + branchQty;
    const minStock = item.min_stock ?? 5;
    const status = totalQty === 0 ? 'អស់ស្តុក' : (totalQty <= minStock ? 'ជិតអស់ស្តុក' : 'មានស្តុក');

    return {
      no: idx + 1,
      id: item.id,
      code: item.code,
      name_kh: item.name_kh,
      name_en: item.name_en,
      category: item.category,
      unit: item.unit,
      image_url: item.image_url,
      min_stock: minStock,
      hq_quantity: hqQty,
      branch_quantity: branchQty,
      total_quantity: totalQty,
      status
    };
  }).filter(item => {
    const matchCategory = activeTab === 'ALL' || item.category === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      item.code.toLowerCase().includes(q) || 
      item.name_kh.toLowerCase().includes(q) || 
      item.name_en.toLowerCase().includes(q);
    return matchCategory && matchSearch;
  });

  // 2. By-Location mode: Raw inventory rows matching location & search
  const detailedLocationItems = inventory.filter(inv => {
    const matchLocation = matchesLocationFilter(inv);
    const matchCategory = activeTab === 'ALL' || inv.category === activeTab;
    const q = searchQuery.toLowerCase().trim();
    const matchSearch = !q || 
      (inv.item_code || '').toLowerCase().includes(q) || 
      (inv.item_name_kh || '').toLowerCase().includes(q) || 
      (inv.item_name_en || '').toLowerCase().includes(q);
    return matchLocation && matchCategory && matchSearch;
  });

  // High-level metrics for quick review
  const totalItemsCount = consolidatedItems.length;
  const totalQuantityUnits = consolidatedItems.reduce((acc, curr) => acc + curr.total_quantity, 0);
  const lowStockCount = consolidatedItems.filter(item => item.total_quantity > 0 && item.total_quantity <= item.min_stock).length;
  const outOfStockCount = consolidatedItems.filter(item => item.total_quantity === 0).length;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.inventory}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            បញ្ជីស្តុកបច្ចុប្បន្ន និងលំហូរស្តុកសម្ភារៈស្របតាមទីតាំងជាក់ស្តែង (ទម្រង់ Read-Only)
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-auto">
          {/* Re-seed / Reorganize Stock Button */}
          <button
            onClick={handleSeedStock}
            disabled={isSeeding || isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 shadow-2xs transition-colors disabled:opacity-50"
            title="រៀបចំ និងកំណត់ចំនួនស្តុកឡើងវិញឱ្យបានត្រឹមត្រូវ"
          >
            <Sparkles size={14} className={isSeeding ? 'animate-spin text-teal-600' : 'text-teal-700'} />
            <span>{isSeeding ? 'កំពុងរៀបចំ...' : 'រៀបចំចំនួនស្តុកឡើងវិញ'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={refreshInventory}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors disabled:opacity-50"
            title="ទាញយកទិន្នន័យចុងក្រោយ"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{isLoading ? 'កំពុងទាញ...' : 'ទាញយកទិន្នន័យ'}</span>
          </button>
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
        {/* Filter, View Mode and Search Bar */}
        <div className="bg-slate-50/90 border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                ទូទៅ (All)
              </button>
              <button
                onClick={() => setActiveTab('Tools')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Wrench size={13} />
                <span>សម្ភារ Tools</span>
              </button>
              <button
                onClick={() => setActiveTab('Suppliers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <PackageIcon size={13} />
                <span>សម្ភារ Suppliers</span>
              </button>
            </div>

            {/* View Mode Toggle when viewing All Locations */}
            {selectedLocationId === 'ALL' && (
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('consolidated')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'consolidated' ? 'bg-white text-teal-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="សរុបស្តុកតាមមុខសម្ភារៈ"
                >
                  <Layers size={13} />
                  <span>សរុបតាមសម្ភារៈ</span>
                </button>
                <button
                  onClick={() => setViewMode('byLocation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    viewMode === 'byLocation' ? 'bg-white text-teal-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="បំបែកលម្អិតតាមទីតាំងនីមួយៗ"
                >
                  <MapPin size={13} />
                  <span>បំបែកតាមទីតាំង</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <input 
              type="text" 
              placeholder="ស្វែងរកតាមកូដ ឬឈ្មោះសម្ភារ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-full md:w-64 shadow-2xs font-medium" 
            />
          </div>
        </div>

        {/* Inventory Data Table */}
        <div className="overflow-x-auto">
          {viewMode === 'consolidated' || selectedLocationId !== 'ALL' ? (
            /* Consolidated Table (Matches Dashboard View 100%) */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 font-bold text-center w-12">ល.រ</th>
                  <th className="px-6 py-3.5 font-bold">រូបភាព / កូដ / សម្ភារ:</th>
                  <th className="px-4 py-3.5 font-bold text-center">ប្រភេទ</th>
                  <th className="px-4 py-3.5 font-bold text-center">កម្រិតអប្បបរមា</th>
                  <th className="px-4 py-3.5 font-bold text-center">ស្តុក HQ</th>
                  <th className="px-4 py-3.5 font-bold text-center">ស្តុកសាខា</th>
                  <th className="px-6 py-3.5 font-bold text-right">ស្តុកសរុប</th>
                  <th className="px-4 py-3.5 font-bold text-center">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consolidatedItems.map((item, idx) => {
                  const isOutOfStock = item.total_quantity === 0;
                  const isLowStock = !isOutOfStock && item.total_quantity <= item.min_stock;

                  return (
                    <tr key={`${item.code}-${idx}`} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-slate-500 text-center text-sm">{idx + 1}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center space-x-3">
                          <ItemAvatar 
                            item={{ 
                              code: item.code, 
                              name_kh: item.name_kh, 
                              name_en: item.name_en, 
                              category: item.category,
                              image_url: item.image_url 
                            }} 
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{item.name_kh}</div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5 tracking-tight flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-slate-700">{item.code}</span>
                              <span>•</span>
                              <span className="truncate">{item.name_en}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                          item.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                          item.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                          'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {item.category === 'Tools' ? 'Tools' : item.category === 'Suppliers' ? 'Suppliers' : item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-slate-500 text-center">
                        {item.min_stock} <span className="font-normal text-[11px]">{item.unit}</span>
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-center text-slate-800">
                        {item.hq_quantity}
                      </td>
                      <td className="px-4 py-4 text-sm font-bold text-center text-blue-900">
                        {item.branch_quantity}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-right text-slate-900">
                        <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900'}>
                          {item.total_quantity}
                        </span>
                        <span className="text-slate-500 font-medium ml-1.5 text-xs">{item.unit}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold inline-block whitespace-nowrap border ${
                          item.status === 'មានស្តុក' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : item.status === 'ជិតអស់ស្តុក' 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {consolidatedItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500 text-sm">
                      {isLoading ? 'កំពុងទាញយកទិន្នន័យ...' : 'មិនមានទិន្នន័យសម្ភារៈឡើយ'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* By-Location Detailed Table */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 font-bold text-center w-12">ល.រ</th>
                  <th className="px-6 py-3.5 font-bold">រូបភាព / កូដ / សម្ភារ:</th>
                  <th className="px-4 py-3.5 font-bold text-center">ប្រភេទ</th>
                  <th className="px-6 py-3.5 font-bold">ទីតាំងស្តុក</th>
                  <th className="px-6 py-3.5 font-bold text-right">ចំនួនក្នុងស្តុក</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailedLocationItems.map((inv, idx) => (
                  <tr key={`${inv.location_id}-${inv.item_id}-${idx}`} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-slate-500 text-center text-sm">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-3">
                        <ItemAvatar 
                          item={{ 
                            code: inv.item_code, 
                            name_kh: inv.item_name_kh, 
                            name_en: inv.item_name_en, 
                            category: inv.category,
                            image_url: inv.image_url 
                          }} 
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-sm leading-snug line-clamp-1">{inv.item_name_kh}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5 tracking-tight flex items-center gap-1.5 truncate">
                            <span className="font-semibold text-slate-700">{inv.item_code}</span>
                            <span>•</span>
                            <span className="truncate">{inv.item_name_en}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                        inv.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                        inv.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                        'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {inv.category === 'Tools' ? 'Tools' : inv.category === 'Suppliers' ? 'Suppliers' : inv.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-semibold">
                      {language === 'kh' ? inv.location_name_kh : inv.location_name_en}
                    </td>
                    <td className="px-6 py-4 text-sm font-black text-right text-slate-900">
                      {inv.quantity} <span className="text-slate-500 font-medium ml-1.5 text-xs">{inv.unit}</span>
                    </td>
                  </tr>
                ))}

                {detailedLocationItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500 text-sm">
                      {isLoading ? 'កំពុងទាញយកទិន្នន័យ...' : 'មិនមានទិន្នន័យ'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
