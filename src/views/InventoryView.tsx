import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockInventory } from '../mockData';

export function InventoryView() {
  const { t, language } = useLanguage();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-gray-800">{t.inventory}</h2>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">តារាងស្តុកសម្ភារៈបច្ចុប្បន្ន</h3>
          <div className="relative">
            <input type="text" placeholder="ស្វែងរក..." className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033]" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 font-bold">{t.code}</th>
                <th className="px-6 py-3 font-bold">{t.itemName}</th>
                <th className="px-6 py-3 font-bold">{t.category}</th>
                <th className="px-6 py-3 font-bold">{t.location}</th>
                <th className="px-6 py-3 font-bold text-right">{t.quantity}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mockInventory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{item.item_code}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-700">
                    {language === 'kh' ? item.item_name_kh : item.item_name_en}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-md text-xs font-semibold">{item.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {language === 'kh' ? item.location_name_kh : item.location_name_en}
                  </td>
                  <td className="px-6 py-4 text-sm font-black text-right text-slate-800">
                    {item.quantity} <span className="text-slate-400 font-medium ml-1 text-xs">{item.unit}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
