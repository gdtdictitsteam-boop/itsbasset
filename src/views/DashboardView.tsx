import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocationContext } from '../contexts/LocationContext';
import { mockInventory, mockItems, mockLocations } from '../mockData';
import { 
  Package, AlertCircle, MapPin, AlertTriangle, Wrench, Package as PackageIcon, Building2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ItemAvatar } from '../components/ItemAvatar';

export function DashboardView() {
  const { t, language } = useLanguage();
  const { selectedLocationId, selectedLocation } = useLocationContext();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');

  // Filter inventory based on selected location
  const locationFilteredInventory = mockInventory.filter(inv => {
    if (selectedLocationId === 'ALL' || selectedLocation.code === 'ALL') return true;
    return inv.location_id === selectedLocationId || inv.location_name_kh.includes(selectedLocation.code) || inv.location_name_kh.includes(selectedLocation.name_kh);
  });

  const totalItems = locationFilteredInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockItems = locationFilteredInventory.filter(item => {
    const itemDef = mockItems.find(i => i.id === item.item_id);
    return itemDef ? item.quantity <= itemDef.min_stock : item.quantity < 10;
  });
  const lowStockCount = lowStockItems.length;
  const locationsCount = selectedLocationId === 'ALL' ? new Set(mockInventory.map(item => item.location_id)).size : 1;

  // Compute aggregated inventory data for the table
  const aggregatedInventory = mockItems.map((item, index) => {
    const itemInventory = locationFilteredInventory.filter(inv => inv.item_id === item.id);
    
    let hqStock = 0;
    let branchStock = 0;
    const branchesWithStock: { code: string, quantity: number }[] = [];

    itemInventory.forEach(inv => {
      const loc = mockLocations.find(l => l.id === inv.location_id || l.code === inv.location_id);
      if (loc) {
        if (loc.type === 'HQ') {
          hqStock += inv.quantity;
        } else {
          branchStock += inv.quantity;
        }
        
        if (inv.quantity > 0) {
          branchesWithStock.push({
            code: loc.code === 'HQ-ITSB' ? 'ITS-HQ' : loc.code,
            quantity: inv.quantity
          });
        }
      } else {
        hqStock += inv.quantity;
        if (inv.quantity > 0) {
          branchesWithStock.push({
            code: 'ITS-HQ',
            quantity: inv.quantity
          });
        }
      }
    });

    const totalStock = hqStock + branchStock;
    const status = totalStock === 0 ? 'អស់ស្តុក' : (totalStock <= item.min_stock ? 'ជិតអស់ស្តុក' : 'មានស្តុក');

    return {
      no: index + 1,
      code: item.code,
      name_kh: item.name_kh,
      name_en: item.name_en,
      name: language === 'kh' ? item.name_kh : item.name_en,
      category: item.category,
      unit: item.unit,
      hqStock,
      branchStock,
      branchesWithStock,
      status,
      minStock: item.min_stock
    };
  });

  const filteredAggregatedInventory = aggregatedInventory.filter(item => {
    if (activeTab === 'ALL') return true;
    return item.category === activeTab;
  });

  // Mock data for charts
  const transactionData = [
    { name: 'Jan', in: 400, out: 240 },
    { name: 'Feb', in: 300, out: 139 },
    { name: 'Mar', in: 200, out: 980 },
    { name: 'Apr', in: 278, out: 390 },
    { name: 'May', in: 189, out: 480 },
    { name: 'Jun', in: 239, out: 380 },
  ];

  const branchData = [
    { name: 'HQ-ITSB', value: 400 },
    { name: '7 Makara', value: 300 },
    { name: 'Daun Penh', value: 300 },
    { name: 'Toul Kork', value: 200 },
  ];
  const COLORS = ['#03291E', '#1E6047', '#40916C', '#74C69D'];

  const lineData = [
    { name: 'Week 1', totalStock: 4000 },
    { name: 'Week 2', totalStock: 3000 },
    { name: 'Week 3', totalStock: 2000 },
    { name: 'Week 4', totalStock: 2780 },
    { name: 'Week 5', totalStock: 1890 },
    { name: 'Week 6', totalStock: 2390 },
  ];

  return (
    <div className="space-y-5 -mt-[5px]">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.totalItems}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900">{totalItems}</h3>
            <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">+12 Items</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Stock Out (Today)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900">84</h3>
            <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">Transactions</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.lowStock}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900">{lowStockCount < 10 ? `0${lowStockCount}` : lowStockCount}</h3>
            <span className="text-xs text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold uppercase">Check SKU</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{t.totalLocations}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl md:text-3xl font-black text-slate-900">{locationsCount}</h3>
            <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">Branches</span>
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
            <h3 className="text-base font-bold text-slate-900">
              {language === 'kh' 
                ? `ស្ថានភាពស្តុក៖ ${selectedLocation.name_kh}` 
                : `Inventory Status: ${selectedLocation.name_en}`}
            </h3>
          </div>
          
          <div className="flex space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'ALL' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              ទូទៅ (All)
            </button>
            <button
              onClick={() => setActiveTab('Tools')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${activeTab === 'Tools' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              <Wrench size={14} />
              <span>សម្ភារ Tools</span>
            </button>
            <button
              onClick={() => setActiveTab('Suppliers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${activeTab === 'Suppliers' ? 'bg-[#03291E] text-white shadow-xs' : 'text-slate-700 hover:bg-slate-200/60'}`}
            >
              <PackageIcon size={14} />
              <span>សម្ភារ Suppliers</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700 border-b border-slate-200/80 text-xs uppercase tracking-wider font-bold">
                <th className="px-4 py-3 font-bold text-center">ល.រ</th>
                <th className="px-4 py-3 font-bold">កូដ / សម្ភារ:</th>
                <th className="px-4 py-3 font-bold">ប្រភេទ</th>
                <th className="px-4 py-3 font-bold text-center">ឯកតា</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុក HQ</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុកសាខា</th>
                <th className="px-4 py-3 font-bold">សាខាដែលមានស្តុក</th>
                <th className="px-4 py-3 font-bold text-center">ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredAggregatedInventory.map((item, idx) => (
                <tr key={idx} className="even:bg-slate-50/40 odd:bg-white hover:bg-teal-50/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-500 text-center">{item.no}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center space-x-3">
                      <ItemAvatar item={{ code: item.code, name_kh: item.name_kh, name_en: item.name_en, category: item.category }} />
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
                  <td className="px-4 py-2.5">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-teal-50 text-teal-800 border-teal-200' : 
                      item.category === 'Suppliers' ? 'bg-slate-100 text-slate-800 border-slate-200' : 
                      'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      {item.category === 'Tools' ? 'សម្ភារ Tools' : item.category === 'Suppliers' ? 'សម្ភារ Suppliers' : item.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-semibold text-center">{item.unit}</td>
                  <td className="px-4 py-2.5 font-black text-center text-slate-900">{item.hqStock}</td>
                  <td className="px-4 py-2.5 font-black text-center text-emerald-800">{item.branchStock}</td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="flex flex-wrap gap-1.5">
                      {item.branchesWithStock.length > 0 ? (
                        item.branchesWithStock.map((branch, i) => (
                          <div key={i} className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50/60 overflow-hidden shadow-2xs">
                            <span className="px-1.5 py-0.5 text-[10px] font-bold text-teal-900">{branch.code}</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-900">{branch.quantity}</span>
                          </div>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">គ្មាន</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {item.status === 'មានស្តុក' ? (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-bold whitespace-nowrap">មានស្តុក</span>
                    ) : item.status === 'ជិតអស់ស្តុក' ? (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-xs font-bold whitespace-nowrap">ជិតអស់ស្តុក</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-md text-xs font-bold whitespace-nowrap">អស់ស្តុក</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAggregatedInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500 text-sm">
                    មិនមានទិន្នន័យ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all col-span-1 md:col-span-2 lg:col-span-2">
          <h3 className="font-bold text-slate-900 text-sm mb-3">របាយការណ៍ទំនិញចេញ-ចូល (Stock In/Out)</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.8)' }} />
                <Legend />
                <Bar dataKey="in" fill="#03291E" name="Stock In" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" fill="#10B981" name="Stock Out" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all">
          <h3 className="font-bold text-slate-900 text-sm mb-3">ការបែងចែកតាមសាខា (By Branch)</h3>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={branchData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {branchData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dedicated Low Stock Alert Widget Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col col-span-1 md:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-rose-100 text-rose-800 rounded-lg">
                <AlertTriangle size={16} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">សម្ភារៈជិតអស់ពីស្តុក</h3>
            </div>
            <span className="px-2.5 py-0.5 bg-rose-50 text-rose-800 rounded-full text-xs font-bold border border-rose-200">
              {lowStockCount} មុខ
            </span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-52 divide-y divide-slate-100 pr-1">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item, idx) => (
                <div key={idx} className="py-2.5 flex items-start justify-between text-xs gap-2">
                  <div>
                    <div className="font-bold text-slate-900">[{item.item_code}] {language === 'kh' ? item.item_name_kh : item.item_name_en}</div>
                    <div className="text-slate-500 text-[11px] mt-0.5">{language === 'kh' ? item.location_name_kh : item.location_name_en}</div>
                  </div>
                  <span className="shrink-0 font-black text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-[11px]">
                    សល់ {item.quantity} {item.unit}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                គ្រប់សម្ភារៈមានស្តុកគ្រប់គ្រាន់
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
