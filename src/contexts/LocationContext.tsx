import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockLocations } from '../mockData';
import { Location } from '../types';
import { useAuth } from './AuthContext';

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
  isLocationLocked: boolean;
  assignedBranchLocation: Location | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { isBranchUser, isCentralAdmin, userLocationId } = useAuth();
  const [selectedLocationId, setRawSelectedLocationId] = useState<string>('ALL');
  const [locationsList, setLocationsList] = useState<Location[]>(mockLocations);

  // Find user's assigned branch location if they are a BranchUser
  const assignedBranchLocation: Location | null = React.useMemo(() => {
    if (!userLocationId) {
      // Default to 7MK (id '2') if not assigned
      return locationsList.find(l => l.code === '7MK' || l.id === '2') || locationsList[1] || null;
    }
    return locationsList.find(l => 
      l.id === userLocationId || 
      l.code === userLocationId ||
      l.name_kh.includes(userLocationId)
    ) || locationsList.find(l => l.code === '7MK') || locationsList[1] || null;
  }, [userLocationId, locationsList]);

  // When user is BranchUser, automatically lock selected location to their assigned branch
  useEffect(() => {
    if (isBranchUser && assignedBranchLocation) {
      setRawSelectedLocationId(assignedBranchLocation.id);
    } else if (isCentralAdmin && selectedLocationId !== 'ALL' && !locationsList.some(l => l.id === selectedLocationId)) {
      setRawSelectedLocationId('ALL');
    }
  }, [isBranchUser, isCentralAdmin, assignedBranchLocation]);

  // Restrict locations list: BranchUser sees only their assigned branch; CentralAdmin sees ALL + all locations
  const locations = React.useMemo(() => {
    if (isBranchUser && assignedBranchLocation) {
      return [assignedBranchLocation];
    }
    return [ALL_LOCATIONS_OPTION, ...locationsList];
  }, [isBranchUser, assignedBranchLocation, locationsList]);

  // Guarded location setter: prevents BranchUser from switching to other locations
  const setSelectedLocationId = (id: string) => {
    if (isBranchUser) {
      // Locked! BranchUser can only stay in their branch
      if (assignedBranchLocation) {
        setRawSelectedLocationId(assignedBranchLocation.id);
      }
      return;
    }
    setRawSelectedLocationId(id);
  };

  // Determine current active Location object
  const currentEffectiveId = isBranchUser && assignedBranchLocation ? assignedBranchLocation.id : selectedLocationId;

  const selectedLocation = locations.find(l => 
    l.id === currentEffectiveId || 
    l.code === currentEffectiveId ||
    (l.code && currentEffectiveId.includes(l.code))
  ) || (isBranchUser && assignedBranchLocation ? assignedBranchLocation : ALL_LOCATIONS_OPTION);

  return (
    <LocationContext.Provider value={{ 
      selectedLocationId: currentEffectiveId, 
      setSelectedLocationId, 
      selectedLocation, 
      locations,
      setLocationsList,
      isLocationLocked: isBranchUser,
      assignedBranchLocation
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
