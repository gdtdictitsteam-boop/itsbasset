import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Item, InventoryItem, Location } from '../types';
// @ts-ignore - xlsx-js-style is a drop-in build of SheetJS that writes cell styles (.s)
import XLSX from 'xlsx-js-style';
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  MapPin,
  Calendar,
  Search,
  ClipboardList,
  CheckCircle2,
  Table2,
  LayoutList,
  Wrench,
  PackageCheck
} from 'lucide-react';

// Part 1: ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់ - Tools & Technical Equipment) — 11 Columns
export interface NonConsumableRow {
  no: number;
  itemId: string;
  itemCode: string;
  nameKh: string;
  nameEn: string;
  unitKh: string;
  totalInboundA: number;     // Col 5: សរុបរួម (A=B+C) (Total Inbound Qty)
  inUseB: number;            // Col 6: កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B) (Active In-Use Qty)
  damagedAdjustedC: number;  // Col 7: ខូច / បាត់បង់ / កែតម្រូវ (C) (Damaged/Adjusted Qty)
  warehouseAvailD: number;   // Col 8: ស្តុកនៅសល់ក្នុងឃ្លាំង (D) (Warehouse Available Qty = A - B - C)
  assignedHolders: string;   // Col 9: សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង (Assigned Branch / Officer from audit trail)
  purposeAndDate: string;    // Col 10: គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ (Purpose / Remark)
  minThreshold: number;
  statusCode: 'sufficient' | 'low_stock' | 'out_of_stock';
  statusLabelKh: string;     // Col 11: ស្ថានភាពស្តុក (🟢 ស្តុកគ្រប់គ្រាន់, 🟡 ស្តុកទាប, 🔴 អស់ពីស្តុក)
}

// Part 2: ប្រភេទទី២៖ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ - Supplies & Consumables) — 10 Columns
export interface ConsumableRow {
  no: number;
  itemId: string;
  itemCode: string;
  nameKh: string;
  nameEn: string;
  unitKh: string;
  totalInboundA: number;     // Col 5: សរុបរួមនាំចូល (A) (Total Inbound Qty)
  totalIssuedB: number;      // Col 6: បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B) (Total Issued / Consumed Qty)
  remainingStockC: number;   // Col 7: ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B) (Remaining Stock Qty)
  issuedRecipients: string;  // Col 8: សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់ (Issued Branches / Recipients)
  purposeAndDate: string;    // Col 9: គោលបំណង និងកាលបរិច្ឆេទបើកបែក (Purpose / Date)
  minThreshold: number;
  statusCode: 'sufficient' | 'low_stock' | 'out_of_stock';
  statusLabelKh: string;     // Col 10: ស្ថានភាពស្តុក (🟢 ស្តុកគ្រប់គ្រាន់, 🟡 ស្តុកទាប, 🔴 អស់ពីស្តុក)
}

export interface MatrixItemRow {
  no: number;
  itemId: string;
  itemCode: string;
  nameKh: string;
  nameEn: string;
  categoryType: 'non_consumable' | 'consumable';
  categoryLabelKh: string;
  unitKh: string;
  totalQty: number;
  locationQuantities: Record<string, number>;
}

const PHNOM_PENH_DISTRICTS = [
  'ដូនពេញ',
  'ចំការមន',
  'ទួលគោក',
  '៧មករា',
  'បឹងកេងកង',
  'ឫស្សីកែវ',
  'សែនសុខ',
  'មានជ័យ',
  'ច្បារអំពៅ',
  'ជ្រោយចង្វារ',
  'ពោធិ៍សែនជ័យ',
  'ដង្កោ',
  'កំបូល',
  'ព្រែកព្នៅ'
];

function getLocationSortWeight(loc: Location): number {
  const codeUpper = String(loc.code || '').toUpperCase();
  const typeUpper = String(loc.type || '').toUpperCase();
  const nameKh = String(loc.name_kh || '');
  if (typeUpper === 'HQ' || codeUpper === 'HQ-ITSB' || loc.id === '1') {
    return 0;
  }
  if (codeUpper === 'TECH-HQ' || loc.id === '35' || nameKh.includes('ថ្នាក់កណ្តាល')) {
    return 1;
  }
  const isPhnomPenh = PHNOM_PENH_DISTRICTS.some(d => nameKh.includes(d)) || nameKh.includes('ខណ្ឌ');
  if (isPhnomPenh) {
    return 2;
  }
  return 3;
}

function getShortLocationHeader(loc: Location | string | undefined): string {
  if (!loc) return '';
  if (typeof loc === 'string') {
    const clean = loc.trim();
    if (clean.includes('HQ-ITSB') || clean.includes('ស្តុកសម្ភារបច្ចេកទេស')) return 'ឃ្លាំងកណ្តាល (HQ-ITSB)';
    if (clean.includes('Tech-HQ') || clean.includes('ថ្នាក់កណ្តាល')) return 'ថ្នាក់កណ្តាល (Tech-HQ)';
    return clean
      .replace(/^\[.*?\]\s*/, '')
      .replace(/^សាខាពន្ធដារខណ្ឌ\s*/, 'ខណ្ឌ')
      .replace(/^សាខាពន្ធដារខេត្ត\s*/, 'ខេត្ត')
      .replace(/^សាខាពន្ធដារ\s*/, 'សាខា')
      .replace(/\s*\([A-Za-z0-9-]+\)\s*$/, '')
      .trim();
  }
  const code = String(loc.code || '').trim();
  const codeUpper = code.toUpperCase();
  const nameKh = String(loc.name_kh || loc.name_en || code).trim();
  if (codeUpper === 'HQ-ITSB' || loc.type === 'HQ' || loc.id === '1') {
    return 'ឃ្លាំងកណ្តាល (HQ-ITSB)';
  }
  if (codeUpper === 'TECH-HQ' || loc.id === '35' || nameKh.includes('ថ្នាក់កណ្តាល')) {
    return 'ថ្នាក់កណ្តាល (Tech-HQ)';
  }
  return nameKh
    .replace(/^\[.*?\]\s*/, '')
    .replace(/^សាខាពន្ធដារខណ្ឌ\s*/, 'ខណ្ឌ')
    .replace(/^សាខាពន្ធដារខេត្ត\s*/, 'ខេត្ត')
    .replace(/^សាខាពន្ធដារ\s*/, 'សាខា')
    .replace(/\s*\([A-Za-z0-9-]+\)\s*$/, '')
    .trim();
}

function isNonConsumableItem(item: Item): boolean {
  const codeUpper = String(item.code || item.id || '').toUpperCase();
  const catLower = String(item.category || '').toLowerCase();
  if (codeUpper.startsWith('T-')) return true;
  if (codeUpper.startsWith('S-')) return false;
  if (catLower.includes('tool') || catLower.includes('ឧបករណ៍') || catLower.includes('មិនអស់')) return true;
  return false;
}

export function ExecutiveReportView() {
  const { language } = useLanguage();
  const { user, isCentralAdmin } = useAuth();
  const {
    selectedLocationId: globalSelectedLocationId,
    locations: availableLocationOptions = [],
    allLocationsList = []
  } = useLocationContext();

  const {
    items: contextItems = [],
    inventory: contextInventory = [],
    transactions: contextTransactions = [],
    locations: contextLocations = []
  } = useInventoryContext();

  // Report Filters (Read-Only)
  const [reportLocationId, setReportLocationId] = useState<string>(() => {
    if (!isCentralAdmin && user?.location_id) return String(user.location_id);
    return globalSelectedLocationId || 'ALL';
  });
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeReportTab, setActiveReportTab] = useState<'consolidated_two_part' | 'matrix_34'>('consolidated_two_part');

  // Direct Read-Only state fetched from Supabase
  const [dbItems, setDbItems] = useState<Item[]>([]);
  const [dbInventory, setDbInventory] = useState<any[]>([]);
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Sync with global header location if changed
  useEffect(() => {
    if (!isCentralAdmin && user?.location_id) {
      setReportLocationId(String(user.location_id));
    } else if (globalSelectedLocationId) {
      setReportLocationId(globalSelectedLocationId);
    }
  }, [globalSelectedLocationId, isCentralAdmin, user]);

  // Strict Read-Only Fetch from Supabase (`public.items`, `public.inventory`, `public.transactions` / `public.audit_trail`)
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const configured = typeof isSupabaseConfigured === 'function' ? isSupabaseConfigured() : Boolean(isSupabaseConfigured);
      if (configured && supabase) {
        const [itemsRes, invRes, txRes, auditRes] = await Promise.all([
          supabase.from('items').select('*').order('code', { ascending: true }),
          supabase.from('inventory').select('*'),
          supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('audit_trail').select('*').order('created_at', { ascending: false }).limit(2000)
        ]);

        if (!itemsRes.error && Array.isArray(itemsRes.data) && itemsRes.data.length > 0) {
          setDbItems(
            itemsRes.data.map((r: any) => ({
              id: String(r.id),
              code: String(r.code || r.id || ''),
              name_kh: String(r.name_kh || r.name || ''),
              name_en: String(r.name_en || ''),
              category: String(r.category || 'Tools'),
              unit: String(r.unit || r.unit_kh || 'គ្រឿង'),
              min_stock: Number(r.min_stock ?? r.min_threshold ?? 5)
            }))
          );
        }

        if (!invRes.error && Array.isArray(invRes.data) && invRes.data.length > 0) {
          setDbInventory(invRes.data);
        }

        const combinedTx: any[] = [];
        if (!txRes.error && Array.isArray(txRes.data)) {
          combinedTx.push(...txRes.data);
        }
        if (!auditRes.error && Array.isArray(auditRes.data)) {
          combinedTx.push(...auditRes.data);
        }
        if (combinedTx.length > 0) {
          setDbTransactions(combinedTx);
        }
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Read-only report fetch notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Unified Locations List (34 physical locations)
  const unifiedLocations = useMemo<Location[]>(() => {
    const base =
      Array.isArray(allLocationsList) && allLocationsList.length > 0
        ? allLocationsList
        : Array.isArray(contextLocations) && contextLocations.length > 0
          ? contextLocations
          : [];
    const filtered = base.filter(l => l && l.id !== 'ALL' && l.code !== 'ALL');
    return [...filtered].sort((a, b) => {
      const wA = getLocationSortWeight(a);
      const wB = getLocationSortWeight(b);
      if (wA !== wB) return wA - wB;
      return String(a.name_kh || '').localeCompare(String(b.name_kh || ''), 'km');
    });
  }, [allLocationsList, contextLocations]);

  // Helper to resolve location object by id, code, or name
  const findLocationByIdOrCode = useCallback(
    (locKey: any): Location | undefined => {
      if (!locKey) return undefined;
      const keyStr = String(locKey).trim();
      const keyUpper = keyStr.toUpperCase();
      return unifiedLocations.find(
        l =>
          String(l.id) === keyStr ||
          String(l.code).toUpperCase() === keyUpper ||
          String(l.name_kh).trim() === keyStr ||
          String(l.name_en).trim() === keyStr
      );
    },
    [unifiedLocations]
  );

  // Selected Location Object for display
  const activeSelectedLocationObj = useMemo<Location | undefined>(() => {
    if (!reportLocationId || reportLocationId === 'ALL') return undefined;
    return findLocationByIdOrCode(reportLocationId);
  }, [reportLocationId, findLocationByIdOrCode]);

  // Unified Items List
  const unifiedItems = useMemo<Item[]>(() => {
    const source = Array.isArray(dbItems) && dbItems.length > 0 ? dbItems : Array.isArray(contextItems) ? contextItems : [];
    const map = new Map<string, Item>();
    source.forEach(item => {
      if (!item) return;
      const codeKey = String(item.code || item.id).trim();
      if (!map.has(codeKey)) {
        map.set(codeKey, {
          id: String(item.id),
          code: String(item.code || item.id),
          name_kh: String(item.name_kh || (item as any).nameKh || ''),
          name_en: String(item.name_en || (item as any).nameEn || ''),
          category: String(item.category || 'Tools'),
          unit: String(item.unit || (item as any).unitKh || 'គ្រឿង'),
          min_stock: Number(item.min_stock ?? (item as any).minThreshold ?? 5)
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
    );
  }, [dbItems, contextItems]);

  // Unified Inventory Rows
  const unifiedInventory = useMemo<InventoryItem[]>(() => {
    // Prefer contextInventory because InventoryContext already joins item_code, location_id, location_name_kh, etc.
    if (Array.isArray(contextInventory) && contextInventory.length > 0) {
      return contextInventory;
    }
    if (!Array.isArray(dbInventory) || dbInventory.length === 0) return [];
    return dbInventory.map((r: any) => {
      const locObj = findLocationByIdOrCode(r.location_id || r.location);
      const itemObj = unifiedItems.find(
        it => String(it.id) === String(r.item_id) || String(it.code) === String(r.item_code || r.item_id)
      );
      return {
        location_id: locObj ? String(locObj.id) : String(r.location_id || r.location || ''),
        item_id: itemObj ? String(itemObj.id) : String(r.item_id || ''),
        quantity: Number(r.quantity ?? r.stock_qty ?? 0),
        last_updated: String(r.last_updated || r.updated_at || ''),
        item_code: itemObj ? itemObj.code : String(r.item_code || r.item_id || ''),
        item_name_kh: itemObj ? itemObj.name_kh : String(r.item_name_kh || ''),
        item_name_en: itemObj ? itemObj.name_en : String(r.item_name_en || ''),
        category: itemObj ? itemObj.category : String(r.category || ''),
        unit: itemObj ? itemObj.unit : String(r.unit || ''),
        location_name_kh: locObj ? locObj.name_kh : String(r.location_name_kh || r.location || ''),
        location_name_en: locObj ? locObj.name_en : String(r.location_name_en || ''),
        min_stock: itemObj ? itemObj.min_stock : Number(r.min_stock ?? 5),
        location_code: locObj ? locObj.code : String(r.location_code || ''),
        type: locObj ? locObj.type : String(r.type || '')
      };
    });
  }, [contextInventory, dbInventory, findLocationByIdOrCode, unifiedItems]);

  // Unified Transactions / Audit Trail
  const unifiedTransactions = useMemo<any[]>(() => {
    if (Array.isArray(contextTransactions) && contextTransactions.length > 0) {
      return contextTransactions;
    }
    return Array.isArray(dbTransactions) ? dbTransactions : [];
  }, [contextTransactions, dbTransactions]);

  // Filter transactions by date range
  const dateFilteredTransactions = useMemo<any[]>(() => {
    return (unifiedTransactions || []).filter(tx => {
      if (!tx) return false;
      if (!startDate && !endDate) return true;
      const rawDateStr = tx.created_at || tx.timestamp || tx.date;
      if (!rawDateStr) return true;
      const rawDate = new Date(rawDateStr);
      if (isNaN(rawDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (rawDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (rawDate > end) return false;
      }
      return true;
    });
  }, [unifiedTransactions, startDate, endDate]);

  // Format short date DD/MM/YYYY
  const formatShortDate = (isoStr?: string): string => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).slice(0, 10);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Match helper between an inventory/transaction row and an item
  const matchesItem = (row: any, item: Item): boolean => {
    if (!row || !item) return false;
    const rowItemId = String(row.item_id || row.itemId || '').trim().toUpperCase();
    const rowItemCode = String(row.item_code || row.code || '').trim().toUpperCase();
    const itemIdUpper = String(item.id || '').trim().toUpperCase();
    const itemCodeUpper = String(item.code || '').trim().toUpperCase();
    return (
      (rowItemId !== '' && (rowItemId === itemIdUpper || rowItemId === itemCodeUpper)) ||
      (rowItemCode !== '' && (rowItemCode === itemCodeUpper || rowItemCode === itemIdUpper))
    );
  };

  // Match helper between a location filter ID/code and an inventory/transaction row
  const matchesSelectedLocation = useCallback(
    (row: any, targetLocId: string): boolean => {
      if (!targetLocId || targetLocId === 'ALL') return true;
      const targetLoc = findLocationByIdOrCode(targetLocId);
      const rowLocId = String(row.location_id || row.to_location || row.from_location || row.location || '').trim();
      const rowLocCode = String(row.location_code || '').trim().toUpperCase();
      const rowLocNameKh = String(row.location_name_kh || row.location || '').trim();

      if (rowLocId === targetLocId) return true;
      if (targetLoc) {
        if (rowLocId === String(targetLoc.id)) return true;
        if (rowLocId.toUpperCase() === String(targetLoc.code).toUpperCase()) return true;
        if (rowLocCode && rowLocCode === String(targetLoc.code).toUpperCase()) return true;
        if (rowLocNameKh && rowLocNameKh === String(targetLoc.name_kh).trim()) return true;
      }
      return false;
    },
    [findLocationByIdOrCode]
  );

  // Build Part 1 (Non-Consumable Technical Equipment - 11 cols) & Part 2 (Consumable Supplies - 10 cols)
  const { nonConsumableRows, consumableRows } = useMemo(() => {
    const part1: NonConsumableRow[] = [];
    const part2: ConsumableRow[] = [];

    const q = searchQuery.trim().toLowerCase();

    unifiedItems.forEach(item => {
      if (q) {
        const matchesSearch =
          String(item.code || '').toLowerCase().includes(q) ||
          String(item.name_kh || '').toLowerCase().includes(q) ||
          String(item.name_en || '').toLowerCase().includes(q) ||
          String(item.category || '').toLowerCase().includes(q);
        if (!matchesSearch) return;
      }

      // Inventory rows for this item across all locations
      const itemInvAll = unifiedInventory.filter(inv => matchesItem(inv, item));
      const itemInvFiltered = itemInvAll.filter(inv => matchesSelectedLocation(inv, reportLocationId));

      // Transactions / Audit logs for this item
      const itemTxs = dateFilteredTransactions.filter(tx => {
        if (!matchesItem(tx, item)) return false;
        if (reportLocationId !== 'ALL' && !matchesSelectedLocation(tx, reportLocationId)) return false;
        return true;
      });

      let inboundFromTx = 0;
      let outboundFromTx = 0;
      let damagedAdjustedFromTx = 0;
      const recipientBranchesSet = new Set<string>();
      const purposeDateEntries: string[] = [];

      itemTxs.forEach(tx => {
        const rawQty = Number(tx.quantity ?? tx.qty ?? 0);
        const absQty = Math.abs(rawQty) || 0;
        const txType = String(tx.type || tx.action_type || '').toUpperCase();
        const noteText = String(tx.purpose || tx.remark || tx.notes || '').replace(/^\[.*?\]\s*/, '').trim();
        const dateStr = formatShortDate(tx.created_at || tx.timestamp);
        const officer = String(tx.recorded_by || tx.updated_by || tx.officer_name || '').trim();

        if (txType === 'STOCK_IN' || txType === 'NEW_ITEM') {
          inboundFromTx += absQty;
        } else if (txType === 'STOCK_OUT' || txType === 'HANDOVER') {
          outboundFromTx += absQty;
          const destLocObj = findLocationByIdOrCode(tx.to_location || tx.location_id || tx.location);
          if (destLocObj && !isHqLocationOrRow(destLocObj, unifiedLocations)) {
            recipientBranchesSet.add(getShortLocationHeader(destLocObj));
          } else if (officer && !officer.toLowerCase().includes('admin')) {
            recipientBranchesSet.add(officer);
          }
          if (noteText) {
            const entry = dateStr ? `${noteText} (${dateStr})` : noteText;
            if (purposeDateEntries.length < 2 && !purposeDateEntries.includes(entry)) {
              purposeDateEntries.push(entry);
            }
          }
        } else if (txType === 'ADJUST' || txType === 'ADJUSTMENT') {
          if (rawQty < 0 || String(tx.qty_change || '').startsWith('-')) {
            damagedAdjustedFromTx += absQty;
          } else {
            damagedAdjustedFromTx += absQty;
          }
          if (noteText) {
            const entry = dateStr ? `កែតម្រូវ: ${noteText} (${dateStr})` : `កែតម្រូវ: ${noteText}`;
            if (purposeDateEntries.length < 2 && !purposeDateEntries.includes(entry)) {
              purposeDateEntries.push(entry);
            }
          }
        }
      });

      const isTool = isNonConsumableItem(item);
      const minThreshold = Number(item.min_stock || 5);

      if (isTool) {
        // PART 1: ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់)
        let warehouseStockD = 0;
        let branchInUseStock = 0;
        const activeHolderLocations: string[] = [];

        if (reportLocationId === 'ALL') {
          itemInvAll.forEach(inv => {
            const qty = Number(inv.quantity || 0);
            if (isHqLocationOrRow(inv, unifiedLocations)) {
              warehouseStockD += qty;
            } else if (qty > 0) {
              branchInUseStock += qty;
              const locObj = findLocationByIdOrCode(inv.location_id);
              const shortLabel = getShortLocationHeader(locObj || inv.location_name_kh);
              if (shortLabel) {
                activeHolderLocations.push(`${shortLabel} (${qty})`);
              }
            }
          });
        } else {
          itemInvFiltered.forEach(inv => {
            const qty = Number(inv.quantity || 0);
            if (isHqLocationOrRow(inv, unifiedLocations)) {
              warehouseStockD += qty;
            } else {
              branchInUseStock += qty;
              if (qty > 0) {
                const locObj = findLocationByIdOrCode(inv.location_id);
                const shortLabel = getShortLocationHeader(locObj || inv.location_name_kh);
                if (shortLabel) {
                  activeHolderLocations.push(`${shortLabel} (${qty})`);
                }
              }
            }
          });
        }

        // B: កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)
        const inUseB = Math.max(branchInUseStock, outboundFromTx);
        // C: ខូច / បាត់បង់ / កែតម្រូវ (C)
        const damagedAdjustedC = damagedAdjustedFromTx;
        // D: ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
        const warehouseAvailD = warehouseStockD;
        // A: សរុបរួម (A = B + C + D so that D = A - B - C holds strictly true)
        const totalInboundA = inUseB + damagedAdjustedC + warehouseAvailD;

        const holdersCombined = [
          ...activeHolderLocations,
          ...Array.from(recipientBranchesSet).filter(r => !activeHolderLocations.some(h => h.includes(r)))
        ];
        const assignedHoldersText =
          holdersCombined.length > 0
            ? holdersCombined.slice(0, 5).join(', ') +
              (holdersCombined.length > 5 ? ` (+${holdersCombined.length - 5} សាខាទៀត)` : '')
            : warehouseAvailD > 0
              ? 'រក្សាទុកនៅឃ្លាំងកណ្តាល (HQ-ITSB)'
              : 'មិនទាន់បែងចែក';

        const purposeText =
          purposeDateEntries.length > 0
            ? purposeDateEntries.join(' | ')
            : inUseB > 0
              ? 'បម្រើការងារបច្ចេកទេស និងប្រព័ន្ធពន្ធដារតាមសាខា'
              : 'ស្តុកបម្រុងក្នុងឃ្លាំងកណ្តាលសម្រាប់បើកផ្តល់';

        const isViewingHqOrAll =
          reportLocationId === 'ALL' ||
          (activeSelectedLocationObj && isHqLocationOrRow(activeSelectedLocationObj, unifiedLocations));
        const refStock = isViewingHqOrAll ? warehouseAvailD : inUseB;

        let statusCode: 'sufficient' | 'low_stock' | 'out_of_stock' = 'sufficient';
        let statusLabelKh = '🟢 ស្តុកគ្រប់គ្រាន់';
        if (refStock <= 0) {
          statusCode = 'out_of_stock';
          statusLabelKh = '🔴 អស់ពីស្តុក';
        } else if (refStock <= minThreshold) {
          statusCode = 'low_stock';
          statusLabelKh = '🟡 ស្តុកទាប';
        }

        part1.push({
          no: part1.length + 1,
          itemId: item.id,
          itemCode: item.code || item.id,
          nameKh: item.name_kh,
          nameEn: item.name_en,
          unitKh: item.unit || 'គ្រឿង',
          totalInboundA,
          inUseB,
          damagedAdjustedC,
          warehouseAvailD,
          assignedHolders: assignedHoldersText,
          purposeAndDate: purposeText,
          minThreshold,
          statusCode,
          statusLabelKh
        });
      } else {
        // PART 2: ប្រភេទទី២៖ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ)
        let remainingStockC = 0;
        let branchDistributedQty = 0;
        const recipientList: string[] = [];

        if (reportLocationId === 'ALL') {
          itemInvAll.forEach(inv => {
            const qty = Number(inv.quantity || 0);
            if (isHqLocationOrRow(inv, unifiedLocations)) {
              remainingStockC += qty;
            } else if (qty > 0) {
              branchDistributedQty += qty;
              const locObj = findLocationByIdOrCode(inv.location_id);
              const shortLabel = getShortLocationHeader(locObj || inv.location_name_kh);
              if (shortLabel) {
                recipientList.push(`${shortLabel} (${qty})`);
              }
            }
          });
        } else {
          itemInvFiltered.forEach(inv => {
            const qty = Number(inv.quantity || 0);
            remainingStockC += qty;
            if (!isHqLocationOrRow(inv, unifiedLocations) && qty > 0) {
              const locObj = findLocationByIdOrCode(inv.location_id);
              const shortLabel = getShortLocationHeader(locObj || inv.location_name_kh);
              if (shortLabel) {
                recipientList.push(`${shortLabel} (${qty})`);
              }
            }
          });
        }

        // B: បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
        const totalIssuedB = Math.max(outboundFromTx, branchDistributedQty);
        // A: សរុបរួមនាំចូល (A) so C = A - B holds strictly true
        const totalInboundA = remainingStockC + totalIssuedB;

        const recipientsCombined = [
          ...recipientList,
          ...Array.from(recipientBranchesSet).filter(r => !recipientList.some(h => h.includes(r)))
        ];
        const issuedRecipientsText =
          recipientsCombined.length > 0
            ? recipientsCombined.slice(0, 5).join(', ') +
              (recipientsCombined.length > 5 ? ` (+${recipientsCombined.length - 5} សាខាទៀត)` : '')
            : totalIssuedB > 0
              ? 'បណ្តានាយកដ្ឋាន និងសាខាពន្ធដារខណ្ឌ-ខេត្ត'
              : 'ឃ្លាំងកណ្តាល (មិនទាន់បើកផ្តល់)';

        const purposeText =
          purposeDateEntries.length > 0
            ? purposeDateEntries.join(' | ')
            : totalIssuedB > 0
              ? 'បើកផ្តល់សម្រាប់ការងាររដ្ឋបាល និងប្រតិបត្តិការប្រចាំថ្ងៃ'
              : 'ស្តុកបម្រុងក្នុងឃ្លាំងសម្រាប់បើកផ្តល់';

        let statusCode: 'sufficient' | 'low_stock' | 'out_of_stock' = 'sufficient';
        let statusLabelKh = '🟢 ស្តុកគ្រប់គ្រាន់';
        if (remainingStockC <= 0) {
          statusCode = 'out_of_stock';
          statusLabelKh = '🔴 អស់ពីស្តុក';
        } else if (remainingStockC <= minThreshold) {
          statusCode = 'low_stock';
          statusLabelKh = '🟡 ស្តុកទាប';
        }

        part2.push({
          no: part2.length + 1,
          itemId: item.id,
          itemCode: item.code || item.id,
          nameKh: item.name_kh,
          nameEn: item.name_en,
          unitKh: item.unit || 'ឯកតា',
          totalInboundA,
          totalIssuedB,
          remainingStockC,
          issuedRecipients: issuedRecipientsText,
          purposeAndDate: purposeText,
          minThreshold,
          statusCode,
          statusLabelKh
        });
      }
    });

    return { nonConsumableRows: part1, consumableRows: part2 };
  }, [
    unifiedItems,
    unifiedInventory,
    dateFilteredTransactions,
    reportLocationId,
    searchQuery,
    unifiedLocations,
    findLocationByIdOrCode,
    matchesSelectedLocation,
    activeSelectedLocationObj
  ]);

  // Subtotals for Part 1 & Part 2
  const part1Totals = useMemo(() => {
    return nonConsumableRows.reduce(
      (acc, r) => {
        acc.totalInboundA += r.totalInboundA;
        acc.inUseB += r.inUseB;
        acc.damagedAdjustedC += r.damagedAdjustedC;
        acc.warehouseAvailD += r.warehouseAvailD;
        return acc;
      },
      { totalInboundA: 0, inUseB: 0, damagedAdjustedC: 0, warehouseAvailD: 0 }
    );
  }, [nonConsumableRows]);

  const part2Totals = useMemo(() => {
    return consumableRows.reduce(
      (acc, r) => {
        acc.totalInboundA += r.totalInboundA;
        acc.totalIssuedB += r.totalIssuedB;
        acc.remainingStockC += r.remainingStockC;
        return acc;
      },
      { totalInboundA: 0, totalIssuedB: 0, remainingStockC: 0 }
    );
  }, [consumableRows]);

  // Cross-Tab Stock Distribution Matrix (34 Locations)
  const matrixData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filteredItems = unifiedItems.filter(item => {
      if (!q) return true;
      return (
        String(item.code || '').toLowerCase().includes(q) ||
        String(item.name_kh || '').toLowerCase().includes(q) ||
        String(item.name_en || '').toLowerCase().includes(q) ||
        String(item.category || '').toLowerCase().includes(q)
      );
    });

    const columnTotals: Record<string, number> = {};
    unifiedLocations.forEach(loc => {
      columnTotals[loc.id] = 0;
    });
    let grandTotal = 0;

    const rows: MatrixItemRow[] = filteredItems.map((item, idx) => {
      const locMap: Record<string, number> = {};
      unifiedLocations.forEach(loc => {
        locMap[loc.id] = 0;
      });

      let rowSum = 0;
      unifiedInventory.forEach(inv => {
        if (matchesItem(inv, item)) {
          const locObj = findLocationByIdOrCode(inv.location_id);
          if (locObj) {
            const qty = Number(inv.quantity || 0);
            locMap[locObj.id] = (locMap[locObj.id] || 0) + qty;
            rowSum += qty;
            columnTotals[locObj.id] = (columnTotals[locObj.id] || 0) + qty;
            grandTotal += qty;
          }
        }
      });

      const isTool = isNonConsumableItem(item);

      return {
        no: idx + 1,
        itemId: item.id,
        itemCode: item.code || item.id,
        nameKh: item.name_kh,
        nameEn: item.name_en,
        categoryType: isTool ? 'non_consumable' : 'consumable',
        categoryLabelKh: isTool ? 'ប្រើប្រាស់មិនអស់' : 'ប្រើប្រាស់អស់ទៅ',
        unitKh: item.unit,
        totalQty: rowSum,
        locationQuantities: locMap
      };
    });

    return {
      rows,
      columnTotals,
      grandTotal
    };
  }, [unifiedItems, unifiedInventory, unifiedLocations, searchQuery, findLocationByIdOrCode]);

  // ===========================================================================
  // EXPORT TO EXCEL (.xlsx) — STYLED TO MATCH OFFICIAL A4 LANDSCAPE PRINT PREVIEW
  // ===========================================================================
  const exportToExcel = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const formattedKhDate = new Date().toLocaleDateString('km-KH', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const locationLabel =
      reportLocationId === 'ALL' || !activeSelectedLocationObj
        ? 'គ្រប់ទីតាំងស្តុកទាំងអស់ (ឃ្លាំងកណ្តាល HQ-ITSB និង ៣៣ សាខាពន្ធដារ)'
        : formatLocationOption(activeSelectedLocationObj, 'kh');
    const dateRangeLabel =
      startDate || endDate
        ? `ចាប់ពីថ្ងៃទី ${startDate || '...'} ដល់ថ្ងៃទី ${endDate || '...'}`
        : `គិតត្រឹមថ្ងៃទី ${formattedKhDate}`;

    // Reusable border helpers
    const thinBorder = (color = 'CBD5E1') => ({
      top: { style: 'thin', color: { rgb: color } },
      bottom: { style: 'thin', color: { rgb: color } },
      left: { style: 'thin', color: { rgb: color } },
      right: { style: 'thin', color: { rgb: color } }
    });

    const headerBorder = {
      top: { style: 'medium', color: { rgb: '05402D' } },
      bottom: { style: 'medium', color: { rgb: 'D4AF37' } },
      left: { style: 'thin', color: { rgb: '475569' } },
      right: { style: 'thin', color: { rgb: '475569' } }
    };

    const subtotalBorder = {
      top: { style: 'medium', color: { rgb: '05402D' } },
      bottom: { style: 'double', color: { rgb: '05402D' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } }
    };

    // Helper to apply style to a range of cells (inclusive, 0-indexed)
    const styleRange = (
      ws: Record<string, any>,
      sR: number,
      sC: number,
      eR: number,
      eC: number,
      styleObj: Record<string, any>
    ) => {
      for (let r = sR; r <= eR; r++) {
        for (let c = sC; c <= eC; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) {
            ws[ref] = { t: 's', v: '' };
          }
          ws[ref].s = {
            ...(ws[ref].s || {}),
            ...styleObj
          };
        }
      }
    };

    // Helper to build the official Royal Government header + KPI summary block
    const applyOfficialSheetHeader = (
      ws: Record<string, any>,
      merges: any[],
      totalCols: number,
      sectionTitleKh: string,
      definitionKh: string
    ) => {
      const lastCol = totalCols - 1;
      const leftSpanEnd = Math.min(3, Math.floor(totalCols / 2) - 1);
      const rightSpanStart = Math.max(leftSpanEnd + 1, totalCols - 4);

      // Merges for Row 0..3 (Left Ministry & Right Kingdom Motto)
      for (let r = 0; r <= 3; r++) {
        merges.push({ s: { r, c: 0 }, e: { r, c: leftSpanEnd } });
        merges.push({ s: { r, c: rightSpanStart }, e: { r, c: lastCol } });
      }

      // Merges for Centerpiece Title, Section Title, Scope/Date, Definition (Rows 4..7)
      merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: lastCol } });
      merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: lastCol } });
      merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: lastCol } });
      merges.push({ s: { r: 7, c: 0 }, e: { r: 7, c: lastCol } });

      // Style Left Official Header (Rows 0..1: Moul, Row 2: Dept Bold, Row 3: Ref No)
      styleRange(ws, 0, 0, 1, leftSpanEnd, {
        font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
      styleRange(ws, 2, 0, 2, leftSpanEnd, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '1E293B' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      });
      styleRange(ws, 3, 0, 3, leftSpanEnd, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '475569' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: '05402D' } } }
      });

      // Style Middle Empty Header Row 3 Bottom Border
      if (rightSpanStart > leftSpanEnd + 1) {
        styleRange(ws, 3, leftSpanEnd + 1, 3, rightSpanStart - 1, {
          border: { bottom: { style: 'medium', color: { rgb: '05402D' } } }
        });
      }

      // Style Right Kingdom Motto (Rows 0..1: Moul, Row 2: Gold Divider, Row 3: Bottom Border)
      styleRange(ws, 0, rightSpanStart, 1, lastCol, {
        font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      styleRange(ws, 2, rightSpanStart, 2, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: 'D4AF37' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      styleRange(ws, 3, rightSpanStart, 3, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 9, color: { rgb: '64748B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: '05402D' } } }
      });

      // Row 4: Main Report Title
      styleRange(ws, 4, 0, 4, lastCol, {
        font: { name: 'Khmer OS Muol Light', sz: 12.5, bold: true, color: { rgb: '05402D' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Row 5: Section Subtitle
      const secCell = XLSX.utils.encode_cell({ r: 5, c: 0 });
      if (ws[secCell]) ws[secCell].v = sectionTitleKh;
      styleRange(ws, 5, 0, 5, lastCol, {
        font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: 'ECFDF5' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('A7F3D0')
      });

      // Row 6: Location Scope & Date Range
      styleRange(ws, 6, 0, 6, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });

      // Row 7: Definition Banner
      const defCell = XLSX.utils.encode_cell({ r: 7, c: 0 });
      if (ws[defCell]) ws[defCell].v = definitionKh;
      styleRange(ws, 7, 0, 7, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 9, italic: true, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: thinBorder('E2E8F0')
      });
    };

    // Helper to style the 3-column signature block at the bottom of a sheet
    const appendAndStyleSignatureBlock = (
      sheetAoA: (string | number)[][],
      merges: any[],
      totalCols: number
    ): number => {
      const emptyRow = new Array(totalCols).fill('');
      sheetAoA.push([...emptyRow]); // Blank spacer row

      const sigStartRow = sheetAoA.length;
      const lastCol = totalCols - 1;

      // Align the 3 signature blocks cleanly with the table column groups:
      // Sheet 1 (11 cols): Left = Cols 0..3, Center = Cols 4..7, Right = Cols 8..10
      // Sheet 2 (10 cols): Left = Cols 0..3, Center = Cols 4..6, Right = Cols 7..9
      let g1End: number;
      let g2Start: number;
      let g2End: number;
      let g3Start: number;

      if (totalCols === 11) {
        g1End = 3;
        g2Start = 4;
        g2End = 7;
        g3Start = 8;
      } else if (totalCols === 10) {
        g1End = 3;
        g2Start = 4;
        g2End = 6;
        g3Start = 7;
      } else {
        g1End = Math.max(3, Math.floor(totalCols / 3) - 1);
        g2Start = g1End + 1;
        g2End = Math.max(g2Start + 2, Math.floor((totalCols * 2) / 3) - 1);
        g3Start = g2End + 1;
      }

      const buildSigRow = (leftText: string, midText: string, rightText: string) => {
        const row = new Array(totalCols).fill('');
        row[0] = leftText;
        row[g2Start] = midText;
        row[g3Start] = rightText;
        return row;
      };

      // 6 structured rows for the 3-Column Official Signature Block:
      // Left: អ្នករៀបចំរបាយការណ៍ (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក) -> មន្ត្រីគ្រប់គ្រងស្តុក
      // Center: បានពិនិត្យ និងឯកភាព (ប្រធានការិយាល័យ) -> ប្រធានការិយាល័យទទួលបន្ទុក
      // Right: បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន) -> ប្រធាននាយកដ្ឋាន
      sheetAoA.push(
        buildSigRow(
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩',
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩',
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩'
        )
      );
      sheetAoA.push(
        buildSigRow(
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦',
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦',
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦'
        )
      );
      sheetAoA.push(
        buildSigRow(
          'អ្នករៀបចំរបាយការណ៍ (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក)',
          'បានពិនិត្យ និងឯកភាព (ប្រធានការិយាល័យ)',
          'បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន)'
        )
      );
      sheetAoA.push([...emptyRow]); // Space for physical stamp & signature
      sheetAoA.push(
        buildSigRow(
          '...................................................',
          '...................................................',
          '...................................................'
        )
      );
      sheetAoA.push(
        buildSigRow(
          'មន្ត្រីគ្រប់គ្រងស្តុក',
          'ប្រធានការិយាល័យទទួលបន្ទុក',
          'ប្រធាននាយកដ្ឋាន'
        )
      );

      for (let r = sigStartRow; r < sigStartRow + 6; r++) {
        merges.push({ s: { r, c: 0 }, e: { r, c: g1End } });
        merges.push({ s: { r, c: g2Start }, e: { r, c: g2End } });
        merges.push({ s: { r, c: g3Start }, e: { r, c: lastCol } });
      }

      return sigStartRow;
    };

    const styleSignatureRows = (ws: Record<string, any>, sigStartRow: number, totalCols: number) => {
      const lastCol = totalCols - 1;
      // Lunar & Solar date rows
      styleRange(ws, sigStartRow, 0, sigStartRow + 1, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '334155' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      // Role Title row (Moul font)
      styleRange(ws, sigStartRow + 2, 0, sigStartRow + 2, lastCol, {
        font: { name: 'Khmer OS Muol Light', sz: 10, bold: true, color: { rgb: '05402D' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
      // Dotted line & Signer Title/Name rows
      styleRange(ws, sigStartRow + 4, 0, sigStartRow + 4, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '94A3B8' } },
        alignment: { horizontal: 'center', vertical: 'bottom' }
      });
      styleRange(ws, sigStartRow + 5, 0, sigStartRow + 5, lastCol, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      });
    };

    const wb = XLSX.utils.book_new();

    // =========================================================================
    // SHEET 1: "ឧបករណ៍បច្ចេកទេស-មិនអស់" (11 Columns — Part 1)
    // =========================================================================
    const cols1 = 11;
    const merges1: any[] = [];
    const sheet1AoA: (string | number)[][] = [
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា', '', '', ''],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ', '', '', ''],
      ['នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន', '', '', '', '', '', '', '✦ ✦ ✦', '', '', ''],
      ['លេខ៖ ........................... អពដ/នបព', '', '', '', '', '', '', '', '', '', ''],
      ['របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់', '', '', '', '', '', '', '', '', '', ''],
      ['ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (Tools)»', '', '', '', '', '', '', '', '', '', ''],
      [`ទីតាំងស្តុក៖ ${locationLabel}   •   កាលបរិច្ឆេទរបាយការណ៍៖ ${dateRangeLabel}`, '', '', '', '', '', '', '', '', '', ''],
      ['និយមន័យ៖ ជាឧបករណ៍/សម្ភារដែលមានតម្លៃគង់វង្ស ពេលដកចេញគឺមិនអស់រូបរាងឡើយ គឺស្ថិតក្នុងស្ថានភាពកំពុងប្រើប្រាស់ជាក់ស្តែងក្នុងដៃមន្ត្រី ឬសាខា។', '', '', '', '', '', '', '', '', '', ''],
      // Row 8: KPI Summary Banner for Part 1
      [
        `១. ឧបករណ៍បច្ចេកទេសសរុប (A)៖ ${part1Totals.totalInboundA.toLocaleString()} គ្រឿង (${nonConsumableRows.length} មុខ)`,
        '',
        '',
        `២. កំពុងប្រើប្រាស់ជាក់ស្តែង (B)៖ ${part1Totals.inUseB.toLocaleString()} គ្រឿង`,
        '',
        '',
        `៣. ខូច / កែតម្រូវ (C)៖ ${part1Totals.damagedAdjustedC.toLocaleString()} គ្រឿង`,
        '',
        `៤. ស្តុកនៅសល់ក្នុងឃ្លាំង (D = A - B - C)៖ ${part1Totals.warehouseAvailD.toLocaleString()} គ្រឿង`,
        '',
        ''
      ],
      new Array(cols1).fill(''), // Row 9: Spacer
      // Row 10: Table Header
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស',
        'ឯកតា',
        'សរុបរួម\n(A = B + C + D)',
        'កំពុងប្រើប្រាស់ /\nបានប្រគល់ជូន (B)',
        'ខូច / បាត់បង់ /\nកែតម្រូវ (C)',
        'ស្តុកនៅសល់ក្នុងឃ្លាំង\n(D = A - B - C)',
        'សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង',
        'គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ',
        'ស្ថានភាពស្តុក'
      ]
    ];

    // Merges for Row 8 KPI cards on Sheet 1
    merges1.push(
      { s: { r: 8, c: 0 }, e: { r: 8, c: 2 } },
      { s: { r: 8, c: 3 }, e: { r: 8, c: 5 } },
      { s: { r: 8, c: 6 }, e: { r: 8, c: 7 } },
      { s: { r: 8, c: 8 }, e: { r: 8, c: 10 } }
    );

    const headerRowIdx1 = 10;
    const dataStartRow1 = 11;

    nonConsumableRows.forEach(r => {
      sheet1AoA.push([
        r.no,
        r.itemCode,
        `${r.nameKh}\n(${r.nameEn})`,
        r.unitKh,
        r.totalInboundA,
        r.inUseB,
        r.damagedAdjustedC,
        r.warehouseAvailD,
        r.assignedHolders,
        r.purposeAndDate,
        r.statusLabelKh
      ]);
    });

    const subtotalRowIdx1 = sheet1AoA.length;
    sheet1AoA.push([
      'សរុបរួមផ្នែកទី ១ (SUBTOTAL - សម្ភារឧបករណ៍បច្ចេកទេសប្រើប្រាស់មិនអស់)៖',
      '',
      '',
      '',
      part1Totals.totalInboundA,
      part1Totals.inUseB,
      part1Totals.damagedAdjustedC,
      part1Totals.warehouseAvailD,
      `តុល្យភាពស្តុកឧបករណ៍បច្ចេកទេស៖ D (${part1Totals.warehouseAvailD.toLocaleString()}) = A (${part1Totals.totalInboundA.toLocaleString()}) - B (${part1Totals.inUseB.toLocaleString()}) - C (${part1Totals.damagedAdjustedC.toLocaleString()})`,
      '',
      ''
    ]);
    merges1.push(
      { s: { r: subtotalRowIdx1, c: 0 }, e: { r: subtotalRowIdx1, c: 3 } },
      { s: { r: subtotalRowIdx1, c: 8 }, e: { r: subtotalRowIdx1, c: 10 } }
    );

    const sigStart1 = appendAndStyleSignatureBlock(sheet1AoA, merges1, cols1);
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1AoA);

    applyOfficialSheetHeader(
      ws1,
      merges1,
      cols1,
      'ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (Tools)»',
      'និយមន័យ៖ ជាឧបករណ៍/សម្ភារដែលមានតម្លៃគង់វង្ស ពេលដកចេញគឺមិនអស់រូបរាងឡើយ គឺស្ថិតក្នុងស្ថានភាពកំពុងប្រើប្រាស់ជាក់ស្តែងក្នុងដៃមន្ត្រី ឬសាខា។'
    );

    // Style KPI Row 8 on Sheet 1
    styleRange(ws1, 8, 0, 8, 2, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('94A3B8')
    });
    styleRange(ws1, 8, 3, 8, 5, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'EFF6FF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('93C5FD')
    });
    styleRange(ws1, 8, 6, 8, 7, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '9F1239' } },
      fill: { fgColor: { rgb: 'FFF1F2' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('FDA4AF')
    });
    styleRange(ws1, 8, 8, 8, 10, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('6EE7B7')
    });

    // Style Table Header Row 10 on Sheet 1
    styleRange(ws1, headerRowIdx1, 0, headerRowIdx1, cols1 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '05402D' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    // Highlight Col 4 (Inbound A) & Col 7 (Warehouse D) in Header
    styleRange(ws1, headerRowIdx1, 4, headerRowIdx1, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '03291E' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    styleRange(ws1, headerRowIdx1, 7, headerRowIdx1, 7, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'D4AF37' } },
      fill: { fgColor: { rgb: '022C22' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });

    // Style Data Rows on Sheet 1
    nonConsumableRows.forEach((row, idx) => {
      const r = dataStartRow1 + idx;
      const zebraFill = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

      // Base row style
      styleRange(ws1, r, 0, r, cols1 - 1, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });

      // Col 0: No (Center)
      styleRange(ws1, r, 0, r, 0, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      // Col 1: Code (Center, Bold Green)
      styleRange(ws1, r, 1, r, 1, {
        font: { name: 'Consolas', sz: 9.5, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      // Col 2: Name (Left, Bold)
      styleRange(ws1, r, 2, r, 2, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });
      // Col 3: Unit (Center)
      styleRange(ws1, r, 3, r, 3, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      // Col 4: Inbound A (Right, Bold Slate, Light Gray Fill)
      styleRange(ws1, r, 4, r, 4, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 5: In-Use B (Right, Bold Blue)
      styleRange(ws1, r, 5, r, 5, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '1D4ED8' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 6: Damaged/Adjusted C (Right, Rose)
      styleRange(ws1, r, 6, r, 6, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: row.damagedAdjustedC > 0, color: { rgb: row.damagedAdjustedC > 0 ? 'BE123C' : '64748B' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 7: Warehouse Available D (Right, Bold GDT Green, Soft Emerald Fill)
      styleRange(ws1, r, 7, r, 7, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: 'ECFDF5' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 8 & 9: Assigned Holders & Purpose (Left, Wrap)
      styleRange(ws1, r, 8, r, 9, {
        font: { name: 'Khmer OS Siemreap', sz: 9, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });
      // Col 10: Status Badge
      const statusFill =
        row.statusCode === 'sufficient'
          ? 'DCFCE7'
          : row.statusCode === 'low_stock'
            ? 'FEF3C7'
            : 'FFE4E6';
      const statusColor =
        row.statusCode === 'sufficient'
          ? '166534'
          : row.statusCode === 'low_stock'
            ? '92400E'
            : '9F1239';
      styleRange(ws1, r, 10, r, 10, {
        font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: statusColor } },
        fill: { fgColor: { rgb: statusFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
    });

    // Style Subtotal Row on Sheet 1
    styleRange(ws1, subtotalRowIdx1, 0, subtotalRowIdx1, 3, {
      font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: subtotalBorder
    });
    styleRange(ws1, subtotalRowIdx1, 4, subtotalRowIdx1, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'CBD5E1' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws1, subtotalRowIdx1, 5, subtotalRowIdx1, 5, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '1E40AF' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws1, subtotalRowIdx1, 6, subtotalRowIdx1, 6, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '9F1239' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws1, subtotalRowIdx1, 7, subtotalRowIdx1, 7, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'D1FAE5' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws1, subtotalRowIdx1, 8, subtotalRowIdx1, 10, {
      font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: '334155' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: subtotalBorder
    });

    styleSignatureRows(ws1, sigStart1, cols1);

    ws1['!merges'] = merges1;
    ws1['!cols'] = [
      { wch: 6 },   // ល.រ
      { wch: 11 },  // កូដ
      { wch: 36 },  // ឈ្មោះឧបករណ៍
      { wch: 10 },  // ឯកតា
      { wch: 16 },  // សរុបរួម A
      { wch: 20 },  // កំពុងប្រើប្រាស់ B
      { wch: 17 },  // ខូច/កែតម្រូវ C
      { wch: 20 },  // ស្តុកនៅសល់ក្នុងឃ្លាំង D
      { wch: 36 },  // សាខា ឬមន្ត្រីទទួលកាន់កាប់
      { wch: 38 },  // គោលបំណង និងកាលបរិច្ឆេទ
      { wch: 18 }   // ស្ថានភាពស្តុក
    ];
    ws1['!rows'] = [
      { hpt: 20 }, // Row 0
      { hpt: 20 }, // Row 1
      { hpt: 19 }, // Row 2
      { hpt: 19 }, // Row 3
      { hpt: 28 }, // Row 4 Main Title
      { hpt: 24 }, // Row 5 Section Title
      { hpt: 20 }, // Row 6 Scope & Date
      { hpt: 22 }, // Row 7 Definition
      { hpt: 26 }, // Row 8 KPI Cards
      { hpt: 10 }, // Row 9 Spacer
      { hpt: 36 }, // Row 10 Table Header
      ...nonConsumableRows.map(() => ({ hpt: 32 })),
      { hpt: 28 }, // Subtotal
      { hpt: 14 }, // Spacer
      { hpt: 19 }, // Sig Lunar
      { hpt: 19 }, // Sig Solar
      { hpt: 22 }, // Sig Title
      { hpt: 38 }, // Sig Stamp Space
      { hpt: 18 }, // Sig Dotted
      { hpt: 22 }  // Sig Officer Name
    ];
    ws1['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    XLSX.utils.book_append_sheet(wb, ws1, 'ឧបករណ៍បច្ចេកទេស-មិនអស់');

    // =========================================================================
    // SHEET 2: "សម្ភារប្រើប្រាស់-អស់ទៅ" (10 Columns — Part 2)
    // =========================================================================
    const cols2 = 10;
    const merges2: any[] = [];
    const sheet2AoA: (string | number)[][] = [
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា', '', '', ''],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ', '', '', ''],
      ['នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន', '', '', '', '', '', '✦ ✦ ✦', '', '', ''],
      ['លេខ៖ ........................... អពដ/នបព', '', '', '', '', '', '', '', '', ''],
      ['របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់', '', '', '', '', '', '', '', '', ''],
      ['ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារប្រើប្រាស់ (Suppliers)»', '', '', '', '', '', '', '', '', ''],
      [`ទីតាំងស្តុក៖ ${locationLabel}   •   កាលបរិច្ឆេទរបាយការណ៍៖ ${dateRangeLabel}`, '', '', '', '', '', '', '', '', ''],
      ['និយមន័យ៖ ជាសម្ភារបរិក្ខារដែលពេលដកចេញ គឺបានបើកផ្តល់ និងប្រើប្រាស់អស់ទៅតាមការងារជាក់ស្តែង គ្មានការយកត្រឡប់ចូលឃ្លាំងវិញទេ។', '', '', '', '', '', '', '', '', ''],
      // Row 8: KPI Summary Banner for Part 2
      [
        `១. មុខសម្ភារប្រើប្រាស់អស់ទៅសរុប៖ ${consumableRows.length} មុខសម្ភារ`,
        '',
        '',
        `២. បរិមាណសរុបរួមនាំចូល (A)៖ ${part2Totals.totalInboundA.toLocaleString()} ឯកតា`,
        '',
        `៣. បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)៖ ${part2Totals.totalIssuedB.toLocaleString()} ឯកតា`,
        '',
        `៤. ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)៖ ${part2Totals.remainingStockC.toLocaleString()} ឯកតា`,
        '',
        ''
      ],
      new Array(cols2).fill(''), // Row 9: Spacer
      // Row 10: Table Header
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះសម្ភារប្រើប្រាស់អស់ទៅ',
        'ឯកតា',
        'សរុបរួមនាំចូល\n(A)',
        'បានបើកផ្តល់ និង\nប្រើប្រាស់សរុប (B)',
        'ស្តុកនៅសល់ក្នុងឃ្លាំង\n(C = A - B)',
        'សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់',
        'គោលបំណង និងកាលបរិច្ឆេទបើកបែក',
        'ស្ថានភាពស្តុក'
      ]
    ];

    merges2.push(
      { s: { r: 8, c: 0 }, e: { r: 8, c: 2 } },
      { s: { r: 8, c: 3 }, e: { r: 8, c: 4 } },
      { s: { r: 8, c: 5 }, e: { r: 8, c: 6 } },
      { s: { r: 8, c: 7 }, e: { r: 8, c: 9 } }
    );

    const headerRowIdx2 = 10;
    const dataStartRow2 = 11;

    consumableRows.forEach(r => {
      sheet2AoA.push([
        r.no,
        r.itemCode,
        `${r.nameKh}\n(${r.nameEn})`,
        r.unitKh,
        r.totalInboundA,
        r.totalIssuedB,
        r.remainingStockC,
        r.issuedRecipients,
        r.purposeAndDate,
        r.statusLabelKh
      ]);
    });

    const subtotalRowIdx2 = sheet2AoA.length;
    sheet2AoA.push([
      'សរុបរួមផ្នែកទី ២ (SUBTOTAL - សម្ភារប្រើប្រាស់អស់ទៅ)៖',
      '',
      '',
      '',
      part2Totals.totalInboundA,
      part2Totals.totalIssuedB,
      part2Totals.remainingStockC,
      `តុល្យភាពស្តុកសម្ភារប្រើប្រាស់អស់ទៅ៖ C (${part2Totals.remainingStockC.toLocaleString()}) = A (${part2Totals.totalInboundA.toLocaleString()}) - B (${part2Totals.totalIssuedB.toLocaleString()})`,
      '',
      ''
    ]);
    merges2.push(
      { s: { r: subtotalRowIdx2, c: 0 }, e: { r: subtotalRowIdx2, c: 3 } },
      { s: { r: subtotalRowIdx2, c: 7 }, e: { r: subtotalRowIdx2, c: 9 } }
    );

    const sigStart2 = appendAndStyleSignatureBlock(sheet2AoA, merges2, cols2);
    const ws2 = XLSX.utils.aoa_to_sheet(sheet2AoA);

    applyOfficialSheetHeader(
      ws2,
      merges2,
      cols2,
      'ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារប្រើប្រាស់ (Suppliers)»',
      'និយមន័យ៖ ជាសម្ភារបរិក្ខារដែលពេលដកចេញ គឺបានបើកផ្តល់ និងប្រើប្រាស់អស់ទៅតាមការងារជាក់ស្តែង គ្មានការយកត្រឡប់ចូលឃ្លាំងវិញទេ។'
    );

    // Style KPI Row 8 on Sheet 2
    styleRange(ws2, 8, 0, 8, 2, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'F1F5F9' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('94A3B8')
    });
    styleRange(ws2, 8, 3, 8, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('94A3B8')
    });
    styleRange(ws2, 8, 5, 8, 6, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'FFFBEB' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('FCD34D')
    });
    styleRange(ws2, 8, 7, 8, 9, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('6EE7B7')
    });

    // Style Table Header Row 10 on Sheet 2
    styleRange(ws2, headerRowIdx2, 0, headerRowIdx2, cols2 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '05402D' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    styleRange(ws2, headerRowIdx2, 4, headerRowIdx2, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '03291E' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    styleRange(ws2, headerRowIdx2, 6, headerRowIdx2, 6, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'D4AF37' } },
      fill: { fgColor: { rgb: '022C22' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });

    // Style Data Rows on Sheet 2
    consumableRows.forEach((row, idx) => {
      const r = dataStartRow2 + idx;
      const zebraFill = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

      styleRange(ws2, r, 0, r, cols2 - 1, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });

      styleRange(ws2, r, 0, r, 0, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws2, r, 1, r, 1, {
        font: { name: 'Consolas', sz: 9.5, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws2, r, 2, r, 2, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws2, r, 3, r, 3, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      // Col 4: Inbound A
      styleRange(ws2, r, 4, r, 4, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: 'F1F5F9' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 5: Issued B (Amber)
      styleRange(ws2, r, 5, r, 5, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: 'B45309' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 6: Remaining Stock C (GDT Green)
      styleRange(ws2, r, 6, r, 6, {
        font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: 'ECFDF5' } },
        alignment: { horizontal: 'right', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });
      // Col 7 & 8: Recipients & Purpose
      styleRange(ws2, r, 7, r, 8, {
        font: { name: 'Khmer OS Siemreap', sz: 9, color: { rgb: '1E293B' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder('CBD5E1')
      });
      // Col 9: Status Badge
      const statusFill =
        row.statusCode === 'sufficient'
          ? 'DCFCE7'
          : row.statusCode === 'low_stock'
            ? 'FEF3C7'
            : 'FFE4E6';
      const statusColor =
        row.statusCode === 'sufficient'
          ? '166534'
          : row.statusCode === 'low_stock'
            ? '92400E'
            : '9F1239';
      styleRange(ws2, r, 9, r, 9, {
        font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: statusColor } },
        fill: { fgColor: { rgb: statusFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
    });

    // Style Subtotal Row on Sheet 2
    styleRange(ws2, subtotalRowIdx2, 0, subtotalRowIdx2, 3, {
      font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: subtotalBorder
    });
    styleRange(ws2, subtotalRowIdx2, 4, subtotalRowIdx2, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'CBD5E1' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws2, subtotalRowIdx2, 5, subtotalRowIdx2, 5, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '92400E' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws2, subtotalRowIdx2, 6, subtotalRowIdx2, 6, {
      font: { name: 'Khmer OS Siemreap', sz: 10.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'D1FAE5' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRange(ws2, subtotalRowIdx2, 7, subtotalRowIdx2, 9, {
      font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: '334155' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: subtotalBorder
    });

    styleSignatureRows(ws2, sigStart2, cols2);

    ws2['!merges'] = merges2;
    ws2['!cols'] = [
      { wch: 6 },   // ល.រ
      { wch: 11 },  // កូដ
      { wch: 36 },  // ឈ្មោះសម្ភារ
      { wch: 10 },  // ឯកតា
      { wch: 18 },  // សរុបរួមនាំចូល A
      { wch: 22 },  // បានបើកផ្តល់ B
      { wch: 22 },  // ស្តុកនៅសល់ក្នុងឃ្លាំង C
      { wch: 36 },  // សាខា ឬអង្គភាពបានបើកយក
      { wch: 38 },  // គោលបំណង និងកាលបរិច្ឆេទ
      { wch: 18 }   // ស្ថានភាពស្តុក
    ];
    ws2['!rows'] = [
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 28 },
      { hpt: 24 },
      { hpt: 20 },
      { hpt: 22 },
      { hpt: 26 },
      { hpt: 10 },
      { hpt: 36 },
      ...consumableRows.map(() => ({ hpt: 32 })),
      { hpt: 28 },
      { hpt: 14 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 22 },
      { hpt: 38 },
      { hpt: 18 },
      { hpt: 22 }
    ];
    ws2['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    XLSX.utils.book_append_sheet(wb, ws2, 'សម្ភារប្រើប្រាស់-អស់ទៅ');

    // =========================================================================
    // SHEET 3: "តារាងម៉ាទ្រីសតាមទីតាំង" (Cross-Tab Stock Distribution Matrix)
    // =========================================================================
    const cols3 = 5 + unifiedLocations.length;
    const merges3: any[] = [];
    const buildHeaderRow3 = (leftTxt: string, rightTxt: string) => {
      const arr = new Array(cols3).fill('');
      arr[0] = leftTxt;
      arr[Math.max(4, cols3 - 8)] = rightTxt;
      return arr;
    };
    const buildFullMergedRow3 = (txt: string) => {
      const arr = new Array(cols3).fill('');
      arr[0] = txt;
      return arr;
    };

    const sheet3AoA: (string | number)[][] = [
      buildHeaderRow3('ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', 'ព្រះរាជាណាចក្រកម្ពុជា'),
      buildHeaderRow3('អគ្គនាយកដ្ឋានពន្ធដារ', 'ជាតិ សាសនា ព្រះមហាក្សត្រ'),
      buildHeaderRow3('នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន', '✦ ✦ ✦'),
      buildHeaderRow3('លេខ៖ ........................... អពដ/នបព', ''),
      buildFullMergedRow3('របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់'),
      buildFullMergedRow3('តារាងម៉ាទ្រីសបែងចែកស្តុកតាមបណ្តាទីតាំងទាំងអស់ (Cross-Tab Stock Distribution Matrix)'),
      buildFullMergedRow3(`ទីតាំងស្តុក៖ គ្រប់ទីតាំងស្តុកទាំង ${unifiedLocations.length}   •   កាលបរិច្ឆេទរបាយការណ៍៖ ${dateRangeLabel}`),
      buildFullMergedRow3('បង្ហាញបរិមាណសម្ភារនីមួយៗតាមជួរឈរទីតាំងស្តុកទាំងអស់ (ឃ្លាំងកណ្តាល HQ-ITSB → ថ្នាក់កណ្តាល → សាខាពន្ធដារខណ្ឌ → សាខាពន្ធដារខេត្ត)'),
      new Array(cols3).fill(''), // Row 8 spacer
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះសម្ភារៈ',
        'ខ្នាត',
        'សរុបរួម',
        ...unifiedLocations.map(loc => getShortLocationHeader(loc))
      ]
    ];

    const headerRowIdx3 = 9;
    const dataStartRow3 = 10;

    matrixData.rows.forEach(r => {
      sheet3AoA.push([
        r.no,
        r.itemCode,
        r.nameKh,
        r.unitKh,
        r.totalQty,
        ...unifiedLocations.map(loc => {
          const val = r.locationQuantities[loc.id] || 0;
          return val > 0 ? val : '-';
        })
      ]);
    });

    const subtotalRowIdx3 = sheet3AoA.length;
    sheet3AoA.push([
      'សរុបតាមទីតាំងនីមួយៗ (COLUMN TOTALS)៖',
      '',
      '',
      '',
      matrixData.grandTotal,
      ...unifiedLocations.map(loc => {
        const colSum = matrixData.columnTotals[loc.id] || 0;
        return colSum > 0 ? colSum : '-';
      })
    ]);
    merges3.push({ s: { r: subtotalRowIdx3, c: 0 }, e: { r: subtotalRowIdx3, c: 3 } });

    const sigStart3 = appendAndStyleSignatureBlock(sheet3AoA, merges3, cols3);
    const ws3 = XLSX.utils.aoa_to_sheet(sheet3AoA);

    // Custom header merges for wide Matrix sheet
    const rightStart3 = Math.max(4, cols3 - 8);
    for (let r = 0; r <= 3; r++) {
      merges3.push({ s: { r, c: 0 }, e: { r, c: 3 } });
      merges3.push({ s: { r, c: rightStart3 }, e: { r, c: cols3 - 1 } });
    }
    for (let r = 4; r <= 7; r++) {
      merges3.push({ s: { r, c: 0 }, e: { r, c: cols3 - 1 } });
    }

    styleRange(ws3, 0, 0, 1, 3, {
      font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    });
    styleRange(ws3, 2, 0, 2, 3, {
      font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    });
    styleRange(ws3, 3, 0, 3, cols3 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, color: { rgb: '475569' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { bottom: { style: 'medium', color: { rgb: '05402D' } } }
    });
    styleRange(ws3, 0, rightStart3, 1, cols3 - 1, {
      font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    styleRange(ws3, 2, rightStart3, 2, cols3 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: 'D4AF37' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    styleRange(ws3, 4, 0, 4, cols3 - 1, {
      font: { name: 'Khmer OS Muol Light', sz: 12.5, bold: true, color: { rgb: '05402D' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    styleRange(ws3, 5, 0, 5, cols3 - 1, {
      font: { name: 'Khmer OS Muol Light', sz: 10.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'ECFDF5' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('A7F3D0')
    });
    styleRange(ws3, 6, 0, 6, cols3 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
    styleRange(ws3, 7, 0, 7, cols3 - 1, {
      font: { name: 'Khmer OS Siemreap', sz: 9, italic: true, color: { rgb: '334155' } },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder('E2E8F0')
    });

    // Style Matrix Table Header (Row 9) — Fixed Columns 0..4 horizontal, Location Columns 5..N rotated 90 deg!
    styleRange(ws3, headerRowIdx3, 0, headerRowIdx3, 3, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '05402D' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    styleRange(ws3, headerRowIdx3, 4, headerRowIdx3, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: 'D4AF37' } },
      fill: { fgColor: { rgb: '022C22' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: headerBorder
    });
    unifiedLocations.forEach((_, idx) => {
      const c = 5 + idx;
      const isCentral = idx === 0;
      styleRange(ws3, headerRowIdx3, c, headerRowIdx3, c, {
        font: {
          name: 'Khmer OS Siemreap',
          sz: 9,
          bold: true,
          color: { rgb: isCentral ? 'D4AF37' : 'FFFFFF' }
        },
        fill: { fgColor: { rgb: isCentral ? '022C22' : '05402D' } },
        alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90 },
        border: headerBorder
      });
    });

    // Style Matrix Data Rows
    matrixData.rows.forEach((row, rIdx) => {
      const r = dataStartRow3 + rIdx;
      const zebraFill = rIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';

      styleRange(ws3, r, 0, r, 0, {
        font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws3, r, 1, r, 1, {
        font: { name: 'Consolas', sz: 9, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws3, r, 2, r, 2, {
        font: { name: 'Khmer OS Siemreap', sz: 9, bold: true, color: { rgb: '0F172A' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws3, r, 3, r, 3, {
        font: { name: 'Khmer OS Siemreap', sz: 9, color: { rgb: '334155' } },
        fill: { fgColor: { rgb: zebraFill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: thinBorder('CBD5E1')
      });
      styleRange(ws3, r, 4, r, 4, {
        font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '05402D' } },
        fill: { fgColor: { rgb: 'ECFDF5' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        numFmt: '#,##0',
        border: thinBorder('CBD5E1')
      });

      unifiedLocations.forEach((loc, cIdx) => {
        const c = 5 + cIdx;
        const val = row.locationQuantities[loc.id] || 0;
        const isCentral = cIdx === 0;
        styleRange(ws3, r, c, r, c, {
          font: {
            name: 'Consolas',
            sz: 9,
            bold: val > 0,
            color: { rgb: val > 0 ? (isCentral ? '05402D' : '0F172A') : 'CBD5E1' }
          },
          fill: {
            fgColor: {
              rgb: val > 0 ? (isCentral ? 'FEF3C7' : 'ECFDF5') : zebraFill
            }
          },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: thinBorder('CBD5E1')
        });
      });
    });

    // Style Matrix Subtotal Row
    styleRange(ws3, subtotalRowIdx3, 0, subtotalRowIdx3, 3, {
      font: { name: 'Khmer OS Siemreap', sz: 9.5, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'E2E8F0' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: subtotalBorder
    });
    styleRange(ws3, subtotalRowIdx3, 4, subtotalRowIdx3, 4, {
      font: { name: 'Khmer OS Siemreap', sz: 10, bold: true, color: { rgb: '05402D' } },
      fill: { fgColor: { rgb: 'FEF3C7' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    unifiedLocations.forEach((loc, cIdx) => {
      const c = 5 + cIdx;
      const colSum = matrixData.columnTotals[loc.id] || 0;
      styleRange(ws3, subtotalRowIdx3, c, subtotalRowIdx3, c, {
        font: {
          name: 'Consolas',
          sz: 9,
          bold: colSum > 0,
          color: { rgb: colSum > 0 ? '05402D' : '94A3B8' }
        },
        fill: { fgColor: { rgb: 'E2E8F0' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: subtotalBorder
      });
    });

    styleSignatureRows(ws3, sigStart3, cols3);

    ws3['!merges'] = merges3;
    ws3['!cols'] = [
      { wch: 5 },   // ល.រ
      { wch: 10 },  // កូដ
      { wch: 30 },  // ឈ្មោះសម្ភារៈ
      { wch: 8 },   // ខ្នាត
      { wch: 10 },  // សរុបរួម
      ...unifiedLocations.map(() => ({ wch: 5.5 }))
    ];
    ws3['!rows'] = [
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 28 },
      { hpt: 24 },
      { hpt: 20 },
      { hpt: 22 },
      { hpt: 10 },
      { hpt: 145 }, // Rotated 90-degree location header row height
      ...matrixData.rows.map(() => ({ hpt: 22 })),
      { hpt: 26 },
      { hpt: 14 },
      { hpt: 19 },
      { hpt: 19 },
      { hpt: 22 },
      { hpt: 38 },
      { hpt: 18 },
      { hpt: 22 }
    ];
    ws3['!pageSetup'] = { paperSize: 9, orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
    XLSX.utils.book_append_sheet(wb, ws3, 'តារាងម៉ាទ្រីសតាមទីតាំង');

    XLSX.writeFile(wb, `GDT_Executive_Stock_Report_${todayStr}.xlsx`);
  };

  const handleExportExcel = exportToExcel;

  // Trigger A4 Landscape Print
  const handlePrintA4 = () => {
    window.print();
  };

  const formattedReportDateKh = new Date().toLocaleDateString('km-KH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const renderStatusBadge = (statusCode: 'sufficient' | 'low_stock' | 'out_of_stock', labelKh: string) => {
    if (statusCode === 'sufficient') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap">
          {labelKh}
        </span>
      );
    }
    if (statusCode === 'low_stock') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 whitespace-nowrap">
          {labelKh}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300 whitespace-nowrap">
        {labelKh}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ================================================================= */}
      {/* TOP CONTROL BAR & FILTERS (HIDDEN ON PRINT: print:hidden)         */}
      {/* ================================================================= */}
      <div className="no-print print:hidden bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#05402D] text-[#D4AF37] flex items-center justify-center shadow-sm shrink-0 border border-[#D4AF37]/40">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {language === 'kh'
                    ? 'របាយការណ៍សង្ខេបស្តុក (Executive Consolidated Report)'
                    : 'Executive Consolidated Stock Report (A4 Landscape)'}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-[#05402D] border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Read-Only • Two-Part Official Format
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                បែងចែកជា ២ ផ្នែកដាច់ពីគ្នា៖ ផ្នែកទី១ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់) និងផ្នែកទី២ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ)
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchReportData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#05402D]' : ''}`} />
              <span>ធ្វើបច្ចុប្បន្នភាព</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-all cursor-pointer border border-emerald-600"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300" />
              <span>📥 ទាញយកជា Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintA4}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-[#D4AF37] bg-[#05402D] hover:bg-[#03291E] shadow-sm transition-all cursor-pointer border border-[#D4AF37]/40"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ បោះពុម្ពរបាយការណ៍ A4</span>
            </button>
          </div>
        </div>

        {/* Report Mode Switcher & Filter Controls */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pt-1">
          {/* View Mode Selector */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveReportTab('consolidated_two_part')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'consolidated_two_part'
                  ? 'bg-[#05402D] text-[#D4AF37] shadow-sm'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <LayoutList className="w-4 h-4" />
              <span>របាយការណ៍សង្ខេបស្តុក ២ ផ្នែក (ផ្នែកទី១ & ផ្នែកទី២)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('matrix_34')}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'matrix_34'
                  ? 'bg-[#05402D] text-[#D4AF37] shadow-sm'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>តារាងម៉ាទ្រីស ៣៤ ទីតាំង (34-Location Matrix)</span>
            </button>
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 max-w-4xl">
            {/* Location Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                ជ្រើសរើសទីតាំងស្តុក (LOCATION)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={reportLocationId}
                  onChange={e => setReportLocationId(e.target.value)}
                  disabled={!isCentralAdmin}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D] disabled:opacity-70"
                >
                  {(availableLocationOptions || []).map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {formatLocationOption(loc, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                ចាប់ពីថ្ងៃទី (START DATE)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                ដល់ថ្ងៃទី (END DATE)
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
                />
              </div>
            </div>

            {/* Search Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                ស្វែងរកសម្ភារ (SEARCH ITEM)
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="កូដ T-001, S-001 ឬឈ្មោះ..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* OFFICIAL A4 LANDSCAPE PRINTABLE PAPER CONTAINER                   */}
      {/* ================================================================= */}
      <div className="print-container print-report-sheet bg-white rounded-2xl border border-slate-300 shadow-lg p-6 sm:p-8 lg:p-10 max-w-[1440px] mx-auto text-slate-900">
        
        {/* ----------------------------------------------------------------- */}
        {/* ១. ក្បាលទំព័រផ្លូវការ (OFFICIAL ROYAL GOVERNMENT HEADER)          */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b-2 border-[#05402D]">
          {/* Left Side: Ministry & General Department */}
          <div className="text-left space-y-0.5 w-[260px] -ml-[17px]">
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
              ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ
            </p>
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
              អគ្គនាយកដ្ឋានពន្ធដារ
            </p>
            <p className="font-siemreap text-xs font-bold text-slate-800 text-center">
              នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន
            </p>
            <p className="text-[11px] text-slate-600 font-medium text-center">
              លេខ៖ ........................... អពដ/នបព
            </p>
          </div>

          {/* Right Side: Kingdom of Cambodia Motto */}
          <div className="space-y-0.5 h-[84px] w-[300px] pl-[10px] pt-0 text-center leading-[25px] ml-[310px]">
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <div className="text-[#D4AF37] font-bold tracking-[0.25em] text-xs select-none text-center">
              ✦ ✦ ✦
            </div>
          </div>
        </div>

        {/* Report Title Centerpiece */}
        <div className="text-center py-3 space-y-1">
          <h1 className="font-moul text-sm sm:text-base lg:text-lg text-[#05402D] leading-snug">
            របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់
          </h1>
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
            EXECUTIVE CONSOLIDATED STOCK BALANCE REPORT (TWO-PART OFFICIAL FORMAT)
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs font-semibold text-slate-700 pt-0.5">
            <span>
              ទីតាំងស្តុក៖{' '}
              <strong className="text-[#05402D]">
                {reportLocationId === 'ALL' || !activeSelectedLocationObj
                  ? 'គ្រប់ទីតាំងស្តុកទាំងអស់ (ឃ្លាំងកណ្តាល HQ-ITSB និង ៣៣ សាខាពន្ធដារ)'
                  : formatLocationOption(activeSelectedLocationObj, 'kh')}
              </strong>
            </span>
            <span>•</span>
            <span>
              កាលបរិច្ឆេទរបាយការណ៍៖{' '}
              <strong className="text-[#05402D]">
                {startDate || endDate
                  ? `ចាប់ពី ${startDate || '...'} ដល់ ${endDate || '...'}`
                  : `គិតត្រឹមថ្ងៃទី ${formattedReportDateKh}`}
              </strong>
            </span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TWO-PART CONSOLIDATED REPORT TABLES (ផ្នែកទី១ & ផ្នែកទី២)         */}
        {/* ================================================================= */}
        {activeReportTab === 'consolidated_two_part' && (
          <div className="space-y-7 mt-2">
            {/* ------------------------------------------------------------- */}
            {/* ផ្នែកទី ១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់) - 11 COLS */}
            {/* ------------------------------------------------------------- */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 bg-[#05402D]/5 border-l-4 border-[#05402D] px-3.5 py-2 rounded-r-xl">
                <div className="flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-[#05402D] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-moul text-xs sm:text-sm text-[#05402D]">
                      ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (Tools)»
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      <strong>និយមន័យ៖</strong> ជាឧបករណ៍/សម្ភារដែលមានតម្លៃគង់វង្ស ពេលដកចេញគឺមិនអស់រូបរាងឡើយ គឺស្ថិតក្នុងស្ថានភាពកំពុងប្រើប្រាស់ជាក់ស្តែងក្នុងដៃមន្ត្រី ឬសាខា។
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#05402D] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
                  សរុប {nonConsumableRows.length} មុខឧបករណ៍
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-400 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#05402D] text-white text-[10px] sm:text-[11px] font-bold">
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-9">ល.រ</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-16">កូដ</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[180px] text-center">ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-14">ឯកតា</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-24 bg-[#03291E]">
                        សរុបរួម (A=B+C)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-28">
                        កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-24">
                        ខូច / បាត់បង់ / កែតម្រូវ (C)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-28 bg-emerald-950 text-[#D4AF37]">
                        ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
                        <div className="text-[9px] font-normal text-emerald-200">(D = A - B - C)</div>
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[175px] text-center">
                        សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[180px] text-center">
                        គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-28">
                        ស្ថានភាពស្តុក
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-300">
                    {nonConsumableRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-6 text-center text-slate-500">
                          មិនមានទិន្នន័យសម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់) ទេ
                        </td>
                      </tr>
                    ) : (
                      nonConsumableRows.map((row, idx) => (
                        <tr
                          key={row.itemCode}
                          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} hover:bg-emerald-50/40`}
                        >
                          <td className="py-2 px-2 border border-slate-300 text-center font-semibold text-slate-700">
                            {row.no}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center font-mono font-bold text-[#05402D]">
                            {row.itemCode}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300">
                            <div className="font-bold text-slate-900">{row.nameKh}</div>
                            <div className="text-[10px] text-slate-500">{row.nameEn}</div>
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center font-medium text-slate-700">
                            {row.unitKh}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-extrabold text-slate-900 bg-slate-100/80">
                            {row.totalInboundA.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-bold text-blue-700">
                            {row.inUseB.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-semibold text-rose-700">
                            {row.damagedAdjustedC > 0 ? row.damagedAdjustedC.toLocaleString() : '0'}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-extrabold text-[#05402D] bg-emerald-50/60">
                            {row.warehouseAvailD.toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300 text-slate-800 font-medium leading-snug">
                            {row.assignedHolders}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300 text-slate-700 leading-snug">
                            {row.purposeAndDate}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center">
                            {renderStatusBadge(row.statusCode, row.statusLabelKh)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200/90 font-extrabold text-[11px] text-slate-900 border-t-2 border-[#05402D]">
                      <td colSpan={4} className="py-2.5 px-3 border border-slate-400 text-right text-[#05402D]">
                        សរុបរួមផ្នែកទី ១ (SUBTOTAL - សម្ភារឧបករណ៍បច្ចេកទេសប្រើប្រាស់មិនអស់)៖
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-slate-900 bg-slate-300/70">
                        {part1Totals.totalInboundA.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-blue-800">
                        {part1Totals.inUseB.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-rose-800">
                        {part1Totals.damagedAdjustedC.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-[#05402D] bg-emerald-100/90">
                        {part1Totals.warehouseAvailD.toLocaleString()}
                      </td>
                      <td colSpan={3} className="py-2.5 px-3 border border-slate-400 text-left text-[10px] font-semibold text-slate-700">
                        តុល្យភាពស្តុកឧបករណ៍បច្ចេកទេស៖ D ({part1Totals.warehouseAvailD.toLocaleString()}) = A ({part1Totals.totalInboundA.toLocaleString()}) - B ({part1Totals.inUseB.toLocaleString()}) - C ({part1Totals.damagedAdjustedC.toLocaleString()})
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* ផ្នែកទី ២៖ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ) - 10 COLS */}
            {/* ------------------------------------------------------------- */}
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 bg-amber-500/10 border-l-4 border-[#D4AF37] px-3.5 py-2 rounded-r-xl">
                <div className="flex items-start gap-2.5">
                  <PackageCheck className="w-4 h-4 text-[#05402D] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-moul text-xs sm:text-sm text-[#05402D]">
                      ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារប្រើប្រាស់ (Suppliers)»
                    </h3>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      <strong>និយមន័យ៖</strong> ជាសម្ភារបរិក្ខារដែលពេលដកចេញ គឺបានបើកផ្តល់ និងប្រើប្រាស់អស់ទៅតាមការងារជាក់ស្តែង គ្មានការយកត្រឡប់ចូលឃ្លាំងវិញទេ។
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-[#05402D] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
                  សរុប {consumableRows.length} មុខសម្ភារ
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-400 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#05402D] text-white text-[10px] sm:text-[11px] font-bold">
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-9">ល.រ</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-16">កូដ</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[190px]">ឈ្មោះសម្ភារប្រើប្រាស់អស់ទៅ</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-14">ឯកតា</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-28 bg-[#03291E]">
                        សរុបរួមនាំចូល (A)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-32">
                        បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-32 bg-emerald-950 text-[#D4AF37]">
                        ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[185px]">
                        សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[185px]">
                        គោលបំណង និងកាលបរិច្ឆេទបើកបែក
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-28">
                        ស្ថានភាពស្តុក
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-slate-300">
                    {consumableRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-slate-500">
                          មិនមានទិន្នន័យសម្ភារប្រើប្រាស់អស់ទៅ ទេ
                        </td>
                      </tr>
                    ) : (
                      consumableRows.map((row, idx) => (
                        <tr
                          key={row.itemCode}
                          className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} hover:bg-emerald-50/40`}
                        >
                          <td className="py-2 px-2 border border-slate-300 text-center font-semibold text-slate-700">
                            {row.no}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center font-mono font-bold text-[#05402D]">
                            {row.itemCode}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300">
                            <div className="font-bold text-slate-900">{row.nameKh}</div>
                            <div className="text-[10px] text-slate-500">{row.nameEn}</div>
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center font-medium text-slate-700">
                            {row.unitKh}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-extrabold text-slate-900 bg-slate-100/80">
                            {row.totalInboundA.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-bold text-amber-700">
                            {row.totalIssuedB.toLocaleString()}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-right font-extrabold text-[#05402D] bg-emerald-50/60">
                            {row.remainingStockC.toLocaleString()}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300 text-slate-800 font-medium leading-snug">
                            {row.issuedRecipients}
                          </td>
                          <td className="py-2 px-2.5 border border-slate-300 text-slate-700 leading-snug">
                            {row.purposeAndDate}
                          </td>
                          <td className="py-2 px-2 border border-slate-300 text-center">
                            {renderStatusBadge(row.statusCode, row.statusLabelKh)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200/90 font-extrabold text-[11px] text-slate-900 border-t-2 border-[#05402D]">
                      <td colSpan={4} className="py-2.5 px-3 border border-slate-400 text-right text-[#05402D]">
                        សរុបរួមផ្នែកទី ២ (SUBTOTAL - សម្ភារប្រើប្រាស់អស់ទៅ)៖
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-slate-900 bg-slate-300/70">
                        {part2Totals.totalInboundA.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-amber-800">
                        {part2Totals.totalIssuedB.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 border border-slate-400 text-right text-[#05402D] bg-emerald-100/90">
                        {part2Totals.remainingStockC.toLocaleString()}
                      </td>
                      <td colSpan={3} className="py-2.5 px-3 border border-slate-400 text-left text-[10px] font-semibold text-slate-700">
                        តុល្យភាពស្តុកសម្ភារប្រើប្រាស់អស់ទៅ៖ C ({part2Totals.remainingStockC.toLocaleString()}) = A ({part2Totals.totalInboundA.toLocaleString()}) - B ({part2Totals.totalIssuedB.toLocaleString()})
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CROSS-TAB 34-LOCATION STOCK DISTRIBUTION MATRIX VIEW              */}
        {/* ================================================================= */}
        {activeReportTab === 'matrix_34' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-[#05402D] text-[#D4AF37] font-bold text-xs flex items-center justify-center">
                  ម
                </span>
                <div>
                  <h3 className="font-moul text-xs sm:text-sm text-[#05402D]">
                    តារាងម៉ាទ្រីសបែងចែកស្តុកតាមបណ្តាទីតាំងទាំងអស់ (Cross-Tab Stock Distribution Matrix)
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    បង្ហាញបរិមាណសម្ភារនីមួយៗតាមជួរឈរទីតាំងស្តុកទាំង {unifiedLocations.length} (ថ្នាក់កណ្តាល → សាខាខណ្ឌ → សាខាខេត្ត)
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-400 rounded-lg">
              <table className="w-full text-left border-collapse matrix-table">
                <thead>
                  <tr className="bg-[#05402D] text-white font-bold">
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[11px] min-w-[32px] w-8 align-middle">
                      ល.រ
                    </th>
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[11px] min-w-[56px] w-14 align-middle">
                      កូដ
                    </th>
                    <th className="py-2 px-2.5 border border-slate-400 text-left text-[11px] min-w-[175px] align-middle">
                      ឈ្មោះសម្ភារៈ
                    </th>
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[11px] min-w-[46px] w-12 align-middle">
                      ខ្នាត
                    </th>
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[11px] min-w-[58px] w-15 align-middle bg-[#03291E] text-[#D4AF37]">
                      សរុបរួម
                    </th>
                    {unifiedLocations.map((loc, idx) => {
                      const shortName = getShortLocationHeader(loc);
                      const isCentral = idx === 0;
                      const isTechHq =
                        idx === 1 &&
                        (String(loc.code || '').toUpperCase() === 'TECH-HQ' || String(loc.id) === '35');
                      return (
                        <th
                          key={loc.id}
                          title={formatLocationOption(loc, 'kh')}
                          className={`border border-slate-400 p-0 align-middle min-w-[34px] w-[34px] h-[175px] ${
                            isCentral
                              ? 'bg-emerald-950 text-[#D4AF37]'
                              : isTechHq
                                ? 'bg-[#03291E] text-amber-200'
                                : 'bg-[#05402D] text-white'
                          }`}
                        >
                          <div className="w-full h-[175px] flex items-center justify-center">
                            <div className="matrix-header-cell">
                              {shortName}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-[11px] divide-y divide-slate-300">
                  {matrixData.rows.map((row, rIdx) => (
                    <tr
                      key={row.itemCode}
                      className={`${rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} hover:bg-emerald-50/50`}
                    >
                      <td className="py-1.5 px-1 border border-slate-300 text-center font-semibold text-slate-700">
                        {row.no}
                      </td>
                      <td className="py-1.5 px-1 border border-slate-300 text-center font-mono font-bold text-[#05402D]">
                        {row.itemCode}
                      </td>
                      <td className="py-1.5 px-2 border border-slate-300 font-bold text-slate-900 min-w-[175px]" title={`${row.nameKh} (${row.nameEn})`}>
                        {row.nameKh}
                      </td>
                      <td className="py-1.5 px-1 border border-slate-300 text-center text-slate-700">
                        {row.unitKh}
                      </td>
                      <td className="py-1.5 px-1.5 border border-slate-300 text-center font-extrabold text-[#05402D] bg-emerald-50/80">
                        {row.totalQty.toLocaleString()}
                      </td>
                      {unifiedLocations.map((loc, cIdx) => {
                        const val = row.locationQuantities[loc.id] || 0;
                        const isCentral = cIdx === 0;
                        return (
                          <td
                            key={loc.id}
                            title={`${row.nameKh} @ ${loc.name_kh}: ${val}`}
                            className={`py-1.5 px-1 border border-slate-300 text-center font-mono min-w-[34px] ${
                              val > 0
                                ? isCentral
                                  ? 'font-extrabold text-[#05402D] bg-amber-50/50'
                                  : 'font-bold text-slate-900 bg-emerald-50/30'
                                : 'text-slate-300 font-normal'
                            }`}
                          >
                            {val > 0 ? val : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-200 font-extrabold text-[11px] text-slate-900 border-t-2 border-[#05402D]">
                    <td colSpan={4} className="py-2 px-2.5 border border-slate-400 text-right text-[#05402D]">
                      សរុបតាមទីតាំងនីមួយៗ (COLUMN TOTALS)៖
                    </td>
                    <td className="py-2 px-1.5 border border-slate-400 text-center text-[#05402D] bg-amber-100/80">
                      {matrixData.grandTotal.toLocaleString()}
                    </td>
                    {unifiedLocations.map(loc => {
                      const colSum = matrixData.columnTotals[loc.id] || 0;
                      return (
                        <td
                          key={loc.id}
                          className="py-2 px-1 border border-slate-400 text-center font-mono text-[10px] text-[#05402D] min-w-[34px]"
                        >
                          {colSum > 0 ? colSum : '-'}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* ៥. ផ្នែកចុះហត្ថលេខាផ្លូវការ (OFFICIAL 3-COLUMN SIGNATURE BLOCK)  */}
        {/* ----------------------------------------------------------------- */}
        <div className="pt-6 mt-5 border-t border-slate-300 break-inside-avoid">
          <div className="grid grid-cols-3 gap-6 text-center text-xs">
            {/* Left Signature: អ្នករៀបចំរបាយការណ៍ (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក) */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  អ្នករៀបចំរបាយការណ៍ (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក)
                </p>
              </div>
              <div className="pt-2">
                <div className="w-44 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="font-bold text-slate-800 text-[11px]">
                  មន្ត្រីគ្រប់គ្រងស្តុក
                </p>
              </div>
            </div>

            {/* Center Signature: បានពិនិត្យ និងឯកភាព (ប្រធានការិយាល័យ) */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  បានពិនិត្យ និងឯកភាព (ប្រធានការិយាល័យ)
                </p>
              </div>
              <div className="pt-2">
                <div className="w-44 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="font-bold text-slate-800 text-[11px]">
                  ប្រធានការិយាល័យទទួលបន្ទុក
                </p>
              </div>
            </div>

            {/* Right Signature: បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន) */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន)
                </p>
              </div>
              <div className="pt-2">
                <div className="w-44 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="font-bold text-slate-800 text-[11px]">
                  ប្រធាននាយកដ្ឋាន
                </p>
              </div>
            </div>
          </div>

          {/* System Footer Timestamp */}
          <div className="mt-4 pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400">
            <span>
              ប្រព័ន្ធគ្រប់គ្រងសារពើភណ្ឌសម្ភារបច្ចេកទេស អគ្គនាយកដ្ឋានពន្ធដារ (GDT Inventory Management System)
            </span>
            <span>
              ទាញទិន្នន័យចុងក្រោយ៖ {lastRefreshed.toLocaleTimeString('km-KH')} ({formattedReportDateKh})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
