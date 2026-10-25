import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useLocationContext, formatLocationOption, getActiveWarehouseLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { MinusCircle, Check, X, AlertTriangle, Loader2 } from 'lucide-react';

export function StockOutView() {
  const { t, language } = useLanguage();
  const { user, userProfile, userDisplayName } = useAuth();
  const { items, locations, inventory, recordStockOut } = useInventoryContext();
  const { selectedLocation: globalSelectedLoc } = useLocationContext();
  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');

  const loggedInOfficerName =
    userProfile?.full_name ||
    userDisplayName ||
    user?.user_metadata?.full_name ||
    (user as any)?.full_name ||
    (user as any)?.name ||
    (user as any)?.username ||
    user?.email ||
    '';

  const [officerName, setOfficerName] = useState<string>(loggedInOfficerName);

  // Sync officerName with logged-in user profile
  useEffect(() => {
    if (loggedInOfficerName) {
      setOfficerName(loggedInOfficerName);
    }
  }, [loggedInOfficerName]);

  // Sync with global location context
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

  const selectedItem = items.find(i => String(i.id) === String(selectedItemId) || String(i.code) === String(selectedItemId));
  const selectedLocation = locations.find(l => 
    l.id !== 'ALL' && l.code !== 'ALL' && 
    (String(l.id) === String(selectedLocId) || String(l.code) === String(selectedLocId))
  ) || locations[0];

  // Calculate live available stock for selected item at selected location
  const availableStock = React.useMemo(() => {
    if (!selectedItem || !selectedLocation) return 0;
    const isTargetHq = isHqLocationOrRow(selectedLocation, locations);

    const matchingRows = inventory.filter(inv => {
      const matchItem = String(inv.item_code)?.toUpperCase() === String(selectedItem.code)?.toUpperCase() || 
                        String(inv.item_id) === String(selectedItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(selectedLocation.id) || 
          String(inv.location_id) === String(selectedLocation.code)) return true;

      if (isTargetHq && isHqLocationOrRow(inv, locations)) return true;

      if (selectedLocation.code && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.code)) return true;
      if (selectedLocation.name_kh && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.name_kh)) return true;

      return false;
    });

    return matchingRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [selectedItem, selectedLocation, inventory, locations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    setNotice(null);

    const form = e.target as HTMLFormElement;
    const locationId = selectedLocId || (form.elements.namedItem('locationId') as HTMLSelectElement)?.value;
    const quantity = parseInt((form.elements.namedItem('quantity') as HTMLInputElement)?.value || '0', 10);
    const resolvedOfficerName = officerName.trim() || (form.elements.namedItem('officerName') as HTMLInputElement)?.value?.trim() || loggedInOfficerName;
    const purpose = (form.elements.namedItem('purpose') as HTMLTextAreaElement)?.value;

    if (!selectedItemId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសសម្ភារៈ!' });
      return;
    }
    if (!locationId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសទីតាំង!' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setNotice({ type: 'error', message: 'ចំនួនដកចេញត្រូវតែធំជាង ០!' });
      return;
    }
    if (availableStock <= 0 || quantity > availableStock) {
      setNotice({ 
        type: 'error', 
        message: `ស្តុកនៅទីតាំងនេះមិនគ្រប់គ្រាន់ទេ! (មានក្នុងស្តុក: ${availableStock} ${selectedItem?.unit || 'គ្រឿង'}, ស្នើសុំដក: ${quantity} ${selectedItem?.unit || 'គ្រឿង'})` 
      });
      return;
    }

    submitLockRef.current = true;
    setLoading(true);

    let res: { success: boolean; message: string };
    try {
      res = await recordStockOut({
        locationId,
        itemId: selectedItemId,
        quantity,
        officerName: resolvedOfficerName,
        purpose: purpose || 'ដកចេញពីស្តុក'
      });
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }

    if (res.success) {
      setNotice({ type: 'success', message: res.message });
      form.reset();
      setSelectedItemId('');
      setOfficerName(loggedInOfficerName);
    } else {
      setNotice({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-4xl mx-auto w-full">
      {notice && (
        <div className={`p-4 border-b flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-4 duration-300 ${
          notice.type === 'success' 
            ? 'bg-rose-50 border-rose-200 text-rose-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${notice.type === 'success' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
              {notice.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-sm">{notice.type === 'success' ? 'ដកចេញជោគជ័យ' : 'បរាជ័យក្នុងការដកចេញ'}</h3>
              <p className="text-xs opacity-90">{notice.message}</p>
            </div>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="border-b border-slate-200/80 px-4 sm:px-6 py-4 flex items-center justify-between bg-slate-50/90">
        <div className="flex items-start sm:items-center space-x-3">
          <div className="bg-rose-100/80 p-2 rounded-lg shrink-0">
            <MinusCircle size={24} className="text-rose-800" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">{t.stockOut}</h2>
            <p className="text-xs text-slate-500">បំពេញព័ត៌មានខាងក្រោមដើម្បីកាត់បន្ថយស្តុកបច្ចុប្បន្ន (កាត់ស្តុកចេញ)</p>
          </div>
        </div>
      </div>
      
      <form id="stock-out-form" onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 bg-white">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.selectLocation} <span className="text-rose-500">*</span></label>
              <select 
                name="locationId" 
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033]" 
                required
              >
                <option value="">-- {t.selectLocation} --</option>
                {locations.filter(l => l.code !== 'ALL').map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationOption(loc, language)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.selectItem} <span className="text-rose-500">*</span></label>
              <select 
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033]" required>
                <option value="">-- {t.selectItem} --</option>
                {items.map(item => (
                  <option key={item.id || item.code} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en}
                  </option>
                ))}
              </select>

              {/* Current Available Stock Indicator */}
              {selectedItem && (
                <div className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                  availableStock > 0 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <span className="font-semibold">
                    ស្តុកបច្ចុប្បន្ននៅ {selectedLocation?.code || 'ទីតាំងនេះ'}៖
                  </span>
                  <span className="font-mono font-black text-sm">
                    {availableStock} {selectedItem.unit || 'គ្រឿង'}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.quantity} <span className="text-rose-500">*</span></label>
                <input name="quantity" type="number" min="1" defaultValue={1} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033]" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.unit}</label>
                <input type="text" disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-2.5 min-h-[44px] text-sm text-slate-500" value={selectedItem?.unit || 'ឯកតា'} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.officerName} <span className="text-rose-500">*</span></label>
              <input
                name="officerName"
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 min-h-[44px] text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">{t.purpose} <span className="text-rose-500">*</span></label>
              <textarea name="purpose" rows={4} defaultValue="ដកចេញដើម្បីបម្រើការងារបច្ចេកទេស" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#900033]/20 focus:border-[#900033] resize-none" required></textarea>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center text-xs text-slate-500 text-center sm:text-left">
             ប្រតិបត្តិការនេះមិនអាចត្រឡប់ថយក្រោយបានទេ បន្ទាប់ពីការបញ្ជាក់។
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:space-x-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => {
                const form = document.getElementById('stock-out-form') as HTMLFormElement;
                if (form) form.reset();
                setSelectedItemId('');
                setOfficerName(loggedInOfficerName);
                setNotice(null);
              }}
              className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] border border-slate-300 rounded-lg text-sm font-bold hover:bg-white transition-colors"
            >
              បោះបង់ (Cancel)
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto px-8 py-2.5 min-h-[44px] bg-[#900033] text-white rounded-lg text-sm font-bold shadow-md hover:bg-[#700028] transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>កំពុងរក្សាទុក...</span>
                </>
              ) : t.confirmDeduct}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
