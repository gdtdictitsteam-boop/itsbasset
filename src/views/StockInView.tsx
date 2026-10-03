import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useLocationContext, formatLocationOption, getActiveWarehouseLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  PlusSquare, Check, X, AlertTriangle, ArrowRight, Package, 
  Building2, TrendingUp, ExternalLink, CheckCircle2, RefreshCw
} from 'lucide-react';
import { ItemAvatar } from '../components/ItemAvatar';

interface StockInViewProps {
  onNavigate?: (view: string) => void;
}

export function StockInView({ onNavigate }: StockInViewProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { items, locations, inventory, recordStockIn } = useInventoryContext();
  const { setSelectedLocationId, selectedLocation: globalSelectedLoc } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ 
    type: 'success' | 'error'; 
    message: string; 
    itemCode?: string;
    itemName?: string;
    addedQty?: number;
    newTotalQty?: number;
    unit?: string;
    locationName?: string;
  } | null>(null);

  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');
  const [inputQuantity, setInputQuantity] = useState<number>(1);

  // Sync default location with global location context (or fallback to HQ if ALL)
  useEffect(() => {
    if (globalSelectedLoc && globalSelectedLoc.code !== 'ALL' && globalSelectedLoc.id !== 'ALL') {
      setSelectedLocId(globalSelectedLoc.id);
    } else if (!selectedLocId && locations.length > 0) {
      const activeLoc = getActiveWarehouseLocation(globalSelectedLoc, locations);
      if (activeLoc) {
        setSelectedLocId(activeLoc.id);
      }
    }
  }, [globalSelectedLoc, locations, selectedLocId]);

  const selectedItem = items.find(i => i.id === selectedItemId || i.code === selectedItemId);
  const selectedLocation = locations.find(l => l.id === selectedLocId || l.code === selectedLocId);

  // Calculate current stock at selected location and across all locations
  const currentLocStock = React.useMemo(() => {
    if (!selectedItem || !selectedLocation) return 0;
    const isTargetHq = isHqLocationOrRow(selectedLocation, locations);

    const matchingRows = inventory.filter(inv => {
      const matchItem = String(inv.item_code) === String(selectedItem.code) || 
                        String(inv.item_id) === String(selectedItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(selectedLocation.id) || String(inv.location_id) === String(selectedLocation.code)) return true;
      if (isTargetHq && isHqLocationOrRow(inv, locations)) return true;
      if (selectedLocation.code && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.code)) return true;
      if (selectedLocation.name_kh && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.name_kh)) return true;
      return false;
    });

    return matchingRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [selectedItem, selectedLocation, inventory, locations]);

  const currentTotalStock = React.useMemo(() => {
    if (!selectedItem) return 0;
    const matchingRows = inventory.filter(inv => 
      inv.item_code === selectedItem.code || inv.item_id === selectedItem.id
    );
    return matchingRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [selectedItem, inventory]);

  const projectedLocStock = currentLocStock + (Number(inputQuantity) || 0);
  const projectedTotalStock = currentTotalStock + (Number(inputQuantity) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសសម្ភារៈដែលត្រូវបញ្ចូលស្តុក!' });
      return;
    }
    if (!selectedLocId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសទីតាំងដែលត្រូវបញ្ចូលស្តុក!' });
      return;
    }
    if (inputQuantity <= 0) {
      setNotice({ type: 'error', message: 'ចំនួនបញ្ចូលត្រូវតែធំជាង ០!' });
      return;
    }

    setLoading(true);
    setNotice(null);

    const form = e.target as HTMLFormElement;
    const officerName = (form.elements.namedItem('officerName') as HTMLInputElement).value;
    const purpose = (form.elements.namedItem('purpose') as HTMLTextAreaElement).value;

    const res = await recordStockIn({
      locationId: selectedLocId,
      itemId: selectedItemId,
      quantity: inputQuantity,
      officerName: officerName || user?.fullName || 'Admin-GDT',
      purpose: purpose || 'បញ្ចូលស្តុកថ្មី'
    });

    setLoading(false);

    if (res.success) {
      setNotice({ 
        type: 'success', 
        message: res.message,
        itemCode: selectedItem?.code,
        itemName: selectedItem?.name_kh,
        addedQty: inputQuantity,
        newTotalQty: res.newQuantity ?? projectedLocStock,
        unit: selectedItem?.unit || 'គ្រឿង',
        locationName: selectedLocation?.name_kh || 'ស្តុកកណ្តាល HQ'
      });
      // Keep selected item & location so user can review or add again, but reset quantity to 1
      setInputQuantity(1);
    } else {
      setNotice({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {/* Top Banner Notice */}
      {notice && (
        <div className={`p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-4 duration-300 ${
          notice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2 rounded-xl mt-0.5 sm:mt-0 ${notice.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {notice.type === 'success' ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {notice.type === 'success' ? 'បញ្ចូលស្តុកថ្មីបានជោគជ័យ ១០០%!' : 'បរាជ័យក្នុងការបញ្ចូលស្តុក'}
              </h3>
              <p className="text-xs opacity-90 mt-0.5 leading-relaxed">{notice.message}</p>
              {notice.type === 'success' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {onNavigate && (
                    <>
                      <button
                        type="button"
                        onClick={() => onNavigate('inventory')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                      >
                        <Package size={13} />
                        <span>ពិនិត្យក្នុង "ស្តុកបច្ចុប្បន្ន"</span>
                        <ArrowRight size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('dashboard')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
                      >
                        <TrendingUp size={13} />
                        <span>ពិនិត្យ "ផ្ទាំងគ្រប់គ្រង"</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700 p-1 self-start sm:self-center">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200/80 px-6 py-4 flex items-center justify-between bg-slate-50/90">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-100/80 p-2 rounded-xl text-emerald-800 shadow-2xs">
            <PlusSquare size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.stockIn}</h2>
            <p className="text-xs text-slate-500">បញ្ចូលស្តុកសម្ភារៈថ្មីទៅក្នុងប្រព័ន្ធ (បង្កើនចំនួនក្នុងស្តុកដោយស្វ័យប្រវត្តិ)</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            លំហូរស្តុក៖ ចូលស្តុក (Stock In)
          </span>
        </div>
      </div>
      
      {/* Form */}
      <form id="stock-in-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
          {/* Left Column: Material & Location Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                {t.selectItem} <span className="text-rose-500">*</span>
              </label>
              <select 
                name="itemId" 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs" 
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
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                ទីតាំងបញ្ចូល (Target Location) <span className="text-rose-500">*</span>
              </label>
              <select 
                name="locationId" 
                value={selectedLocId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLocId(val);
                  if (val) {
                    setSelectedLocationId(val);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs" 
                required
              >
                <option value="">-- ជ្រើសរើសទីតាំង --</option>
                {locations.filter(l => l.code !== 'ALL').map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationOption(loc, language)}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                  {t.quantity} <span className="text-rose-500">*</span>
                </label>
                <input 
                  name="quantity" 
                  type="number" 
                  min="1" 
                  value={inputQuantity}
                  onChange={(e) => setInputQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs" 
                  required 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.unit}</label>
                <input 
                  type="text" 
                  disabled 
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600" 
                  value={selectedItem?.unit || 'គ្រឿង'} 
                />
              </div>
            </div>

            {/* Live Stock Flow Calculation Card */}
            {selectedItem && selectedLocation && (
              <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-2xl p-4 shadow-2xs space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center space-x-3">
                  <ItemAvatar item={{
                    code: selectedItem.code,
                    name_kh: selectedItem.name_kh,
                    name_en: selectedItem.name_en,
                    category: selectedItem.category,
                    image_url: selectedItem.image_url
                  }} />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-slate-900 line-clamp-1">{selectedItem.name_kh}</h4>
                    <p className="text-[11px] text-slate-500 font-mono">{selectedItem.code} • {selectedItem.category}</p>
                  </div>
                </div>

                <div className="border-t border-emerald-200/80 pt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-white p-2 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-slate-500 font-bold block uppercase">ស្តុកបច្ចុប្បន្ន</span>
                    <span className="text-base font-black text-slate-800">{currentLocStock}</span>
                    <span className="text-[10px] text-slate-400 block">{selectedItem.unit}</span>
                  </div>
                  <div className="bg-emerald-100/70 p-2 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold block uppercase">+ បញ្ចូលថ្មី</span>
                    <span className="text-base font-black text-emerald-800">+{inputQuantity}</span>
                    <span className="text-[10px] text-emerald-600 block">{selectedItem.unit}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-emerald-100">
                    <span className="text-[10px] text-teal-800 font-bold block uppercase">= ស្តុកសរុបថ្មី</span>
                    <span className="text-base font-black text-teal-900">{projectedLocStock}</span>
                    <span className="text-[10px] text-teal-600 block">{selectedItem.unit}</span>
                  </div>
                </div>

                <div className="text-[11px] text-emerald-900 bg-emerald-100/50 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
                  <span>ទីតាំងទទួលស្តុក៖</span>
                  <span className="font-bold">{selectedLocation.name_kh}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Officer Info & Reference */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                {t.officerName} (អ្នកកត់ត្រា) <span className="text-rose-500">*</span>
              </label>
              <input 
                name="officerName" 
                type="text" 
                defaultValue={user?.fullName || 'Admin-GDT'} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 shadow-2xs" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                ឯកសារយោង / មូលហេតុ (Reference / Purpose) <span className="text-rose-500">*</span>
              </label>
              <textarea 
                name="purpose" 
                rows={5} 
                defaultValue="បញ្ចូលស្តុកបន្ថែមប្រចាំការ តាមផែនការផ្គត់ផ្គង់" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 resize-none shadow-2xs" 
                required
              ></textarea>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                <span>លក្ខខណ្ឌលំហូរស្តុក (Inventory Flow Rules)៖</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] leading-relaxed">
                <li>ចំនួនដែលបញ្ចូលនឹងត្រូវបានបូកបន្ថែមភ្លាមៗទៅក្នុង <strong>"ស្តុកបច្ចុប្បន្ន (Inventory)"</strong> និង <strong>"ផ្ទាំងគ្រប់គ្រង (Dashboard)"</strong>។</li>
                <li>ប្រព័ន្ធនឹងបង្កើតកំណត់ត្រាប្រតិបត្តិការ (Transaction Audit Trail) ប្រភេទ <strong>STOCK_IN</strong> ដោយស្វ័យប្រវត្តិ។</li>
                <li>បើសិនជាប្រព័ន្ធភ្ជាប់ Supabase ទិន្នន័យនឹងត្រូវ Sync ទៅកាន់ Supabase Database ដោយផ្ទាល់។</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center text-xs text-slate-500 font-medium">
            សម្ភារៈនឹងត្រូវបានបង្កើនចំនួនក្នុងស្តុកភ្លាមៗបន្ទាប់ពីចុចបញ្ជាក់។
          </div>
          <div className="flex space-x-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => {
                const form = document.getElementById('stock-in-form') as HTMLFormElement;
                if (form) form.reset();
                setSelectedItemId('');
                setInputQuantity(1);
                setNotice(null);
              }}
              className="flex-1 sm:flex-none px-6 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-white transition-colors"
            >
              បោះបង់ (Cancel)
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 sm:flex-none px-8 py-2.5 bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-800 transition-all transform active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>កំពុងបញ្ចូលស្តុក...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>បញ្ជាក់ការបញ្ចូលស្តុក</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
