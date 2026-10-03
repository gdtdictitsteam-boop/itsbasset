import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useInventoryContext } from '../contexts/InventoryContext';
import { useAuth } from '../contexts/AuthContext';
import { PlusSquare, Check, X, AlertTriangle } from 'lucide-react';

export function StockInView() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { items, locations, recordStockIn } = useInventoryContext();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');

  const selectedItem = items.find(i => i.id === selectedItemId || i.code === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);

    const form = e.target as HTMLFormElement;
    const locationId = (form.elements.namedItem('locationId') as HTMLSelectElement).value;
    const quantity = parseInt((form.elements.namedItem('quantity') as HTMLInputElement).value || '0', 10);
    const officerName = (form.elements.namedItem('officerName') as HTMLInputElement).value;
    const purpose = (form.elements.namedItem('purpose') as HTMLTextAreaElement).value;

    const res = await recordStockIn({
      locationId,
      itemId: selectedItemId,
      quantity,
      officerName: officerName || user?.fullName || 'Admin-GDT',
      purpose: purpose || 'បញ្ចូលស្តុកថ្មី'
    });

    setLoading(false);

    if (res.success) {
      setNotice({ type: 'success', message: res.message });
      form.reset();
      setSelectedItemId('');
    } else {
      setNotice({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {notice && (
        <div className={`p-4 border-b flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-4 duration-300 ${
          notice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${notice.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {notice.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-sm">{notice.type === 'success' ? 'បញ្ចូលស្តុកជោគជ័យ' : 'បរាជ័យក្នុងការបញ្ចូលស្តុក'}</h3>
              <p className="text-xs opacity-90">{notice.message}</p>
            </div>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700 p-1">
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
            <p className="text-xs text-slate-500">បញ្ចូលស្តុកសម្ភារៈថ្មីទៅក្នុងប្រព័ន្ធ (បង្កើនចំនួនក្នុងស្តុក)</p>
          </div>
        </div>
      </div>
      
      <form id="stock-in-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.selectItem} <span className="text-rose-500">*</span></label>
              <select 
                name="itemId" 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" 
                required
              >
                <option value="">-- {t.selectItem} --</option>
                {items.map(item => (
                  <option key={item.id || item.code} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">ទីតាំងបញ្ចូល (Location) <span className="text-rose-500">*</span></label>
              <select name="locationId" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required>
                <option value="">-- ជ្រើសរើសទីតាំង --</option>
                {locations.filter(l => l.code !== 'ALL').map(loc => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.code}] {language === 'kh' ? loc.name_kh : loc.name_en}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.quantity} <span className="text-rose-500">*</span></label>
                <input name="quantity" type="number" min="1" defaultValue={1} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.unit}</label>
                <input type="text" disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 text-sm text-slate-500" value={selectedItem?.unit || 'ឯកតា'} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.officerName} <span className="text-rose-500">*</span></label>
              <input name="officerName" type="text" defaultValue={user?.fullName || 'Admin-GDT'} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">ឯកសារយោង / មូលហេតុ (Reference/Purpose) <span className="text-rose-500">*</span></label>
              <textarea name="purpose" rows={4} defaultValue="បញ្ចូលស្តុកបន្ថែមប្រចាំការ" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 resize-none" required></textarea>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500">
             បរិមាណដែលបញ្ចូលនឹងត្រូវបូកបន្ថែមទៅក្នុងស្តុកនៃទីតាំងដែលបានជ្រើសរើសដោយស្វ័យប្រវត្តិ។
          </div>
          <div className="flex space-x-3">
            <button 
              type="button"
              onClick={() => {
                const form = document.getElementById('stock-in-form') as HTMLFormElement;
                if (form) form.reset();
                setSelectedItemId('');
                setNotice(null);
              }}
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
                  កំពុងបញ្ចូលស្តុក...
                </>
              ) : 'បញ្ជាក់ការបញ្ចូលស្តុក'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
