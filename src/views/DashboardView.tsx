import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Package, AlertCircle, MapPin, AlertTriangle, Wrench, Package as PackageIcon, Building2,
  Boxes, TrendingUp, RefreshCw, ShieldCheck, CheckCircle2,
  PlusCircle, ArrowLeftRight, MinusCircle, ClipboardList, Sliders
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
      {/* Stat Cards: 2x2 Compact Grid on Mobile, 4 Columns on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Stock Units */}
        <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">
              {isBranchView ? 'បរិមាណស្តុកប្រចាំសាខា' : 'បរិមាណស្តុកសរុប (Total Units)'}
            </p>
            <div className="p-1 sm:p-1.5 rounded-lg bg-teal-50 text-teal-800 shrink-0">
              <Boxes size={15} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
            <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-slate-900 leading-tight">{totalStockUnits.toLocaleString()}</h3>
            <span className="text-[10px] sm:text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto whitespace-nowrap">
              {totalItemCount} មុខសម្ភារៈ
            </span>
          </div>
        </div>

        {/* Card 2: If Branch View -> Show In-Stock Items; If Central -> Show HQ Stock */}
        {isBranchView ? (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">មុខសម្ភារៈមានស្តុក (In-Stock)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 text-emerald-800 shrink-0">
                <CheckCircle2 size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-emerald-800 leading-tight">{inStockCount}</h3>
              <span className="text-[10px] sm:text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto whitespace-nowrap">
                ស្តុកគ្រប់គ្រាន់
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">ស្តុកកណ្តាល HQ (HQ-ITSB)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-emerald-50 text-emerald-800 shrink-0">
                <Building2 size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-emerald-800 leading-tight">{totalHqUnits.toLocaleString()}</h3>
              <span className="text-[10px] sm:text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full self-start sm:self-auto whitespace-nowrap">
                {totalStockUnits > 0 ? `${Math.round((totalHqUnits / totalStockUnits) * 100)}% នៃស្តុក` : '0%'}
              </span>
            </div>
          </div>
        )}

        {/* Card 3: If Branch View -> Low stock count; If Central -> Branch stock total */}
        {isBranchView ? (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">ជិតអស់ស្តុក (Low Stock)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 text-amber-700 shrink-0">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-amber-600 leading-tight">{lowStockCount}</h3>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold self-start sm:self-auto whitespace-nowrap ${
                lowStockCount > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {lowStockCount > 0 ? 'ត្រូវការស្នើសុំបំពេញ' : 'គ្រប់គ្រាន់'}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">ស្តុកតាមសាខា (Branches)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-blue-50 text-blue-800 shrink-0">
                <MapPin size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-blue-900 leading-tight">{totalBranchUnits.toLocaleString()}</h3>
              <span className="text-[10px] sm:text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full self-start sm:self-auto whitespace-nowrap">
                {totalStockUnits > 0 ? `${Math.round((totalBranchUnits / totalStockUnits) * 100)}% នៃស្តុក` : '0%'}
              </span>
            </div>
          </div>
        )}

        {/* Card 4: If Branch View -> Branch Assignment info; If Central -> Low Stock alert */}
        {isBranchView ? (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">សាខាប្រតិបត្តិការ (BRANCH)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-teal-50 text-teal-800 shrink-0">
                <MapPin size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate max-w-full" title={selectedLocation.name_kh}>
                {selectedLocation.code || selectedLocation.name_kh}
              </h3>
              <span className="text-[10px] sm:text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full font-bold self-start sm:self-auto truncate max-w-full">
                {selectedLocation.name_kh}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-white p-3 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] sm:text-xs font-medium sm:font-bold text-gray-600 sm:text-slate-500 uppercase tracking-wider line-clamp-1">ជិតអស់ស្តុក (Alerts)</p>
              <div className="p-1 sm:p-1.5 rounded-lg bg-amber-50 text-amber-700 shrink-0">
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1.5 mt-1 sm:mt-2">
              <h3 className="text-xl sm:text-3xl font-bold sm:font-black text-amber-600 leading-tight">{lowStockCount}</h3>
              <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold self-start sm:self-auto whitespace-nowrap ${
                outOfStockCount > 0 ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {outOfStockCount > 0 ? `អស់ស្តុក: ${outOfStockCount}` : 'គ្រប់គ្រាន់'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Quick Action Grid (Visible ONLY on Mobile/Tablet: lg:hidden) */}
      {onNavigate && (
        <div className="grid grid-cols-4 gap-2 lg:hidden">
          {isCentralAdmin ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('stockIn')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-emerald-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#03291E] flex items-center justify-center">
                  <PlusCircle size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">បញ្ចូលស្តុក</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('handover')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-teal-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-900 flex items-center justify-center">
                  <ArrowLeftRight size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">ប្រគល់សាខា</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('stockOut')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-amber-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                  <MinusCircle size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">ដកប្រើប្រាស់</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('executiveReport')}
                className="flex flex-col items-center justify-center gap-1.5 bg-[#03291E] hover:bg-[#1E6047] active:scale-95 p-2.5 rounded-xl border border-[#03291E] shadow-2xs transition-all cursor-pointer text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-[#A3D8C2]/20 text-[#A3D8C2] flex items-center justify-center">
                  <ClipboardList size={17} />
                </div>
                <span className="text-[11px] font-bold text-[#A3D8C2] leading-tight text-center">របាយការណ៍</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-emerald-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#03291E] flex items-center justify-center">
                  <Package size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">ស្តុកបច្ចុប្បន្ន</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('stockOut')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-amber-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center">
                  <MinusCircle size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">ដកប្រើប្រាស់</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('adjustment')}
                className="flex flex-col items-center justify-center gap-1.5 bg-white hover:bg-blue-50/70 active:scale-95 p-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center">
                  <Sliders size={17} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 leading-tight text-center">កែតម្រូវស្តុក</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('executiveReport')}
                className="flex flex-col items-center justify-center gap-1.5 bg-[#03291E] hover:bg-[#1E6047] active:scale-95 p-2.5 rounded-xl border border-[#03291E] shadow-2xs transition-all cursor-pointer text-white"
              >
                <div className="w-8 h-8 rounded-lg bg-[#A3D8C2]/20 text-[#A3D8C2] flex items-center justify-center">
                  <ClipboardList size={17} />
                </div>
                <span className="text-[11px] font-bold text-[#A3D8C2] leading-tight text-center">របាយការណ៍</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Section Header */}
        <div className="bg-slate-50/90 text-slate-900 border-b border-slate-200/80 px-3.5 sm:px-5 py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
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

        {/* Aggregated Inventory Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3 font-bold text-center w-12">ល.រ</th>
                <th className="px-4 py-3 font-bold">សម្ភារ:</th>
                <th className="px-4 py-3 font-bold text-center">ប្រភេទ</th>
                <th className="px-4 py-3 font-bold text-center">ឯកតា</th>
                {/* Central HQ Stock column */}
                <th className="px-4 py-3 font-bold text-center">
                  {isBranchView ? 'ស្តុកកណ្តាល HQ (អាចស្នើសុំ)' : 'ស្តុក HQ'}
                </th>

                {/* Branch Stock column for CentralAdmin */}
                {!isBranchView && (
                  <th className="px-4 py-3 font-bold text-center">ស្តុកសាខា</th>
                )}

                {/* Main Branch Stock Column for Branch View / Total for Central */}
                <th className="px-4 py-3 font-bold text-center">
                  {isBranchView ? 'ស្តុកនៅសាខានេះ' : 'ស្តុកសរុប'}
                </th>

                {/* For CentralAdmin only: show other branches with stock */}
                {!isBranchView && (
                  <th className="px-4 py-3 font-bold">សាខាដែលមានស្តុក</th>
                )}
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
