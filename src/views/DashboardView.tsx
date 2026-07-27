import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockInventory, mockItems } from '../mockData';
import { Package, AlertCircle, MapPin, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

export function DashboardView() {
  const { t, language } = useLanguage();

  const totalItems = mockInventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const lowStockItems = mockInventory.filter(item => {
    const itemDef = mockItems.find(i => i.id === item.item_id);
    return itemDef ? item.quantity <= itemDef.min_stock : item.quantity < 10;
  });
  const lowStockCount = lowStockItems.length;
  const locationsCount = new Set(mockInventory.map(item => item.location_id)).size;

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
