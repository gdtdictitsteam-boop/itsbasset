import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { useInventoryContext } from '../contexts/InventoryContext';
import { 
  Package, AlertCircle, MapPin, AlertTriangle, Wrench, Package as PackageIcon, Building2,
  Boxes, TrendingUp, RefreshCw, Sparkles
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ItemAvatar } from '../components/ItemAvatar';

export function DashboardView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const { inventory, items, locations, isLoading, refreshInventory, reseedStandardStock } = useInventoryContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');

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

  // Filter inventory based on selected location
  const locationFilteredInventory = inventory.filter(inv => matchesLocationFilter(inv));

  // Calculate live aggregated inventory per item (reliable code and ID matching)
  const aggregatedInventory = items.map((item, index) => {
    const itemInventory = locationFilteredInventory.filter(
      inv => (inv.item_id === item.id || inv.item_code === item.code)
    );
    
    let hqStock = 0;
    let branchStock = 0;
    const branchesWithStock: { code: string; quantity: number }[] = [];

    itemInventory.forEach(inv => {
      const loc = locations.find(l => l.id === inv.location_id || l.code === inv.location_id);
      const isHq = isHqRow(inv);

      if (isHq) {
        hqStock += (inv.quantity || 0);
      } else {
        branchStock += (inv.quantity || 0);
      }

      if ((inv.quantity || 0) > 0) {
        const branchCode = loc ? (loc.code === 'HQ-ITSB' ? 'ITS-HQ' : loc.code) : (inv.location_name_kh || 'Branch');
        branchesWithStock.push({
          code: branchCode,
          quantity: inv.quantity
        });
      }
    });

    const totalStock = hqStock + branchStock;
    const minStock = item.min_stock ?? 5;
    const status = totalStock === 0 ? 'អស់ស្តុក' : (totalStock <= minStock ? 'ជិតអស់ស្តុក' : 'មានស្តុក');

    return {
      no: index + 1,
      id: item.id,
      code: item.code,
      name_kh: item.name_kh,
      name_en: item.name_en,
      image_url: item.image_url,
      name: language === 'kh' ? item.name_kh : item.name_en,
      category: item.category,
      unit: item.unit,
      hqStock,
      branchStock,
      totalStock,
      branchesWithStock,
      status,
      minStock
    };
  });

  // Filter by category tab
  const filteredAggregatedInventory = aggregatedInventory.filter(item => {
    if (activeTab === 'ALL') return true;
    return item.category === activeTab;
  });

  // Accurate overall stock flow metrics
  const totalItemCount = items.length;
  const totalStockUnits = aggregatedInventory.reduce((acc, curr) => acc + curr.totalStock, 0);
  const totalHqUnits = aggregatedInventory.reduce((acc, curr) => acc + curr.hqStock, 0);
  const totalBranchUnits = aggregatedInventory.reduce((acc, curr) => acc + curr.branchStock, 0);
  const lowStockCount = aggregatedInventory.filter(item => item.totalStock > 0 && item.totalStock <= item.minStock).length;
  const outOfStockCount = aggregatedInventory.filter(item => item.totalStock === 0).length;

  // Chart data
  const categoryStockData = [
    { name: 'Tools', stock: aggregatedInventory.filter(i => i.category === 'Tools').reduce((a, c) => a + c.totalStock, 0) },
    { name: 'Suppliers', stock: aggregatedInventory.filter(i => i.category === 'Suppliers').reduce((a, c) => a + c.totalStock, 0) },
  ];

  const distributionData = [
    { name: 'ស្តុកកណ្តាល HQ', value: totalHqUnits },
    { name: 'ស្តុកតាមសាខា Branches', value: totalBranchUnits },
  ];
  const COLORS = ['#03291E', '#1E6047', '#40916C', '#74C69D'];

  return (
    <div className="space-y-5 -mt-[5px]">
      {/* Stat Cards - Accurately Reflecting Stock Flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Stock Units */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">បរិមាណស្តុកសរុប (Total Units)</p>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-800">
              <Boxes size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900">{totalStockUnits.toLocaleString()}</h3>
            <span className="text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full font-bold">
              {totalItemCount} មុខសម្ភារៈ
            </span>
          </div>
        </div>

        {/* Card 2: HQ Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ស្តុកកណ្តាល HQ (ITSB-HQ)</p>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-800">
              <Building2 size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <h3 className="text-2xl md:text-3xl font-black text-emerald-800">{totalHqUnits.toLocaleString()}</h3>
            <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              {totalStockUnits > 0 ? `${Math.round((totalHqUnits / totalStockUnits) * 100)}% នៃស្តុក` : '0%'}
            </span>
          </div>
        </div>

        {/* Card 3: Branch Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ស្តុកតាមសាខា (Branches)</p>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-800">
              <MapPin size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <h3 className="text-2xl md:text-3xl font-black text-blue-900">{totalBranchUnits.toLocaleString()}</h3>
            <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              {totalStockUnits > 0 ? `${Math.round((totalBranchUnits / totalStockUnits) * 100)}% នៃស្តុក` : '0%'}
            </span>
          </div>
        </div>

        {/* Card 4: Low & Out of Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ជិតអស់ស្តុក (Alerts)</p>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="flex items-end justify-between mt-2">
            <h3 className="text-2xl md:text-3xl font-black text-amber-600">{lowStockCount}</h3>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              outOfStockCount > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-600'
            }`}>
              {outOfStockCount > 0 ? `អស់ស្តុក: ${outOfStockCount}` : 'គ្រប់គ្រាន់'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="bg-slate-50/90 text-slate-900 border-b border-slate-200/80 px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-emerald-100/80 text-emerald-800 rounded-lg">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {language === 'kh' 
                  ? `ស្ថានភាពស្តុក៖ ${selectedLocation.name_kh}` 
                  : `Inventory Status: ${selectedLocation.name_en}`}
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                {selectedLocationId === 'ALL' 
                  ? 'បង្ហាញស្តុកកណ្តាល HQ និងស្តុកតាមសាខាទាំងអស់ស្របតាមលំហូរស្តុក' 
                  : `បង្ហាញព័ត៌មានស្តុកជាក់ស្តែងសម្រាប់ទីតាំង ${selectedLocation.name_kh}`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                ទូទៅ (All)
              </button>
              <button
                onClick={() => setActiveTab('Tools')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Wrench size={14} />
                <span>សម្ភារ Tools</span>
              </button>
              <button
                onClick={() => setActiveTab('Suppliers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <PackageIcon size={14} />
                <span>សម្ភារ Suppliers</span>
              </button>
            </div>

            <button
              onClick={refreshInventory}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-teal-800 hover:bg-slate-50 transition-colors shadow-2xs"
              title="ទាញយកទិន្នន័យចុងក្រោយ"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-teal-600' : ''} />
            </button>
          </div>
        </div>

        {/* Aggregated Inventory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3 font-bold text-center w-12">ល.រ</th>
                <th className="px-4 py-3 font-bold">សម្ភារ:</th>
                <th className="px-4 py-3 font-bold text-center">ប្រភេទ</th>
                <th className="px-4 py-3 font-bold text-center">ឯកតា</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុក HQ</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុកសាខា</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុកសរុប</th>
                <th className="px-4 py-3 font-bold">សាខាដែលមានស្តុក</th>
                <th className="px-4 py-3 font-bold text-center">ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAggregatedInventory.map((item, idx) => (
                <tr key={`${item.code}-${idx}`} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-500 text-center">{idx + 1}</td>
                  
                  {/* Item Image and Name */}
                  <td className="px-4 py-2.5">
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

                  {/* Category */}
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                      item.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {item.category === 'Tools' ? 'Tools' : item.category === 'Suppliers' ? 'Suppliers' : item.category}
                    </span>
                  </td>

                  {/* Unit */}
                  <td className="px-4 py-2.5 text-slate-600 font-semibold text-center">{item.unit}</td>
                  
                  {/* HQ Stock */}
                  <td className="px-4 py-2.5 font-black text-center text-slate-900">
                    {item.hqStock}
                  </td>
                  
                  {/* Branch Stock */}
                  <td className="px-4 py-2.5 font-black text-center text-blue-900">
                    {item.branchStock}
                  </td>

                  {/* Total Combined Stock */}
                  <td className="px-4 py-2.5 font-black text-center text-emerald-800">
                    {item.totalStock}
                  </td>

                  {/* Branches with Stock Badges */}
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="flex flex-wrap gap-1.5">
                      {item.branchesWithStock.length > 0 ? (
                        item.branchesWithStock.map((branch, i) => (
                          <div key={i} className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50/60 overflow-hidden shadow-2xs">
                            <span className="text-[10px] font-bold text-teal-900 px-1.5 py-0.5">{branch.code}</span>
                            <span className="bg-teal-700 text-white font-bold text-[9px] px-1 py-0.5 min-w-[16px] text-center">
                              {branch.quantity}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs italic">គ្មានសាខាមានស្តុក</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block whitespace-nowrap border ${
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
              ))}

              {filteredAggregatedInventory.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500 text-sm">
                    {isLoading ? 'កំពុងទាញយកទិន្នន័យ...' : 'មិនមានទិន្នន័យ'}
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
