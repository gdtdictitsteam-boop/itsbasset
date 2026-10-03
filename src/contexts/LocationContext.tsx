import React, { createContext, useContext, useState } from 'react';
import { mockLocations } from '../mockData';
import { Location } from '../types';

export const ALL_LOCATIONS_OPTION: Location = {
  id: 'ALL',
  name_kh: 'ទីតាំងស្តុករួម (គ្រប់ទីតាំង)',
  name_en: 'All Combined Locations',
  type: 'ALL',
  code: 'ALL'
};

/**
 * Standardized location display formatter across the application
 * Produces unified, consistent labels for Sidebar, StockIn, StockOut, Handover, NewItem, etc.
 * Example for ALL: "[ALL] ទីតាំងស្តុករួម (គ្រប់ទីតាំង)"
 * Example for HQ: "[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB (ស្តុកកណ្តាល)"
 * Example for Branch: "[7MK] សាខាពន្ធដារខណ្ឌ៧មករា"
 */
export function formatLocationOption(loc: Location, language: 'kh' | 'en' = 'kh'): string {
  if (!loc) return '';
  if (loc.id === 'ALL' || loc.code === 'ALL') {
    return language === 'kh' ? '[ALL] ទីតាំងស្តុករួម (គ្រប់ទីតាំង)' : '[ALL] All Combined Locations';
  }

  const code = loc.code || loc.id;
  const isHq = loc.type === 'HQ' || code === 'HQ-ITSB';
  let name = language === 'kh' ? (loc.name_kh || '') : (loc.name_en || loc.name_kh || '');
  
  // Clean duplicate code in parenthesis or brackets if present
  let cleanName = name.replace(new RegExp(`\\s*\\(${code}\\)\\s*$`, 'i'), '').trim();
  cleanName = cleanName.replace(new RegExp(`^\\[${code}\\]\\s*`, 'i'), '').trim();

  const hqTag = isHq ? (language === 'kh' ? ' (ស្តុកកណ្តាល)' : ' (HQ Central)') : '';
  return `[${code}] ${cleanName}${hqTag}`;
}

/**
 * Get an active specific physical warehouse/branch (falls back to HQ-ITSB if ALL is selected)
 */
export function getActiveWarehouseLocation(currentLoc: Location, allLocations: Location[]): Location {
  if (currentLoc && currentLoc.code !== 'ALL' && currentLoc.id !== 'ALL') {
    return currentLoc;
  }
  const hq = allLocations.find(l => l.code === 'HQ-ITSB' || l.type === 'HQ' || l.id === '1');
  return hq || allLocations.find(l => l.code !== 'ALL') || allLocations[0];
}

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  selectedLocation: Location;
  locations: Location[];
  setLocationsList: (locs: Location[]) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [locationsList, setLocationsList] = useState<Location[]>(mockLocations);

  const locations = [ALL_LOCATIONS_OPTION, ...locationsList];

  const selectedLocation = locations.find(l => 
    l.id === selectedLocationId || 
    l.code === selectedLocationId ||
    (l.code && selectedLocationId.includes(l.code))
  ) || ALL_LOCATIONS_OPTION;

  return (
    <LocationContext.Provider value={{ 
      selectedLocationId, 
      setSelectedLocationId, 
      selectedLocation, 
      locations,
      setLocationsList
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
