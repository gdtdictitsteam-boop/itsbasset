import React, { useState, useEffect } from 'react';
import { 
  Zap, Box, Wind, Thermometer, Scissors, Hammer, Settings, Wrench, Package as PackageIcon, 
  Camera, Upload, X, Trash2, Check
} from 'lucide-react';

interface ItemAvatarProps {
  item: {
    code: string;
    name_kh: string;
    name_en: string;
    category: string;
    image_url?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
}

export function getItemSavedImage(code: string): string | null {
  try {
    return localStorage.getItem(`item_image_${code}`);
  } catch (e) {
    return null;
  }
}

export function setItemSavedImage(code: string, dataUrl: string | null) {
  try {
    if (dataUrl) {
      localStorage.setItem(`item_image_${code}`, dataUrl);
    } else {
      localStorage.removeItem(`item_image_${code}`);
    }
    window.dispatchEvent(new Event('item-image-updated'));
  } catch (e) {
    console.error('Failed to save image:', e);
  }
}

export function ItemAvatar({ item, size = 'md', editable = true }: ItemAvatarProps) {
  const [customImage, setCustomImage] = useState<string | null>(item.image_url || null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const loadSavedImage = () => {
    const saved = getItemSavedImage(item.code);
    if (saved) {
      setCustomImage(saved);
    } else {
      setCustomImage(item.image_url || null);
    }
  };

  useEffect(() => {
    loadSavedImage();
    const handleUpdate = () => loadSavedImage();
    window.addEventListener('item-image-updated', handleUpdate);
    return () => window.removeEventListener('item-image-updated', handleUpdate);
  }, [item.code, item.image_url]);

  const nameKh = item.name_kh.toLowerCase();
  const nameEn = item.name_en.toLowerCase();

  let IconComponent = Wrench;
  let iconColor = 'text-blue-600';
  let bgColor = 'bg-blue-50';

  if (nameKh.includes('ម៉ូទ័រ') || nameKh.includes('ស្វាន') || nameEn.includes('drill') || nameEn.includes('screwdriver')) {
    IconComponent = Zap;
    iconColor = 'text-[#0284c7]';
    bgColor = 'bg-sky-50';
  } else if (nameKh.includes('កេះ') || nameEn.includes('toolbox') || nameEn.includes('box')) {
    IconComponent = Box;
    iconColor = 'text-blue-600';
    bgColor = 'bg-blue-50';
  } else if (nameKh.includes('ផ្លុំ') || nameEn.includes('blower')) {
    IconComponent = Wind;
    iconColor = 'text-amber-500';
    bgColor = 'bg-amber-50';
  } else if (nameKh.includes('សីតុណ្ហភាព') || nameEn.includes('thermometer')) {
    IconComponent = Thermometer;
    iconColor = 'text-red-500';
    bgColor = 'bg-red-50';
  } else if (nameKh.includes('កន្ត្រៃ') || nameEn.includes('scissors') || nameEn.includes('cutter')) {
    IconComponent = Scissors;
    iconColor = 'text-indigo-600';
    bgColor = 'bg-indigo-50';
  } else if (nameKh.includes('ញញួរ') || nameEn.includes('hammer')) {
    IconComponent = Hammer;
    iconColor = nameKh.includes('ជ័រ') ? 'text-amber-600' : 'text-slate-600';
    bgColor = 'bg-slate-100';
  } else if (nameKh.includes('សោ') || nameEn.includes('key') || nameEn.includes('spanner')) {
    IconComponent = Settings;
    iconColor = 'text-red-600';
    bgColor = 'bg-red-50';
  } else if (nameKh.includes('ដង្កាប់') || nameEn.includes('pliers') || nameEn.includes('crimping')) {
    IconComponent = Wrench;
    iconColor = 'text-amber-600';
    bgColor = 'bg-amber-50';
  } else if (item.category === 'Suppliers') {
    IconComponent = PackageIcon;
    iconColor = 'text-teal-600';
    bgColor = 'bg-teal-50';
  }

  const dimClasses = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 24 : 18;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const finalImage = selectedFile || (urlInput.trim() ? urlInput.trim() : null);
    setItemSavedImage(item.code, finalImage);
    setIsModalOpen(false);
    setSelectedFile(null);
    setUrlInput('');
  };

  const handleRemove = () => {
    setItemSavedImage(item.code, null);
    setIsModalOpen(false);
    setSelectedFile(null);
    setUrlInput('');
  };

  return (
    <>
      <div 
        onClick={() => editable && setIsModalOpen(true)}
        className={`relative group ${dimClasses} rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-transform hover:scale-105`}
        title="ចុចដើម្បីបញ្ចូល ឬកែប្រែរូបភាពសម្ភារ"
      >
        {customImage ? (
          <img 
            src={customImage} 
            alt={item.name_kh} 
            className={`${dimClasses} rounded-full object-cover border border-slate-200 shadow-xs`} 
          />
        ) : (
          <div className={`${dimClasses} rounded-full ${bgColor} border border-slate-200/80 flex items-center justify-center`}>
            <IconComponent size={iconSize} className={iconColor} />
          </div>
        )}

        {editable && (
          <div className="w-3.5 h-3.5 rounded-full bg-white border border-slate-300 shadow-xs flex items-center justify-center absolute -bottom-0.5 -right-0.5 group-hover:bg-[#064E3B] group-hover:border-[#064E3B] group-hover:text-white transition-colors">
            <Camera size={9} className="text-slate-500 group-hover:text-white" />
          </div>
        )}
      </div>

      {/* Modal for image upload/editing */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">បញ្ចូល / កែប្រែរូបភាពសម្ភារ</h3>
                <p className="text-xs text-slate-500 mt-0.5">[{item.code}] {item.name_kh}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Preview area */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                {selectedFile || customImage || urlInput ? (
                  <img 
                    src={selectedFile || urlInput || customImage || ''} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400 gap-1">
                    <Camera size={28} />
                    <span className="text-[10px]">មិនទាន់មានរូបភាព</span>
                  </div>
                )}
              </div>
            </div>

            {/* Input options */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ជ្រើសរើសរូបភាពពីឧបករណ៍ (Upload File)
                </label>
                <label className="flex items-center justify-center w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 text-slate-700 text-xs font-bold gap-2 transition-colors">
                  <Upload size={16} className="text-slate-500" />
                  <span>ជ្រើសរើសរូបភាព (Choose Image)</span>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-xs uppercase font-medium">ឬ (OR)</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  បញ្ចូល URL រូបភាព (Image URL)
                </label>
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#064E3B]/20 focus:border-[#064E3B]"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {(customImage || selectedFile || urlInput) ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl flex items-center space-x-1.5 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>លុបរូបភាព</span>
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  បោះបង់
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#064E3B] hover:bg-[#04392b] rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
                >
                  <Check size={14} />
                  <span>រក្សាទុក</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
