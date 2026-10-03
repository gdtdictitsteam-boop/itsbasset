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

export interface StockInParams {
  locationId: string;
  itemId: string;
  quantity: number;
  officerName: string;
  purpose: string;
}

export interface StockOutParams {
  locationId: string;
  itemId: string;
  quantity: number;
  officerName?: string;
  purpose?: string;
}

export interface InventoryContextType {
  inventory: InventoryItem[];
  items: Item[];
  locations: Location[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  recordStockIn: (params: StockInParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordStockOut: (params: StockOutParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  reseedStandardStock: () => Promise<{ success: boolean; message: string }>;
  addNewItemToContext: (item: Item, initialStock?: number, locationId?: string) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Storage keys for persistent local fallback
const ITEMS_STORAGE_KEY = 'gdt_inventory_items_v4';
const INVENTORY_STORAGE_KEY = 'gdt_inventory_stock_v4';
const TX_STORAGE_KEY = 'gdt_inventory_tx_v4';

const saveToStorage = (itemsList: Item[], invList: InventoryItem[], txList?: any[]) => {
  try {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(itemsList));
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(invList));
    if (txList) {
      localStorage.setItem(TX_STORAGE_KEY, JSON.stringify(txList.slice(0, 50)));
    }
  } catch (err) {
    console.warn('Failed to save to localStorage:', err);
  }
};

const loadFromStorage = () => {
  try {
    const rawItems = localStorage.getItem(ITEMS_STORAGE_KEY);
    const rawInv = localStorage.getItem(INVENTORY_STORAGE_KEY);
    const rawTx = localStorage.getItem(TX_STORAGE_KEY);

    if (rawItems) {
      const parsedItems: Item[] = JSON.parse(rawItems);
      const itemMap = new Map<string, Item>();
      mockItems.forEach(i => itemMap.set(i.code, i));
      parsedItems.forEach(i => itemMap.set(i.code, i));
      const merged = Array.from(itemMap.values());
      mockItems.length = 0;
      mockItems.push(...merged);
    }

    if (rawInv) {
      const parsedInv: InventoryItem[] = JSON.parse(rawInv);
      if (Array.isArray(parsedInv) && parsedInv.length > 0) {
        mockInventory.length = 0;
        mockInventory.push(...parsedInv);
      }
    }

    if (rawTx) {
      const parsedTx = JSON.parse(rawTx);
      if (Array.isArray(parsedTx) && parsedTx.length > 0) {
        const txIds = new Set(mockTransactions.map(t => t.id));
        parsedTx.forEach((t: any) => {
          if (!txIds.has(t.id)) {
            mockTransactions.push(t);
            txIds.add(t.id);
          }
        });
      }
    }
  } catch (e) {
    console.warn('Could not read from localStorage:', e);
  }
};

// Global unified helper to test if a location or inventory row is HQ
export const isHqLocationOrRow = (rowOrLoc: any, locationsList?: Location[]): boolean => {
  if (!rowOrLoc) return false;
  const locId = String(rowOrLoc.location_id || rowOrLoc.id || '').trim();
  const locCode = String(rowOrLoc.location_code || rowOrLoc.code || '').trim();
  const locType = String(rowOrLoc.type || rowOrLoc.location_type || '').trim().toUpperCase();
  const locNameKh = String(rowOrLoc.location_name_kh || rowOrLoc.name_kh || '').trim();
  const locNameEn = String(rowOrLoc.location_name_en || rowOrLoc.name_en || '').trim();

  // If ALL or combined filter, never HQ
  if (locId === 'ALL' || locCode === 'ALL' || locType === 'ALL') return false;

  // 1. Direct IDs or Codes for HQ
  if (locId === '1' || locId === 'HQ-ITSB' || locCode === 'HQ-ITSB' || locId === 'ITSB-HQ' || locCode === 'ITSB-HQ') return true;
  if (locId === '35' || locId === 'Tech-HQ' || locCode === 'Tech-HQ') return true;
  if (locType === 'HQ') return true;

  // 2. Lookup in locations list if available
  if (locationsList && locationsList.length > 0) {
    const found = locationsList.find(l => 
      String(l.id) === locId || 
      String(l.code) === locId || 
      (locCode && String(l.code) === locCode)
    );
    if (found) {
      if (found.id === 'ALL' || found.code === 'ALL' || String(found.type).toUpperCase() === 'ALL') return false;
      if (found.type === 'HQ' || found.code === 'HQ-ITSB' || found.code === 'ITSB-HQ' || found.code === 'Tech-HQ') return true;
      if (found.name_kh && !found.name_kh.includes('ខេត្តកណ្តាល') && (found.name_kh.includes('HQ') || found.name_kh.includes('ថ្នាក់កណ្តាល'))) return true;
    }
  }

  // 3. Name heuristics (covers ITSB-HQ, Tech-HQ, and central team, explicitly excluding Kandal Province)
  if (locNameKh && !locNameKh.includes('ខេត្តកណ្តាល') && (locNameKh.includes('HQ') || locNameKh.includes('ថ្នាក់កណ្តាល'))) {
    return true;
  }
  if (locNameEn && (locNameEn.includes('HQ') || locNameEn.includes('Central Working Group'))) {
    return true;
  }

  return false;
};

// Helper to test if a string is a valid UUID
const isValidUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const { setLocationsList } = useLocationContext();

  // Load any previously persisted local state
  loadFromStorage();

  const [items, setItems] = useState<Item[]>(() => [...mockItems]);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => [...mockInventory]);
  const [locations, setLocations] = useState<Location[]>(() => [...mockLocations]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshInventory = useCallback(async () => {
    if (!isConfigured) {
      loadFromStorage();
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
        const mergedItems = Array.from(itemMap.values());
        setItems(mergedItems);
        mockItems.length = 0;
        mockItems.push(...mergedItems);
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
        mockInventory.length = 0;
        mockInventory.push(...liveInventory);
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

  // Add new item seamlessly into context and storage
  const addNewItemToContext = (newItem: Item, initialStock: number = 0, targetLocationId: string = '1') => {
    const existingItemIdx = mockItems.findIndex(i => i.code === newItem.code || i.id === newItem.id);
    if (existingItemIdx >= 0) {
      mockItems[existingItemIdx] = { ...mockItems[existingItemIdx], ...newItem };
    } else {
      mockItems.push(newItem);
    }

    const targetLoc = locations.find(l => String(l.id) === String(targetLocationId) || String(l.code) === String(targetLocationId))
      || mockLocations.find(l => String(l.id) === String(targetLocationId) || String(l.code) === String(targetLocationId))
      || mockLocations[0];

    const isTargetHq = isHqLocationOrRow(targetLoc, locations);

    const existingInvIdx = mockInventory.findIndex(inv => 
      (String(inv.item_code) === String(newItem.code) || String(inv.item_id) === String(newItem.id)) &&
      (String(inv.location_id) === String(targetLoc.id) || (isTargetHq && isHqLocationOrRow(inv, locations)))
    );

    if (existingInvIdx >= 0) {
      if (initialStock > 0) {
        mockInventory[existingInvIdx].quantity = (mockInventory[existingInvIdx].quantity || 0) + initialStock;
        mockInventory[existingInvIdx].last_updated = new Date().toISOString();
      }
    } else {
      mockInventory.push({
        location_id: targetLoc.id,
        item_id: newItem.id,
        quantity: initialStock,
        last_updated: new Date().toISOString(),
        item_code: newItem.code,
        item_name_kh: newItem.name_kh,
        item_name_en: newItem.name_en,
        category: newItem.category,
        unit: newItem.unit,
        min_stock: newItem.min_stock,
        location_name_kh: targetLoc.name_kh,
        location_name_en: targetLoc.name_en,
        location_code: targetLoc.code,
        type: targetLoc.type,
        image_url: newItem.image_url,
      });
    }

    // Ensure an HQ row exists for this item so HQ stock can always be tracked and displayed
    const hasHqRow = mockInventory.some(inv => 
      (String(inv.item_code) === String(newItem.code) || String(inv.item_id) === String(newItem.id)) &&
      isHqLocationOrRow(inv, locations)
    );
    if (!hasHqRow) {
      const hqLoc = locations.find(l => isHqLocationOrRow(l, locations)) || mockLocations[0];
      mockInventory.push({
        location_id: hqLoc.id,
        item_id: newItem.id,
        quantity: isTargetHq ? initialStock : 0,
        last_updated: new Date().toISOString(),
        item_code: newItem.code,
        item_name_kh: newItem.name_kh,
        item_name_en: newItem.name_en,
        category: newItem.category,
        unit: newItem.unit,
        min_stock: newItem.min_stock,
        location_name_kh: hqLoc.name_kh,
        location_name_en: hqLoc.name_en,
        location_code: hqLoc.code,
        type: hqLoc.type,
        image_url: newItem.image_url,
      });
    }

    if (initialStock > 0) {
      mockTransactions.unshift({
        id: `tx-new-${Date.now()}`,
        date: new Date().toISOString(),
        type: 'STOCK_IN',
        item_id: newItem.id,
        item_code: newItem.code,
        item_name_kh: newItem.name_kh,
        item_name_en: newItem.name_en,
        from_location: 'New SKU Entry',
        to_location: targetLoc.name_kh,
        to_location_id: targetLoc.id,
        quantity: initialStock,
        unit: newItem.unit,
        recorded_by: 'Admin-GDT',
        remark: 'បញ្ចូលសម្ភារថ្មីដំបូង',
        status: 'RECEIVED'
      });
    }

    saveToStorage(mockItems, mockInventory, mockTransactions);
    setItems([...mockItems]);
    setInventory([...mockInventory]);
  };

  // Record Stock-In (Increases stock at target location)
  const recordStockIn = async (params: StockInParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId)) 
      || mockItems.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));

    const targetLocation = locations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId)) 
      || mockLocations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
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

    const isTargetHq = isHqLocationOrRow(targetLocation, locations);

    // 1. Update in-memory mock data with flexible matching
    const existingIndex = mockInventory.findIndex(inv => {
      const matchItem = String(inv.item_code) === String(targetItem.code) || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      // Exact location ID or Code match
      if (String(inv.location_id) === String(targetLocation.id) || 
          String(inv.location_id) === String(targetLocation.code)) return true;

      // HQ match
      if (isTargetHq && isHqLocationOrRow(inv, locations)) {
        return true;
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
      const newInvRow: InventoryItem = {
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
        location_code: targetLocation.code,
        type: targetLocation.type,
        image_url: targetItem.image_url,
      };
      mockInventory.push(newInvRow);
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

    // 3. Immediately persist to localStorage and sync React state
    saveToStorage(mockItems, mockInventory, mockTransactions);
    setInventory([...mockInventory]);

    // 4. If Supabase is configured, write to database reliably
    if (isConfigured) {
      try {
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
          const { data: invRows } = await supabase
            .from('inventory')
            .select('quantity')
            .eq('location_id', dbLocId)
            .eq('item_id', dbItemId)
            .maybeSingle();

          const currentQty = invRows ? (invRows.quantity || 0) : 0;
          const newQty = currentQty + params.quantity;

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

          const liveInv = await fetchFullInventoryFromSupabase();
          if (liveInv && liveInv.length > 0) {
            setInventory(liveInv);
            mockInventory.length = 0;
            mockInventory.push(...liveInv);
            saveToStorage(mockItems, mockInventory, mockTransactions);
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
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId))
      || mockItems.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));

    const targetLocation = locations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
      || mockLocations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
      || locations[0]
      || mockLocations[0];

    if (!targetItem || !targetLocation) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈ ឬទីតាំងឡើយ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនដកចេញត្រូវតែធំជាង ០!' };
    }

    const isTargetHq = isHqLocationOrRow(targetLocation, locations);

    // 1. Check in-memory stock with flexible matching
    const existingIndex = mockInventory.findIndex(inv => {
      const matchItem = String(inv.item_code) === String(targetItem.code) || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(targetLocation.id) || 
          String(inv.location_id) === String(targetLocation.code)) return true;

      if (isTargetHq && isHqLocationOrRow(inv, locations)) {
        return true;
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

    mockInventory[existingIndex].quantity -= params.quantity;
    mockInventory[existingIndex].last_updated = new Date().toISOString();
    const remainingQty = mockInventory[existingIndex].quantity;

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

    saveToStorage(mockItems, mockInventory, mockTransactions);
    setInventory([...mockInventory]);

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
            mockInventory.length = 0;
            mockInventory.push(...liveInv);
            saveToStorage(mockItems, mockInventory, mockTransactions);
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
          location_name_kh: 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB',
          location_name_en: 'HQ-ITSB Technical Inventory',
          location_code: 'HQ-ITSB',
          type: 'HQ'
        });
      });
      saveToStorage(mockItems, mockInventory, mockTransactions);
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
      addNewItemToContext,
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
