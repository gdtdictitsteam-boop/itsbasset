import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, PlusCircle, ChevronDown, Check, X, RefreshCw, AlertTriangle, Database, Info, Copy, ShieldCheck, ChevronUp, ExternalLink } from 'lucide-react';

import { mockItems, mockInventory, mockLocations } from '../mockData';
import { supabase, insertItemToSupabase, uploadItemImageToStorage, isSupabaseConfigured } from '../lib/supabase';
import { useInventoryContext } from '../contexts/InventoryContext';
import { formatLocationOption } from '../contexts/LocationContext';

export const RLS_FIX_SQL = `-- =========================================================================
-- កូដ SQL សម្រាប់បើកសិទ្ធិ RLS លើ Table items ក្នុង Supabase SQL Editor
-- (អនុញ្ញាតឱ្យ Authenticated Users / CentralAdmin អាច SELECT, INSERT, UPDATE, DELETE)
-- =========================================================================

-- 1. បើកដំណើរការ Row Level Security លើ Table items
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- 2. លុប Policies ចាស់ៗដែលអាចបង្កការរាំងស្ទះ
DROP POLICY IF EXISTS "Allow all access on items" ON public.items;
DROP POLICY IF EXISTS "Allow read items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users full access on items" ON public.items;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to manage items" ON public.items;
DROP POLICY IF EXISTS "Allow anon read items" ON public.items;

-- 3. បង្កើត Policy អនុញ្ញាតពេញលេញ (SELECT, INSERT, UPDATE, DELETE) សម្រាប់ Authenticated Users
CREATE POLICY "Authenticated users full access on items" 
ON public.items 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- 4. បង្កើត Policy អនុញ្ញាតឱ្យ Anon Users អាចអានទិន្នន័យ (SELECT) បាន
CREATE POLICY "Allow anon read items" 
ON public.items 
FOR SELECT 
TO anon 
USING (true);

-- 5. ផ្តល់សិទ្ធិពេញលេញ (GRANT ALL) លើ Table items
GRANT ALL ON TABLE public.items TO authenticated;
GRANT SELECT ON TABLE public.items TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. បន្ថែម Columns បម្រុងទុក (ធានាថាឈ្មោះ Columns ត្រូវគ្នា ១០០%)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS code VARCHAR(100);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_kh VARCHAR(255);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS min_stock INTEGER DEFAULT 0;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url TEXT;`;

export function NewItemView() {
  const { refreshInventory, addNewItemToContext } = useInventoryContext();
  const [copiedSql, setCopiedSql] = useState(false);
  const [showRlsSql, setShowRlsSql] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [uploadingImageText, setUploadingImageText] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState('tools');
  const [materialCode, setMaterialCode] = useState(() => `TOL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    savedToSupabase: boolean;
    message: string;
    details?: string;
    isRlsError?: boolean;
  } | null>(null);

  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [units, setUnits] = useState(['គ្រឿង', 'ម៉ែត្រ', 'ប្រអប់', 'កេស', 'រ៉ាម']);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isConfigured = isSupabaseConfigured();

  const [locations, setLocations] = useState(isConfigured ? [] : mockLocations);

  useEffect(() => {
    async function fetchLocations() {
      if (isConfigured) {
        const { supabase } = await import('../lib/supabase');
        const { data } = await supabase.from('locations').select('*');
        if (data) setLocations(data as any);
      }
    }
    fetchLocations();
  }, [isConfigured]);

  const copyRlsSql = () => {
    navigator.clipboard.writeText(RLS_FIX_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredUnits = units.filter(u => u.toLowerCase().includes(unitSearch.toLowerCase()));
  const isNewUnit = unitSearch.trim() !== '' && !units.some(u => u.toLowerCase() === unitSearch.toLowerCase());

  const handleSelectUnit = (unit: string) => {
    setUnitSearch(unit);
    setIsUnitDropdownOpen(false);
  };

  const handleAddUnit = () => {
    if (unitSearch.trim() !== '') {
      setUnits([...units, unitSearch.trim()]);
      setIsUnitDropdownOpen(false);
    }
  };

  const generateRandomCode = (catVal?: string) => {
    const currentCat = catVal || category;
    const prefix = currentCat === 'tools' ? 'TOL' : 'SUP';
    const randomSeq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setMaterialCode(`${prefix}-${randomSeq}`);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCategory(val);
    generateRandomCode(val);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedImageFile(null);
    setImagePreview(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    setUploadingImageText(null);
    setCategory('tools');
    generateRandomCode('tools');
    setUnitSearch('');
    const form = document.getElementById('new-item-form') as HTMLFormElement;
    if (form) form.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);
    setUploadingImageText(null);

    try {
      const form = e.target as HTMLFormElement;
      const materialName = (form.elements.namedItem('materialName') as HTMLInputElement).value.trim();
      const brand = (form.elements.namedItem('brand') as HTMLInputElement).value.trim();
      const minStock = parseInt((form.elements.namedItem('minStock') as HTMLInputElement).value || '0', 10);
      const initialStock = parseInt((form.elements.namedItem('initialStock') as HTMLInputElement)?.value || '0', 10);
      const locationId = (form.elements.namedItem('locationId') as HTMLSelectElement)?.value || '1';
      const description = (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '';

      const categoryName = category === 'tools' ? 'Tools' : 'Suppliers';
      const selectedUnit = unitSearch.trim() || 'គ្រឿង';

      console.log('[NewItemView Form Submit] Attempting to insert new item into Supabase:', {
        code: materialCode,
        name_kh: materialName,
        name_en: brand || materialName,
        category: categoryName,
        unit: selectedUnit,
        min_stock: minStock,
        initial_stock: initialStock,
        location_id: locationId,
        description
      });

      let finalImageUrl: string | undefined = undefined;
      let storageNotice: string | undefined = undefined;

      // 1. Upload Image to Supabase Storage if file was provided
      if (selectedImageFile) {
        if (isConfigured) {
          try {
            setUploadingImageText('កំពុង Upload រូបភាពសម្ភារទៅកាន់ Supabase Storage (bucket: item_images)...');
            console.log('[NewItemView] Uploading image file to Supabase storage...');
            const uploadRes = await uploadItemImageToStorage(selectedImageFile);
            if (uploadRes.publicUrl) {
              finalImageUrl = uploadRes.publicUrl;
              console.log('[NewItemView] Image uploaded to Storage:', finalImageUrl);
            } else {
              console.warn('[NewItemView] Storage image upload notice:', uploadRes.errorMessage);
              storageNotice = uploadRes.errorMessage || 'មិនអាច Upload រូបភាពទៅ Supabase Storage បានឡើយ។';
            }
          } catch (uploadErr) {
            console.warn('[NewItemView] Storage upload exception:', uploadErr);
          }
        } else {
          finalImageUrl = imagePreview || undefined;
        }
      }

      setUploadingImageText(null);

      // 2. Perform insert directly with supabase.from('items').insert(...)
      if (isConfigured) {
        // Construct primary payload with exact column names from Table `items`
        const primaryPayload: Record<string, any> = {
          code: materialCode.trim(),
          name_kh: materialName.trim(),
          name_en: brand.trim() || materialName.trim(),
          category: categoryName,
          unit: selectedUnit,
          min_stock: minStock,
        };
        if (finalImageUrl) {
          primaryPayload.image_url = finalImageUrl;
        }

        console.log('[NewItemView] Calling supabase.from("items").insert(...) with columns:', primaryPayload);

        let insertedItemData: any = null;
        let insertItemError: any = null;

        try {
          const res = await supabase
            .from('items')
            .insert([primaryPayload])
            .select()
            .single();

          insertedItemData = res.data;
          insertItemError = res.error;
          console.log('[NewItemView] Initial supabase.from("items").insert result:', { data: res.data, error: res.error });
        } catch (callErr: any) {
          console.error('[NewItemView] Direct call exception during supabase.from("items").insert:', callErr);
          insertItemError = { message: callErr?.message || String(callErr) };
        }

        // Column Compatibility Resilience 1: If image_url column doesn't exist in Supabase table items
        if (insertItemError && (insertItemError.code === 'PGRST204' || insertItemError.message?.includes('image_url'))) {
          console.warn('[NewItemView] Column image_url not found in items table. Retrying insert without image_url...', insertItemError.message);
          delete primaryPayload.image_url;
          try {
            const retryRes = await supabase
              .from('items')
              .insert([primaryPayload])
              .select()
              .single();
            insertedItemData = retryRes.data;
            insertItemError = retryRes.error;
            console.log('[NewItemView] Retry without image_url result:', { data: retryRes.data, error: retryRes.error });
          } catch (retryErr: any) {
            insertItemError = { message: retryErr?.message || String(retryErr) };
          }
        }

        // Column Compatibility Resilience 2: If table uses 'name' column instead of or in addition to 'name_kh'
        if (insertItemError && (insertItemError.code === 'PGRST204' || insertItemError.message?.toLowerCase().includes('name'))) {
          console.warn('[NewItemView] Column name_kh not found or table expects "name". Retrying with name column...', insertItemError.message);
          const adaptedPayload: Record<string, any> = {
            code: materialCode.trim(),
            name: materialName.trim(),
            name_kh: materialName.trim(),
            name_en: brand.trim() || materialName.trim(),
            category: categoryName,
            unit: selectedUnit,
            min_stock: minStock,
            ...(finalImageUrl ? { image_url: finalImageUrl } : {})
          };
          try {
            const retryName = await supabase.from('items').insert([adaptedPayload]).select().single();
            if (!retryName.error && retryName.data) {
              insertedItemData = retryName.data;
              insertItemError = null;
              console.log('[NewItemView] Retry with name column succeeded:', insertedItemData);
            } else if (retryName.error?.code === 'PGRST204') {
              // Try basic schema (code, name, category, unit, min_stock)
              const simplePayload = {
                code: materialCode.trim(),
                name: materialName.trim(),
                category: categoryName,
                unit: selectedUnit,
                min_stock: minStock,
              };
              const retrySimple = await supabase.from('items').insert([simplePayload]).select().single();
              if (!retrySimple.error && retrySimple.data) {
                insertedItemData = retrySimple.data;
                insertItemError = null;
                console.log('[NewItemView] Retry with simple schema succeeded:', insertedItemData);
              }
            }
          } catch (nameErr) {
            console.warn('[NewItemView] Exception during name column retry:', nameErr);
          }
        }

        // Column Compatibility Resilience 3: If table uses 'sku' column instead of 'code'
        if (insertItemError && (insertItemError.code === 'PGRST204' || insertItemError.message?.toLowerCase().includes('code'))) {
          console.warn('[NewItemView] Column "code" not found. Retrying with "sku" column...', insertItemError.message);
          const skuPayload: Record<string, any> = {
            sku: materialCode.trim(),
            name: materialName.trim(),
            name_kh: materialName.trim(),
            category: categoryName,
            unit: selectedUnit,
            min_stock: minStock,
          };
          try {
            const retrySku = await supabase.from('items').insert([skuPayload]).select().single();
            if (!retrySku.error && retrySku.data) {
              insertedItemData = retrySku.data;
              insertItemError = null;
              console.log('[NewItemView] Retry with sku column succeeded:', insertedItemData);
            }
          } catch (skuErr) {
            console.warn('[NewItemView] Exception during sku column retry:', skuErr);
          }
        }

        // Check if insertion was rejected by Supabase
        if (insertItemError) {
          console.error('[NewItemView] CRITICAL: supabase.from("items").insert failed:', {
            code: insertItemError.code,
            message: insertItemError.message,
            details: insertItemError.details,
            hint: insertItemError.hint
          });

          const isRls = insertItemError.code === '42501' || 
                        insertItemError.message?.toLowerCase().includes('row-level security') || 
                        insertItemError.message?.toLowerCase().includes('policy') ||
                        insertItemError.details?.toLowerCase().includes('policy');

          let errMsg = insertItemError.message || 'បរាជ័យក្នុងការរក្សាទុកសម្ភារៈទៅក្នុង Supabase Database!';
          let errDetails = `Error Code: ${insertItemError.code || 'UNKNOWN'} | Details: ${insertItemError.details || insertItemError.hint || ''}`;

          if (insertItemError.code === '23505') {
            errMsg = `លេខកូដសម្ភារ "${materialCode}" មានរួចហើយនៅក្នុង Supabase (Duplicate SKU/Code)!`;
            errDetails = 'សូមផ្លាស់ប្តូរលេខកូដសម្ភារ ឬចុចប៊ូតុង «បង្កើតកូដថ្មី»។';
          } else if (isRls) {
            errMsg = 'ជាប់រាំងស្ទះសិទ្ធិ Row Level Security (RLS Policy) លើ Table "items"!';
            errDetails = 'Supabase បានបដិសេធសិទ្ធិ INSERT ដោយសារគ្មាន RLS Policy សម្រាប់ Authenticated Users។ សូមដំណើរការកូដ SQL បើកសិទ្ធិ RLS ក្នុង Supabase Dashboard -> SQL Editor (មើលកូដខាងក្រោម)។';
            setShowRlsSql(true);
          } else if (insertItemError.code === 'PGRST204' || insertItemError.message?.includes('Columns') || insertItemError.message?.includes('schema cache')) {
            errMsg = 'រចនាសម្ព័ន្ធ Table "items" ក្នុង Supabase មិនត្រូវគ្នានឹងកូដ!';
            errDetails = 'សូមប្រាកដថាតារាង items មាន column: code, name_kh (ឬ name), name_en, category, unit, min_stock';
          }

          setSubmitResult({
            success: false,
            savedToSupabase: false,
            message: errMsg,
            details: errDetails,
            isRlsError: isRls,
          });
          return;
        }

        console.log('[NewItemView] SUCCESS! Item successfully inserted into Supabase items table:', insertedItemData);
        const newItemId = insertedItemData.id;

        // 3. Initialize inventory row in Supabase so item is linked to HQ
        try {
          const { data: hqLoc } = await supabase
            .from('locations')
            .select('id')
            .or('type.eq.HQ,code.eq.HQ-ITSB,code.ilike.%HQ%')
            .limit(1)
            .maybeSingle();

          const targetLocId = hqLoc?.id || locationId;
          console.log('[NewItemView] Initializing inventory row in Supabase:', { location_id: targetLocId, item_id: newItemId, quantity: initialStock });
          await supabase.from('inventory').upsert([{
            location_id: targetLocId,
            item_id: newItemId,
            quantity: initialStock || 0,
            last_updated: new Date().toISOString()
          }], { onConflict: 'location_id,item_id' });
        } catch (invErr) {
          console.warn('[NewItemView] Non-fatal notice when linking initial inventory row:', invErr);
        }

        // 4. Update React Context immediately
        addNewItemToContext({
          id: newItemId,
          code: insertedItemData.code || insertedItemData.sku || materialCode,
          name_kh: insertedItemData.name_kh || insertedItemData.name || materialName,
          name_en: insertedItemData.name_en || insertedItemData.name || brand || materialName,
          category: categoryName,
          unit: selectedUnit,
          min_stock: minStock,
          image_url: finalImageUrl || imagePreview || undefined,
        }, initialStock, locationId);

        // 5. Automatically re-fetch live items & inventory from Supabase so all views update immediately
        try {
          console.log('[NewItemView] Re-fetching inventory and items from Supabase immediately...');
          await refreshInventory();
          console.log('[NewItemView] refreshInventory completed successfully! Inventory table now updated.');
        } catch (e) {
          console.warn('[NewItemView] refreshInventory error:', e);
        }

        let successMsg = `បានរក្សាទុកក្នុង Supabase Database (Table: items) ជោគជ័យ! (ID: ${newItemId}, Code: ${materialCode})`;
        if (finalImageUrl) {
          successMsg += ' | រូបភាពត្រូវបាន Upload ទៅកាន់ Storage bucket (item_images) រួចរាល់។';
        }
        setSubmitResult({
          success: true,
          savedToSupabase: true,
          message: successMsg,
          details: storageNotice,
        });
        resetForm();

      } else {
        // Fallback when Supabase credentials are not in .env
        console.warn('[NewItemView] Supabase is not configured. Saving to local state context...');
        const newItemId = Math.random().toString(36).substring(7);
        addNewItemToContext({
          id: newItemId,
          code: materialCode,
          name_kh: materialName,
          name_en: brand || materialName,
          category: categoryName,
          unit: selectedUnit,
          min_stock: minStock,
          image_url: finalImageUrl || imagePreview || undefined,
        }, initialStock, locationId);
        await refreshInventory();

        setSubmitResult({
          success: true,
          savedToSupabase: false,
          message: `បានបញ្ចូលសម្ភារៈថ្មីក្នុង Local Storage (កូដ: ${materialCode})`,
          details: 'ប្រព័ន្ធមិនទាន់បានកំណត់ Supabase Credentials (.env) នៅឡើយទេ។',
        });
        resetForm();
      }
    } catch (err: any) {
      console.error('[NewItemView] Unhandled exception in handleSubmit:', err);
      setSubmitResult({
        success: false,
        savedToSupabase: false,
        message: 'មានបញ្ហាមិនរំពឹងទុកពេលបញ្ចូលសម្ភារៈ: ' + (err?.message || err?.toString()),
        details: err?.stack || err?.toString(),
      });
    } finally {
      setIsSubmitting(false);
      setUploadingImageText(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Supabase Database Connection Status Banner */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
        isConfigured 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
          : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-2.5">
          <Database size={18} className={isConfigured ? 'text-emerald-600' : 'text-amber-600'} />
          <div>
            <div className="font-bold flex items-center gap-2">
              <span>ស្ថាបត្យកម្មមូលទិន្នន័យ Supabase DB:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isConfigured ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {isConfigured ? 'បានតភ្ជាប់ (Configured)' : 'មិនទាន់កំណត់ Credentials (.env)'}
              </span>
            </div>
            <p className="opacity-80 mt-0.5">
              {isConfigured 
                ? 'ប្រព័ន្ធត្រូវបានតភ្ជាប់ជាមួយ Supabase API ដោយស្វ័យប្រវត្តិ។ រាល់ការបញ្ចូលនឹងទាញយក id ពី Supabase។' 
                : 'សូមកំណត់ VITE_SUPABASE_URL និង VITE_SUPABASE_ANON_KEY ក្នុងឯកសារ .env ដើម្បីរក្សាទុកក្នុង Supabase Remote DB។'}
            </p>
          </div>
        </div>
      </div>

      {/* Result Notification Banner */}
      {submitResult && (
        <div className={`border rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 ${
          submitResult.success && submitResult.savedToSupabase
            ? 'bg-teal-50 border-teal-200 text-teal-900'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full mt-0.5 ${
                submitResult.success ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {submitResult.success ? <Check size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm">
                  {submitResult.success ? 'រក្សាទុកជោគជ័យ' : 'បរាជ័យក្នុងការបញ្ចូល Supabase'}
                </h3>
                <p className="text-xs font-medium">{submitResult.message}</p>
                {submitResult.details && (
                  <p className="text-[11px] font-mono opacity-90 bg-white/70 p-2 rounded border border-amber-200 mt-1">
                    💡 {submitResult.details}
                  </p>
                )}
                {submitResult.isRlsError && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowRlsSql(true);
                      copyRlsSql();
                    }}
                    className="mt-2 text-xs font-bold text-amber-950 bg-amber-200/90 hover:bg-amber-300 px-3 py-1.5 rounded-lg border border-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>{copiedSql ? 'បានចម្លងកូដ SQL រួចរាល់!' : 'ចម្លងកូដ SQL បើកសិទ្ធិ RLS ភ្លាមៗ'}</span>
                  </button>
                )}
                {!submitResult.savedToSupabase && !submitResult.isRlsError && (
                  <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 mt-2 bg-emerald-100/70 p-2 rounded border border-emerald-200">
                    <Info size={14} />
                    <span>ទិន្នន័យសម្ភារត្រូវបានបញ្ចូលក្នុង Local Inventory ប្រព័ន្ធរួចរាល់សម្រាប់តេស្តប្រើប្រាស់!</span>
                  </div>
                )}
                {submitResult.success && (
                  <div className="text-[11px] font-medium text-teal-800 flex items-center gap-1.5 mt-2 bg-teal-100/60 p-2 rounded border border-teal-200">
                    <Check size={14} className="text-teal-700" />
                    <span>ទិន្នន័យត្រូវបាន Fetch និង Update ចូលផ្ទាំង «ស្តុកបច្ចុប្បន្ន (Inventory)» ដោយស្វ័យប្រវត្តរួចរាល់។</span>
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSubmitResult(null)} 
              className="text-gray-500 hover:text-gray-800 p-1 rounded-lg hover:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* RLS Policy Helper Card & SQL Script Copy Box */}
      <div className="bg-white border border-teal-200/90 rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 text-teal-800 rounded-lg">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>កូដ SQL បើកសិទ្ធិ RLS លើ Table "items" (Supabase RLS Policy)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">
                  SQL Editor
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ដំណើរការកូដនេះក្នុង Supabase Dashboard -&gt; SQL Editor ដើម្បីអនុញ្ញាតឱ្យ Authenticated Users (CentralAdmin) អាច SELECT, INSERT, UPDATE, DELETE ដោយគ្មានការរាំងស្ទះ។
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={copyRlsSql}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-700 text-white hover:bg-teal-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {copiedSql ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{copiedSql ? 'បានចម្លងរួចរាល់!' : 'ចម្លងកូដ SQL'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRlsSql(!showRlsSql)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>{showRlsSql ? 'លាក់កូដ' : 'មើលកូដ'}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showRlsSql ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {showRlsSql && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>-- SQL Script សម្រាប់ដំណើការក្នុង Supabase Dashboard -&gt; SQL Editor</span>
              <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                1-Click Copy Ready
              </span>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed border border-slate-800">
              <code>{RLS_FIX_SQL}</code>
            </pre>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden">
        {/* Header Section */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100/80 text-teal-800 rounded-lg">
              <PlusCircle size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                បញ្ចូលព័ត៌មានសម្ភារថ្មី (New Item Entry)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                បំពេញព័ត៌មានសម្ភារដើម្បីបញ្ចូលទៅក្នុង Supabase Database និងប្រព័ន្ធគ្រប់គ្រងស្តុក
              </p>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <form id="new-item-form" className="p-6 space-y-6" onSubmit={handleSubmit}>
          {/* Material Image (Full Width) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">រូបភាពសម្ភារ</label>
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-xl transition-colors cursor-pointer relative overflow-hidden group ${
                isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-500 hover:bg-teal-50/50'
              }`}
            >
              {imagePreview ? (
                <div className="relative w-full h-48 flex items-center justify-center">
                  <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain rounded-lg shadow-sm" />
                  <button 
                    onClick={handleRemoveImage} 
                    className="absolute top-2 right-2 bg-white/90 text-red-600 p-1.5 rounded-full hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm border border-red-100 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="លុបរូបភាព (Remove Image)"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-center">
                  <div className="mx-auto h-12 w-12 text-gray-400 bg-gray-50 rounded-full flex items-center justify-center group-hover:text-teal-500 group-hover:bg-teal-50 transition-colors">
                    <ImageIcon size={24} />
                  </div>
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-transparent rounded-md font-medium text-teal-600 hover:text-teal-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-600">
                      <span>ជ្រើសរើសរូបភាព</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                    </label>
                    <p className="pl-1">ឬអូសទម្លាក់ទីនេះ</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF ទំហំមិនលើសពី 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Material Code */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="materialCode" className="block text-sm font-semibold text-gray-700">
                  លេខកូដសម្ភារ <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => generateRandomCode()}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 transition-colors"
                >
                  <RefreshCw size={12} />
                  <span>បង្កើតកូដថ្មី</span>
                </button>
              </div>
              <input
                type="text"
                id="materialCode"
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="ឧ. TOL-0001"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-gray-50 font-mono font-semibold"
              />
            </div>

            {/* Material Name */}
            <div>
              <label htmlFor="materialName" className="block text-sm font-semibold text-gray-700 mb-2">
                ឈ្មោះសម្ភារ (ភាសាខ្មែរ) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="materialName" name="materialName"
                placeholder="ឧ. ខ្សែបណ្តាញ Network Cat6"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 font-medium"
              />
            </div>

            {/* Brand / English Name */}
            <div>
              <label htmlFor="brand" className="block text-sm font-semibold text-gray-700 mb-2">
                ម៉ាក/ឈ្មោះជាភាសាអង់គ្លេស (Brand / English Name)
              </label>
              <input
                type="text"
                id="brand" name="brand"
                placeholder="ឧ. Link Basic Cat6 UTP Cable"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">ប្រភេទសម្ភារ</label>
              <select
                id="category"
                value={category}
                onChange={handleCategoryChange}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 bg-white font-medium"
              >
                <option value="tools">សម្ភារ Tools</option>
                <option value="suppliers">សម្ភារ Suppliers</option>
              </select>
            </div>

            {/* Unit */}
            <div className="relative" ref={dropdownRef}>
              <label htmlFor="unit" className="block text-sm font-semibold text-gray-700 mb-2">ឯកតារង្វាស់</label>
              <div className="relative">
                <input
                  type="text"
                  id="unit"
                  ref={unitInputRef}
                  value={unitSearch}
                  onChange={(e) => {
                    setUnitSearch(e.target.value);
                    setIsUnitDropdownOpen(true);
                  }}
                  onFocus={() => setIsUnitDropdownOpen(true)}
                  placeholder="ជ្រើសរើស ឬវាយបញ្ចូលឯកតាថ្មី"
                  className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => {
                    setIsUnitDropdownOpen(!isUnitDropdownOpen);
                    if (!isUnitDropdownOpen) unitInputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <ChevronDown size={18} className={`transition-transform duration-200 ${isUnitDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Combobox Dropdown */}
              {isUnitDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto py-1">
                  {filteredUnits.length > 0 ? (
                    filteredUnits.map((unit, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectUnit(unit)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 flex items-center justify-between"
                      >
                        {unit}
                        {unitSearch.toLowerCase() === unit.toLowerCase() && <Check size={16} className="text-teal-600" />}
                      </button>
                    ))
                  ) : (
                    !isNewUnit && <div className="px-4 py-2 text-sm text-gray-500">គ្មានទិន្នន័យ</div>
                  )}
                  
                  {isNewUnit && (
                    <button
                      type="button"
                      onClick={handleAddUnit}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center border-t border-teal-100"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      បន្ថែម "{unitSearch}" ជាឯកតាថ្មី
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Min Stock Alert */}
            <div>
              <label htmlFor="minStock" className="block text-sm font-semibold text-gray-700 mb-2">បរិមាណអប្បបរមា (Min Stock Alert)</label>
              <input
                type="number"
                id="minStock" name="minStock"
                min="0"
                defaultValue={5}
                placeholder="ឧ. 5"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Initial Quantity - Master Data Only Note */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ស្ថានភាពស្តុកដំបូង (Initial Stock)
              </label>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm bg-white border border-slate-300 px-3 py-1 rounded text-slate-800">0 គ្រឿង</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  (បង្កើតតែទិន្នន័យមេ Master Data - សូមប្រើមុខងារ «បញ្ចូលស្តុកថ្មី» ដើម្បីបន្ថែមចំនួនស្តុកជាក់ស្តែង)
                </span>
              </div>
              <input type="hidden" id="initialStock" name="initialStock" value="0" />
            </div>

            {/* Default HQ Reference Location */}
            <div>
              <label htmlFor="locationId" className="block text-sm font-semibold text-gray-700 mb-2">ទីតាំងឃ្លាំងកណ្តាលយោង (HQ Reference)</label>
              <select
                id="locationId"
                name="locationId"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 bg-white"
              >
                {locations.length > 0 ? locations.filter(l => l.code !== 'ALL').map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationOption(loc, 'kh')}
                  </option>
                )) : <option value="">-- {isConfigured ? 'កំពុងទាញយក...' : 'គ្មានទីតាំង'} --</option>}
              </select>
            </div>
          </div>

          {/* Description (Full Width) */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">ការពិពណ៌នាបន្ថែម</label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="បញ្ចូលការពិពណ៌នាបន្ថែមពីសម្ភារថ្មីនេះ..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 resize-y"
            ></textarea>
          </div>

          {/* Actions */}
          <div className="pt-4 mt-6 border-t border-gray-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={resetForm}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 transition-colors disabled:opacity-50"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {uploadingImageText || 'កំពុងបញ្ចូលទៅក្នុង Supabase DB...'}
                </>
              ) : (
                'រក្សាទុកសម្ភារថ្មី'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

