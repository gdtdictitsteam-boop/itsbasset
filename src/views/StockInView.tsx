import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { mockLocations, mockItems, mockInventory } from '../mockData';
import { PlusSquare, Check, X } from 'lucide-react';

export function StockInView() {
  const { t, language } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');

  const selectedItem = mockItems.find(i => i.id === selectedItemId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitSuccess(false);

    const form = e.target as HTMLFormElement;
    const locationId = (form.elements.namedItem('locationId') as HTMLSelectElement).value;
    const quantity = parseInt((form.elements.namedItem('quantity') as HTMLInputElement).value || '0', 10);
    const purpose = (form.elements.namedItem('purpose') as HTMLTextAreaElement).value;

    setTimeout(() => {
      if (selectedItem && quantity > 0) {
        // Update inventory logic
        const existingInventoryIndex = mockInventory.findIndex(inv => inv.item_id === selectedItem.id && inv.location_id === locationId);
        
        if (existingInventoryIndex >= 0) {
          mockInventory[existingInventoryIndex].quantity += quantity;
          mockInventory[existingInventoryIndex].last_updated = new Date().toISOString();
        } else {
          const loc = mockLocations.find(l => l.id === locationId);
          mockInventory.push({
            location_id: locationId,
            item_id: selectedItem.id,
            quantity: quantity,
            last_updated: new Date().toISOString(),
            item_code: selectedItem.code,
            item_name_kh: selectedItem.name_kh,
            item_name_en: selectedItem.name_en,
            category: selectedItem.category,
            unit: selectedItem.unit,
            location_name_kh: loc?.name_kh || '',
            location_name_en: loc?.name_en || ''
          });
        }
      }

      setLoading(false);
      setSubmitSuccess(true);
      form.reset();
      setSelectedItemId('');
      
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    }, 800);
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {submitSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 p-4 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-1.5 rounded-full text-emerald-700">
              <Check size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">បញ្ចូលស្តុកជោគជ័យ</h3>
              <p className="text-xs opacity-90">បរិមាណស្តុកថ្មីត្រូវបានធ្វើបច្ចុប្បន្នភាពក្នុងប្រព័ន្ធ។</p>
            </div>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="border-b border-slate-200/80 px-6 py-4 flex items-center justify-between bg-slate-50/90">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-100/80 p-2 rounded-lg">
            <PlusSquare size={24} className="text-emerald-800" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.stockIn}</h2>
            <p className="text-xs text-slate-500">បញ្ចូលស្តុកសម្ភារៈថ្មីទៅក្នុងប្រព័ន្ធ</p>
          </div>
        </div>
      </div>
      
      <form id="stock-in-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.selectItem}</label>
              <select 
                name="itemId" 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" 
                required
              >
                <option value="">-- {t.selectItem} --</option>
                {mockItems.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">ទីតាំងបញ្ចូល (Location)</label>
              <select name="locationId" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required>
                <option value="">-- ជ្រើសរើសទីតាំង --</option>
                {mockLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {language === 'kh' ? loc.name_kh : loc.name_en}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.quantity}</label>
                <input name="quantity" type="number" min="1" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.unit}</label>
                <input type="text" disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500" value={selectedItem?.unit || 'ឯកតា'} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.officerName}</label>
              <input name="officerName" type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">ឯកសារយោង / មូលហេតុ (Reference/Purpose)</label>
              <textarea name="purpose" rows={4} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 resize-none" required></textarea>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500">
             ត្រូវប្រាកដថាចំនួននិងសម្ភារៈត្រឹមត្រូវមុនពេលបញ្ជាក់។
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
              className="px-8 py-2.5 bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md hover:bg-emerald-800 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  កំពុងដំណើរការ...
                </>
              ) : 'បញ្ជាក់ការបញ្ចូលស្តុក'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
