import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, PlusCircle, ChevronDown, Check } from 'lucide-react';

export function NewItemView() {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <form className="p-6 space-y-6" onSubmit={(e) => e.preventDefault()}>
          {/* Material Image (Full Width) */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">រូបភាពសម្ភារ</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:border-teal-500 hover:bg-teal-50/50 transition-colors cursor-pointer">
              <div className="space-y-2 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400 bg-gray-50 rounded-full flex items-center justify-center">
                  <ImageIcon size={24} />
                </div>
                <div className="flex text-sm text-gray-600 justify-center">
                  <span className="relative cursor-pointer bg-transparent rounded-md font-medium text-teal-600 hover:text-teal-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-teal-600">
                    <span>ជ្រើសរើសរូបភាព</span>
                    <input id="file-upload" name="file-upload" type="file" className="sr-only" accept="image/*" />
                  </span>
                  <p className="pl-1">ឬអូសទម្លាក់ទីនេះ</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF ទំហំមិនលើសពី 5MB</p>
              </div>
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
                placeholder="ឧ. MAT-001"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all text-gray-800 placeholder-gray-400"
              />
            </div>

            {/* Material Name */}
            <div>
              <label htmlFor="materialName" className="block text-sm font-semibold text-gray-700 mb-2">ឈ្មោះសម្ភារ <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="materialName"
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
                id="minStock"
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
                id="brand"
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
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 transition-colors"
            >
              បោះបង់
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 transition-colors shadow-sm"
            >
              រក្សាទុក
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
