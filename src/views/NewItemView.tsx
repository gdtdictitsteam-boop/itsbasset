import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, PlusCircle, ChevronDown, Check, X } from 'lucide-react';

import { mockItems, mockInventory } from '../mockData';

export function NewItemView() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [category, setCategory] = useState('tools');
  const [materialCode, setMaterialCode] = useState(() => `TOL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [units, setUnits] = useState(['គ្រឿង', 'ម៉ែត្រ', 'ប្រអប់', 'កេស', 'រ៉ាម']);
  const unitInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCategory(val);
    const prefix = val === 'tools' ? 'TOL' : 'SUP';
    const randomSeq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setMaterialCode(`${prefix}-${randomSeq}`);
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
    setMaterialCode(`TOL-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`);
    setUnitSearch('');
    const form = document.getElementById('new-item-form') as HTMLFormElement;
    if (form) form.reset();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(false);

    const form = e.target as HTMLFormElement;
    const materialName = (form.elements.namedItem('materialName') as HTMLInputElement).value;
    const brand = (form.elements.namedItem('brand') as HTMLInputElement).value;
    const minStock = parseInt((form.elements.namedItem('minStock') as HTMLInputElement).value || '0', 10);
    const categoryName = category === 'tools' ? 'Tools' : 'Suppliers';
    
    // Simulate API call
    setTimeout(() => {
      // Mutate the mock items arrays to make the new item appear in the app
      const newItemId = Math.random().toString(36).substring(7);
      
      mockItems.push({
        id: newItemId,
        code: materialCode,
        name_kh: materialName,
        name_en: brand || materialName,
        category: categoryName,
        unit: unitSearch || 'គ្រឿង',
        min_stock: minStock,
        image_url: imagePreview || undefined,
      });

      // Add a dummy inventory record so it appears in the dashboard
      mockInventory.push({
        location_id: '1',
        item_id: newItemId,
        quantity: 0,
        last_updated: new Date().toISOString(),
        item_code: materialCode,
        item_name_kh: materialName,
        item_name_en: brand || materialName,
        category: categoryName,
        unit: unitSearch || 'គ្រឿង',
        location_name_kh: 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB',
        location_name_en: 'HQ-ITSB Technical Inventory'
      });

      setIsSubmitting(false);
      setSubmitSuccess(true);
      resetForm();
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {submitSuccess && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-1.5 rounded-full text-teal-700">
              <Check size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm">រក្សាទុកជោគជ័យ</h3>
              <p className="text-xs opacity-90">ព័ត៌មានសម្ភារថ្មីត្រូវបានបញ្ចូលទៅក្នុងប្រព័ន្ធ។</p>
            </div>
          </div>
          <button onClick={() => setSubmitSuccess(false)} className="text-teal-600 hover:text-teal-800 p-1">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header Section */}
        <div className="px-6 py-4 border-b border-gray-100 bg-[#F2F9F6] flex items-center gap-3">
          <div className="p-2 bg-teal-100 text-teal-700 rounded-lg">
            <PlusCircle size={20} />
          </div>
          <h2 className="text-xl font-bold text-[#03291E]" style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}>
            បញ្ចូលព័ត៌មានសម្ភារថ្មី
          </h2>
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
              <label htmlFor="materialCode" className="block text-sm font-semibold text-gray-700 mb-2">លេខកូដសម្ភារ <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="materialCode"
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="ឧ. MAT-001"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-gray-50 font-medium"
              />
            </div>

            {/* Material Name */}
            <div>
              <label htmlFor="materialName" className="block text-sm font-semibold text-gray-700 mb-2">ឈ្មោះសម្ភារ <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="materialName" name="materialName"
                placeholder="ឧ. ខ្សែបណ្តាញ Network"
                required
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
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 bg-white"
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
              <label htmlFor="minStock" className="block text-sm font-semibold text-gray-700 mb-2">បរិមាណអប្បបរមា</label>
              <input
                type="number"
                id="minStock" name="minStock"
                min="0"
                placeholder="ឧ. 10"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Brand/Model */}
            <div>
              <label htmlFor="brand" className="block text-sm font-semibold text-gray-700 mb-2">ម៉ាក/ម៉ូដែល</label>
              <input
                type="text"
                id="brand" name="brand"
                placeholder="បញ្ចូលម៉ាក ឬម៉ូដែល"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Description (Full Width) */}
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">ការពិពណ៌នា</label>
            <textarea
              id="description"
              rows={3}
              placeholder="បញ្ចូលការពិពណ៌នាបន្ថែម..."
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
                  កំពុងរក្សាទុក...
                </>
              ) : (
                'រក្សាទុក'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
