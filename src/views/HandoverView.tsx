import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { mockLocations, mockItems, mockInventory, mockTransactions } from '../mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  ArrowRightLeft, 
  Check, 
  X, 
  UploadCloud, 
  FileCheck2, 
  AlertTriangle, 
  ShieldAlert, 
  FileText, 
  Trash2, 
  ExternalLink,
  ShieldCheck,
  Building2
} from 'lucide-react';

export function HandoverView() {
  const { t, language } = useLanguage();
  const { userRole, isCentralAdmin, userDisplayName } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null);

  // Data States
  const [locations, setLocations] = useState(isSupabaseConfigured() ? [] : mockLocations);
  const [items, setItems] = useState(isSupabaseConfigured() ? [] : mockItems);

  // Fetch real data from Supabase if configured
  useEffect(() => {
    async function fetchData() {
      if (isSupabaseConfigured()) {
        const [locsRes, itemsRes] = await Promise.all([
          supabase.from('locations').select('*'),
          supabase.from('items').select('*')
        ]);
        
        let fetchedLocations = locsRes.data as any || [];
        let fetchedItems = itemsRes.data as any || [];
        
        setLocations(fetchedLocations);
        setItems(fetchedItems);
      }
    }
    fetchData();
  }, []);

  // Form States
  const [selectedItemId, setSelectedItemId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [officerName, setOfficerName] = useState('');
  const [purpose, setPurpose] = useState('');

  // File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const selectedItem = items.find(i => i.id === selectedItemId);
  const branchLocations = locations.filter(loc => loc.type === 'BRANCH');
  const hqLocations = locations.filter(loc => loc.type === 'HQ');

  // Automatically select default HQ location if available
  React.useEffect(() => {
    // If fromLocationId is invalid, reset it
    const isValidFrom = hqLocations.some(l => l.id === fromLocationId);
    if (hqLocations.length > 0 && (!fromLocationId || !isValidFrom)) {
      setFromLocationId(hqLocations[0].id);
    }
    
    // Clear selections if invalid
    if (toBranchId && !branchLocations.some(l => l.id === toBranchId)) setToBranchId('');
    if (selectedItemId && !items.some(i => i.id === selectedItemId)) setSelectedItemId('');

    if (!officerName && userDisplayName) {
      setOfficerName(userDisplayName);
    }
  }, [hqLocations, branchLocations, items, fromLocationId, toBranchId, selectedItemId, userDisplayName]);

  // File Validation Handler (Strict Security Rules: PDF/JPG/PNG & Max 5MB)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileValidationError(null);
    const file = e.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. Strict File Type Validation (MIME type & extension check)
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

    const isMimeValid = allowedMimeTypes.includes(file.type.toLowerCase());
    const isExtValid = allowedExtensions.includes(fileExtension);

    if (!isMimeValid || !isExtValid) {
      setFileValidationError('ប្រភេទឯកសារមិនត្រឹមត្រូវ! អនុញ្ញាតតែប្រភេទ PDF, JPG, ឬ PNG ប៉ុណ្ណោះ (Invalid format)');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    // 2. Strict File Size Validation (Max 5MB = 5 * 1024 * 1024 bytes)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Megabytes
    if (file.size > MAX_SIZE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setFileValidationError(`ទំហំឯកសារធំពេក (${fileSizeMB} MB)! ទំហំអតិបរមាអនុញ្ញាតត្រឹមតែ 5MB ប៉ុណ្ណោះ (Max size 5MB)`);
      setSelectedFile(null);
      e.target.value = '';
      return;
    }

    // File passed security checks
    setSelectedFile(file);
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setFileValidationError(null);
  };

  // Submit Handover Request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitSuccess(false);
    setSubmitError(null);
    setUploadedDocUrl(null);

    // 1. Authorization Gate Check
    if (!isCentralAdmin) {
      setSubmitError('បរាជ័យ! អ្នកប្រើប្រាស់ជាប្រភេទ BranchUser គ្មានសិទ្ធិអនុវត្តប្រតិបត្តិការផ្ទេរស្តុកទេ (CentralAdmin Only)');
      return;
    }

    // 2. Form Inputs Validation
    if (!fromLocationId || !toBranchId || !selectedItemId || !quantity || Number(quantity) <= 0) {
      setSubmitError('សូមបំពេញព័ត៌មានចាំបាច់ទាំងអស់ឱ្យបានត្រឹមត្រូវ!');
      return;
    }

    if (fromLocationId === toBranchId) {
      setSubmitError('ទីតាំងដើម និងទីតាំងគោលដៅ មិនអាចដូចគ្នាបានទេ!');
      return;
    }

    setLoading(true);

    let docPublicUrl: string | null = null;

    try {
      // 3. Upload Document to Supabase Storage Bucket "handover_docs"
      if (selectedFile) {
        setUploadProgress('កំពុងរក្សាទុកឯកសារយោងក្នុង Supabase Storage...');

        if (isSupabaseConfigured()) {
          // Sanitize filename & add timestamp prefix to avoid collisions
          const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const filePath = `handovers/${Date.now()}_${sanitizedFileName}`;

          const { error: uploadErr } = await supabase.storage
            .from('handover_docs')
            .upload(filePath, selectedFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadErr) {
            console.warn('Storage Upload Error:', uploadErr);
            throw new Error(`បរាជ័យក្នុងការ Upload ឯកសារទៅកាន់ Storage: ${uploadErr.message}`);
          }

          // Get Public URL of the uploaded document
          const { data: publicUrlData } = supabase.storage
            .from('handover_docs')
            .getPublicUrl(filePath);

          docPublicUrl = publicUrlData?.publicUrl || null;
        } else {
          // Demo Mode Fallback URL
          docPublicUrl = `https://supabase.gdt.gov.kh/storage/v1/object/public/handover_docs/demo_${selectedFile.name}`;
        }
      }

      setUploadProgress('កំពុងប្រពន្ធ័ប្រតិបត្តិការ Atomic RPC Transaction...');

      // Combine remark with Document URL
      const finalRemark = docPublicUrl
        ? `${purpose.trim()} | ឯកសារយោង: ${docPublicUrl}`
        : purpose.trim();

      // 4. Call Supabase Atomic Transaction RPC "handle_branch_handover"
      if (isSupabaseConfigured()) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('handle_branch_handover', {
          p_from_location: fromLocationId,
          p_to_location: toBranchId,
          p_item_id: selectedItemId,
          p_quantity: Number(quantity),
          p_recorded_by: officerName || userDisplayName || 'CentralAdmin',
          p_remark: finalRemark
        });

        if (rpcError) {
          throw new Error(`RPC Execution Error: ${rpcError.message}`);
        }
      } else {
        // Fallback for Local Demo State updates
        const sourceIndex = mockInventory.findIndex(
          inv => inv.item_id === selectedItemId && inv.location_id === fromLocationId
        );

        if (sourceIndex < 0 || mockInventory[sourceIndex].quantity < Number(quantity)) {
          throw new Error('បរិមាណស្តុកនៅទីតាំងដើមមិនគ្រប់គ្រាន់សម្រាប់ផ្ទេរទេ!');
        }

        // Deduct source stock
        mockInventory[sourceIndex].quantity -= Number(quantity);
        mockInventory[sourceIndex].last_updated = new Date().toISOString();

        // Add target stock
        const targetIndex = mockInventory.findIndex(
          inv => inv.item_id === selectedItemId && inv.location_id === toBranchId
        );

        if (targetIndex >= 0) {
          mockInventory[targetIndex].quantity += Number(quantity);
          mockInventory[targetIndex].last_updated = new Date().toISOString();
        } else {
          const itemObj = mockItems.find(i => i.id === selectedItemId);
          const locObj = mockLocations.find(l => l.id === toBranchId);
          if (itemObj) {
            mockInventory.push({
              location_id: toBranchId,
              item_id: selectedItemId,
              quantity: Number(quantity),
              last_updated: new Date().toISOString(),
              item_code: itemObj.code,
              item_name_kh: itemObj.name_kh,
              item_name_en: itemObj.name_en,
              category: itemObj.category,
              unit: itemObj.unit,
              location_name_kh: locObj?.name_kh || '',
              location_name_en: locObj?.name_en || ''
            });
          }
        }

        // Add Transaction record
        const fromLoc = mockLocations.find(l => l.id === fromLocationId);
        const toLoc = mockLocations.find(l => l.id === toBranchId);
        mockTransactions.unshift({
          id: `tx-${Date.now()}`,
          date: new Date().toISOString(),
          type: 'HANDOVER',
          from_location: fromLoc?.name_kh || 'HQ',
          to_location: toLoc?.name_kh || 'Branch',
          item_code: selectedItem?.code || '',
          item_name_kh: selectedItem?.name_kh || '',
          quantity: Number(quantity),
          unit: selectedItem?.unit || 'គ្រឿង',
          recorded_by: officerName || userDisplayName,
          remark: finalRemark
        });
      }

      setSubmitSuccess(true);
      setUploadedDocUrl(docPublicUrl);

      // Reset Form fields
      setSelectedItemId('');
      setQuantity('');
      setPurpose('');
      setSelectedFile(null);

    } catch (err: any) {
      console.error('Handover submit error:', err);
      setSubmitError(err.message || 'មានបញ្ហាបរាជ័យក្នុងការអនុវត្តប្រតិបត្តិការផ្ទេរស្តុក!');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden max-w-4xl mx-auto w-full font-siemreap">
      
      {/* CentralAdmin Authorization Check Banner */}
      {!isCentralAdmin && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950 p-4 flex items-center gap-3">
          <ShieldAlert size={22} className="text-amber-700 shrink-0" />
          <div className="text-xs">
            <span className="font-extrabold uppercase text-amber-900">ការកំណត់សិទ្ធិ (Role Restriction): </span>
            គណនីរបស់អ្នកជាប្រភេទ <span className="font-bold underline">{userRole}</span>។ មូលងារផ្ទេរសម្ភារៈ (Handover) ត្រូវបានកម្រិតសម្រាប់តែ <span className="font-bold text-emerald-800">CentralAdmin</span> ប៉ុណ្ណោះ។
          </div>
        </div>
      )}

      {/* Success Banner */}
      {submitSuccess && (
        <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-900 p-4 flex items-start justify-between shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-200 p-1.5 rounded-full text-emerald-800 mt-0.5">
              <Check size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-emerald-950">ប្រតិបត្តិការប្រគល់-ទទួល ជោគជ័យ (Handover Complete)</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                ប្រព័ន្ធបានអនុវត្ត Atomic RPC Transaction និងបានកាត់/បូកស្តុកដោយជោគជ័យ។
              </p>
              {uploadedDocUrl && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-900 px-3 py-1 rounded-lg text-xs font-semibold shadow-2xs">
                  <FileText size={14} className="text-emerald-700" />
                  <span>ឯកសារយោង Supabase Storage:</span>
                  <a 
                    href={uploadedDocUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-700 underline font-mono flex items-center gap-1 hover:text-blue-900 ml-1"
                  >
                    <span>មើលឯកសារ (View Doc)</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="text-emerald-700 hover:text-emerald-950 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Error Banner */}
      {submitError && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-900 p-4 flex items-start justify-between shadow-xs animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="bg-rose-200 p-1.5 rounded-full text-rose-800 mt-0.5">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-rose-950">បរាជ័យក្នុងការផ្ទេរស្តុក!</h3>
              <p className="text-xs text-rose-800 mt-0.5">{submitError}</p>
            </div>
          </div>
          <button onClick={() => setSubmitError(null)} className="text-rose-700 hover:text-rose-950 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200/80 px-6 py-4 flex items-center justify-between bg-slate-50/90">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-2.5 rounded-xl border border-blue-200 text-blue-800">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.handoverStock}</h2>
            <p className="text-xs text-slate-500 font-medium">
              ផ្ទេរស្តុកសម្ភារបច្ចេកទេសពីស្តុកកណ្តាល (HQ) ទៅកាន់សាខាពន្ធដារ និង Upload ឯកសារយោង
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
          isCentralAdmin 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {isCentralAdmin ? <ShieldCheck size={14} /> : <Building2 size={14} />}
          <span>{userRole}</span>
        </div>
      </div>
      
      {/* Main Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-white">
          
          {/* Left Column: Locations & Items */}
          <div className="space-y-4">
            
            {/* Source & Destination Locations */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  {t.fromLocation} <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={fromLocationId}
                  onChange={(e) => setFromLocationId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" 
                  required
                  disabled={!isCentralAdmin}
                >
                  {hqLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {language === 'kh' ? loc.name_kh : loc.name_en}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  {t.toBranch} <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" 
                  required
                  disabled={!isCentralAdmin}
                >
                  <option value="">-- ជ្រើសរើសសាខា --</option>
                  {branchLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {language === 'kh' ? loc.name_kh : loc.name_en}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Select Item SKU */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                {t.selectItem} <span className="text-rose-500">*</span>
              </label>
              <select 
                value={selectedItemId} 
                onChange={(e) => setSelectedItemId(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" 
                required
                disabled={!isCentralAdmin}
              >
                <option value="">-- {t.selectItem} --</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    [{item.code}] {language === 'kh' ? item.name_kh : item.name_en}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  {t.quantity} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="number" 
                  min="1" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" 
                  required 
                  disabled={!isCentralAdmin}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">{t.unit}</label>
                <input 
                  type="text" 
                  disabled 
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-600" 
                  value={selectedItem?.unit || 'ឯកតា'} 
                />
              </div>
            </div>

            {/* Officer Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                {t.officerName} (មន្ត្រីទទួលខុសត្រូវ) <span className="text-rose-500">*</span>
              </label>
              <input 
                type="text" 
                value={officerName}
                onChange={(e) => setOfficerName(e.target.value)}
                placeholder="ឈ្មោះមន្ត្រីប្រគល់-ទទួល"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700" 
                required 
                disabled={!isCentralAdmin}
              />
            </div>

          </div>

          {/* Right Column: Remark & Secure Document Upload */}
          <div className="space-y-4">
            
            {/* Purpose / Remark */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                {t.purpose} / កំណត់សម្គាល់ <span className="text-rose-500">*</span>
              </label>
              <textarea 
                rows={3} 
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="បញ្ជាក់មូលហេតុ ឬលេខលិខិតអមនៃការផ្ទេរសម្ភារៈ..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-700/20 focus:border-blue-700 resize-none" 
                required
                disabled={!isCentralAdmin}
              ></textarea>
            </div>

            {/* Secure File Upload Box (Supabase Storage: handover_docs) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase flex items-center justify-between">
                <span>ឯកសារយោងភ្ជាប់ (Supporting Document)</span>
                <span className="text-[10px] font-mono text-slate-400 font-bold">PDF, JPG, PNG (&le; 5MB)</span>
              </label>

              {/* Upload Dropzone Container */}
              {!selectedFile ? (
                <div className="border-2 border-dashed border-slate-200 hover:border-teal-500 bg-slate-50 hover:bg-teal-50/30 transition-all rounded-2xl p-4 text-center cursor-pointer group relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={handleFileChange}
                    disabled={!isCentralAdmin}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1.5 py-1">
                    <div className="p-2 bg-white rounded-xl shadow-2xs border border-slate-200 group-hover:scale-110 transition-transform">
                      <UploadCloud size={24} className="text-teal-700" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">
                        ចុចជ្រើសរើសឯកសារ ឬ ទម្លាក់ឯកសារនៅទីនេះ
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-0.5">
                        ឯកសារលិខិតផ្ទេរស្តុកផ្លូវការ (PDF, JPG, PNG ត្រឹមតែ 5MB)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* File Selected Card Preview */
                <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-teal-600 text-white rounded-xl shrink-0">
                      <FileCheck2 size={20} />
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-teal-950 truncate">{selectedFile.name}</div>
                      <div className="text-[10px] font-mono text-teal-700 font-bold">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Document'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeSelectedFile}
                    className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors shrink-0"
                    title="លុបឯកសារ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              {/* Validation Warning Alert */}
              {fileValidationError && (
                <div className="mt-2 bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <div>{fileValidationError}</div>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {uploadProgress ? (
              <span className="text-teal-700 font-bold flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-teal-600 animate-ping"></span>
                {uploadProgress}
              </span>
            ) : (
              <span>🔒 ការផ្ទេរស្តុកនឹងកត់ត្រា Atomic Transaction និង Upload ឯកសារទៅ Supabase Storage</span>
            )}
          </div>

          <div className="flex space-x-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => {
                setSelectedItemId('');
                setQuantity('');
                setPurpose('');
                setSelectedFile(null);
                setSubmitError(null);
              }}
              className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-bold hover:bg-white transition-colors w-1/2 sm:w-auto text-slate-700"
            >
              បោះបង់ (Cancel)
            </button>
            
            <button 
              type="submit" 
              disabled={loading || !isCentralAdmin}
              className="px-7 py-2.5 bg-[#03291E] hover:bg-[#1E6047] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-1/2 sm:w-auto"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>កំពុងផ្ទេរស្តុក...</span>
                </>
              ) : (
                <span>{t.confirmHandover}</span>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
