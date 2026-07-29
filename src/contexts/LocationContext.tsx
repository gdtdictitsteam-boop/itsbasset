import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Location } from '../types';

export const ALL_LOCATIONS_OPTION: Location = {
  id: 'ALL',
  name_kh: 'ទីតាំងស្តុករួម (គ្រប់ទីតាំង)',
  name_en: 'All Combined Locations',
  type: 'HQ',
  code: 'ALL'
};

interface LocationContextType {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  selectedLocation: Location;
  locations: Location[];
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
  const [locationsList, setLocationsList] = useState<Location[]>([]);

  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('locations').select('*');
      if (data) setLocationsList(data);
    };
    fetchLocations();
  }, []);

  const locations = [ALL_LOCATIONS_OPTION, ...locationsList];

  const selectedLocation = locations.find(l => l.id === selectedLocationId || l.code === selectedLocationId) || ALL_LOCATIONS_OPTION;

  return (
    <LocationContext.Provider value={{ selectedLocationId, setSelectedLocationId, selectedLocation, locations }}>
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
