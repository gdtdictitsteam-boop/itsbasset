import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Wrench, Package as PackageIcon, RefreshCw, 
  AlertTriangle, Boxes, ShieldAlert,
  Layers, MapPin, Building2, CheckCircle2, Lock
} from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';

export function InventoryView() {
  const { t, language } = useLanguage();
  const { isBranchUser, isCentralAdmin } = useAuth();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const { inventory, items, locations, isLoading, refreshInventory } = useInventoryContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'byLocation' | 'consolidated'>('consolidated');

  // Helper to check if inventory row belongs to HQ
  const isHqRow = (inv: any) => isHqLocationOrRow(inv, locations);

  // Helper to check if inventory row matches current location filter
  const matchesLocationFilter = (inv: any) => {
    if (selectedLocationId === 'ALL' || selectedLocation.code === 'ALL') return true;
    if (String(inv.location_id) === String(selectedLocationId) || String(inv.location_id) === String(selectedLocation.code)) return true;

    const rowLoc = locations.find(l => String(l.id) === String(inv.location_id) || String(l.code) === String(inv.location_id));
    if (rowLoc) {
      if (String(rowLoc.code) === String(selectedLocation.code)) return true;
      if (String(rowLoc.id) === String(selectedLocation.id)) return true;
    }

    const isSelHq = isHqLocationOrRow(selectedLocation, locations);
    if (isSelHq && isHqLocationOrRow(inv, locations)) {
      return true;
    }

    if (selectedLocation.code && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.code)) return true;
    if (selectedLocation.name_kh && inv.location_name_kh && 
        (inv.location_name_kh.includes(selectedLocation.name_kh) || selectedLocation.name_kh.includes(inv.location_name_kh))) return true;

    return false;
  };

  const isSpecificBranch = selectedLocationId !== 'ALL' && 
    !isHqLocationOrRow(selectedLocation, locations) && 
    selectedLocation.code !== 'ALL';

  const isSelHq = selectedLocationId !== 'ALL' && isHqLocationOrRow(selectedLocation, locations);

  // Check if viewing in branch-isolated mode (either logged in as BranchUser or CentralAdmin selected a specific branch)
  const isBranchView = isBranchUser || isSpecificBranch;

  // 1. Consolidated mode: One row per item (Accurately calculates HQ Stock, Branch Stock, and Total Stock)
  const consolidatedItems = items.map((item, idx) => {
    // Find all inventory rows for this item
    const itemRows = inventory.filter(inv => 
      String(inv.item_code)?.trim().toUpperCase() === String(item.code)?.trim().toUpperCase() || 
      String(inv.item_id) === String(item.id)
    );

    // HQ stock ALWAYS calculates total stock of this item at HQ locations
    let hqQty = 0;
    itemRows.forEach(inv => {
      if (isHqLocationOrRow(inv, locations)) {
        hqQty += (inv.quantity || 0);
      }
    });

    // Branch stock: if specific branch selected, show that branch's stock; otherwise sum across branches
    let branchQty = 0;
    itemRows.forEach(inv => {
      if (!isHqLocationOrRow(inv, locations)) {
        if (!isSpecificBranch || matchesLocationFilter(inv)) {
          branchQty += (inv.quantity || 0);
        }
      }
    });

    const totalQty = isSpecificBranch ? branchQty : (isSelHq ? hqQty : (hqQty + branchQty));
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
  const totalQuantityUnits = consolidatedItems.reduce((acc, curr) => acc + (isBranchView ? curr.branch_quantity : curr.total_quantity), 0);
  const lowStockCount = consolidatedItems.filter(item => {
    const qty = isBranchView ? item.branch_quantity : item.total_quantity;
    return qty > 0 && qty <= item.min_stock;
  }).length;
  const outOfStockCount = consolidatedItems.filter(item => {
    const qty = isBranchView ? item.branch_quantity : item.total_quantity;
    return qty === 0;
  }).length;

  return (
    <div className="space-y-6 font-siemreap">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.inventory}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isBranchView 
              ? `* បង្ហាញតែមុខសម្ភារៈដែលមានក្នុងស្តុកសាខា ${selectedLocation.name_kh} ជាក់ស្តែង (ដែលបានទទួលផ្ទេរពីស្តុកកណ្តាល HQ)` 
              : 'បញ្ជីស្តុកបច្ចុប្បន្ន និងលំហូរស្តុកសម្ភារៈស្របតាមទីតាំងជាក់ស្តែង (ទម្រង់ Read-Only)'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            onClick={refreshInventory}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            title="ទាញយកទិន្នន័យចុងក្រោយ"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin text-teal-600' : 'text-slate-500'} />
            <span>{isLoading ? 'កំពុងទាញ...' : 'ទាញយកទិន្នន័យ'}</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total SKUs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isBranchView ? 'មុខសម្ភារៈមានស្តុក' : 'មុខសម្ភារៈសរុប'}
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">{totalItemsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Boxes size={20} />
          </div>
        </div>

        {/* Card 2: Total Units */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {isBranchView ? 'បរិមាណស្តុកប្រចាំសាខា' : 'បរិមាណស្តុកសរុប'}
            </p>
            <p className="text-2xl font-black text-teal-800 mt-1">{totalQuantityUnits.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
            <PackageIcon size={20} />
          </div>
        </div>

        {/* Card 3: Low Stock */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ជិតអស់ស្តុក (Low)</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{lowStockCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* Card 4: If Branch View -> Branch Assignment info; If Central -> Out of Stock */}
        {isBranchView ? (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">សាខាប្រចាំការ</p>
              <p className="text-base font-black text-slate-900 mt-1 truncate max-w-[130px]" title={selectedLocation.name_kh}>
                {selectedLocation.code || selectedLocation.name_kh}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200" title="ចាក់សោតាមសាខា">
              <Lock size={18} />
            </div>
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">អស់ពីស្តុក (Out)</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{outOfStockCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <ShieldAlert size={20} />
            </div>
          </div>
        )}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                ទូទៅ (All)
              </button>
              <button
                onClick={() => setActiveTab('Tools')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Wrench size={13} />
                <span>សម្ភារ Tools</span>
              </button>
              <button
                onClick={() => setActiveTab('Suppliers')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <PackageIcon size={13} />
                <span>សម្ភារ Suppliers</span>
              </button>
            </div>

            {/* View Mode Toggle when viewing All Locations (CentralAdmin ONLY) */}
            {!isBranchView && selectedLocationId === 'ALL' && (
              <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode('consolidated')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'consolidated' ? 'bg-white text-teal-900 shadow-2xs border border-slate-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="សរុបស្តុកតាមមុខសម្ភារៈ"
                >
                  <Layers size={13} />
                  <span>សរុបតាមសម្ភារៈ</span>
                </button>
                <button
                  onClick={() => setViewMode('byLocation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
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
              placeholder="ស្វែងរកតាមកូដ ឬឈ្មោះសម្ភារៈ..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 w-full md:w-64 shadow-2xs font-medium" 
            />
          </div>
        </div>

        {/* Inventory Data Table */}
        <div className="overflow-x-auto">
          {viewMode === 'consolidated' || isBranchView ? (
            /* Consolidated Table */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                  <th className="px-4 py-3.5 font-bold text-center w-12">ល.រ</th>
                  <th className="px-6 py-3.5 font-bold">រូបភាព / កូដ / សម្ភារ:</th>
                  <th className="px-4 py-3.5 font-bold text-center">ប្រភេទ</th>
                  <th className="px-4 py-3.5 font-bold text-center">កម្រិតអប្បបរមា</th>
                  {/* Central HQ Stock column */}
                  <th className="px-4 py-3.5 font-bold text-center">
                    {isBranchView ? 'ស្តុកកណ្តាល HQ (អាចស្នើសុំ)' : 'ស្តុក HQ'}
                  </th>
                  {/* Branch Stock column for CentralAdmin */}
                  {!isBranchView && (
                    <th className="px-4 py-3.5 font-bold text-center">ស្តុកសាខា</th>
                  )}
                  {/* Branch quantity or total quantity */}
                  <th className="px-6 py-3.5 font-bold text-right">
                    {isBranchView ? 'ស្តុកនៅសាខានេះ' : 'ស្តុកសរុប'}
                  </th>
                  <th className="px-4 py-3.5 font-bold text-center">ស្ថានភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consolidatedItems.map((item, idx) => {
                  const effectiveQty = isBranchView ? item.branch_quantity : item.total_quantity;
                  const isOutOfStock = effectiveQty === 0;
                  const isLowStock = !isOutOfStock && effectiveQty <= item.min_stock;

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
                      {/* HQ Stock (Always visible: shows HQ stock) */}
                      <td className="px-4 py-4 text-sm font-bold text-center text-slate-800">
                        <span className={item.hq_quantity > 0 ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'}>
                          {item.hq_quantity}
                        </span>
                      </td>
                      {/* Branch Stock (CentralAdmin ONLY) */}
                      {!isBranchView && (
                        <td className="px-4 py-4 text-sm font-bold text-center text-blue-900">
                          {item.branch_quantity}
                        </td>
                      )}
                      {/* Effective Stock Column */}
                      <td className="px-6 py-4 text-sm font-black text-right text-slate-900">
                        <span className={isOutOfStock ? 'text-rose-600 font-bold' : isLowStock ? 'text-amber-600 font-bold' : 'text-slate-900 font-black'}>
                          {effectiveQty}
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
                    <td colSpan={isBranchView ? 6 : 8} className="px-6 py-12 text-center text-slate-500 text-sm">
                      {isLoading ? (
                        'កំពុងទាញយកទិន្នន័យ...'
                      ) : isBranchView ? (
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <PackageIcon className="text-slate-300" size={36} />
                          <p className="font-semibold text-slate-600">មិនទាន់មានសម្ភារៈណាមួយត្រូវបានផ្ទេរមកកាន់សាខានេះនៅឡើយទេ</p>
                          <p className="text-xs text-slate-400">នៅពេលស្តុកកណ្តាល HQ ធ្វើការផ្ទេរសម្ភារៈមកកាន់សាខានេះ ស្តុកជាក់ស្តែងនឹងបង្ហាញនៅទីនេះ។</p>
                        </div>
                      ) : (
                        'មិនមានទិន្នន័យសម្ភារៈឡើយ'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* By-Location Detailed Table (CentralAdmin ONLY) */
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
