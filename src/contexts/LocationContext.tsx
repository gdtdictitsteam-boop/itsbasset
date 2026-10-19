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

  // Extract clean code (ignore full UUID strings from being used as short codes)
  const rawCode = String(loc.code || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode);
  const code = (rawCode && !isUuid) ? rawCode.toUpperCase() : '';

  // Get primary name in Khmer; fallback to English or code or id if missing
  let name = (loc.name_kh || loc.name_en || (!isUuid ? rawCode : '') || loc.id || '').trim();

  // If the name already starts with [CODE] or (CODE), strip it to avoid duplicate brackets
  if (code) {
    name = name
      .replace(new RegExp(`^\\[${code}\\]\\s*`, 'i'), '')
      .replace(new RegExp(`^\\(${code}\\)\\s*`, 'i'), '')
      .trim();
  }

  // Format as [<code_in_uppercase>] <name_kh> or just <name_kh> if no code
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
  resetLocationFilter: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { user, isBranchUser, isCentralAdmin, userLocationId } = useAuth();
  const [selectedLocationId, setRawSelectedLocationId] = useState<string>('ALL');
  const [locationsList, setLocationsList] = useState<Location[]>(mockLocations);

  // Track authentication transitions (login, logout, role switch) to reset location filter state
  const lastAuthTokenRef = React.useRef<string | null>(null);

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

  // Find user's assigned branch location ONLY if they are an active BranchUser
  const assignedBranchLocation: Location | null = useMemo(() => {
    if (!isBranchUser) return null;
    if (!userLocationId) {
      return locationsList.find(l => l.code === '7MK') || locationsList[1] || null;
    }
    const locStr = String(userLocationId).trim();
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
    const targetCode = String(codeMap[locStr] || locStr);

    return locationsList.find(l => 
      String(l.id) === locStr || 
      String(l.code) === locStr ||
      String(l.code) === targetCode ||
      (l.name_kh && l.name_kh.includes(targetCode)) ||
      (l.code && targetCode.toUpperCase().includes(String(l.code).toUpperCase())) ||
      (l.code && String(l.code).toUpperCase() === targetCode.toUpperCase())
    ) || locationsList.find(l => l.code === '7MK') || locationsList[1] || null;
  }, [isBranchUser, userLocationId, locationsList]);

  // Complete locations list available across the app (includes [ALL] and all locations)
  const locations = useMemo(() => {
    return [ALL_LOCATIONS_OPTION, ...locationsList];
  }, [locationsList]);

  // Explicit helper to reset location filter according to current user role
  const resetLocationFilter = useCallback(() => {
    if (isBranchUser && assignedBranchLocation) {
      setRawSelectedLocationId(assignedBranchLocation.id);
    } else {
      setRawSelectedLocationId('ALL');
    }
  }, [isBranchUser, assignedBranchLocation]);

  // Immediately synchronize location filter whenever user logs in, switches role, or signs out
  useEffect(() => {
    const currentAuthToken = user ? `${user.id || user.email}-${isCentralAdmin ? 'admin' : 'branch'}` : 'guest';
    const isAuthChanged = lastAuthTokenRef.current !== currentAuthToken;
    lastAuthTokenRef.current = currentAuthToken;

    if (isBranchUser) {
      // BranchUser is strictly locked to their branch
      if (assignedBranchLocation) {
        setRawSelectedLocationId(assignedBranchLocation.id);
      }
    } else if (isCentralAdmin) {
      // CentralAdmin: on sign in or user switch or if current ID is invalid/stale, reset immediately to 'ALL'
      if (isAuthChanged || selectedLocationId === '' || (selectedLocationId !== 'ALL' && !locationsList.some(l => l.id === selectedLocationId))) {
        setRawSelectedLocationId('ALL');
      }
    } else {
      // Unauthenticated / guest state
      setRawSelectedLocationId('ALL');
    }
  }, [user?.id, user?.email, isBranchUser, isCentralAdmin, assignedBranchLocation, locationsList]);

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
  const currentEffectiveId = String((isBranchUser && assignedBranchLocation ? assignedBranchLocation.id : selectedLocationId) || 'ALL');

  const selectedLocation = useMemo(() => {
    if (!isBranchUser && (currentEffectiveId === 'ALL' || currentEffectiveId === '')) {
      return ALL_LOCATIONS_OPTION;
    }
    if (isBranchUser && assignedBranchLocation) {
      return assignedBranchLocation;
    }
    return locations.find(l => 
      String(l.id) === currentEffectiveId || 
      String(l.code).toUpperCase() === currentEffectiveId.toUpperCase()
    ) || (locations.find(l => l.code && currentEffectiveId.includes(String(l.code)))) || ALL_LOCATIONS_OPTION;
  }, [currentEffectiveId, isBranchUser, assignedBranchLocation, locations]);

  return (
    <LocationContext.Provider value={{ 
      selectedLocationId: currentEffectiveId, 
      setSelectedLocationId, 
      selectedLocation, 
      locations,
      allLocationsList: locationsList,
      setLocationsList,
      isLocationLocked: isBranchUser,
      assignedBranchLocation,
      resetLocationFilter
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
