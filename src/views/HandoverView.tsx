import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockLocations, mockItems } from '../mockData';
import { ArrowRightLeft } from 'lucide-react';

export function HandoverView() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);

  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitSuccess(false);

    const form = e.target as HTMLFormElement;
    const fromLocationId = (form.elements[0] as HTMLSelectElement).value;
    const toBranchId = (form.elements[1] as HTMLSelectElement).value;
    const itemId = (form.elements[2] as HTMLSelectElement).value;
    const quantity = parseInt((form.elements[3] as HTMLInputElement).value || '0', 10);

    setTimeout(() => {
      // Find source inventory
      const sourceInvIndex = mockInventory.findIndex(inv => inv.item_id === itemId && inv.location_id === fromLocationId);
      
      if (sourceInvIndex >= 0 && mockInventory[sourceInvIndex].quantity >= quantity && fromLocationId !== toBranchId) {
        // Reduce source inventory
        mockInventory[sourceInvIndex].quantity -= quantity;
        mockInventory[sourceInvIndex].last_updated = new Date().toISOString();

        // Add to destination
        const destInvIndex = mockInventory.findIndex(inv => inv.item_id === itemId && inv.location_id === toBranchId);
        if (destInvIndex >= 0) {
          mockInventory[destInvIndex].quantity += quantity;
          mockInventory[destInvIndex].last_updated = new Date().toISOString();
        } else {
          const item = mockItems.find(i => i.id === itemId);
          const loc = mockLocations.find(l => l.id === toBranchId);
          if (item) {
            mockInventory.push({
              location_id: toBranchId,
              item_id: itemId,
              quantity: quantity,
              last_updated: new Date().toISOString(),
              item_code: item.code,
              item_name_kh: item.name_kh,
              item_name_en: item.name_en,
              category: item.category,
              unit: item.unit,
              location_name_kh: loc?.name_kh || '',
              location_name_en: loc?.name_en || ''
            });
          }
        }
        setSubmitSuccess(true);
        form.reset();
      } else {
        alert('បរិមាណស្តុកមិនគ្រប់គ្រាន់ ឬទីតាំងមិនត្រឹមត្រូវ!');
      }

      setLoading(false);
      
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    }, 800);
  };

  const branchLocations = mockLocations.filter(loc => loc.type === 'BRANCH');
  const hqLocations = mockLocations.filter(loc => loc.type === 'HQ');

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-lg flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {submitSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-700">
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">ប្រគល់-ទទួល ជោគជ័យ</h3>
              <p className="text-xs opacity-90">សម្ភារៈត្រូវបានផ្ទេរដោយជោគជ័យ។</p>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-white">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-50 p-2 rounded-lg">
            <ArrowRightLeft size={24} className="text-blue-700" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t.handoverStock}</h2>
            <p className="text-xs text-slate-500">ផ្ទេរស្តុកសម្ភារៈពីទីតាំងមួយទៅសាខា</p>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.fromLocation}</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" required>
                  {hqLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {language === 'kh' ? loc.name_kh : loc.name_en}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.toBranch}</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" required>
                  <option value="">-- {t.toBranch} --</option>
                  {branchLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {language === 'kh' ? loc.name_kh : loc.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.selectItem}</label>
              <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" required>
                <option value="">-- {t.selectItem} --</option>
                {mockItems.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.quantity}</label>
                <input type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.unit}</label>
                <input type="text" disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500" value="គ្រឿង" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.officerName}</label>
              <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.purpose}</label>
              <textarea rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 resize-none" required></textarea>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500">
             ប្រតិបត្តិការនេះមិនអាចត្រឡប់ថយក្រោយបានទេ បន្ទាប់ពីការបញ្ជាក់។
          </div>
          <div className="flex space-x-3">
            <button 
              type="button"
              className="px-6 py-2.5 border border-slate-300 rounded-lg text-sm font-bold hover:bg-white transition-colors"
            >
              បោះបង់ (Cancel)
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-2.5 bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md hover:bg-blue-800 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center"
            >
              {loading ? 'Processing...' : t.confirmHandover}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
