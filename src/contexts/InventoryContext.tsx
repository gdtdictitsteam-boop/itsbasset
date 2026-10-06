import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockItems, mockInventory, mockLocations, mockTransactions, standardItemQuantities } from '../mockData';
import { Item, InventoryItem, Location } from '../types';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchFullInventoryFromSupabase,
  seedInitialInventoryToSupabase,
  supabaseRecordStockIn,
  supabaseRecordStockOut,
  supabaseHandleHandover,
  supabaseAcknowledgeHandover,
  supabaseRecordAdjustment
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

export interface HandoverParams {
  fromLocationId: string;
  toLocationId: string;
  itemId: string;
  quantity: number;
  officerName?: string;
  purpose?: string;
  documentUrl?: string;
  isRequisition?: boolean;
}

export interface AdjustmentParams {
  locationId: string;
  itemId: string;
  actualQuantity: number;
  officerName?: string;
  reason?: string;
  remark?: string;
}

export interface InventoryContextType {
  inventory: InventoryItem[];
  items: Item[];
  locations: Location[];
  isLoading: boolean;
  refreshInventory: () => Promise<void>;
  recordStockIn: (params: StockInParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordStockOut: (params: StockOutParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordHandover: (params: HandoverParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  acknowledgeHandover: (transactionId: string, receivedBy?: string) => Promise<{ success: boolean; message: string; newBranchQuantity?: number }>;
  recordAdjustment: (params: AdjustmentParams) => Promise<{ success: boolean; message: string; previousQuantity?: number; newQuantity?: number; delta?: number }>;
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

// Global unified helper to test if a location or inventory row is HQ (HQ-ITSB Central Warehouse)
export const isHqLocationOrRow = (rowOrLoc: any, locationsList?: Location[]): boolean => {
  if (!rowOrLoc) return false;
  const locId = String(rowOrLoc.location_id || rowOrLoc.id || '').trim();
  const locCode = String(rowOrLoc.location_code || rowOrLoc.code || '').trim().toUpperCase();
  const locType = String(rowOrLoc.type || rowOrLoc.location_type || '').trim().toUpperCase();
  const locNameKh = String(rowOrLoc.location_name_kh || rowOrLoc.name_kh || '').trim();
  const locNameEn = String(rowOrLoc.location_name_en || rowOrLoc.name_en || '').trim();

  // If ALL or combined filter, never HQ
  if (locId === 'ALL' || locCode === 'ALL' || locType === 'ALL') return false;

  // Tech-HQ is Central Working Group branch, NOT the HQ central stock
  if (locId === '35' || locCode === 'TECH-HQ' || locNameKh.includes('Tech-HQ') || locNameEn.includes('Tech-HQ')) return false;

  // 1. Direct IDs or Codes for HQ
  if (locId === '1' || locId === 'HQ-ITSB' || locCode === 'HQ-ITSB' || locId === 'ITSB-HQ' || locCode === 'ITSB-HQ') return true;
  if (locType === 'HQ') return true;

  // 2. Lookup in locations list if available
  if (locationsList && locationsList.length > 0) {
    const found = locationsList.find(l => 
      String(l.id) === locId || 
      String(l.code).toUpperCase() === locCode || 
      (locId && String(l.code).toUpperCase() === locId.toUpperCase())
    );
    if (found) {
      if (found.id === 'ALL' || found.code === 'ALL' || String(found.type).toUpperCase() === 'ALL') return false;
      if (found.type === 'HQ' || found.code === 'HQ-ITSB' || found.code === 'ITSB-HQ') return true;
      if (found.code === 'Tech-HQ' || String(found.type).toUpperCase() === 'BRANCH') return false;
      if (found.name_kh && !found.name_kh.includes('ខេត្តកណ្តាល') && (found.name_kh.includes('HQ-ITSB') || found.name_kh.includes('ITSB-HQ') || found.name_kh.includes('ស្តុកសម្ភារបច្ចេកទេស'))) return true;
    }
  }

  // 3. Name heuristics (strictly HQ-ITSB warehouse, excluding Kandal Province and Tech-HQ)
  if (locNameKh && !locNameKh.includes('ខេត្តកណ្តាល') && !locNameKh.includes('Tech-HQ') && (locNameKh.includes('HQ-ITSB') || locNameKh.includes('ITSB-HQ') || locNameKh.includes('ស្តុកសម្ភារបច្ចេកទេស'))) {
    return true;
  }
  if (locNameEn && (locNameEn.includes('HQ-ITSB') || locNameEn.includes('ITSB-HQ') || locNameEn.includes('HQ Technical Inventory'))) {
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
      if (itemsErr) {
        console.error('[InventoryContext] Error fetching items from Supabase (Check RLS policy on items):', itemsErr);
      }
      if (!itemsErr && dbItems && dbItems.length > 0) {
        console.log(`[InventoryContext] Fetched ${dbItems.length} items from Supabase.`);
        const itemMap = new Map<string, Item>();
        mockItems.forEach(i => itemMap.set(i.code, i));
        dbItems.forEach((i: any) => {
          const itemCode = (i.code || i.sku || '').trim();
          const itemNameKh = (i.name_kh || i.name || '').trim();
          const itemNameEn = (i.name_en || i.name || itemNameKh).trim();
          const key = itemCode || i.id;
          itemMap.set(key, {
            id: i.id,
            code: itemCode || key,
            name_kh: itemNameKh || 'សម្ភារៈគ្មានឈ្មោះ',
            name_en: itemNameEn || 'Unnamed Item',
            category: i.category || 'Tools',
            unit: i.unit || 'គ្រឿង',
            min_stock: i.min_stock ?? 5,
            image_url: i.image_url || undefined,
          });
        });
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
      if (liveInventory !== null) {
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

  // Record Stock-In (Increases stock at target location, defaulting to HQ if ALL is selected)
  const recordStockIn = async (params: StockInParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId)) 
      || mockItems.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));

    // Resolve target location - must always be a concrete physical warehouse (never 'ALL')
    let targetLocation = locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
    );

    if (!targetLocation && params.locationId !== 'ALL') {
      targetLocation = mockLocations.find(l => 
        l.id !== 'ALL' && l.code !== 'ALL' &&
        (String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
      );
    }

    // Default fallback is ALWAYS the central HQ warehouse (HQ-ITSB)
    if (!targetLocation) {
      targetLocation = locations.find(l => isHqLocationOrRow(l, locations))
        || mockLocations.find(l => isHqLocationOrRow(l, mockLocations))
        || locations.find(l => l.code !== 'ALL')
        || mockLocations[0];
    }

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
      const matchItem = String(inv.item_code)?.trim().toUpperCase() === String(targetItem.code)?.trim().toUpperCase() || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      // Exact location ID or Code match
      if (String(inv.location_id) === String(targetLocation.id) || 
          String(inv.location_id) === String(targetLocation.code)) return true;

      // HQ match: If target is HQ and this inventory row is HQ
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
      if (isTargetHq) {
        mockInventory[existingIndex].type = 'HQ';
        mockInventory[existingIndex].location_code = targetLocation.code || 'HQ-ITSB';
        mockInventory[existingIndex].location_name_kh = targetLocation.name_kh;
        mockInventory[existingIndex].location_name_en = targetLocation.name_en;
      }
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
        location_code: targetLocation.code || (isTargetHq ? 'HQ-ITSB' : ''),
        type: isTargetHq ? 'HQ' : targetLocation.type,
        image_url: targetItem.image_url,
      };
      mockInventory.push(newInvRow);
      calculatedNewQty = params.quantity;
    }

    // Ensure an HQ row always exists for this item
    const hasHq = mockInventory.some(inv => 
      (String(inv.item_code)?.trim().toUpperCase() === String(targetItem.code)?.trim().toUpperCase() || 
       String(inv.item_id) === String(targetItem.id)) &&
      isHqLocationOrRow(inv, locations)
    );
    if (!hasHq) {
      const hqLoc = locations.find(l => isHqLocationOrRow(l, locations)) || mockLocations[0];
      mockInventory.push({
        location_id: hqLoc.id,
        item_id: targetItem.id,
        quantity: isTargetHq ? params.quantity : 0,
        last_updated: new Date().toISOString(),
        item_code: targetItem.code,
        item_name_kh: targetItem.name_kh,
        item_name_en: targetItem.name_en,
        category: targetItem.category,
        unit: targetItem.unit,
        min_stock: targetItem.min_stock,
        location_name_kh: hqLoc.name_kh,
        location_name_en: hqLoc.name_en,
        location_code: hqLoc.code || 'HQ-ITSB',
        type: 'HQ',
        image_url: targetItem.image_url,
      });
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
        await supabaseRecordStockIn({
          locationId: targetLocation.id,
          locationCode: targetLocation.code,
          itemId: targetItem.id,
          itemCode: targetItem.code,
          quantity: params.quantity,
          recordedBy: params.officerName || 'Admin-GDT',
          remark: params.purpose || 'បញ្ចូលស្តុកថ្មី'
        });

        const liveInv = await fetchFullInventoryFromSupabase();
        if (liveInv && liveInv.length > 0) {
          setInventory(liveInv);
          mockInventory.length = 0;
          mockInventory.push(...liveInv);
          saveToStorage(mockItems, mockInventory, mockTransactions);
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

    // Resolve target location - must always be a concrete physical warehouse (never 'ALL')
    let targetLocation = locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
    );

    if (!targetLocation && params.locationId !== 'ALL') {
      targetLocation = mockLocations.find(l => 
        l.id !== 'ALL' && l.code !== 'ALL' &&
        (String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId))
      );
    }

    if (!targetLocation) {
      targetLocation = locations.find(l => isHqLocationOrRow(l, locations))
        || mockLocations.find(l => isHqLocationOrRow(l, mockLocations))
        || locations.find(l => l.code !== 'ALL')
        || mockLocations[0];
    }

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
        await supabaseRecordStockOut({
          locationId: targetLocation.id,
          locationCode: targetLocation.code,
          itemId: targetItem.id,
          itemCode: targetItem.code,
          quantity: params.quantity,
          recordedBy: params.officerName || 'Admin-GDT',
          remark: params.purpose || 'ដកចេញពីស្តុក'
        });

        const liveInv = await fetchFullInventoryFromSupabase();
        if (liveInv && liveInv.length > 0) {
          setInventory(liveInv);
          mockInventory.length = 0;
          mockInventory.push(...liveInv);
          saveToStorage(mockItems, mockInventory, mockTransactions);
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

  // Record Handover (Transfers stock from HQ or branch to target branch)
  const recordHandover = async (params: HandoverParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code)?.toUpperCase() === String(params.itemId)?.toUpperCase())
      || mockItems.find(i => String(i.id) === String(params.itemId) || String(i.code)?.toUpperCase() === String(params.itemId)?.toUpperCase());

    // Resolve source location
    let fromLocation = locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(params.fromLocationId) || String(l.code)?.toUpperCase() === String(params.fromLocationId)?.toUpperCase())
    );
    if (!fromLocation && params.fromLocationId !== 'ALL') {
      fromLocation = mockLocations.find(l => 
        l.id !== 'ALL' && l.code !== 'ALL' &&
        (String(l.id) === String(params.fromLocationId) || String(l.code)?.toUpperCase() === String(params.fromLocationId)?.toUpperCase())
      );
    }
    if (!fromLocation) {
      fromLocation = locations.find(l => isHqLocationOrRow(l, locations))
        || mockLocations.find(l => isHqLocationOrRow(l, mockLocations))
        || mockLocations[0];
    }

    // Resolve target location
    let toLocation = locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(params.toLocationId) || String(l.code)?.toUpperCase() === String(params.toLocationId)?.toUpperCase())
    );
    if (!toLocation) {
      toLocation = mockLocations.find(l => 
        l.id !== 'ALL' && l.code !== 'ALL' &&
        (String(l.id) === String(params.toLocationId) || String(l.code)?.toUpperCase() === String(params.toLocationId)?.toUpperCase())
      );
    }

    if (!targetItem) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈដែលបានជ្រើសរើសឡើយ!' };
    }
    if (!fromLocation || !toLocation) {
      return { success: false, message: 'រកមិនឃើញទីតាំងដើម ឬទីតាំងគោលដៅឡើយ!' };
    }
    if (fromLocation.id === toLocation.id || fromLocation.code === toLocation.code) {
      return { success: false, message: 'ទីតាំងដើម និងទីតាំងគោលដៅ មិនអាចដូចគ្នាបានទេ!' };
    }
    if (params.quantity <= 0) {
      return { success: false, message: 'ចំនួនស្នើសុំផ្ទេរត្រូវតែធំជាង ០!' };
    }

    const isFromHq = isHqLocationOrRow(fromLocation, locations);

    // 1. Calculate available stock at source location with flexible matching
    const matchingSourceRows = mockInventory.filter(inv => {
      const matchItem = String(inv.item_code)?.trim().toUpperCase() === String(targetItem.code)?.trim().toUpperCase() || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(fromLocation.id) || 
          String(inv.location_id) === String(fromLocation.code)) return true;

      if (isFromHq && isHqLocationOrRow(inv, locations)) return true;

      if (fromLocation.code && inv.location_name_kh && inv.location_name_kh.includes(fromLocation.code)) return true;
      if (fromLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(fromLocation.name_kh) || fromLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    const totalAvailableSourceQty = matchingSourceRows.reduce((sum, r) => sum + (r.quantity || 0), 0);

    if (totalAvailableSourceQty < params.quantity) {
      return {
        success: false,
        message: `បរិមាណស្តុកមិនគ្រប់គ្រាន់! ស្តុកជាក់ស្តែងនៅ "${fromLocation.name_kh}" មានតែ ${totalAvailableSourceQty} ${targetItem.unit} ប៉ុណ្ណោះ។`
      };
    }

    // 2. Deduct from source in-memory
    let remainingToDeduct = params.quantity;
    for (const row of matchingSourceRows) {
      if (remainingToDeduct <= 0) break;
      const deductFromThis = Math.min(row.quantity, remainingToDeduct);
      row.quantity -= deductFromThis;
      row.last_updated = new Date().toISOString();
      remainingToDeduct -= deductFromThis;
    }

    // 3. Direct Handover Auto Sync: Credit / Add stock to destination branch in-memory immediately
    const destRowIndex = mockInventory.findIndex(inv => {
      const matchItem = String(inv.item_code)?.trim().toUpperCase() === String(targetItem.code)?.trim().toUpperCase() || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(toLocation.id) || 
          String(inv.location_id) === String(toLocation.code)) return true;

      if (toLocation.code && inv.location_code && String(inv.location_code).toUpperCase() === String(toLocation.code).toUpperCase()) return true;
      if (toLocation.code && inv.location_name_kh && inv.location_name_kh.includes(toLocation.code)) return true;
      if (toLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(toLocation.name_kh) || toLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    if (destRowIndex >= 0) {
      mockInventory[destRowIndex].quantity = (mockInventory[destRowIndex].quantity || 0) + params.quantity;
      mockInventory[destRowIndex].last_updated = new Date().toISOString();
    } else {
      mockInventory.push({
        location_id: toLocation.id,
        item_id: targetItem.id,
        quantity: params.quantity,
        last_updated: new Date().toISOString(),
        item_code: targetItem.code,
        item_name_kh: targetItem.name_kh,
        item_name_en: targetItem.name_en,
        category: targetItem.category,
        unit: targetItem.unit,
        min_stock: targetItem.min_stock ?? 5,
        location_name_kh: toLocation.name_kh,
        location_name_en: toLocation.name_en,
        location_code: toLocation.code,
        type: toLocation.type || 'BRANCH'
      });
    }

    // 4. Create transaction record with status COMPLETED (Direct Handover)
    const finalRemark = params.documentUrl
      ? `${(params.purpose || 'ផ្ទេរសម្ភារៈជូនសាខា').trim()} | ឯកសារយោង: ${params.documentUrl}`
      : (params.purpose || 'ផ្ទេរសម្ភារៈជូនសាខា').trim();

    mockTransactions.unshift({
      id: `tx-handover-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'HANDOVER',
      from_location: fromLocation.name_kh,
      from_location_id: fromLocation.id,
      to_location: toLocation.name_kh,
      to_location_id: toLocation.id,
      item_id: targetItem.id,
      item_code: targetItem.code,
      item_name_kh: targetItem.name_kh,
      item_name_en: targetItem.name_en,
      quantity: params.quantity,
      unit: targetItem.unit,
      recorded_by: params.officerName || 'Admin-GDT',
      remark: finalRemark,
      status: 'COMPLETED'
    });

    saveToStorage(mockItems, mockInventory, mockTransactions);
    setInventory([...mockInventory]);

    // 5. Supabase DB Persistence
    if (isConfigured) {
      try {
        await supabaseHandleHandover({
          fromLocationId: fromLocation.id,
          toLocationId: toLocation.id,
          fromLocationCode: fromLocation.code,
          toLocationCode: toLocation.code,
          itemId: targetItem.id,
          itemCode: targetItem.code,
          quantity: params.quantity,
          recordedBy: params.officerName || 'Admin-GDT',
          remark: finalRemark
        });

        const liveInv = await fetchFullInventoryFromSupabase();
        if (liveInv && liveInv.length > 0) {
          setInventory(liveInv);
          mockInventory.length = 0;
          mockInventory.push(...liveInv);
          saveToStorage(mockItems, mockInventory, mockTransactions);
        }
      } catch (dbErr: any) {
        console.warn('Supabase Handover Sync Error:', dbErr);
      }
    }

    const remainingSource = totalAvailableSourceQty - params.quantity;
    return {
      success: true,
      newQuantity: remainingSource,
      message: `បានផ្ទេរ និងបញ្ចូលស្តុកសម្ភារៈ "${targetItem.name_kh}" ចំនួន ${params.quantity} ${targetItem.unit} ទៅកាន់ "${toLocation.name_kh}" រួចរាល់ដោយស្វ័យប្រវត្តិ (ស្ថានភាព: COMPLETED)!`
    };
  };

  // Acknowledge Handover (Branch accepts received stock, updates status to RECEIVED and increments branch balance)
  const acknowledgeHandover = async (transactionId: string, receivedBy?: string): Promise<{ success: boolean; message: string; newBranchQuantity?: number }> => {
    const txIndex = mockTransactions.findIndex(t => t.id === transactionId);
    let targetTx = txIndex >= 0 ? mockTransactions[txIndex] : null;

    if (!targetTx && isConfigured) {
      const { data: dbTx } = await supabase.from('transactions').select('*').eq('id', transactionId).maybeSingle();
      if (dbTx) targetTx = dbTx;
    }

    if (!targetTx) {
      return { success: false, message: 'រកមិនឃើញទិន្នន័យប្រតិបត្តិការផ្ទេរនេះឡើយ!' };
    }

    if (targetTx.status === 'RECEIVED') {
      return { success: false, message: 'ប្រតិបត្តិការនេះត្រូវបានទទួលស្គាល់រួចរាល់ហើយ!' };
    }

    // 1. Update mock transaction
    if (txIndex >= 0) {
      mockTransactions[txIndex].status = 'RECEIVED';
      mockTransactions[txIndex].recorded_by = receivedBy || mockTransactions[txIndex].recorded_by;
      mockTransactions[txIndex].date = new Date().toISOString();
    }

    // 2. Increment destination branch stock
    const destLocId = targetTx.to_location_id;
    const destLoc = locations.find(l => String(l.id) === String(destLocId) || String(l.code) === String(destLocId))
      || mockLocations.find(l => String(l.id) === String(destLocId) || String(l.code) === String(destLocId));

    const itemObj = items.find(i => String(i.id) === String(targetTx.item_id) || String(i.code) === String(targetTx.item_code))
      || mockItems.find(i => String(i.id) === String(targetTx.item_id) || String(i.code) === String(targetTx.item_code));

    const destInvIndex = mockInventory.findIndex(inv => 
      (String(inv.item_id) === String(targetTx.item_id) || (itemObj && String(inv.item_code) === String(itemObj.code))) &&
      (String(inv.location_id) === String(destLocId) || (destLoc && String(inv.location_id) === String(destLoc.code)))
    );

    let newDestQty = targetTx.quantity;
    if (destInvIndex >= 0) {
      mockInventory[destInvIndex].quantity = (mockInventory[destInvIndex].quantity || 0) + targetTx.quantity;
      mockInventory[destInvIndex].last_updated = new Date().toISOString();
      newDestQty = mockInventory[destInvIndex].quantity;
    } else if (itemObj && destLoc) {
      mockInventory.push({
        location_id: destLoc.id,
        item_id: itemObj.id,
        quantity: targetTx.quantity,
        last_updated: new Date().toISOString(),
        item_code: itemObj.code,
        item_name_kh: itemObj.name_kh,
        item_name_en: itemObj.name_en,
        category: itemObj.category,
        unit: itemObj.unit,
        min_stock: itemObj.min_stock,
        location_name_kh: destLoc.name_kh,
        location_name_en: destLoc.name_en,
        location_code: destLoc.code,
        type: destLoc.type
      });
    }

    saveToStorage(mockItems, mockInventory, mockTransactions);
    setInventory([...mockInventory]);

    // 3. Supabase synchronization
    if (isConfigured) {
      try {
        await supabaseAcknowledgeHandover({
          transactionId,
          receivedBy: receivedBy || 'BranchUser'
        });
        const liveInv = await fetchFullInventoryFromSupabase();
        if (liveInv && liveInv.length > 0) {
          setInventory(liveInv);
          mockInventory.length = 0;
          mockInventory.push(...liveInv);
          saveToStorage(mockItems, mockInventory, mockTransactions);
        }
      } catch (err) {
        console.warn('Supabase acknowledge handover sync notice:', err);
      }
    }

    return {
      success: true,
      newBranchQuantity: newDestQty,
      message: `បានទទួលស្គាល់ការផ្ទេរសម្ភារៈ "${targetTx.item_name_kh}" ចំនួន ${targetTx.quantity} ${targetTx.unit} ចូលស្តុកសាខាជោគជ័យ!`
    };
  };

  // Record Adjustment (Reconciles Actual Physical Count with System Balance)
  const recordAdjustment = async (params: AdjustmentParams): Promise<{
    success: boolean;
    message: string;
    previousQuantity?: number;
    newQuantity?: number;
    delta?: number;
  }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code)?.toUpperCase() === String(params.itemId)?.toUpperCase())
      || mockItems.find(i => String(i.id) === String(params.itemId) || String(i.code)?.toUpperCase() === String(params.itemId)?.toUpperCase());

    let targetLocation = locations.find(l => 
      l.id !== 'ALL' && l.code !== 'ALL' && 
      (String(l.id) === String(params.locationId) || String(l.code)?.toUpperCase() === String(params.locationId)?.toUpperCase())
    );
    if (!targetLocation && params.locationId !== 'ALL') {
      targetLocation = mockLocations.find(l => 
        l.id !== 'ALL' && l.code !== 'ALL' &&
        (String(l.id) === String(params.locationId) || String(l.code)?.toUpperCase() === String(params.locationId)?.toUpperCase())
      );
    }
    if (!targetLocation) {
      targetLocation = locations.find(l => isHqLocationOrRow(l, locations)) || mockLocations[0];
    }

    if (!targetItem) {
      return { success: false, message: 'រកមិនឃើញសម្ភារៈដែលបានជ្រើសរើសឡើយ!' };
    }
    if (!targetLocation) {
      return { success: false, message: 'រកមិនឃើញទីតាំងដែលត្រូវកែតម្រូវឡើយ!' };
    }
    if (params.actualQuantity < 0) {
      return { success: false, message: 'ចំនួនស្តុកជាក់ស្តែងមិនអាចជាលេខអវិជ្ជមានបានទេ!' };
    }

    const isTargetHq = isHqLocationOrRow(targetLocation, locations);

    // 1. Find existing inventory row
    const existingIndex = mockInventory.findIndex(inv => {
      const matchItem = String(inv.item_code)?.trim().toUpperCase() === String(targetItem.code)?.trim().toUpperCase() || 
                        String(inv.item_id) === String(targetItem.id);
      if (!matchItem) return false;

      if (String(inv.location_id) === String(targetLocation.id) || 
          String(inv.location_id) === String(targetLocation.code)) return true;

      if (isTargetHq && isHqLocationOrRow(inv, locations)) return true;

      if (targetLocation.code && inv.location_name_kh && inv.location_name_kh.includes(targetLocation.code)) return true;
      if (targetLocation.name_kh && inv.location_name_kh && 
          (inv.location_name_kh.includes(targetLocation.name_kh) || targetLocation.name_kh.includes(inv.location_name_kh))) return true;

      return false;
    });

    const previousQty = existingIndex >= 0 ? (mockInventory[existingIndex].quantity || 0) : 0;
    const delta = params.actualQuantity - previousQty;

    // 2. Set new actual physical quantity
    if (existingIndex >= 0) {
      mockInventory[existingIndex].quantity = params.actualQuantity;
      mockInventory[existingIndex].last_updated = new Date().toISOString();
    } else {
      mockInventory.push({
        location_id: targetLocation.id,
        item_id: targetItem.id,
        quantity: params.actualQuantity,
        last_updated: new Date().toISOString(),
        item_code: targetItem.code,
        item_name_kh: targetItem.name_kh,
        item_name_en: targetItem.name_en,
        category: targetItem.category,
        unit: targetItem.unit,
        min_stock: targetItem.min_stock,
        location_name_kh: targetLocation.name_kh,
        location_name_en: targetLocation.name_en,
        location_code: targetLocation.code || (isTargetHq ? 'HQ-ITSB' : ''),
        type: isTargetHq ? 'HQ' : targetLocation.type,
        image_url: targetItem.image_url,
      });
    }

    // 3. Record transaction in mockTransactions
    const sign = delta >= 0 ? '+' : '';
    const finalRemark = `${params.reason || 'កែតម្រូវស្តុកជាក់ស្តែង'} [ប្រព័ន្ធ: ${previousQty} -> ជាក់ស្តែង: ${params.actualQuantity} | ផលសង: ${sign}${delta} ${targetItem.unit}]${params.remark ? ' - ' + params.remark : ''}`;

    mockTransactions.unshift({
      id: `tx-adj-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'ADJUSTMENT',
      item_id: targetItem.id,
      item_code: targetItem.code,
      item_name_kh: targetItem.name_kh,
      item_name_en: targetItem.name_en,
      from_location: targetLocation.name_kh,
      from_location_id: targetLocation.id,
      to_location: targetLocation.name_kh,
      to_location_id: targetLocation.id,
      quantity: delta,
      unit: targetItem.unit,
      recorded_by: params.officerName || 'Admin-GDT',
      remark: finalRemark,
      status: 'RECEIVED'
    });

    saveToStorage(mockItems, mockInventory, mockTransactions);
    setInventory([...mockInventory]);

    // 4. Supabase DB Persistence
    if (isConfigured) {
      try {
        await supabaseRecordAdjustment({
          locationId: targetLocation.id,
          locationCode: targetLocation.code,
          itemId: targetItem.id,
          itemCode: targetItem.code,
          actualQuantity: params.actualQuantity,
          recordedBy: params.officerName || 'Admin-GDT',
          remark: finalRemark
        });

        const liveInv = await fetchFullInventoryFromSupabase();
        if (liveInv && liveInv.length > 0) {
          setInventory(liveInv);
          mockInventory.length = 0;
          mockInventory.push(...liveInv);
          saveToStorage(mockItems, mockInventory, mockTransactions);
        }
      } catch (err) {
        console.warn('Supabase adjustment sync notice:', err);
      }
    }

    return {
      success: true,
      previousQuantity: previousQty,
      newQuantity: params.actualQuantity,
      delta,
      message: `កែតម្រូវស្តុក "${targetItem.name_kh}" នៅ "${targetLocation.name_kh}" ជោគជ័យ! (ចំនួនមុន: ${previousQty}, ជាក់ស្តែងថ្មី: ${params.actualQuantity}, ផលសង: ${sign}${delta} ${targetItem.unit})`
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
      recordHandover,
      acknowledgeHandover,
      recordAdjustment,
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
