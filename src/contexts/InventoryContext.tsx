import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockItems, mockInventory, mockLocations, mockTransactions, standardItemQuantities } from '../mockData';
import { Item, InventoryItem, Location } from '../types';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchFullInventoryFromSupabase,
  seedInitialInventoryToSupabase 
} from '../lib/supabase';
import { useLocationContext } from './LocationContext';

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
  recordStockIn: (params: StockInParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordStockOut: (params: StockOutParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  reseedStandardStock: () => Promise<{ success: boolean; message: string }>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Helper to test if a string is a valid UUID
const isValidUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const { setLocationsList } = useLocationContext();
  const [items, setItems] = useState<Item[]>(() => [...mockItems]);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => [...mockInventory]);
  const [locations, setLocations] = useState<Location[]>(() => [...mockLocations]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshInventory = useCallback(async () => {
    if (!isConfigured) {
      setInventory([...mockInventory]);
      setItems([...mockItems]);
      setLocations([...mockLocations]);
      setLocationsList(mockLocations);
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch live items from Supabase
      const { data: dbItems, error: itemsErr } = await supabase.from('items').select('*');
      if (!itemsErr && dbItems && dbItems.length > 0) {
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
      const { data: dbLocs, error: locsErr } = await supabase.from('locations').select('*');
      if (!locsErr && dbLocs && dbLocs.length > 0) {
        const formattedLocs = dbLocs as Location[];
        setLocations(formattedLocs);
        setLocationsList(formattedLocs);
      } else {
        setLocations([...mockLocations]);
        setLocationsList(mockLocations);
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
      setLocationsList(mockLocations);
    } finally {
      setIsLoading(false);
    }
  }, [isConfigured, setLocationsList]);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  // Record Stock-In (Increases stock at target location)
  const recordStockIn = async (params: StockInParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => i.id === params.itemId || i.code === params.itemId) 
      || mockItems.find(i => i.id === params.itemId || i.code === params.itemId);

    const targetLocation = locations.find(l => l.id === params.locationId || l.code === params.locationId) 
      || mockLocations.find(l => l.id === params.locationId || l.code === params.locationId)
      || locations[0]
      || mockLocations[0];

    if (!targetItem) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈដែលបានជ្រើសរើសឡើយ!' };
    }
    if (!targetLocation) {
      return { success: false, message: 'រកមិនឃើញទីតាំងដែលបានជ្រើសរើសឡើយ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនបញ្ចូលត្រូវតែធំជាង ០!' };
    }

    const isTargetHq = targetLocation.type === 'HQ' || 
                       targetLocation.code === 'HQ-ITSB' || 
                       targetLocation.id === '1' ||
                       (targetLocation.name_kh && targetLocation.name_kh.includes('HQ'));

    // 1. Update in-memory mock data with flexible matching
    const existingIndex = mockInventory.findIndex(inv => {
      const matchItem = inv.item_code === targetItem.code || inv.item_id === targetItem.id;
      if (!matchItem) return false;

      // Exact location ID or Code match
      if (inv.location_id === targetLocation.id || inv.location_id === targetLocation.code) return true;

      // HQ match
      if (isTargetHq) {
        return inv.location_id === '1' || 
               inv.location_id === 'HQ-ITSB' || 
               (inv.location_name_kh && inv.location_name_kh.includes('HQ'));
      }

      // Branch match by code or name
      if (targetLocation.code && inv.location_name_kh && inv.location_name_kh.includes(targetLocation.code)) return true;
      if (targetLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(targetLocation.name_kh) || targetLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    let calculatedNewQty = params.quantity;

    if (existingIndex >= 0) {
      mockInventory[existingIndex].quantity = (mockInventory[existingIndex].quantity || 0) + params.quantity;
      mockInventory[existingIndex].last_updated = new Date().toISOString();
      calculatedNewQty = mockInventory[existingIndex].quantity;
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
      calculatedNewQty = params.quantity;
    }

    // 2. Add Transaction record to mockTransactions
    mockTransactions.unshift({
      id: `tx-in-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'STOCK_IN',
      item_id: targetItem.id,
      item_code: targetItem.code,
      item_name_kh: targetItem.name_kh,
      item_name_en: targetItem.name_en,
      from_location: 'Supplier / Procurement',
      to_location: targetLocation.name_kh,
      to_location_id: targetLocation.id,
      quantity: params.quantity,
      unit: targetItem.unit,
      recorded_by: params.officerName || 'Admin-GDT',
      remark: params.purpose || 'បញ្ចូលស្តុកថ្មី',
      status: 'RECEIVED'
    });

    // 3. Immediately sync React state so UI updates instantaneously
    setInventory([...mockInventory]);

    // 4. If Supabase is configured, write to database reliably
    if (isConfigured) {
      try {
        // Resolve real Supabase item UUID
        let dbItemId = targetItem.id;
        if (!isValidUuid(dbItemId)) {
          const { data: itemRows } = await supabase
            .from('items')
            .select('id')
            .eq('code', targetItem.code)
            .maybeSingle();
          if (itemRows?.id) {
            dbItemId = itemRows.id;
          }
        }

        // Resolve real Supabase location UUID
        let dbLocId = targetLocation.id;
        if (!isValidUuid(dbLocId)) {
          const { data: locRows } = await supabase
            .from('locations')
            .select('id')
            .eq('code', targetLocation.code)
            .maybeSingle();
          if (locRows?.id) {
            dbLocId = locRows.id;
          }
        }

        if (isValidUuid(dbItemId) && isValidUuid(dbLocId)) {
          // Query current quantity in Supabase
          const { data: invRows } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('location_id', dbLocId)
            .eq('item_id', dbItemId)
            .maybeSingle();

          const currentQty = invRows ? (invRows.quantity || 0) : 0;
          const newQty = currentQty + params.quantity;

          // Upsert inventory row
          await supabase.from('inventory').upsert([
            {
              location_id: dbLocId,
              item_id: dbItemId,
              quantity: newQty,
              last_updated: new Date().toISOString(),
            }
          ], { onConflict: 'location_id,item_id' });

          // Insert transaction record
          await supabase.from('transactions').insert([
            {
              type: 'STOCK_IN',
              to_location_id: dbLocId,
              item_id: dbItemId,
              item_code: targetItem.code,
              item_name_kh: targetItem.name_kh,
              quantity: params.quantity,
              unit: targetItem.unit,
              recorded_by: params.officerName || 'Admin-GDT',
              remark: params.purpose || 'បញ្ចូលស្តុកថ្មី',
              status: 'RECEIVED'
            }
          ]);

          // Re-fetch live inventory from Supabase
          const liveInv = await fetchFullInventoryFromSupabase();
          if (liveInv && liveInv.length > 0) {
            setInventory(liveInv);
          }
        }
      } catch (dbErr: any) {
        console.warn('Supabase DB Stock-In Error (using local state fallback):', dbErr);
      }
    }

    return { 
      success: true, 
      newQuantity: calculatedNewQty,
      message: `បញ្ចូលស្តុក "${targetItem.name_kh}" ចំនួន ${params.quantity} ${targetItem.unit} ទៅកាន់ "${targetLocation.name_kh}" ជោគជ័យ! (ចំនួនសរុបថ្មី: ${calculatedNewQty} ${targetItem.unit})` 
    };
  };

  // Record Stock-Out (Decreases stock at source location)
  const recordStockOut = async (params: StockOutParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => i.id === params.itemId || i.code === params.itemId)
      || mockItems.find(i => i.id === params.itemId || i.code === params.itemId);

    const targetLocation = locations.find(l => l.id === params.locationId || l.code === params.locationId)
      || mockLocations.find(l => l.id === params.locationId || l.code === params.locationId)
      || locations[0]
      || mockLocations[0];

    if (!targetItem || !targetLocation) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈ ឬទីតាំងឡើយ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនដកចេញត្រូវតែធំជាង ០!' };
    }

    const isTargetHq = targetLocation.type === 'HQ' || 
                       targetLocation.code === 'HQ-ITSB' || 
                       targetLocation.id === '1' ||
                       (targetLocation.name_kh && targetLocation.name_kh.includes('HQ'));

    // 1. Check in-memory stock with flexible matching
    const existingIndex = mockInventory.findIndex(inv => {
      const matchItem = inv.item_code === targetItem.code || inv.item_id === targetItem.id;
      if (!matchItem) return false;

      if (inv.location_id === targetLocation.id || inv.location_id === targetLocation.code) return true;

      if (isTargetHq) {
        return inv.location_id === '1' || 
               inv.location_id === 'HQ-ITSB' || 
               (inv.location_name_kh && inv.location_name_kh.includes('HQ'));
      }

      if (targetLocation.code && inv.location_name_kh && inv.location_name_kh.includes(targetLocation.code)) return true;
      if (targetLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(targetLocation.name_kh) || targetLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    const availableLocalQty = existingIndex >= 0 ? (mockInventory[existingIndex].quantity || 0) : 0;
    if (availableLocalQty < params.quantity) {
      return { 
        success: false, 
        message: `បរិមាណស្តុកមិនគ្រប់គ្រាន់! ស្តុកជាក់ស្តែងនៅទីតាំងនេះមានតែ ${availableLocalQty} ${targetItem.unit} ប៉ុណ្ណោះ។` 
      };
    }

    // Deduct in-memory
    mockInventory[existingIndex].quantity -= params.quantity;
    mockInventory[existingIndex].last_updated = new Date().toISOString();
    const remainingQty = mockInventory[existingIndex].quantity;

    // Record Transaction in mockTransactions
    mockTransactions.unshift({
      id: `tx-out-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'STOCK_OUT',
      item_id: targetItem.id,
      item_code: targetItem.code,
      item_name_kh: targetItem.name_kh,
      item_name_en: targetItem.name_en,
      from_location: targetLocation.name_kh,
      from_location_id: targetLocation.id,
      to_location: 'Department / Operation',
      quantity: params.quantity,
      unit: targetItem.unit,
      recorded_by: params.officerName || 'Admin-GDT',
      remark: params.purpose || 'ដកចេញពីស្តុក',
      status: 'RECEIVED'
    });

    // Update React state immediately
    setInventory([...mockInventory]);

    // 2. If Supabase is configured, deduct from database
    if (isConfigured) {
      try {
        let dbItemId = targetItem.id;
        if (!isValidUuid(dbItemId)) {
          const { data: itemRows } = await supabase
            .from('items')
            .select('id')
            .eq('code', targetItem.code)
            .maybeSingle();
          if (itemRows?.id) dbItemId = itemRows.id;
        }

        let dbLocId = targetLocation.id;
        if (!isValidUuid(dbLocId)) {
          const { data: locRows } = await supabase
            .from('locations')
            .select('id')
            .eq('code', targetLocation.code)
            .maybeSingle();
          if (locRows?.id) dbLocId = locRows.id;
        }

        if (isValidUuid(dbItemId) && isValidUuid(dbLocId)) {
          const { data: invRows } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('location_id', dbLocId)
            .eq('item_id', dbItemId)
            .maybeSingle();

          const currentQty = invRows ? (invRows.quantity || 0) : 0;
          if (currentQty < params.quantity) {
            return { 
              success: false, 
              message: `បរិមាណស្តុកក្នុង Supabase មិនគ្រប់គ្រាន់! (មាន: ${currentQty}, ស្នើសុំ: ${params.quantity})` 
            };
          }

          const newQty = currentQty - params.quantity;
          await supabase.from('inventory').upsert([
            {
              location_id: dbLocId,
              item_id: dbItemId,
              quantity: newQty,
              last_updated: new Date().toISOString(),
            }
          ], { onConflict: 'location_id,item_id' });

          await supabase.from('transactions').insert([
            {
              type: 'STOCK_OUT',
              from_location_id: dbLocId,
              item_id: dbItemId,
              item_code: targetItem.code,
              item_name_kh: targetItem.name_kh,
              quantity: params.quantity,
              unit: targetItem.unit,
              recorded_by: params.officerName || 'Admin-GDT',
              remark: params.purpose || 'ដកចេញពីស្តុក',
              status: 'RECEIVED'
            }
          ]);

          const liveInv = await fetchFullInventoryFromSupabase();
          if (liveInv && liveInv.length > 0) {
            setInventory(liveInv);
          }
        }
      } catch (dbErr: any) {
        console.warn('Supabase DB Stock-Out Error:', dbErr);
      }
    }

    return { 
      success: true, 
      newQuantity: remainingQty,
      message: `ដកចេញ "${targetItem.name_kh}" ចំនួន ${params.quantity} ${targetItem.unit} ជោគជ័យ! (នៅសល់: ${remainingQty} ${targetItem.unit})` 
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
      setInventory([...mockInventory]);
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
