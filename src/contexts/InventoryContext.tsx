import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockItems, mockInventory, mockLocations, standardItemQuantities } from '../mockData';
import { Item, InventoryItem, Location } from '../types';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchFullInventoryFromSupabase,
  seedInitialInventoryToSupabase 
} from '../lib/supabase';

interface StockInParams {
  locationId: string;
  itemId: string;
  quantity: number;
  officerName: string;
  purpose: string;
}

interface StockOutParams {
  locationId: string;
  itemId: string;
  quantity: number;
  officerName?: string;
  purpose?: string;
}

interface InventoryContextType {
  inventory: InventoryItem[];
  items: Item[];
  locations: Location[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  recordStockIn: (params: StockInParams) => Promise<{ success: boolean; message: string }>;
  recordStockOut: (params: StockOutParams) => Promise<{ success: boolean; message: string }>;
  reseedStandardStock: () => Promise<{ success: boolean; message: string }>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const [items, setItems] = useState<Item[]>(mockItems);
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [locations, setLocations] = useState<Location[]>(mockLocations);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshInventory = useCallback(async () => {
    if (!isConfigured) {
      setInventory([...mockInventory]);
      setItems([...mockItems]);
      setLocations([...mockLocations]);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch live items from Supabase
      const { data: dbItems } = await supabase.from('items').select('*');
      if (dbItems && dbItems.length > 0) {
        // Merge with local mockItems to ensure fallback completeness
        const itemMap = new Map<string, Item>();
        mockItems.forEach(i => itemMap.set(i.code, i));
        dbItems.forEach((i: any) => itemMap.set(i.code, {
          id: i.id,
          code: i.code,
          name_kh: i.name_kh,
          name_en: i.name_en || i.name_kh,
          category: i.category || 'Tools',
          unit: i.unit || 'គ្រឿង',
          min_stock: i.min_stock ?? 5,
          image_url: i.image_url || undefined,
        }));
        setItems(Array.from(itemMap.values()));
      } else {
        setItems([...mockItems]);
      }

      // 2. Fetch live locations from Supabase
      const { data: dbLocs } = await supabase.from('locations').select('*');
      if (dbLocs && dbLocs.length > 0) {
        setLocations(dbLocs as Location[]);
      } else {
        setLocations([...mockLocations]);
      }

      // 3. Fetch full inventory with join
      const liveInventory = await fetchFullInventoryFromSupabase();
      if (liveInventory && liveInventory.length > 0) {
        setInventory(liveInventory);
      } else {
        setInventory([...mockInventory]);
      }
    } catch (err) {
      console.warn('Error refreshing live inventory, using fallback:', err);
      setInventory([...mockInventory]);
      setItems([...mockItems]);
      setLocations([...mockLocations]);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  // Record Stock-In (Increases stock at target location)
  const recordStockIn = async (params: StockInParams): Promise<{ success: boolean; message: string }> => {
    const targetItem = items.find(i => i.id === params.itemId || i.code === params.itemId);
    const targetLocation = locations.find(l => l.id === params.locationId || l.code === params.locationId) 
      || mockLocations.find(l => l.id === params.locationId || l.code === params.locationId);

    if (!targetItem) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈដែលបានជ្រើសរើសឡើយ!' };
    }
    if (!targetLocation) {
      return { success: false, message: 'រកមិនឃើញទីតាំងដែលបានជ្រើសរើសឡើយ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនបញ្ចូលត្រូវតែធំជាង ០!' };
    }

    // 1. Update in-memory mock data
    const existingIndex = mockInventory.findIndex(
      inv => (inv.item_id === targetItem.id || inv.item_code === targetItem.code) &&
             (inv.location_id === targetLocation.id || inv.location_id === targetLocation.code || 
              (inv.location_name_kh && inv.location_name_kh.includes(targetLocation.name_kh)))
    );

    if (existingIndex >= 0) {
      mockInventory[existingIndex].quantity += params.quantity;
      mockInventory[existingIndex].last_updated = new Date().toISOString();
    } else {
      mockInventory.push({
        location_id: targetLocation.id,
        item_id: targetItem.id,
        quantity: params.quantity,
        last_updated: new Date().toISOString(),
        item_code: targetItem.code,
        item_name_kh: targetItem.name_kh,
        item_name_en: targetItem.name_en,
        category: targetItem.category,
        unit: targetItem.unit,
        min_stock: targetItem.min_stock,
        location_name_kh: targetLocation.name_kh,
        location_name_en: targetLocation.name_en,
        image_url: targetItem.image_url,
      });
    }

    // 2. If Supabase is configured, write to database
    if (isConfigured) {
      try {
        // Find existing inventory in Supabase
        const { data: invRows } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('location_id', targetLocation.id)
          .eq('item_id', targetItem.id);

        const currentQty = (invRows && invRows.length > 0) ? (invRows[0].quantity || 0) : 0;
        const newQty = currentQty + params.quantity;

        // Upsert inventory row
        await supabase.from('inventory').upsert([
          {
            location_id: targetLocation.id,
            item_id: targetItem.id,
            quantity: newQty,
            last_updated: new Date().toISOString(),
          }
        ], { onConflict: 'location_id,item_id' });

        // Insert transaction record
        await supabase.from('transactions').insert([
          {
            type: 'STOCK_IN',
            to_location_id: targetLocation.id,
            item_id: targetItem.id,
            item_code: targetItem.code,
            item_name_kh: targetItem.name_kh,
            quantity: params.quantity,
            unit: targetItem.unit,
            recorded_by: params.officerName || 'Admin-GDT',
            remark: params.purpose || 'បញ្ចូលស្តុកថ្មី',
            status: 'RECEIVED'
          }
        ]);
      } catch (dbErr: any) {
        console.warn('Supabase DB Stock-In Error:', dbErr);
      }
    }

    // Refresh context state
    await refreshInventory();

    return { 
      success: true, 
      message: `បញ្ចូលស្តុក "${targetItem.name_kh}" ចំនួន ${params.quantity} ${targetItem.unit} ជោគជ័យ!` 
    };
  };

  // Record Stock-Out (Decreases stock at source location)
  const recordStockOut = async (params: StockOutParams): Promise<{ success: boolean; message: string }> => {
    const targetItem = items.find(i => i.id === params.itemId || i.code === params.itemId);
    const targetLocation = locations.find(l => l.id === params.locationId || l.code === params.locationId)
      || mockLocations.find(l => l.id === params.locationId || l.code === params.locationId);

    if (!targetItem || !targetLocation) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈ ឬទីតាំងឡើយ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនដកចេញត្រូវតែធំជាង ០!' };
    }

    // 1. Check in-memory stock
    const existingIndex = mockInventory.findIndex(
      inv => (inv.item_id === targetItem.id || inv.item_code === targetItem.code) &&
             (inv.location_id === targetLocation.id || inv.location_id === targetLocation.code ||
              (inv.location_name_kh && inv.location_name_kh.includes(targetLocation.name_kh)))
    );

    const availableLocalQty = existingIndex >= 0 ? mockInventory[existingIndex].quantity : 0;
    if (availableLocalQty < params.quantity) {
      return { 
        success: false, 
        message: `បរិមាណស្តុកមិនគ្រប់គ្រាន់! ស្តុកជាក់ស្តែងមានតែ ${availableLocalQty} ${targetItem.unit} ប៉ុណ្ណោះ។` 
      };
    }

    // Deduct in-memory
    mockInventory[existingIndex].quantity -= params.quantity;
    mockInventory[existingIndex].last_updated = new Date().toISOString();

    // 2. If Supabase is configured, deduct from database
    if (isConfigured) {
      try {
        const { data: invRows } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('location_id', targetLocation.id)
          .eq('item_id', targetItem.id);

        const currentQty = (invRows && invRows.length > 0) ? (invRows[0].quantity || 0) : 0;
        if (currentQty < params.quantity) {
          return { 
            success: false, 
            message: `បរិមាណស្តុកក្នុង Supabase មិនគ្រប់គ្រាន់! (មាន: ${currentQty}, ស្នើសុំ: ${params.quantity})` 
          };
        }

        const newQty = currentQty - params.quantity;
        await supabase.from('inventory').upsert([
          {
            location_id: targetLocation.id,
            item_id: targetItem.id,
            quantity: newQty,
            last_updated: new Date().toISOString(),
          }
        ], { onConflict: 'location_id,item_id' });

        await supabase.from('transactions').insert([
          {
            type: 'STOCK_OUT',
            from_location_id: targetLocation.id,
            item_id: targetItem.id,
            item_code: targetItem.code,
            item_name_kh: targetItem.name_kh,
            quantity: params.quantity,
            unit: targetItem.unit,
            recorded_by: params.officerName || 'Admin-GDT',
            remark: params.purpose || 'ដកចេញពីស្តុក',
            status: 'RECEIVED'
          }
        ]);
      } catch (dbErr: any) {
        console.warn('Supabase DB Stock-Out Error:', dbErr);
      }
    }

    await refreshInventory();

    return { 
      success: true, 
      message: `ដកចេញ "${targetItem.name_kh}" ចំនួន ${params.quantity} ${targetItem.unit} ជោគជ័យ!` 
    };
  };

  // Re-seed clean standard stock
  const reseedStandardStock = async (): Promise<{ success: boolean; message: string }> => {
    if (isConfigured) {
      const res = await seedInitialInventoryToSupabase();
      if (res.success) {
        await refreshInventory();
      }
      return res;
    } else {
      // Local reseed
      mockInventory.length = 0;
      mockItems.forEach(item => {
        mockInventory.push({
          location_id: '1',
          item_id: item.id,
          quantity: standardItemQuantities[item.code] ?? 20,
          last_updated: new Date().toISOString(),
          item_code: item.code,
          item_name_kh: item.name_kh,
          item_name_en: item.name_en,
          category: item.category,
          unit: item.unit,
          min_stock: item.min_stock,
          location_name_kh: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
          location_name_en: 'ITSB-HQ Technical Inventory'
        });
      });
      await refreshInventory();
      return { 
        success: true, 
        message: 'បានកំណត់ចំនួនស្តុកឡើងវិញត្រឹមត្រូវតាមស្ដង់ដារប្រព័ន្ធជោគជ័យ!' 
      };
    }
  };

  return (
    <InventoryContext.Provider value={{
      inventory,
      items,
      locations,
      isLoading,
      refreshInventory,
      recordStockIn,
      recordStockOut,
      reseedStandardStock,
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryContext() {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return context;
}
