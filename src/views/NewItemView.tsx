import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, PlusCircle, ChevronDown, Check, X, RefreshCw, AlertTriangle, Database, Info } from 'lucide-react';

import { mockItems, mockInventory, mockLocations } from '../mockData';
import { insertItemToSupabase, isSupabaseConfigured } from '../lib/supabase';

export function NewItemView() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState('tools');
  const [materialCode, setMaterialCode] = useState(() => `TOL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    savedToSupabase: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [units, setUnits] = useState(['គ្រឿង', 'ម៉ែត្រ', 'ប្រអប់', 'កេស', 'រ៉ាម']);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isConfigured = isSupabaseConfigured();

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
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => {
    setImagePreview(null);
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

    const form = e.target as HTMLFormElement;
    const materialName = (form.elements.namedItem('materialName') as HTMLInputElement).value.trim();
    const brand = (form.elements.namedItem('brand') as HTMLInputElement).value.trim();
    const minStock = parseInt((form.elements.namedItem('minStock') as HTMLInputElement).value || '0', 10);
    const initialStock = parseInt((form.elements.namedItem('initialStock') as HTMLInputElement)?.value || '0', 10);
    const locationId = (form.elements.namedItem('locationId') as HTMLSelectElement)?.value || '1';
    const description = (form.elements.namedItem('description') as HTMLTextAreaElement)?.value || '';

    const categoryName = category === 'tools' ? 'Tools' : 'Suppliers';
    const selectedUnit = unitSearch.trim() || 'គ្រឿង';

    // 1. Send data to Supabase
    const res = await insertItemToSupabase({
      code: materialCode,
      name_kh: materialName,
      name_en: brand || materialName,
      category: categoryName,
      unit: selectedUnit,
      min_stock: minStock,
      initial_stock: initialStock,
      location_id: locationId,
      remark: description || 'បញ្ចូលសម្ភារថ្មី',
      recorded_by: 'Admin-GDT',
    });

    // 2. Add to local memory array so UI updates immediately
    const newItemId = res.item?.id || Math.random().toString(36).substring(7);
    const targetLoc = mockLocations.find(l => l.id === locationId) || mockLocations[0];

    mockItems.push({
      id: newItemId,
      code: materialCode,
      name_kh: materialName,
      name_en: brand || materialName,
      category: categoryName,
      unit: selectedUnit,
      min_stock: minStock,
      image_url: imagePreview || undefined,
    });

    mockInventory.push({
      location_id: locationId,
      item_id: newItemId,
      quantity: initialStock,
      last_updated: new Date().toISOString(),
      item_code: materialCode,
      item_name_kh: materialName,
      item_name_en: brand || materialName,
      category: categoryName,
      unit: selectedUnit,
      location_name_kh: targetLoc.name_kh,
      location_name_en: targetLoc.name_en,
      image_url: imagePreview || undefined,
    });

    setIsSubmitting(false);

    if (res.success && res.savedToSupabase) {
      setSubmitResult({
        success: true,
        savedToSupabase: true,
        message: `រក្សាទុកក្នុង Supabase Database ជោគជ័យ! (Item ID: ${res.item?.id || newItemId})`,
      });
      resetForm();
    } else {
      setSubmitResult({
        success: false,
        savedToSupabase: false,
        message: res.error || 'បរាជ័យបញ្ចូលទៅក្នុង Supabase Database',
        details: res.errorDetails || 'ទិន្នន័យត្រូវបញ្ចូលក្នុង Local Memory ប្រព័ន្ធជាបណ្តោះអាសន្ន។',
      });
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
                {!submitResult.savedToSupabase && (
                  <div className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5 mt-2 bg-emerald-100/70 p-2 rounded border border-emerald-200">
                    <Info size={14} />
                    <span>ទិន្នន័យសម្ភារត្រូវបានបញ្ចូលក្នុង Local Inventory ប្រព័ន្ធរួចរាល់សម្រាប់តេស្តប្រើប្រាស់!</span>
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

            {/* Initial Quantity */}
            <div>
              <label htmlFor="initialStock" className="block text-sm font-semibold text-gray-700 mb-2">បរិមាណស្តុកដើមដំបូង (Initial Stock Quantity)</label>
              <input
                type="number"
                id="initialStock" name="initialStock"
                min="0"
                defaultValue={0}
                placeholder="ឧ. 10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Default Location */}
            <div>
              <label htmlFor="locationId" className="block text-sm font-semibold text-gray-700 mb-2">ទីតាំងរក្សាទុកស្តុកដើម</label>
              <select
                id="locationId"
                name="locationId"
                defaultValue="1"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 bg-white"
              >
                {mockLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    [{loc.code}] {loc.name_kh}
                  </option>
                ))}
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
                  កំពុងបញ្ចូលទៅក្នុង Supabase DB...
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

