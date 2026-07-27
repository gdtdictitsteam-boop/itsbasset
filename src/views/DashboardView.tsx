import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockInventory, mockItems, mockLocations } from '../mockData';
import { Package, AlertCircle, MapPin, AlertTriangle, Wrench, Package as PackageIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export function DashboardView() {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'ALL' | 'Tools' | 'Suppliers'>('ALL');

  const totalItems = mockInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockItems = mockInventory.filter(item => {
    const itemDef = mockItems.find(i => i.id === item.item_id);
    return itemDef ? item.quantity <= itemDef.min_stock : item.quantity < 10;
  });
  const lowStockCount = lowStockItems.length;
  const locationsCount = new Set(mockInventory.map(item => item.location_id)).size;

  // Compute aggregated inventory data for the table
  const aggregatedInventory = mockItems.map((item, index) => {
    const itemInventory = mockInventory.filter(inv => inv.item_id === item.id);
    
    let hqStock = 0;
    let branchStock = 0;
    const branchesWithStock: string[] = [];

    itemInventory.forEach(inv => {
      const loc = mockLocations.find(l => l.id === inv.location_id);
      if (loc) {
        if (loc.type === 'HQ') {
          hqStock += inv.quantity;
        } else if (loc.type === 'BRANCH') {
          branchStock += inv.quantity;
          branchesWithStock.push(language === 'kh' ? loc.name_kh : loc.name_en);
        }
      }
    });

    const totalStock = hqStock + branchStock;
    const status = totalStock === 0 ? 'អស់ស្តុក' : (totalStock <= item.min_stock ? 'ជិតអស់ស្តុក' : 'មានស្តុក');

    return {
      no: index + 1,
      code: item.code,
      name: language === 'kh' ? item.name_kh : item.name_en,
      category: item.category,
      unit: item.unit,
      hqStock,
      branchStock,
      branchesWithStock: branchesWithStock.join(', ') || '-',
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
  const COLORS = ['#064E3B', '#10B981', '#3B82F6', '#F59E0B'];

  const lineData = [
    { name: 'Week 1', totalStock: 4000 },
    { name: 'Week 2', totalStock: 3000 },
    { name: 'Week 3', totalStock: 2000 },
    { name: 'Week 4', totalStock: 2780 },
    { name: 'Week 5', totalStock: 1890 },
    { name: 'Week 6', totalStock: 2390 },
  ];

  return (
    <div className="space-y-6">
      {lowStockCount > 0 && (
        <div className="bg-red-50 border-l-4 border-[#900033] p-4 flex items-start gap-3 rounded-r-xl">
          <AlertTriangle className="text-[#900033] shrink-0" />
          <div>
            <h4 className="text-[#900033] font-bold">ចំណាំ: សម្ភារៈជិតអស់ពីស្តុក (Low Stock Alert)</h4>
            <ul className="list-disc list-inside text-sm text-red-900 mt-1">
              {lowStockItems.map((item, idx) => (
                <li key={idx}>[{item.item_code}] {language === 'kh' ? item.item_name_kh : item.item_name_en} - សល់ {item.quantity} {item.unit} នៅ {language === 'kh' ? item.location_name_kh : item.location_name_en}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.totalItems}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">{totalItems}</h3>
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">+12 Items</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">Stock Out (Today)</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">84</h3>
            <span className="text-xs text-slate-400">Transactions</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.lowStock}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-[#900033]">{lowStockCount < 10 ? `0${lowStockCount}` : lowStockCount}</h3>
            <span className="text-xs text-red-600 font-bold uppercase">Check SKU</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-500 uppercase mb-1">{t.totalLocations}</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black">{locationsCount}</h3>
            <span className="text-xs text-slate-400">Branches</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold">ស្ថានភាពស្តុកសម្ភារៈគ្រប់ទីតាំង (All Locations Inventory Status)</h3>
          
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 font-bold text-center">ល.រ</th>
                <th className="px-4 py-3 font-bold">កូដ/សម្ភារ</th>
                <th className="px-4 py-3 font-bold">ប្រភេទ</th>
                <th className="px-4 py-3 font-bold text-center">ឯកតា</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុក HQ</th>
                <th className="px-4 py-3 font-bold text-center">ស្តុកសាខា</th>
                <th className="px-4 py-3 font-bold">សាខាដែលមានស្តុក</th>
                <th className="px-4 py-3 font-bold text-center">ស្ថានភាព</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAggregatedInventory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-500 text-center">{item.no}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-800">[{item.code}]</div>
                    <div className="text-sm text-slate-600 line-clamp-1">{item.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 border rounded-md text-xs font-bold whitespace-nowrap ${
                      item.category === 'Tools' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      item.category === 'Suppliers' ? 'bg-teal-50 text-teal-700 border-teal-200' : 
                      'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {item.category === 'Tools' ? 'សម្ភារ Tools' : item.category === 'Suppliers' ? 'សម្ភារ Suppliers' : item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 text-center">{item.unit}</td>
                  <td className="px-4 py-3 text-sm font-black text-center text-blue-700">{item.hqStock}</td>
                  <td className="px-4 py-3 text-sm font-black text-center text-teal-600">{item.branchStock}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={item.branchesWithStock}>
                    {item.branchesWithStock}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.status === 'មានស្តុក' ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold whitespace-nowrap">មានស្តុក</span>
                    ) : item.status === 'ជិតអស់ស្តុក' ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold whitespace-nowrap">ជិតអស់ស្តុក</span>
                    ) : (
                      <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold whitespace-nowrap">អស់ស្តុក</span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 lg:col-span-2">
          <h3 className="font-bold text-slate-800 mb-4">របាយការណ៍ទំនិញចេញ-ចូល (Stock In/Out)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={transactionData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                <Legend />
                <Bar dataKey="in" fill="#064E3B" name="Stock In" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" fill="#900033" name="Stock Out" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">ការបែងចែកតាមសាខា (By Branch)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={branchData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
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

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2 lg:col-span-3">
          <h3 className="font-bold text-slate-800 mb-4">និន្នាការស្តុកទូទៅ (Overall Stock Trend)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="totalStock" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
