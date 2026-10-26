import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, AlertCircle, MapPin, AlertTriangle, Wrench, Package as PackageIcon, Building2,
  Boxes, TrendingUp, RefreshCw, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ItemAvatar } from '../components/ItemAvatar';

interface DashboardViewProps {
  onNavigate?: (view: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { t, language } = useLanguage();
  const { isBranchUser, isCentralAdmin } = useAuth();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const { inventory, items, locations, isLoading, refreshInventory } = useInventoryContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');

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

  // Calculate live aggregated inventory per item
  const rawAggregatedInventory = items.map((item, index) => {
    const itemInventory = inventory.filter(
      inv => (String(inv.item_id) === String(item.id) || 
              String(inv.item_code)?.trim().toUpperCase() === String(item.code)?.trim().toUpperCase())
    );
    
    let hqStock = 0;
    let branchStock = 0;
    const branchesWithStock: { code: string; quantity: number }[] = [];

    itemInventory.forEach(inv => {
      const loc = locations.find(l => String(l.id) === String(inv.location_id) || String(l.code) === String(inv.location_id));
      const isHq = isHqLocationOrRow(inv, locations);

      if (isHq) {
        hqStock += (inv.quantity || 0);
      } else {
        if (!isSpecificBranch || matchesLocationFilter(inv)) {
          branchStock += (inv.quantity || 0);
        }
      }

      if (!isHq && (inv.quantity || 0) > 0) {
        const branchCode = loc ? loc.code : (inv.location_code || inv.location_name_kh || 'Branch');
        branchesWithStock.push({
          code: branchCode,
          quantity: inv.quantity
        });
      }
    });

    const totalStock = isSpecificBranch ? branchStock : (isSelHq ? hqStock : (hqStock + branchStock));
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

  // Show all catalog items with their live stock across locations
  const branchFilteredInventory = rawAggregatedInventory;

  // Filter by category tab
  const filteredAggregatedInventory = branchFilteredInventory.filter(item => {
    if (activeTab === 'ALL') return true;
    return item.category === activeTab;
  });

  // Accurate overall stock metrics
  const totalItemCount = branchFilteredInventory.length;
  const totalHqUnits = inventory
    .filter(inv => isHqLocationOrRow(inv, locations))
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalBranchUnits = inventory
    .filter(inv => !isHqLocationOrRow(inv, locations) && (!isSpecificBranch || matchesLocationFilter(inv)))
    .reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const totalStockUnits = isSpecificBranch ? totalBranchUnits : (isSelHq ? totalHqUnits : (totalHqUnits + totalBranchUnits));
  const lowStockCount = branchFilteredInventory.filter(item => item.totalStock > 0 && item.totalStock <= item.minStock).length;
  const inStockCount = branchFilteredInventory.filter(item => item.totalStock > item.minStock).length;
  const outOfStockCount = branchFilteredInventory.filter(item => item.totalStock === 0).length;

  return (
    <div className="space-y-3.5 sm:space-y-5 -mt-[5px]">
      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
        {/* Section Header */}
        <div className="bg-slate-50/90 text-slate-900 border-b border-slate-200/80 px-3.5 sm:px-5 py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-start sm:items-center space-x-2.5 min-w-0">
            <div className="p-1.5 bg-emerald-100/80 text-emerald-800 rounded-lg shrink-0">
              <MapPin size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {language === 'kh' 
                  ? `ស្ថានភាពស្តុក៖ ${selectedLocation.name_kh}` 
                  : `Inventory Status: ${selectedLocation.name_en}`}
              </h3>
              <p className="text-[11px] text-slate-500 font-normal">
                {isBranchView
                  ? `* បង្ហាញតែមុខសម្ភារៈដែលមានក្នុងស្តុកសាខា ${selectedLocation.name_kh} ជាក់ស្តែង (ដែលបានទទួលផ្ទេរពីស្តុកកណ្តាល HQ)`
                  : (selectedLocationId === 'ALL' 
                    ? 'បង្ហាញស្តុកកណ្តាល HQ និងស្តុកតាមសាខាទាំងអស់ស្របតាមលំហូរស្តុក' 
                    : `បង្ហាញព័ត៌មានស្តុកជាក់ស្តែងសម្រាប់ទីតាំង ${selectedLocation.name_kh}`)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
            <div className="grid grid-cols-3 sm:flex flex-1 md:flex-initial gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center min-h-[34px] ${
                  activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <span>ទូទៅ (All)</span>
              </button>
              <button
                onClick={() => setActiveTab('Tools')}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap min-h-[34px] ${
                  activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <Wrench size={13} className="shrink-0" />
                <span>សម្ភារ Tools</span>
              </button>
              <button
                onClick={() => setActiveTab('Suppliers')}
                className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap min-h-[34px] ${
                  activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <PackageIcon size={13} className="shrink-0" />
                <span>សម្ភារ Suppliers</span>
              </button>
            </div>

            <button
              onClick={refreshInventory}
              disabled={isLoading}
              className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-teal-800 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer shrink-0"
              title="ទាញយកទិន្នន័យចុងក្រោយ"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin text-teal-600' : ''} />
            </button>
          </div>
        </div>

        {/* Aggregated Inventory Table with Sticky Header */}
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto overflow-x-auto relative rounded-b-2xl w-full">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <tr className="bg-slate-50/95 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center w-12">ល.រ</th>
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold">សម្ភារ:</th>
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">ប្រភេទ</th>
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">ឯកតា</th>
                {/* Central HQ Stock column */}
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">
                  {isBranchView ? 'ស្តុកកណ្តាល HQ (អាចស្នើសុំ)' : 'ស្តុក HQ'}
                </th>

                {/* Branch Stock column for CentralAdmin */}
                {!isBranchView && (
                  <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">ស្តុកសាខា</th>
                )}

                {/* Main Branch Stock Column for Branch View / Total for Central */}
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">
                  {isBranchView ? 'ស្តុកនៅសាខានេះ' : 'ស្តុកសរុប'}
                </th>

                {/* For CentralAdmin only: show other branches with stock */}
                {!isBranchView && (
                  <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold">សាខាដែលមានស្តុក</th>
                )}
                <th className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-[0_1px_2px_rgba(0,0,0,0.08)] px-4 py-3 font-bold text-center">ស្ថានភាព</th>
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
                  
                  {/* HQ Stock (Always visible: shows HQ stock) */}
                  <td className="px-4 py-2.5 font-black text-center text-slate-900">
                    <span className={item.hqStock > 0 ? 'text-slate-900 font-black' : 'text-slate-400 font-medium'}>
                      {item.hqStock}
                    </span>
                  </td>
                  
                  {/* Branch Stock (CentralAdmin ONLY) */}
                  {!isBranchView && (
                    <td className="px-4 py-2.5 font-black text-center text-blue-900">
                      {item.branchStock}
                    </td>
                  )}

                  {/* Total Stock / Branch Stock */}
                  <td className="px-4 py-2.5 font-black text-center">
                    <span className={item.totalStock > 0 ? 'text-emerald-800 font-black' : 'text-rose-600 font-bold'}>
                      {item.totalStock}
                    </span>
                  </td>

                  {/* Branches with Stock Badges (CentralAdmin ONLY) */}
                  {!isBranchView && (
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
                  )}

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
                  <td colSpan={isBranchView ? 6 : 9} className="px-6 py-12 text-center text-slate-500 text-sm">
                    {isLoading ? (
                      'កំពុងទាញយកទិន្នន័យ...'
                    ) : isBranchView ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="text-slate-300" size={36} />
                        <p className="font-semibold text-slate-600">មិនទាន់មានសម្ភារៈណាមួយត្រូវបានផ្ទេរមកកាន់សាខានេះនៅឡើយទេ</p>
                        <p className="text-xs text-slate-400">នៅពេលស្តុកកណ្តាល HQ ធ្វើការផ្ទេរសម្ភារៈមកកាន់សាខានេះ ទិន្នន័យនឹងបង្ហាញនៅទីនេះដោយស្វ័យប្រវត្តិ។</p>
                      </div>
                    ) : (
                      'មិនមានទិន្នន័យសម្ភារៈឡើយ'
                    )}
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
