import React, { useState } from 'react';
import { 
  Zap, Box, Wind, Thermometer, Scissors, Hammer, Settings, Wrench, Package as PackageIcon 
} from 'lucide-react';

export interface ItemAvatarProps {
  item: {
    code?: string;
    name_kh: string;
    name_en?: string;
    category?: string;
    image_url?: string | null;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Strict Read-Only Item Thumbnail Component
 * 
 * Rules Enforced:
 * 1. Read-only thumbnail: no edit buttons, no camera icons, no click handlers, no file inputs.
 * 2. Displays the image from Database (image_url).
 * 3. Gracefully falls back to category-specific default icons if no image exists or if the image fails to load.
 */
export function ItemAvatar({ item, size = 'md', className = '' }: ItemAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const nameKh = (item.name_kh || '').toLowerCase();
  const nameEn = (item.name_en || '').toLowerCase();
  const category = item.category || '';

  // Determine smart contextual icon if no image is available
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
  } else if (category === 'Suppliers' || nameKh.includes('ស្គត') || nameKh.includes('ម៉ាស') || nameKh.includes('ខ្សែរិត')) {
    IconComponent = PackageIcon;
    iconColor = 'text-teal-600';
    bgColor = 'bg-teal-50';
  }

  const dimClasses = 
    size === 'sm' ? 'w-8 h-8' : 
    size === 'lg' ? 'w-14 h-14' : 
    size === 'xl' ? 'w-20 h-20' : 
    'w-10 h-10';

  const iconSize = 
    size === 'sm' ? 15 : 
    size === 'lg' ? 24 : 
    size === 'xl' ? 32 : 
    18;

  const hasValidImage = Boolean(item.image_url && !imageError && item.image_url.trim().length > 0);

  return (
    <div 
      className={`relative ${dimClasses} rounded-full flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
      title={item.name_kh}
    >
      {hasValidImage ? (
        <img 
          src={item.image_url!} 
          alt={item.name_kh} 
          className={`${dimClasses} rounded-full object-cover border border-slate-200 shadow-2xs`}
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <div className={`${dimClasses} rounded-full ${bgColor} border border-slate-200/80 flex items-center justify-center`}>
          <IconComponent size={iconSize} className={iconColor} />
        </div>
      )}
    </div>
  );
}
