import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { useLocationContext, formatLocationOption, getActiveWarehouseLocation } from '../contexts/LocationContext';
import { 
  SlidersHorizontal, 
  Check, 
  X, 
  AlertTriangle, 
  ArrowRight, 
  Package, 
  Building2, 
  ShieldCheck, 
  Clock, 
  History, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Equal,
  CheckCircle2,
  FileText,
  User,
  Info,
  Loader2
} from 'lucide-react';

export function AdjustmentView() {
  const { t, language } = useLanguage();
  const { userRole, isCentralAdmin, isBranchUser, userDisplayName } = useAuth();
  const { 
    inventory, 
    items, 
    locations, 
    transactions,
    recordAdjustment, 
    refreshInventory 
  } = useInventoryContext();
  const { selectedLocation: globalSelectedLoc, assignedBranchLocation, isLocationLocked } = useLocationContext();

  // Default Location (BranchUser -> assigned branch; CentralAdmin -> active global location or HQ)
  const defaultHq = locations.find(l => isHqLocationOrRow(l, locations)) || locations.find(l => l.code !== 'ALL') || locations[0];
  const initialLocId =
    isBranchUser && assignedBranchLocation
      ? assignedBranchLocation.id
      : globalSelectedLoc && globalSelectedLoc.code !== 'ALL' && globalSelectedLoc.id !== 'ALL'
        ? globalSelectedLoc.id
        : defaultHq?.id || '1';
  const [selectedLocId, setSelectedLocId] = useState<string>(initialLocId);

  // Sync with global location context & strictly lock BranchUser to their own branch (matching StockOutView)
  useEffect(() => {
    if (isBranchUser && assignedBranchLocation) {
      setSelectedLocId(assignedBranchLocation.id);
    } else if (globalSelectedLoc && globalSelectedLoc.code !== 'ALL' && globalSelectedLoc.id !== 'ALL') {
      setSelectedLocId(globalSelectedLoc.id);
    } else if (!selectedLocId && locations.length > 0) {
      const activeLoc = getActiveWarehouseLocation(globalSelectedLoc, locations);
      if (activeLoc) {
        setSelectedLocId(activeLoc.id);
      }
    }
  }, [isBranchUser, assignedBranchLocation, globalSelectedLoc, locations, selectedLocId]);

  // Available locations for the dropdown (BranchUser: only their assigned branch; CentralAdmin: all locations)
  const selectableLocations = useMemo(() => {
    const physicalLocations = locations.filter(l => l.id !== 'ALL' && l.code !== 'ALL');
    if (isBranchUser && assignedBranchLocation) {
      const matched = physicalLocations.filter(
        l => String(l.id) === String(assignedBranchLocation.id) || String(l.code)?.toUpperCase() === String(assignedBranchLocation.code)?.toUpperCase()
      );
      return matched.length > 0 ? matched : [assignedBranchLocation];
    }
    return physicalLocations;
  }, [locations, isBranchUser, assignedBranchLocation]);

  // Selected Item
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Actual Physical Count Input
  const [actualQuantity, setActualQuantity] = useState<number | ''>('');

  // Reason & Details
  const [reason, setReason] = useState<string>('រាប់ស្តុកប្រចាំត្រីមាស (Quarterly physical audit)');
  const [remark, setRemark] = useState<string>('');
  const [officerName, setOfficerName] = useState<string>(userDisplayName || 'Admin-GDT');

  // Status & Notifications
  const [loading, setLoading] = useState<boolean>(false);
  const submitLockRef = useRef(false);
  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  // History Tab & Filter
  const [historySearch, setHistorySearch] = useState<string>('');

  // Selected Location Object
  const selectedLocation = useMemo(() => {
    if (isBranchUser && assignedBranchLocation) {
      return assignedBranchLocation;
    }
    return locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(selectedLocId) || String(l.code)?.toUpperCase() === String(selectedLocId)?.toUpperCase())
    ) || defaultHq;
  }, [isBranchUser, assignedBranchLocation, locations, selectedLocId, defaultHq]);

  // Selected Item Object
  const selectedItem = useMemo(() => {
    return items.find(i => String(i.id) === String(selectedItemId) || String(i.code)?.toUpperCase() === String(selectedItemId)?.toUpperCase());
  }, [items, selectedItemId]);

  // Current System Balance for selected item and location
  const currentSystemQty = useMemo(() => {
    if (!selectedItem || !selectedLocation) return 0;
    const isTargetHq = isHqLocationOrRow(selectedLocation, locations);

    const matchingRows = inventory.filter(inv => {
      const matchItem = String(inv.item_code)?.trim().toUpperCase() === String(selectedItem.code)?.trim().toUpperCase() || 
                        String(inv.item_id) === String(selectedItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(selectedLocation.id) || 
          String(inv.location_id) === String(selectedLocation.code)) return true;

      if (isTargetHq && isHqLocationOrRow(inv, locations)) return true;

      if (selectedLocation.code && inv.location_name_kh && inv.location_name_kh.includes(selectedLocation.code)) return true;
      if (selectedLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(selectedLocation.name_kh) || selectedLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    return matchingRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [selectedItem, selectedLocation, inventory, locations]);

  // Delta calculation: Actual - System
  const delta = useMemo(() => {
    if (actualQuantity === '') return 0;
    return Number(actualQuantity) - currentSystemQty;
  }, [actualQuantity, currentSystemQty]);

  // Recent Adjustment Transactions History
  const recentAdjustments = useMemo(() => {
    return (transactions || [])
      .filter(tx => tx.type === 'ADJUSTMENT')
      .filter(tx => {
        if (!historySearch.trim()) return true;
        const q = historySearch.toLowerCase();
        return (
          tx.item_code?.toLowerCase().includes(q) ||
          tx.item_name_kh?.toLowerCase().includes(q) ||
          tx.to_location?.toLowerCase().includes(q) ||
          tx.recorded_by?.toLowerCase().includes(q) ||
          tx.remark?.toLowerCase().includes(q)
        );
      });
  }, [historySearch, notice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    const effectiveLocationId = isBranchUser && assignedBranchLocation ? assignedBranchLocation.id : selectedLocId;

    if (!selectedItemId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសសម្ភារៈដែលត្រូវកែតម្រូវស្តុក!' });
      return;
    }
    if (!effectiveLocationId) {
      setNotice({ type: 'error', message: 'សូមជ្រើសរើសទីតាំងឃ្លាំង ឬសាខា!' });
      return;
    }
    if (actualQuantity === '' || Number(actualQuantity) < 0) {
      setNotice({ type: 'error', message: 'សូមបញ្ចូលចំនួនស្តុកជាក់ស្តែងឱ្យបានត្រឹមត្រូវ (≥ 0)!' });
      return;
    }

    submitLockRef.current = true;
    setLoading(true);
    setNotice(null);

    try {
      const res = await recordAdjustment({
        locationId: effectiveLocationId,
        itemId: selectedItemId,
        actualQuantity: Number(actualQuantity),
        officerName: officerName || userDisplayName || 'Admin-GDT',
        reason: reason,
        remark: remark.trim()
      });

      if (res.success) {
        setNotice({
          type: 'success',
          message: res.message,
          details: `ចំនួនមុន: ${res.previousQuantity} ${selectedItem?.unit || 'គ្រឿង'} -> ចំនួនជាក់ស្តែងថ្មី: ${res.newQuantity} ${selectedItem?.unit || 'គ្រឿង'} (ផលសង: ${res.delta && res.delta >= 0 ? '+' : ''}${res.delta} ${selectedItem?.unit || 'គ្រឿង'})`
        });

        // Reset input quantity
        setActualQuantity('');
        setRemark('');
        await refreshInventory();
      } else {
        setNotice({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      console.error('Error submitting adjustment:', err);
      setNotice({ type: 'error', message: err?.message || 'មានបញ្ហាបរាជ័យក្នុងការកែតម្រូវស្តុក!' });
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-5xl mx-auto w-full font-siemreap">
      
      {/* Header */}
      <div className="border-b border-slate-200/80 bg-slate-50/90 px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center space-x-3">
          <div className="bg-[#03291E] p-2.5 rounded-xl border border-emerald-800 text-[#A3D8C2] shadow-xs shrink-0">
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">{t.adjustment}</h2>
              <span className="text-[11px] bg-blue-100 text-blue-900 font-extrabold px-2.5 py-0.5 rounded-full border border-blue-300">
                Reconciliation
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ផ្ទៀងផ្ទាត់ និងកែសម្រួលចំនួនស្តុកជាក់ស្តែងក្នុងឃ្លាំង ជាមួយប្រព័ន្ធគ្រប់គ្រង (Physical Stock Reconciliation)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 shadow-2xs ${
            isCentralAdmin 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {isCentralAdmin ? <ShieldCheck size={15} /> : <Building2 size={15} />}
            <span>{userDisplayName || userRole}</span>
            <span className="text-[10px] text-slate-400 font-normal">({userRole})</span>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className={`p-4 border-b flex items-start justify-between gap-3 shadow-2xs animate-in fade-in slide-in-from-top-2 duration-200 ${
          notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-full mt-0.5 ${notice.type === 'success' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
              {notice.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div>
              <h3 className="font-bold text-sm">{notice.type === 'success' ? 'កែតម្រូវស្តុកជោគជ័យ!' : 'បរាជ័យក្នុងការកែតម្រូវស្តុក'}</h3>
              <p className="text-xs mt-0.5 opacity-90">{notice.message}</p>
              {notice.details && (
                <div className="mt-1.5 text-xs font-mono font-bold text-emerald-800 bg-white/80 border border-emerald-300 rounded-lg px-2.5 py-1 inline-block">
                  {notice.details}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setNotice(null)} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Content Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-y-auto">
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 bg-white">
          
          {/* Left Column: Location & Item Selection */}
          <div className="space-y-4 sm:space-y-5">
            
            {/* 1. Location Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>ទីតាំងឃ្លាំង ឬសាខាពន្ធដារ (Location)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <select
                value={isBranchUser && assignedBranchLocation ? assignedBranchLocation.id : selectedLocId}
                onChange={(e) => {
                  if (isBranchUser || isLocationLocked) return;
                  setSelectedLocId(e.target.value);
                  setActualQuantity('');
                }}
                disabled={isBranchUser || isLocationLocked}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E] disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed"
                required
              >
                {selectableLocations.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationOption(loc, language)} {isHqLocationOrRow(loc, locations) ? '(HQ)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Item Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>ជ្រើសរើសសម្ភារៈ (Select Item)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => { setSelectedItemId(e.target.value); setActualQuantity(''); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
                required
              >
                <option value="">-- ជ្រើសរើសមុខសម្ភារ / សម្ភារៈបច្ចេកទេស --</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en} ({item.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Current System Balance Card */}
            {selectedItemId && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-100 text-blue-800 rounded-xl border border-blue-200">
                    <Package size={22} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-950 block">
                      ចំនួនស្តុកក្នុងប្រព័ន្ធបច្ចុប្បន្ន (Current System Balance):
                    </span>
                    <span className="text-[11px] text-blue-700 block mt-0.5">
                      ទីតាំង: <strong>{selectedLocation?.name_kh}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-blue-900">
                    {currentSystemQty}
                  </span>
                  <span className="text-xs font-bold text-blue-800 ml-1.5">
                    {selectedItem?.unit || 'គ្រឿង'}
                  </span>
                </div>
              </div>
            )}

            {/* 4. Reason Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>មូលហេតុនៃការកែតម្រូវ (Reason)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
                required
              >
                <option value="រាប់ស្តុកប្រចាំត្រីមាស (Quarterly physical audit)">រាប់ស្តុកប្រចាំត្រីមាស (Quarterly physical audit)</option>
                <option value="សម្ភារៈខូចខាត (Damaged item)">សម្ភារៈខូចខាត (Damaged item)</option>
                <option value="បាត់បង់អំឡុងពេលដឹកជញ្ជូន (Lost in transit)">បាត់បង់អំឡុងពេលដឹកជញ្ជូន (Lost in transit)</option>
                <option value="កែតម្រូវទិន្នន័យកត់ត្រាខុស (Data entry correction)">កែតម្រូវទិន្នន័យកត់ត្រាខុស (Data entry correction)</option>
                <option value="ផ្សេងៗ (Other)">ផ្សេងៗ (Other)</option>
              </select>
            </div>

          </div>

          {/* Right Column: Physical Count Input & Live Delta */}
          <div className="space-y-4 sm:space-y-5">
            
            {/* 1. Actual Physical Count Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>ចំនួនស្តុកជាក់ស្តែងក្នុងការិយាល័យ/ឃ្លាំង (Actual Count)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={actualQuantity}
                  onChange={(e) => setActualQuantity(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 min-h-[48px] text-lg font-black text-slate-900 outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
                  required
                />
                <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">
                  {selectedItem?.unit || 'គ្រឿង'}
                </span>
              </div>

              {/* Quick Adjustment Increment/Decrement helpers */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => setActualQuantity(0)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg"
                >
                  ០ (អស់ស្តុក)
                </button>
                <button
                  type="button"
                  onClick={() => setActualQuantity(currentSystemQty)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg"
                >
                  ស្មើប្រព័ន្ធ ({currentSystemQty})
                </button>
                <button
                  type="button"
                  onClick={() => setActualQuantity(Math.max(0, (Number(actualQuantity) || currentSystemQty) - 1))}
                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold rounded-lg ml-auto"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => setActualQuantity((Number(actualQuantity) || currentSystemQty) + 1)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => setActualQuantity((Number(actualQuantity) || currentSystemQty) + 5)}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg"
                >
                  +5
                </button>
              </div>
            </div>

            {/* 2. Live Dynamic Delta Calculation Card */}
            {selectedItemId && actualQuantity !== '' && (
              <div className={`p-4 rounded-2xl border transition-all ${
                delta > 0 
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : delta < 0 
                    ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {delta > 0 && <TrendingUp size={22} className="text-emerald-700" />}
                    {delta < 0 && <TrendingDown size={22} className="text-rose-700" />}
                    {delta === 0 && <Equal size={22} className="text-slate-600" />}
                    <div>
                      <span className="text-xs font-bold block">
                        {delta > 0 && 'ផលសងស្តុកលើស (Surplus / Overage):'}
                        {delta < 0 && 'ផលសងស្តុកខ្វះ (Deficit / Shortage):'}
                        {delta === 0 && 'ចំនួនជាក់ស្តែងត្រឹមត្រូវស្មើនឹងប្រព័ន្ធ (In Balance):'}
                      </span>
                      <span className="text-[11px] opacity-80 block mt-0.5">
                        {delta > 0 && 'ប្រព័ន្ធនឹងកត់ត្រាបន្ថែមស្តុកលើសដោយស្វ័យប្រវត្តិ'}
                        {delta < 0 && 'ប្រព័ន្ធនឹងកត់ត្រាកាត់ស្តុកខ្វះខាតដោយស្វ័យប្រវត្តិ'}
                        {delta === 0 && 'មិនមានការប្រែប្រួលចំនួនស្តុកឡើយ'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-2xl font-black font-mono ${
                      delta > 0 ? 'text-emerald-700' : (delta < 0 ? 'text-rose-700' : 'text-slate-700')
                    }`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                    <span className="text-xs font-bold ml-1">
                      {selectedItem?.unit || 'គ្រឿង'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Detailed Remarks & Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                កំណត់សម្គាល់បន្ថែម ឬលេខលិខិតអធិការកិច្ច (Remarks / Notes)
              </label>
              <textarea
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="បញ្ជាក់មូលហេតុលម្អិត លេខកូដសម្ភារៈខូចខាត ឬកំណត់ហេតុ..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E] resize-none"
              ></textarea>
            </div>

            {/* 4. Officer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>មន្ត្រីធ្វើការកែតម្រូវ (Inspector / Officer)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <input
                type="text"
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="ឈ្មោះមន្ត្រី"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[44px] text-xs font-semibold outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
                required
              />
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 text-center sm:text-left">
            <Info size={14} className="text-slate-400 shrink-0" />
            <span>ការកែតម្រូវនឹង Update ចំនួនស្តុកចុងក្រោយក្នុង Database និងកត់ត្រាប្រវត្តិ Transaction ស្វ័យប្រវត្តិ</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:space-x-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedItemId('');
                setActualQuantity('');
                setRemark('');
                setNotice(null);
              }}
              className="px-5 py-2.5 min-h-[44px] border border-slate-300 rounded-xl text-xs font-bold hover:bg-white transition-colors w-full sm:w-auto text-slate-700"
            >
              សម្អាត (Clear)
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-7 py-2.5 min-h-[44px] bg-[#03291E] hover:bg-[#1E6047] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>កំពុងរក្សាទុក...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>កត់ត្រាកែតម្រូវស្តុក (Save Adjustment)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* History of Adjustments */}
      <div className="border-t border-slate-200/80 bg-slate-50/50 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History size={18} className="text-[#03291E] shrink-0" />
            <h3 className="text-sm font-bold text-slate-900">ប្រវត្តិនៃការកែតម្រូវស្តុកថ្មីៗ (Recent Adjustment History)</h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="ស្វែងរកតាម SKU ឬឈ្មោះសម្ភារៈ..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 min-h-[40px] text-xs font-semibold outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
            />
          </div>
        </div>

        {recentAdjustments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200/80">
            មិនទាន់មានប្រវត្តិនៃការកែតម្រូវស្តុកនៅឡើយទេ
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">កាលបរិច្ឆេទ</th>
                    <th className="py-2.5 px-4">ទីតាំង</th>
                    <th className="py-2.5 px-4">កូដ SKU</th>
                    <th className="py-2.5 px-4">ឈ្មោះសម្ភារៈ</th>
                    <th className="py-2.5 px-4 text-center">ផលសង</th>
                    <th className="py-2.5 px-4">មូលហេតុ និងកំណត់សម្គាល់</th>
                    <th className="py-2.5 px-4">មន្ត្រីកត់ត្រា</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {recentAdjustments.slice(0, 8).map((tx) => {
                    const isPositive = tx.quantity > 0;
                    const isZero = tx.quantity === 0;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(tx.date || tx.created_at || Date.now()).toLocaleDateString('km-KH')}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                          {tx.to_location || tx.from_location}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {tx.item_code}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900 max-w-xs truncate">
                          {tx.item_name_kh}
                        </td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-block font-mono font-extrabold px-2 py-0.5 rounded-full text-[11px] ${
                            isPositive 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                              : isZero 
                                ? 'bg-slate-100 text-slate-700 border border-slate-200' 
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                          }`}>
                            {isPositive ? `+${tx.quantity}` : tx.quantity} {tx.unit}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={tx.remark}>
                          {tx.remark}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                          {tx.recorded_by}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
