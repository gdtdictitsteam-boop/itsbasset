import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mockItems, mockLocations, mockInventory, mockTransactions, standardItemQuantities } from '../mockData';
import { Item, InventoryItem, Location } from '../types';
import { 
  supabase, 
  isSupabaseConfigured, 
  fetchFullInventoryFromSupabase,
  fetchTransactionsFromSupabase,
  seedInitialInventoryToSupabase,
  supabaseRecordStockIn,
  supabaseRecordStockOut,
  supabaseHandleHandover,
  supabaseAcknowledgeHandover,
  supabaseRecordAdjustment,
  insertItemToSupabase
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
  transactions: any[];
  isLoading: boolean;
  dbError: string | null;
  refreshInventory: () => Promise<void>;
  recordStockIn: (params: StockInParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordStockOut: (params: StockOutParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  recordHandover: (params: HandoverParams) => Promise<{ success: boolean; message: string; newQuantity?: number }>;
  acknowledgeHandover: (transactionId: string, receivedBy?: string) => Promise<{ success: boolean; message: string; newBranchQuantity?: number }>;
  recordAdjustment: (params: AdjustmentParams) => Promise<{ success: boolean; message: string; previousQuantity?: number; newQuantity?: number; delta?: number }>;
  reseedStandardStock: () => Promise<{ success: boolean; message: string }>;
  addNewItemToContext: (item: Item, initialStock?: number, locationId?: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Unified helper to test if a location or inventory row is HQ
export const isHqLocationOrRow = (rowOrLoc: any, locationsList?: Location[]): boolean => {
  if (!rowOrLoc) return false;
  const locId = String(rowOrLoc.location_id || rowOrLoc.id || '').trim();
  const locCode = String(rowOrLoc.location_code || rowOrLoc.code || '').trim().toUpperCase();
  const locType = String(rowOrLoc.type || rowOrLoc.location_type || '').trim().toUpperCase();
  const locNameKh = String(rowOrLoc.location_name_kh || rowOrLoc.name_kh || '').trim();
  const locNameEn = String(rowOrLoc.location_name_en || rowOrLoc.name_en || '').trim();

  if (locId === 'ALL' || locCode === 'ALL' || locType === 'ALL') return false;
  if (locId === '35' || locCode === 'TECH-HQ' || locNameKh.includes('Tech-HQ') || locNameEn.includes('Tech-HQ')) return false;

  if (locId === '1' || locId === 'HQ-ITSB' || locCode === 'HQ-ITSB' || locId === 'ITSB-HQ' || locCode === 'ITSB-HQ') return true;
  if (locType === 'HQ') return true;

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

  if (locNameKh && !locNameKh.includes('ខេត្តកណ្តាល') && !locNameKh.includes('Tech-HQ') && (locNameKh.includes('HQ-ITSB') || locNameKh.includes('ITSB-HQ') || locNameKh.includes('ស្តុកសម្ភារបច្ចេកទេស'))) {
    return true;
  }
  if (locNameEn && (locNameEn.includes('HQ-ITSB') || locNameEn.includes('ITSB-HQ') || locNameEn.includes('HQ Technical Inventory'))) {
    return true;
  }

  return false;
};

// Helper to construct guaranteed baseline inventory matching items and locations
export function buildBaselineInventory(itemsList: Item[], locsList: Location[]): InventoryItem[] {
  const hqLoc = locsList.find(l => isHqLocationOrRow(l, locsList)) || locsList[0];
  const result: InventoryItem[] = [];

  if (hqLoc) {
    itemsList.forEach(item => {
      const stdQty = standardItemQuantities[item.code] ?? 20;
      result.push({
        location_id: hqLoc.id,
        item_id: item.id,
        quantity: stdQty,
        last_updated: new Date().toISOString(),
        item_code: item.code,
        item_name_kh: item.name_kh,
        item_name_en: item.name_en,
        category: item.category,
        unit: item.unit,
        min_stock: item.min_stock,
        location_name_kh: hqLoc.name_kh || 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB',
        location_name_en: hqLoc.name_en || 'HQ-ITSB Technical Inventory',
        location_code: hqLoc.code || 'HQ-ITSB',
        type: 'HQ',
        image_url: item.image_url
      });
    });
  }

  // Sample branch stock for active branches (7MK, CKM, DPE, TKO, KPC, Tech-HQ)
  const branchMap: Record<string, Array<{ itemCode: string; qty: number }>> = {
    '7MK': [
      { itemCode: 'T-001', qty: 2 },
      { itemCode: 'T-006', qty: 2 },
      { itemCode: 'T-019', qty: 5 },
      { itemCode: 'S-004', qty: 10 },
      { itemCode: 'S-005', qty: 5 },
    ],
    'CKM': [
      { itemCode: 'T-001', qty: 1 },
      { itemCode: 'T-004', qty: 1 },
      { itemCode: 'T-010', qty: 2 },
      { itemCode: 'S-004', qty: 8 },
    ],
    'DPE': [
      { itemCode: 'T-001', qty: 1 },
      { itemCode: 'T-002', qty: 1 },
      { itemCode: 'T-012', qty: 1 },
      { itemCode: 'S-001', qty: 2 },
    ],
    'TKO': [
      { itemCode: 'T-001', qty: 1 },
      { itemCode: 'T-007', qty: 2 },
      { itemCode: 'T-020', qty: 50 },
      { itemCode: 'S-005', qty: 10 },
    ],
    'KPC': [
      { itemCode: 'T-001', qty: 1 },
      { itemCode: 'T-003', qty: 1 },
      { itemCode: 'T-013', qty: 2 },
      { itemCode: 'S-002', qty: 5 },
    ],
    'Tech-HQ': [
      { itemCode: 'T-001', qty: 1 },
      { itemCode: 'T-004', qty: 1 },
      { itemCode: 'T-012', qty: 1 },
      { itemCode: 'S-004', qty: 20 },
    ]
  };

  Object.entries(branchMap).forEach(([bCode, bItems]) => {
    const bLoc = locsList.find(l => l.code === bCode || l.name_kh?.includes(bCode));
    if (bLoc) {
      bItems.forEach(bi => {
        const itemObj = itemsList.find(it => it.code === bi.itemCode);
        if (itemObj) {
          result.push({
            location_id: bLoc.id,
            item_id: itemObj.id,
            quantity: bi.qty,
            last_updated: new Date().toISOString(),
            item_code: itemObj.code,
            item_name_kh: itemObj.name_kh,
            item_name_en: itemObj.name_en,
            category: itemObj.category,
            unit: itemObj.unit,
            min_stock: itemObj.min_stock,
            location_name_kh: bLoc.name_kh,
            location_name_en: bLoc.name_en,
            location_code: bLoc.code,
            type: 'BRANCH',
            image_url: itemObj.image_url
          });
        }
      });
    }
  });

  return result;
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { setLocationsList } = useLocationContext();

  const [items, setItems] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const refreshInventory = useCallback(async () => {
    setIsLoading(true);
    setDbError(null);

    const configured = isSupabaseConfigured();

    if (!configured) {
      console.warn('Supabase credentials not configured or placeholder detected. Operating in high-fidelity local mode.');
      setItems([...mockItems]);
      setLocations([...mockLocations]);
      setLocationsList([...mockLocations]);
      setInventory([...mockInventory]);
      setTransactions([...mockTransactions]);
      setIsLoading(false);
      return;
    }

    try {
      // 1. SELECT items from Supabase Table items
      const { data: dbItems, error: itemsErr } = await supabase
        .from('items')
        .select('*')
        .order('code', { ascending: true });

      if (itemsErr) {
        console.error('Supabase SELECT items error:', itemsErr);
        setDbError(`Error fetching items: ${itemsErr.message}`);
      }

      // 2. SELECT locations from Supabase Table locations
      const { data: dbLocs, error: locsErr } = await supabase
        .from('locations')
        .select('*')
        .order('code', { ascending: true });

      if (locsErr) {
        console.error('Supabase SELECT locations error:', locsErr);
        setDbError(`Error fetching locations: ${locsErr.message}`);
      }

      let currentDbItems = (dbItems && dbItems.length > 0) ? dbItems : mockItems;
      let currentDbLocs = (dbLocs && dbLocs.length > 0) ? dbLocs : mockLocations;

      // Auto-seed if database is brand new and completely empty
      if (
        (!itemsErr && (!dbItems || dbItems.length === 0)) || 
        (!locsErr && (!dbLocs || dbLocs.length === 0))
      ) {
        console.info('Supabase database tables are empty. Auto-seeding initial master items and locations into Supabase...');
        await seedInitialInventoryToSupabase();
        
        const [reItems, reLocs] = await Promise.all([
          supabase.from('items').select('*').order('code', { ascending: true }),
          supabase.from('locations').select('*').order('code', { ascending: true })
        ]);
        if (reItems.data && reItems.data.length > 0) currentDbItems = reItems.data;
        if (reLocs.data && reLocs.data.length > 0) currentDbLocs = reLocs.data;
      }

      // Format Items
      const formattedItems: Item[] = currentDbItems.map((i: any) => ({
        id: i.id,
        code: i.code,
        name_kh: i.name_kh,
        name_en: i.name_en || i.name_kh,
        category: i.category || 'Tools',
        unit: i.unit || 'គ្រឿង',
        min_stock: i.min_stock ?? 5,
        image_url: i.image_url || undefined,
      }));
      setItems(formattedItems);

      // Format Locations
      const formattedLocs = currentDbLocs as Location[];
      setLocations(formattedLocs);
      setLocationsList(formattedLocs);

      // 3. SELECT full inventory joined with items and locations from Supabase Table inventory
      const liveInventory = await fetchFullInventoryFromSupabase();
      if (liveInventory && liveInventory.length > 0) {
        setInventory(liveInventory);
      } else {
        // Fallback: build baseline inventory so Central HQ stock and branch stock are NEVER lost or 0
        const baseline = buildBaselineInventory(formattedItems, formattedLocs);
        setInventory(baseline);
      }

      // 4. SELECT transactions from Supabase Table transactions
      const liveTx = await fetchTransactionsFromSupabase(500);
      setTransactions(liveTx && liveTx.length > 0 ? liveTx : mockTransactions);

    } catch (err: any) {
      console.error('Unhandled exception in refreshInventory from Supabase:', err);
      setDbError(err?.message || 'Error connecting to Supabase database');
      setItems([...mockItems]);
      setLocations([...mockLocations]);
      setLocationsList([...mockLocations]);
      setInventory([...mockInventory]);
      setTransactions([...mockTransactions]);
    } finally {
      setIsLoading(false);
    }
  }, [setLocationsList]);

  // Initial load on mount and listen for dynamic config updates
  useEffect(() => {
    refreshInventory();

    const handleConfigChange = () => {
      console.info('Supabase credentials updated, refreshing inventory...');
      refreshInventory();
    };

    window.addEventListener('supabase-config-changed', handleConfigChange);
    return () => {
      window.removeEventListener('supabase-config-changed', handleConfigChange);
    };
  }, [refreshInventory]);

  // Add new SKU: Directly insert into Supabase Table items and inventory
  const addNewItemToContext = async (newItem: Item, initialStock: number = 0, targetLocationId: string = '1') => {
    const configured = isSupabaseConfigured();
    if (!configured) {
      console.warn('Supabase not configured, local SKU entry');
      return;
    }

    try {
      const res = await insertItemToSupabase({
        code: newItem.code,
        name_kh: newItem.name_kh,
        name_en: newItem.name_en,
        category: newItem.category,
        unit: newItem.unit,
        min_stock: newItem.min_stock,
        initial_stock: initialStock,
        location_id: targetLocationId,
        image_url: newItem.image_url,
      });

      if (!res.success) {
        console.error('Supabase Insert Item Error:', res.error);
        throw new Error(res.error);
      }

      await refreshInventory();
    } catch (err) {
      console.error('Exception adding new item to Supabase:', err);
      throw err;
    }
  };

  // Record Stock In: Directly insert into Supabase transactions and upsert inventory
  const recordStockIn = async (params: StockInParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));
    const targetLoc = locations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId));

    const configured = isSupabaseConfigured();
    if (!configured) {
      // Local mode seamless execution
      let updatedQty = params.quantity;
      setInventory(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(inv => 
          (String(inv.item_id) === String(targetItem?.id) || String(inv.item_code) === String(targetItem?.code)) &&
          (String(inv.location_id) === String(targetLoc?.id) || String(inv.location_code) === String(targetLoc?.code))
        );
        if (idx >= 0) {
          updatedQty = (copy[idx].quantity || 0) + params.quantity;
          copy[idx] = { ...copy[idx], quantity: updatedQty, last_updated: new Date().toISOString() };
        } else {
          copy.push({
            location_id: targetLoc?.id || params.locationId,
            item_id: targetItem?.id || params.itemId,
            quantity: params.quantity,
            last_updated: new Date().toISOString(),
            item_code: targetItem?.code || '',
            item_name_kh: targetItem?.name_kh || '',
            item_name_en: targetItem?.name_en || '',
            category: targetItem?.category || 'Tools',
            unit: targetItem?.unit || 'គ្រឿង',
            min_stock: targetItem?.min_stock ?? 5,
            location_name_kh: targetLoc?.name_kh || 'ស្តុកកណ្តាល HQ',
            location_name_en: targetLoc?.name_en || 'HQ',
            location_code: targetLoc?.code || 'HQ-ITSB',
            type: targetLoc?.type || 'HQ'
          });
        }
        return copy;
      });

      const newTx = {
        id: `TX-${Date.now()}`,
        type: 'STOCK_IN',
        to_location_id: targetLoc?.id,
        to_location: targetLoc?.name_kh,
        item_id: targetItem?.id,
        item_code: targetItem?.code,
        item_name_kh: targetItem?.name_kh,
        quantity: params.quantity,
        unit: targetItem?.unit || 'គ្រឿង',
        recorded_by: params.officerName || 'Admin-GDT',
        remark: params.purpose || 'បញ្ចូលស្តុកថ្មី',
        status: 'RECEIVED',
        date: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);

      return {
        success: true,
        newQuantity: updatedQty,
        message: `បានបញ្ចូលស្តុកចំនួន ${params.quantity} ជោគជ័យ!`
      };
    }

    try {
      const res = await supabaseRecordStockIn({
        locationId: targetLoc?.id || params.locationId,
        locationCode: targetLoc?.code,
        itemId: targetItem?.id || params.itemId,
        itemCode: targetItem?.code,
        quantity: params.quantity,
        recordedBy: params.officerName || 'Admin-GDT',
        remark: params.purpose || 'បញ្ចូលស្តុកថ្មី'
      });

      if (!res.success) {
        console.error('Supabase Stock In operation failed:', res.error);
        return { 
          success: false, 
          message: `បរាជ័យក្នុងការបញ្ចូលស្តុកទៅ Supabase: ${res.error}` 
        };
      }

      await refreshInventory();

      return { 
        success: true, 
        newQuantity: res.newQuantity,
        message: `បានបញ្ចូលស្តុកចំនួន ${params.quantity} ទៅកាន់ Supabase Database ជោគជ័យ!` 
      };
    } catch (err: any) {
      console.error('Exception executing Stock In to Supabase:', err);
      return { 
        success: false, 
        message: `មានបញ្ហាបរាជ័យក្នុងការតភ្ជាប់ Supabase: ${err.message || err}` 
      };
    }
  };

  // Record Stock Out: Directly deduct in Supabase inventory and insert into transactions
  const recordStockOut = async (params: StockOutParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));
    const targetLoc = locations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId));

    const configured = isSupabaseConfigured();
    if (!configured) {
      let updatedQty = 0;
      setInventory(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(inv => 
          (String(inv.item_id) === String(targetItem?.id) || String(inv.item_code) === String(targetItem?.code)) &&
          (String(inv.location_id) === String(targetLoc?.id) || String(inv.location_code) === String(targetLoc?.code))
        );
        if (idx >= 0) {
          updatedQty = Math.max(0, (copy[idx].quantity || 0) - params.quantity);
          copy[idx] = { ...copy[idx], quantity: updatedQty, last_updated: new Date().toISOString() };
        }
        return copy;
      });

      const newTx = {
        id: `TX-${Date.now()}`,
        type: 'STOCK_OUT',
        from_location_id: targetLoc?.id,
        from_location: targetLoc?.name_kh,
        item_id: targetItem?.id,
        item_code: targetItem?.code,
        item_name_kh: targetItem?.name_kh,
        quantity: params.quantity,
        unit: targetItem?.unit || 'គ្រឿង',
        recorded_by: params.officerName || 'BranchOfficer',
        remark: params.purpose || 'ដកប្រើប្រាស់',
        status: 'RECEIVED',
        date: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);

      return {
        success: true,
        newQuantity: updatedQty,
        message: `បានដកស្តុកចំនួន ${params.quantity} ជោគជ័យ!`
      };
    }

    try {
      const res = await supabaseRecordStockOut({
        locationId: targetLoc?.id || params.locationId,
        locationCode: targetLoc?.code,
        itemId: targetItem?.id || params.itemId,
        itemCode: targetItem?.code,
        quantity: params.quantity,
        recordedBy: params.officerName || 'BranchOfficer',
        remark: params.purpose || 'ដកប្រើប្រាស់'
      });

      if (!res.success) {
        console.error('Supabase Stock Out operation failed:', res.error);
        return { 
          success: false, 
          message: `បរាជ័យក្នុងការដកស្តុកពី Supabase: ${res.error}` 
        };
      }

      await refreshInventory();

      return { 
        success: true, 
        newQuantity: res.newQuantity,
        message: `បានដកស្តុកចំនួន ${params.quantity} ពី Supabase Database ជោគជ័យ!` 
      };
    } catch (err: any) {
      console.error('Exception executing Stock Out to Supabase:', err);
      return { 
        success: false, 
        message: `មានបញ្ហាបរាជ័យក្នុងការតភ្ជាប់ Supabase: ${err.message || err}` 
      };
    }
  };

  // Record Handover (Direct Handover Auto Sync): Deduct source, add destination, status COMPLETED
  const recordHandover = async (params: HandoverParams): Promise<{ success: boolean; message: string; newQuantity?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));
    const fromLoc = locations.find(l => String(l.id) === String(params.fromLocationId) || String(l.code) === String(params.fromLocationId));
    const toLoc = locations.find(l => String(l.id) === String(params.toLocationId) || String(l.code) === String(params.toLocationId));

    if (!targetItem || !fromLoc || !toLoc) {
      return { success: false, message: 'មិនអាចស្វែងរកព័ត៌មានសម្ភារៈ ឬទីតាំងក្នុង Database' };
    }

    const finalRemark = params.documentUrl
      ? `${(params.purpose || 'ផ្ទេរសម្ភារៈជូនសាខា').trim()} | ឯកសារយោង: ${params.documentUrl}`
      : (params.purpose || 'ផ្ទេរសម្ភារៈជូនសាខា').trim();

    const configured = isSupabaseConfigured();
    if (!configured) {
      // Local mode seamless execution
      setInventory(prev => {
        const copy = [...prev];
        // Deduct source
        const srcIdx = copy.findIndex(inv => 
          (String(inv.item_id) === String(targetItem.id) || String(inv.item_code) === String(targetItem.code)) &&
          (String(inv.location_id) === String(fromLoc.id) || String(inv.location_code) === String(fromLoc.code))
        );
        if (srcIdx >= 0) {
          copy[srcIdx] = { 
            ...copy[srcIdx], 
            quantity: Math.max(0, (copy[srcIdx].quantity || 0) - params.quantity),
            last_updated: new Date().toISOString() 
          };
        }

        // Add destination
        const destIdx = copy.findIndex(inv => 
          (String(inv.item_id) === String(targetItem.id) || String(inv.item_code) === String(targetItem.code)) &&
          (String(inv.location_id) === String(toLoc.id) || String(inv.location_code) === String(toLoc.code))
        );
        if (destIdx >= 0) {
          copy[destIdx] = { 
            ...copy[destIdx], 
            quantity: (copy[destIdx].quantity || 0) + params.quantity,
            last_updated: new Date().toISOString() 
          };
        } else {
          copy.push({
            location_id: toLoc.id,
            item_id: targetItem.id,
            quantity: params.quantity,
            last_updated: new Date().toISOString(),
            item_code: targetItem.code,
            item_name_kh: targetItem.name_kh,
            item_name_en: targetItem.name_en,
            category: targetItem.category,
            unit: targetItem.unit,
            min_stock: targetItem.min_stock,
            location_name_kh: toLoc.name_kh,
            location_name_en: toLoc.name_en,
            location_code: toLoc.code,
            type: toLoc.type || 'BRANCH'
          });
        }
        return copy;
      });

      const newTx = {
        id: `TX-${Date.now()}`,
        type: 'HANDOVER',
        from_location_id: fromLoc.id,
        from_location: fromLoc.name_kh,
        to_location_id: toLoc.id,
        to_location: toLoc.name_kh,
        item_id: targetItem.id,
        item_code: targetItem.code,
        item_name_kh: targetItem.name_kh,
        quantity: params.quantity,
        unit: targetItem.unit || 'គ្រឿង',
        recorded_by: params.officerName || 'Admin-GDT',
        remark: finalRemark,
        status: 'COMPLETED',
        date: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);

      return {
        success: true,
        message: `បានផ្ទេរ និងកត់ត្រាជោគជ័យ (status: COMPLETED)!`
      };
    }

    try {
      const res = await supabaseHandleHandover({
        fromLocationId: fromLoc.id,
        toLocationId: toLoc.id,
        fromLocationCode: fromLoc.code,
        toLocationCode: toLoc.code,
        itemId: targetItem.id,
        itemCode: targetItem.code,
        quantity: params.quantity,
        recordedBy: params.officerName || 'Admin-GDT',
        remark: finalRemark
      });

      if (!res.success) {
        console.error('Supabase Handover operation failed:', res.error);
        return { 
          success: false, 
          message: `បរាជ័យក្នុងការផ្ទេរស្តុកក្នុង Supabase: ${res.error}` 
        };
      }

      await refreshInventory();

      return {
        success: true,
        message: `បានផ្ទេរ និងកត់ត្រាចូល Supabase Database (status: COMPLETED) ជោគជ័យ!`
      };
    } catch (err: any) {
      console.error('Exception executing Handover to Supabase:', err);
      return { 
        success: false, 
        message: `មានបញ្ហាបរាជ័យក្នុងការតភ្ជាប់ Supabase: ${err.message || err}` 
      };
    }
  };

  // Acknowledge Handover fallback helper
  const acknowledgeHandover = async (transactionId: string, receivedBy?: string): Promise<{ success: boolean; message: string; newBranchQuantity?: number }> => {
    const configured = isSupabaseConfigured();
    if (!configured) {
      return { success: false, message: 'Supabase មិនទាន់ត្រូវបានកំណត់ឡើយ' };
    }

    try {
      const res = await supabaseAcknowledgeHandover({
        transactionId,
        receivedBy: receivedBy || 'BranchOfficer'
      });

      if (!res.success) {
        console.error('Supabase Acknowledge Handover failed:', res.error);
        return { success: false, message: res.error || 'បរាជ័យក្នុងការទទួល' };
      }

      await refreshInventory();
      return { success: true, message: 'បានទទួលស្គាល់ការផ្ទេរសម្ភារៈជោគជ័យ!', newBranchQuantity: res.newBranchQuantity };
    } catch (err: any) {
      console.error('Exception acknowledging handover in Supabase:', err);
      return { success: false, message: err.message || 'Error' };
    }
  };

  // Record Stock Adjustment: Upsert actualQuantity directly in Supabase inventory & insert transactions
  const recordAdjustment = async (params: AdjustmentParams): Promise<{ success: boolean; message: string; previousQuantity?: number; newQuantity?: number; delta?: number }> => {
    const targetItem = items.find(i => String(i.id) === String(params.itemId) || String(i.code) === String(params.itemId));
    const targetLoc = locations.find(l => String(l.id) === String(params.locationId) || String(l.code) === String(params.locationId));

    const finalRemark = `${params.reason || 'កែតម្រូវស្តុកជាក់ស្តែង'} ${params.remark ? `| ${params.remark}` : ''}`.trim();

    const configured = isSupabaseConfigured();
    if (!configured) {
      let prevQty = 0;
      setInventory(prev => {
        const copy = [...prev];
        const idx = copy.findIndex(inv => 
          (String(inv.item_id) === String(targetItem?.id) || String(inv.item_code) === String(targetItem?.code)) &&
          (String(inv.location_id) === String(targetLoc?.id) || String(inv.location_code) === String(targetLoc?.code))
        );
        if (idx >= 0) {
          prevQty = copy[idx].quantity || 0;
          copy[idx] = { ...copy[idx], quantity: params.actualQuantity, last_updated: new Date().toISOString() };
        } else {
          copy.push({
            location_id: targetLoc?.id || params.locationId,
            item_id: targetItem?.id || params.itemId,
            quantity: params.actualQuantity,
            last_updated: new Date().toISOString(),
            item_code: targetItem?.code || '',
            item_name_kh: targetItem?.name_kh || '',
            item_name_en: targetItem?.name_en || '',
            category: targetItem?.category || 'Tools',
            unit: targetItem?.unit || 'គ្រឿង',
            min_stock: targetItem?.min_stock ?? 5,
            location_name_kh: targetLoc?.name_kh || 'ស្តុកកណ្តាល HQ',
            location_name_en: targetLoc?.name_en || 'HQ',
            location_code: targetLoc?.code || 'HQ-ITSB',
            type: targetLoc?.type || 'HQ'
          });
        }
        return copy;
      });

      const delta = params.actualQuantity - prevQty;
      const sign = delta >= 0 ? '+' : '';
      const detailedRemark = `${finalRemark} [ប្រព័ន្ធ: ${prevQty} -> ជាក់ស្តែង: ${params.actualQuantity} | ផលសង: ${sign}${delta} ${targetItem?.unit || 'គ្រឿង'}]`;

      const newTx = {
        id: `TX-${Date.now()}`,
        type: 'ADJUSTMENT',
        to_location_id: targetLoc?.id,
        to_location: targetLoc?.name_kh,
        from_location_id: targetLoc?.id,
        from_location: targetLoc?.name_kh,
        item_id: targetItem?.id,
        item_code: targetItem?.code,
        item_name_kh: targetItem?.name_kh,
        quantity: delta,
        unit: targetItem?.unit || 'គ្រឿង',
        recorded_by: params.officerName || 'Admin-GDT',
        remark: detailedRemark,
        status: 'RECEIVED',
        date: new Date().toISOString()
      };
      setTransactions(prev => [newTx, ...prev]);

      return {
        success: true,
        previousQuantity: prevQty,
        newQuantity: params.actualQuantity,
        delta,
        message: `បានកែតម្រូវចំនួនស្តុកជោគជ័យ!`
      };
    }

    try {
      const res = await supabaseRecordAdjustment({
        locationId: targetLoc?.id || params.locationId,
        locationCode: targetLoc?.code,
        itemId: targetItem?.id || params.itemId,
        itemCode: targetItem?.code,
        actualQuantity: params.actualQuantity,
        recordedBy: params.officerName || 'Admin-GDT',
        remark: finalRemark
      });

      if (!res.success) {
        console.error('Supabase Adjustment operation failed:', res.error);
        return { 
          success: false, 
          message: `បរាជ័យក្នុងការកែតម្រូវស្តុកក្នុង Supabase: ${res.error}` 
        };
      }

      await refreshInventory();

      return { 
        success: true, 
        previousQuantity: res.previousQuantity,
        newQuantity: res.newQuantity,
        delta: res.delta,
        message: `បានកែតម្រូវចំនួនស្តុកក្នុង Supabase Database ជោគជ័យ!`
      };
    } catch (err: any) {
      console.error('Exception executing Adjustment to Supabase:', err);
      return { 
        success: false, 
        message: `មានបញ្ហាបរាជ័យក្នុងការតភ្ជាប់ Supabase: ${err.message || err}` 
      };
    }
  };

  // Re-seed clean standard stock into Supabase database
  const reseedStandardStock = async (): Promise<{ success: boolean; message: string }> => {
    const configured = isSupabaseConfigured();
    if (configured) {
      const res = await seedInitialInventoryToSupabase();
      if (res.success) {
        await refreshInventory();
      }
      return res;
    } else {
      return {
        success: false,
        message: 'សូមភ្ជាប់ Supabase Database ជាមុនសិន។'
      };
    }
  };

  return (
    <InventoryContext.Provider value={{
      inventory,
      items,
      locations,
      transactions,
      isLoading,
      dbError,
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
