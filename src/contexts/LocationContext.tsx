import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { mockLocations } from '../mockData';
import { Location } from '../types';
import { useAuth } from './AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const ALL_LOCATIONS_OPTION: Location = {
  id: 'ALL',
  name_kh: 'ទីតាំងស្តុកទាំងអស់',
  name_en: 'All Combined Locations',
  type: 'ALL',
  code: 'ALL'
};

/**
 * Standardized location display formatter across the application
 * Produces unified, consistent labels for Sidebar, StockIn, StockOut, Handover, NewItem, etc.
 * Example for ALL: "[ALL] ទីតាំងស្តុកទាំងអស់"
 * Example for HQ: "[HQ-ITSB] ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB"
 * Example for Branch: "[PLN] សាខាពន្ធដារខេត្តប៉ៃលិន", "[7MK] សាខាពន្ធដារខណ្ឌ៧មករា"
 */
export function formatLocationOption(loc: Location | null | undefined, _language: 'kh' | 'en' = 'kh'): string {
  if (!loc) return '';
  if (loc.id === 'ALL' || loc.code === 'ALL') {
    return '[ALL] ទីតាំងស្តុកទាំងអស់';
  }

  const code = String(loc.code || loc.id || '').trim();
  let name = (loc.name_kh || loc.name_en || code).trim();

  // If the string already starts with [code] or (code), clean it to avoid double prefix
  if (code) {
    name = name
      .replace(new RegExp(`^\\[${code}\\]\\s*`, 'i'), '')
      .replace(new RegExp(`^\\(${code}\\)\\s*`, 'i'), '')
      .trim();
  }

  return code ? `[${code}] ${name}` : name;
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
  allLocationsList: Location[];
  setLocationsList: (locs: Location[]) => void;
  isLocationLocked: boolean;
  assignedBranchLocation: Location | null;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { isBranchUser, isCentralAdmin, userLocationId } = useAuth();
  const [selectedLocationId, setRawSelectedLocationId] = useState<string>('ALL');
  const [locationsList, setLocationsList] = useState<Location[]>(mockLocations);

  // Directly fetch locations from Supabase Database sorted by type desc (HQ first) then name_kh asc
  const fetchLocationsFromSupabase = useCallback(async () => {
    try {
      if (!isSupabaseConfigured()) return;
      const { data, error } = await supabase
        .from('locations')
        .select('id, name_kh, code, type')
        .order('type', { ascending: false })
        .order('name_kh', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        setLocationsList(data as Location[]);
      }
    } catch (err) {
      console.warn('Notice loading locations from Supabase in LocationProvider:', err);
    }
  }, []);

  useEffect(() => {
    fetchLocationsFromSupabase();
  }, [fetchLocationsFromSupabase]);

  // Find user's assigned branch location if they are a BranchUser
  const assignedBranchLocation: Location | null = useMemo(() => {
    if (!userLocationId) {
      return locationsList.find(l => l.code === '7MK') || locationsList[1] || null;
    }
    // Handle numeric legacy IDs or codes or UUIDs
    const codeMap: Record<string, string> = {
      '1': 'HQ-ITSB',
      '2': '7MK',
      '3': 'CKM',
      '4': 'DKO',
      '5': 'DPE',
      '6': 'TKO',
      '24': 'KPC'
    };
    const targetCode = codeMap[userLocationId] || userLocationId;

    return locationsList.find(l => 
      l.id === userLocationId || 
      l.code === userLocationId ||
      l.code === targetCode ||
      l.name_kh.includes(targetCode) ||
      (l.code && targetCode.toUpperCase() === l.code.toUpperCase())
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

  // Complete locations list available across the app (includes [ALL] and all locations)
  const locations = useMemo(() => {
    return [ALL_LOCATIONS_OPTION, ...locationsList];
  }, [locationsList]);

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
      allLocationsList: locationsList,
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
