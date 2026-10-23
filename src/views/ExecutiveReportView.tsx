import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Item, InventoryItem, Location } from '../types';
import ExcelJS from 'exceljs';
import gdtLogo from '../gdtlogo.png';
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
  // EXPORT TO EXCEL (.xlsx) — EXCELJS WITH EMBEDDED GDT LOGO & EXACT PREVIEW LAYOUT
  // ===========================================================================
  const exportToExcel = async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const formattedKhDate = new Date().toLocaleDateString('km-KH', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const dateRangeLabel =
      startDate || endDate
        ? `ចាប់ពីថ្ងៃទី ${startDate || '...'} ដល់ថ្ងៃទី ${endDate || '...'}`
        : `គិតត្រឹមថ្ងៃទី ${formattedKhDate}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'GDT Inventory Management System';
    workbook.created = new Date();

    // Fetch /gdtlogo.png, normalize to a true 1:1 square PNG so the circular seal is never oval/stretched, and register in Workbook
    let logoImageId: number | null = null;
    try {
      const fetchLogoBuffer = async (): Promise<ArrayBuffer | null> => {
        const candidateUrls = [gdtLogo, '/gdtlogo.png'].filter(Boolean);
        for (const url of candidateUrls) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              return await res.arrayBuffer();
            }
          } catch {
            // Try next candidate URL
          }
        }
        return null;
      };

      const arrayBuffer = await fetchLogoBuffer();
      if (arrayBuffer && arrayBuffer.byteLength > 0) {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        let base64Logo = window.btoa(binary);

        // Normalize rectangular source PNG (e.g. 282x220 with horizontal padding) into a true 1:1 square PNG
        try {
          const dataUrl = `data:image/png;base64,${base64Logo}`;
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const imageEl = new Image();
            imageEl.onload = () => resolve(imageEl);
            imageEl.onerror = reject;
            imageEl.src = dataUrl;
          });
          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            const size = Math.min(img.naturalWidth, img.naturalHeight);
            const sx = (img.naturalWidth - size) / 2;
            const sy = (img.naturalHeight - size) / 2;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, size, size);
              ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
              base64Logo = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
            }
          }
        } catch {
          // Fallback to raw base64Logo if canvas fails
        }

        logoImageId = workbook.addImage({
          base64: base64Logo,
          extension: 'png'
        });
      }
    } catch (err) {
      console.warn('Could not embed GDT logo into Excel workbook:', err);
    }

    const thinBorder = (argb = 'FFCBD5E1'): Partial<ExcelJS.Borders> => ({
      top: { style: 'thin', color: { argb } },
      bottom: { style: 'thin', color: { argb } },
      left: { style: 'thin', color: { argb } },
      right: { style: 'thin', color: { argb } }
    });

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'medium', color: { argb: 'FF0B3D2E' } },
      bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
      left: { style: 'thin', color: { argb: 'FF475569' } },
      right: { style: 'thin', color: { argb: 'FF475569' } }
    };

    const subtotalBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'medium', color: { argb: 'FF0B3D2E' } },
      bottom: { style: 'double', color: { argb: 'FF0B3D2E' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };

    const styleRowRange = (
      ws: ExcelJS.Worksheet,
      rowNumber: number,
      startCol: number,
      endCol: number,
      opts: {
        font?: Partial<ExcelJS.Font>;
        fillArgb?: string;
        alignment?: Partial<ExcelJS.Alignment>;
        border?: Partial<ExcelJS.Borders>;
        numFmt?: string;
      }
    ) => {
      const row = ws.getRow(rowNumber);
      for (let c = startCol; c <= endCol; c++) {
        const cell = row.getCell(c);
        if (opts.font) cell.font = opts.font;
        if (opts.fillArgb) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: opts.fillArgb }
          };
        }
        if (opts.alignment) cell.alignment = opts.alignment;
        if (opts.border) cell.border = opts.border;
        if (opts.numFmt) cell.numFmt = opts.numFmt;
      }
    };

    // Helper: Build Rows 1..8 matching Preview Report 100%
    const buildOfficialHeaderRows = (
      ws: ExcelJS.Worksheet,
      totalCols: number,
      sectionTitleKh: string,
      totalItemsBadgeKh: string,
      definitionKh: string,
      logoColZeroIndexed: number
    ) => {
      const leftEndCol = 3; // Columns A-C (1..3)
      const rightStartCol = totalCols >= 11 ? 9 : totalCols === 10 ? 8 : Math.max(5, totalCols - 5); // Columns I-K on Sheet 1 (9..11)

      // 1) Fill ALL cells in Rows 1..6 (Col 1..totalCols) with pure solid white (FFFFFFFF) and no grid borders
      for (let r = 1; r <= 6; r++) {
        for (let c = 1; c <= totalCols; c++) {
          const cell = ws.getCell(r, c);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          };
          cell.border = {};
        }
      }

      // Row 1..4 Values
      ws.getCell(1, 1).value = 'ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ';
      ws.getCell(1, rightStartCol).value = 'ព្រះរាជាណាចក្រកម្ពុជា';

      ws.getCell(2, 1).value = 'អគ្គនាយកដ្ឋានពន្ធដារ';
      ws.getCell(2, rightStartCol).value = 'ជាតិ សាសនា ព្រះមហាក្សត្រ';

      ws.getCell(3, 1).value = 'នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន';
      ws.getCell(3, rightStartCol).value = '✦  ✦  ✦';

      ws.getCell(4, 1).value = 'លេខ៖ ........................... អពដ/នបព';

      // Merge Left (Cols A-C, Rows 1-4) and Right (Cols I-K / H-J, Rows 1-4)
      for (let r = 1; r <= 4; r++) {
        ws.mergeCells(r, 1, r, leftEndCol);
        ws.mergeCells(r, rightStartCol, r, totalCols);
      }

      // Style Left Official Block (Rows 1-4)
      for (let r = 1; r <= 2; r++) {
        styleRowRange(ws, r, 1, leftEndCol, {
          font: { name: 'Khmer OS Muol Light', size: 11, bold: true, color: { argb: 'FF05402D' } },
          fillArgb: 'FFFFFFFF',
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
      }
      styleRowRange(ws, 3, 1, leftEndCol, {
        font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF1E293B' } },
        fillArgb: 'FFFFFFFF',
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
      styleRowRange(ws, 4, 1, leftEndCol, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, color: { argb: 'FF475569' } },
        fillArgb: 'FFFFFFFF',
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      // Style Right Motto Block (Rows 1-3)
      for (let r = 1; r <= 2; r++) {
        styleRowRange(ws, r, rightStartCol, totalCols, {
          font: { name: 'Khmer OS Muol Light', size: 11, bold: true, color: { argb: 'FF05402D' } },
          fillArgb: 'FFFFFFFF',
          alignment: { horizontal: 'center', vertical: 'middle' }
        });
      }
      styleRowRange(ws, 3, rightStartCol, totalCols, {
        font: { name: 'Khmer OS Siemreap', size: 11, bold: true, color: { argb: 'FFD4AF37' } },
        fillArgb: 'FFFFFFFF',
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      // Dark Green Divider Border below Row 4 across all columns (Column A to K)
      for (let c = 1; c <= totalCols; c++) {
        ws.getCell(4, c).border = {
          bottom: { style: 'medium', color: { argb: 'FF0B3D2E' } }
        };
      }

      // Set Row Heights for Rows 1..8
      ws.getRow(1).height = 22;
      ws.getRow(2).height = 20;
      ws.getRow(3).height = 20;
      ws.getRow(4).height = 28;

      // Embed GDT Logo in True Visual Center with 1:1 Fixed Aspect Ratio (editAs: 'oneCell')
      if (logoImageId !== null) {
        ws.addImage(logoImageId, {
          tl: { col: logoColZeroIndexed, row: 0.15 } as any,
          ext: { width: 82, height: 82 },
          editAs: 'oneCell'
        });
      }

      // Row 5: Main Report Title (Centered)
      ws.getCell(5, 1).value = 'របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់';
      ws.mergeCells(5, 1, 5, totalCols);
      ws.getRow(5).height = 32;
      styleRowRange(ws, 5, 1, totalCols, {
        font: { name: 'Khmer OS Muol Light', size: 12.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFFFFFFF',
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      // Row 6: Report Date (Centered, directly above Section Title)
      ws.getCell(6, 1).value = `កាលបរិច្ឆេទរបាយការណ៍៖ ${dateRangeLabel}`;
      ws.mergeCells(6, 1, 6, totalCols);
      ws.getRow(6).height = 22;
      styleRowRange(ws, 6, 1, totalCols, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFFFFFFF',
        alignment: { horizontal: 'center', vertical: 'middle' }
      });

      // Row 7: Section Title (Left) + Item Count Badge (Right) with Soft Green/Gray Fill & Thick Left Green Bar
      const badgeStartCol = Math.max(2, totalCols - 1);
      ws.getCell(7, 1).value = sectionTitleKh;
      ws.mergeCells(7, 1, 7, badgeStartCol - 1);

      ws.getCell(7, badgeStartCol).value = totalItemsBadgeKh;
      ws.mergeCells(7, badgeStartCol, 7, totalCols);
      ws.getRow(7).height = 26;

      styleRowRange(ws, 7, 1, badgeStartCol - 1, {
        font: { name: 'Khmer OS Muol Light', size: 10.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFECFDF5',
        alignment: { horizontal: 'left', vertical: 'middle', indent: 1 },
        border: {
          top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          bottom: { style: 'hair', color: { argb: 'FFA7F3D0' } }
        }
      });
      styleRowRange(ws, 7, badgeStartCol, totalCols, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFECFDF5',
        alignment: { horizontal: 'right', vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          bottom: { style: 'hair', color: { argb: 'FFA7F3D0' } },
          right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
        }
      });
      ws.getCell(7, 1).border = {
        top: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        bottom: { style: 'hair', color: { argb: 'FFA7F3D0' } },
        left: { style: 'thick', color: { argb: 'FF05402D' } }
      };

      // Row 8: Definition Row (with matching Left Green Accent Bar)
      ws.getCell(8, 1).value = definitionKh;
      ws.mergeCells(8, 1, 8, totalCols);
      ws.getRow(8).height = 24;
      styleRowRange(ws, 8, 1, totalCols, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, italic: true, color: { argb: 'FF334155' } },
        fillArgb: 'FFF8FAFC',
        alignment: { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true },
        border: {
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        }
      });
      ws.getCell(8, 1).border = {
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thick', color: { argb: 'FF05402D' } }
      };
    };

    // Helper: Append & Style 3-Column Official Signature Block at Bottom of Worksheet
    const appendOfficialSignatureBlock = (ws: ExcelJS.Worksheet, startRow: number, totalCols: number) => {
      // Blank spacer row before signatures
      ws.getRow(startRow).height = 14;
      styleRowRange(ws, startRow, 1, totalCols, { fillArgb: 'FFFFFFFF' });

      const sigRow1 = startRow + 1;
      let g1End: number;
      let g2Start: number;
      let g2End: number;
      let g3Start: number;

      if (totalCols === 11) {
        g1End = 4;
        g2Start = 5;
        g2End = 8;
        g3Start = 9;
      } else if (totalCols === 10) {
        g1End = 4;
        g2Start = 5;
        g2End = 7;
        g3Start = 8;
      } else {
        g1End = Math.max(4, Math.floor(totalCols / 3));
        g2Start = g1End + 1;
        g2End = Math.max(g2Start + 2, Math.floor((totalCols * 2) / 3));
        g3Start = g2End + 1;
      }

      const sigLines: [string, string, string][] = [
        [
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩',
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩',
          'ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩'
        ],
        [
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦',
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦',
          'រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦'
        ],
        [
          'អ្នករៀបចំរបាយការណ៍ (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក)',
          'បានពិនិត្យ និងឯកភាព (ប្រធានការិយាល័យ)',
          'បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន)'
        ],
        ['', '', ''],
        [
          '...................................................',
          '...................................................',
          '...................................................'
        ],
        [
          'មន្ត្រីគ្រប់គ្រងស្តុក',
          'ប្រធានការិយាល័យទទួលបន្ទុក',
          'ប្រធាននាយកដ្ឋាន'
        ]
      ];

      const rowHeights = [19, 19, 22, 38, 18, 22];

      sigLines.forEach(([leftTxt, midTxt, rightTxt], idx) => {
        const r = sigRow1 + idx;
        ws.getRow(r).height = rowHeights[idx];
        ws.getCell(r, 1).value = leftTxt;
        ws.getCell(r, g2Start).value = midTxt;
        ws.getCell(r, g3Start).value = rightTxt;

        ws.mergeCells(r, 1, r, g1End);
        ws.mergeCells(r, g2Start, r, g2End);
        ws.mergeCells(r, g3Start, r, totalCols);

        if (idx === 0 || idx === 1) {
          styleRowRange(ws, r, 1, totalCols, {
            font: { name: 'Khmer OS Siemreap', size: 9.5, color: { argb: 'FF334155' } },
            fillArgb: 'FFFFFFFF',
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
        } else if (idx === 2) {
          styleRowRange(ws, r, 1, totalCols, {
            font: { name: 'Khmer OS Muol Light', size: 10, bold: true, color: { argb: 'FF05402D' } },
            fillArgb: 'FFFFFFFF',
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
        } else if (idx === 3) {
          styleRowRange(ws, r, 1, totalCols, {
            fillArgb: 'FFFFFFFF'
          });
        } else if (idx === 4) {
          styleRowRange(ws, r, 1, totalCols, {
            font: { name: 'Khmer OS Siemreap', size: 9.5, color: { argb: 'FF94A3B8' } },
            fillArgb: 'FFFFFFFF',
            alignment: { horizontal: 'center', vertical: 'bottom' }
          });
        } else if (idx === 5) {
          styleRowRange(ws, r, 1, totalCols, {
            font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } },
            fillArgb: 'FFFFFFFF',
            alignment: { horizontal: 'center', vertical: 'middle' }
          });
        }
      });
    };

    // =========================================================================
    // SHEET 1: "ឧបករណ៍បច្ចេកទេស-មិនអស់" (11 Columns — Part 1: Tools)
    // =========================================================================
    const cols1 = 11;
    const ws1 = workbook.addWorksheet('ឧបករណ៍បច្ចេកទេស-មិនអស់', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    ws1.columns = [
      { width: 6 },   // Col A: ល.រ
      { width: 11 },  // Col B: កូដ
      { width: 36 },  // Col C: ឈ្មោះឧបករណ៍
      { width: 10 },  // Col D: ឯកតា
      { width: 19 },  // Col E: សរុបរួម (A = B + C + D) — widened to >= 18 so (A = B + C + D) never truncates
      { width: 20 },  // Col F: កំពុងប្រើប្រាស់ B
      { width: 17 },  // Col G: ខូច/កែតម្រូវ C
      { width: 20 },  // Col H: ស្តុកនៅសល់ក្នុងឃ្លាំង D
      { width: 36 },  // Col I: សាខា ឬមន្ត្រីទទួលកាន់កាប់
      { width: 38 },  // Col J: គោលបំណង និងកាលបរិច្ឆេទ
      { width: 18 }   // Col K: ស្ថានភាពស្តុក
    ];

    buildOfficialHeaderRows(
      ws1,
      cols1,
      'ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (Tools)»',
      `សរុប ${nonConsumableRows.length} មុខឧបករណ៍`,
      'និយមន័យ៖ ជាឧបករណ៍/សម្ភារដែលមានតម្លៃគង់វង្ស ពេលដកចេញគឺមិនអស់រូបរាងឡើយ គឺស្ថិតក្នុងស្ថានភាពកំពុងប្រើប្រាស់ជាក់ស្តែងក្នុងដៃមន្ត្រី ឬសាខា។',
      6.6 // Visual center of Sheet 1 between Left (A-C) and Right (I-K)
    );

    // Row 9: Table Headers for Sheet 1
    const headerRow1 = ws1.getRow(9);
    headerRow1.values = [
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
    ];
    headerRow1.height = 38;
    styleRowRange(ws1, 9, 1, cols1, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } },
      fillArgb: 'FF0B3D2E',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    styleRowRange(ws1, 9, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } },
      fillArgb: 'FF03291E',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    styleRowRange(ws1, 9, 8, 8, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFD4AF37' } },
      fillArgb: 'FF022C22',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });

    // Data Rows for Sheet 1 (starting at Row 10)
    const dataStartRow1 = 10;
    nonConsumableRows.forEach((row, idx) => {
      const r = dataStartRow1 + idx;
      const excelRow = ws1.getRow(r);
      excelRow.values = [
        row.no,
        row.itemCode,
        `${row.nameKh}\n(${row.nameEn})`,
        row.unitKh,
        row.totalInboundA,
        row.inUseB,
        row.damagedAdjustedC,
        row.warehouseAvailD,
        row.assignedHolders,
        row.purposeAndDate,
        row.statusLabelKh
      ];
      excelRow.height = 32;

      const zebraFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      // Col 1: No
      styleRowRange(ws1, r, 1, 1, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      // Col 2: Code
      styleRowRange(ws1, r, 2, 2, {
        font: { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      // Col 3: Item Name
      styleRowRange(ws1, r, 3, 3, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF0F172A' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: thinBorder()
      });
      // Col 4: Unit
      styleRowRange(ws1, r, 4, 4, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      // Col 5: Total Inbound A
      styleRowRange(ws1, r, 5, 5, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } },
        fillArgb: 'FFF1F5F9',
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      // Col 6: In-Use B
      styleRowRange(ws1, r, 6, 6, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF1D4ED8' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      // Col 7: Damaged C
      styleRowRange(ws1, r, 7, 7, {
        font: {
          name: 'Khmer OS Siemreap',
          size: 9.5,
          bold: row.damagedAdjustedC > 0,
          color: { argb: row.damagedAdjustedC > 0 ? 'FFBE123C' : 'FF64748B' }
        },
        fillArgb: zebraFill,
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      // Col 8: Warehouse Available D
      styleRowRange(ws1, r, 8, 8, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFECFDF5',
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      // Col 9 & 10: Holders & Purpose
      styleRowRange(ws1, r, 9, 10, {
        font: { name: 'Khmer OS Siemreap', size: 9, color: { argb: 'FF1E293B' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: thinBorder()
      });
      // Col 11: Status Badge
      const statusFill =
        row.statusCode === 'sufficient'
          ? 'FFDCFCE7'
          : row.statusCode === 'low_stock'
            ? 'FFFEF3C7'
            : 'FFFFE4E6';
      const statusColor =
        row.statusCode === 'sufficient'
          ? 'FF166534'
          : row.statusCode === 'low_stock'
            ? 'FF92400E'
            : 'FF9F1239';
      styleRowRange(ws1, r, 11, 11, {
        font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: statusColor } },
        fillArgb: statusFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
    });

    // Subtotal Row for Sheet 1
    const subtotalRow1 = dataStartRow1 + nonConsumableRows.length;
    ws1.getRow(subtotalRow1).height = 28;
    ws1.getCell(subtotalRow1, 1).value = 'សរុបរួមផ្នែកទី ១ (SUBTOTAL - សម្ភារឧបករណ៍បច្ចេកទេសប្រើប្រាស់មិនអស់)៖';
    ws1.getCell(subtotalRow1, 5).value = part1Totals.totalInboundA;
    ws1.getCell(subtotalRow1, 6).value = part1Totals.inUseB;
    ws1.getCell(subtotalRow1, 7).value = part1Totals.damagedAdjustedC;
    ws1.getCell(subtotalRow1, 8).value = part1Totals.warehouseAvailD;
    ws1.getCell(subtotalRow1, 9).value = `តុល្យភាពស្តុកឧបករណ៍បច្ចេកទេស៖ D (${part1Totals.warehouseAvailD.toLocaleString()}) = A (${part1Totals.totalInboundA.toLocaleString()}) - B (${part1Totals.inUseB.toLocaleString()}) - C (${part1Totals.damagedAdjustedC.toLocaleString()})`;

    ws1.mergeCells(subtotalRow1, 1, subtotalRow1, 4);
    ws1.mergeCells(subtotalRow1, 9, subtotalRow1, 11);

    styleRowRange(ws1, subtotalRow1, 1, 4, {
      font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: subtotalBorder
    });
    styleRowRange(ws1, subtotalRow1, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF0F172A' } },
      fillArgb: 'FFCBD5E1',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws1, subtotalRow1, 6, 6, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF1E40AF' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws1, subtotalRow1, 7, 7, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF9F1239' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws1, subtotalRow1, 8, 8, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFD1FAE5',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws1, subtotalRow1, 9, 11, {
      font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF334155' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: subtotalBorder
    });

    appendOfficialSignatureBlock(ws1, subtotalRow1 + 1, cols1);

    // =========================================================================
    // SHEET 2: "សម្ភារប្រើប្រាស់-អស់ទៅ" (10 Columns — Part 2: Suppliers)
    // =========================================================================
    const cols2 = 10;
    const ws2 = workbook.addWorksheet('សម្ភារប្រើប្រាស់-អស់ទៅ', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    ws2.columns = [
      { width: 6 },   // Col A: ល.រ
      { width: 11 },  // Col B: កូដ
      { width: 36 },  // Col C: ឈ្មោះសម្ភារ
      { width: 10 },  // Col D: ឯកតា
      { width: 18 },  // Col E: សរុបរួមនាំចូល A
      { width: 22 },  // Col F: បានបើកផ្តល់ B
      { width: 22 },  // Col G: ស្តុកនៅសល់ក្នុងឃ្លាំង C
      { width: 36 },  // Col H: សាខា ឬអង្គភាពបានបើកយក
      { width: 38 },  // Col I: គោលបំណង និងកាលបរិច្ឆេទ
      { width: 18 }   // Col J: ស្ថានភាពស្តុក
    ];

    buildOfficialHeaderRows(
      ws2,
      cols2,
      'ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារប្រើប្រាស់ (Suppliers)»',
      `សរុប ${consumableRows.length} មុខសម្ភារ`,
      'និយមន័យ៖ ជាសម្ភារបរិក្ខារដែលពេលដកចេញ គឺបានបើកផ្តល់ និងប្រើប្រាស់អស់ទៅតាមការងារជាក់ស្តែង គ្មានការយកត្រឡប់ចូលឃ្លាំងវិញទេ។',
      6.0 // Visual center of Sheet 2 between Left (A-C) and Right (H-J)
    );

    // Row 9: Table Headers for Sheet 2
    const headerRow2 = ws2.getRow(9);
    headerRow2.values = [
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
    ];
    headerRow2.height = 38;
    styleRowRange(ws2, 9, 1, cols2, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } },
      fillArgb: 'FF0B3D2E',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    styleRowRange(ws2, 9, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } },
      fillArgb: 'FF03291E',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    styleRowRange(ws2, 9, 7, 7, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFD4AF37' } },
      fillArgb: 'FF022C22',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });

    // Data Rows for Sheet 2 (starting at Row 10)
    const dataStartRow2 = 10;
    consumableRows.forEach((row, idx) => {
      const r = dataStartRow2 + idx;
      const excelRow = ws2.getRow(r);
      excelRow.values = [
        row.no,
        row.itemCode,
        `${row.nameKh}\n(${row.nameEn})`,
        row.unitKh,
        row.totalInboundA,
        row.totalIssuedB,
        row.remainingStockC,
        row.issuedRecipients,
        row.purposeAndDate,
        row.statusLabelKh
      ];
      excelRow.height = 32;

      const zebraFill = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      styleRowRange(ws2, r, 1, 1, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws2, r, 2, 2, {
        font: { name: 'Consolas', size: 9.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws2, r, 3, 3, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF0F172A' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: thinBorder()
      });
      styleRowRange(ws2, r, 4, 4, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws2, r, 5, 5, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF0F172A' } },
        fillArgb: 'FFF1F5F9',
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      styleRowRange(ws2, r, 6, 6, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FFB45309' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      styleRowRange(ws2, r, 7, 7, {
        font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFECFDF5',
        alignment: { horizontal: 'right', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });
      styleRowRange(ws2, r, 8, 9, {
        font: { name: 'Khmer OS Siemreap', size: 9, color: { argb: 'FF1E293B' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: thinBorder()
      });

      const statusFill =
        row.statusCode === 'sufficient'
          ? 'FFDCFCE7'
          : row.statusCode === 'low_stock'
            ? 'FFFEF3C7'
            : 'FFFFE4E6';
      const statusColor =
        row.statusCode === 'sufficient'
          ? 'FF166534'
          : row.statusCode === 'low_stock'
            ? 'FF92400E'
            : 'FF9F1239';
      styleRowRange(ws2, r, 10, 10, {
        font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: statusColor } },
        fillArgb: statusFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
    });

    // Subtotal Row for Sheet 2
    const subtotalRow2 = dataStartRow2 + consumableRows.length;
    ws2.getRow(subtotalRow2).height = 28;
    ws2.getCell(subtotalRow2, 1).value = 'សរុបរួមផ្នែកទី ២ (SUBTOTAL - សម្ភារប្រើប្រាស់អស់ទៅ)៖';
    ws2.getCell(subtotalRow2, 5).value = part2Totals.totalInboundA;
    ws2.getCell(subtotalRow2, 6).value = part2Totals.totalIssuedB;
    ws2.getCell(subtotalRow2, 7).value = part2Totals.remainingStockC;
    ws2.getCell(subtotalRow2, 8).value = `តុល្យភាពស្តុកសម្ភារប្រើប្រាស់អស់ទៅ៖ C (${part2Totals.remainingStockC.toLocaleString()}) = A (${part2Totals.totalInboundA.toLocaleString()}) - B (${part2Totals.totalIssuedB.toLocaleString()})`;

    ws2.mergeCells(subtotalRow2, 1, subtotalRow2, 4);
    ws2.mergeCells(subtotalRow2, 8, subtotalRow2, 10);

    styleRowRange(ws2, subtotalRow2, 1, 4, {
      font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: subtotalBorder
    });
    styleRowRange(ws2, subtotalRow2, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF0F172A' } },
      fillArgb: 'FFCBD5E1',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws2, subtotalRow2, 6, 6, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF92400E' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws2, subtotalRow2, 7, 7, {
      font: { name: 'Khmer OS Siemreap', size: 10.5, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFD1FAE5',
      alignment: { horizontal: 'right', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    styleRowRange(ws2, subtotalRow2, 8, 10, {
      font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF334155' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: subtotalBorder
    });

    appendOfficialSignatureBlock(ws2, subtotalRow2 + 1, cols2);

    // =========================================================================
    // SHEET 3: "តារាងម៉ាទ្រីសតាមទីតាំង" (Cross-Tab Stock Distribution Matrix)
    // =========================================================================
    const cols3 = 5 + unifiedLocations.length;
    const ws3 = workbook.addWorksheet('តារាងម៉ាទ្រីសតាមទីតាំង', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    });

    ws3.columns = [
      { width: 5 },   // ល.រ
      { width: 10 },  // កូដ
      { width: 30 },  // ឈ្មោះសម្ភារៈ
      { width: 8 },   // ខ្នាត
      { width: 10 },  // សរុបរួម
      ...unifiedLocations.map(() => ({ width: 5.5 }))
    ];

    buildOfficialHeaderRows(
      ws3,
      cols3,
      'តារាងម៉ាទ្រីសបែងចែកស្តុកតាមបណ្តាទីតាំងទាំងអស់ (Cross-Tab Stock Distribution Matrix)',
      `សរុប ${matrixData.rows.length} មុខសម្ភារ × ${unifiedLocations.length} ទីតាំង`,
      'បង្ហាញបរិមាណសម្ភារនីមួយៗតាមជួរឈរទីតាំងស្តុកទាំងអស់ (ឃ្លាំងកណ្តាល HQ-ITSB → ថ្នាក់កណ្តាល → សាខាពន្ធដារខណ្ឌ → សាខាពន្ធដារខេត្ត)',
      Math.max(4.5, Math.floor(cols3 / 2) - 1)
    );

    // Row 9: Matrix Table Header
    const headerRow3 = ws3.getRow(9);
    headerRow3.values = [
      'ល.រ',
      'កូដ',
      'ឈ្មោះសម្ភារៈ',
      'ខ្នាត',
      'សរុបរួម',
      ...unifiedLocations.map(loc => getShortLocationHeader(loc))
    ];
    headerRow3.height = 145;

    styleRowRange(ws3, 9, 1, 4, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } },
      fillArgb: 'FF0B3D2E',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    styleRowRange(ws3, 9, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FFD4AF37' } },
      fillArgb: 'FF022C22',
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: headerBorder
    });
    unifiedLocations.forEach((_, idx) => {
      const c = 6 + idx;
      const isCentral = idx === 0;
      styleRowRange(ws3, 9, c, c, {
        font: {
          name: 'Khmer OS Siemreap',
          size: 9,
          bold: true,
          color: { argb: isCentral ? 'FFD4AF37' : 'FFFFFFFF' }
        },
        fillArgb: isCentral ? 'FF022C22' : 'FF0B3D2E',
        alignment: { horizontal: 'center', vertical: 'bottom', textRotation: 90 },
        border: headerBorder
      });
    });

    const dataStartRow3 = 10;
    matrixData.rows.forEach((row, rIdx) => {
      const r = dataStartRow3 + rIdx;
      const excelRow = ws3.getRow(r);
      excelRow.values = [
        row.no,
        row.itemCode,
        row.nameKh,
        row.unitKh,
        row.totalQty,
        ...unifiedLocations.map(loc => {
          const val = row.locationQuantities[loc.id] || 0;
          return val > 0 ? val : '-';
        })
      ];
      excelRow.height = 22;

      const zebraFill = rIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      styleRowRange(ws3, r, 1, 1, {
        font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws3, r, 2, 2, {
        font: { name: 'Consolas', size: 9, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws3, r, 3, 3, {
        font: { name: 'Khmer OS Siemreap', size: 9, bold: true, color: { argb: 'FF0F172A' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws3, r, 4, 4, {
        font: { name: 'Khmer OS Siemreap', size: 9, color: { argb: 'FF334155' } },
        fillArgb: zebraFill,
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
      });
      styleRowRange(ws3, r, 5, 5, {
        font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF05402D' } },
        fillArgb: 'FFECFDF5',
        alignment: { horizontal: 'center', vertical: 'middle' },
        numFmt: '#,##0',
        border: thinBorder()
      });

      unifiedLocations.forEach((loc, cIdx) => {
        const c = 6 + cIdx;
        const val = row.locationQuantities[loc.id] || 0;
        const isCentral = cIdx === 0;
        styleRowRange(ws3, r, c, c, {
          font: {
            name: 'Consolas',
            size: 9,
            bold: val > 0,
            color: { argb: val > 0 ? (isCentral ? 'FF05402D' : 'FF0F172A') : 'FFCBD5E1' }
          },
          fillArgb: val > 0 ? (isCentral ? 'FFFEF3C7' : 'FFECFDF5') : zebraFill,
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder()
        });
      });
    });

    const subtotalRow3 = dataStartRow3 + matrixData.rows.length;
    ws3.getRow(subtotalRow3).height = 26;
    ws3.getCell(subtotalRow3, 1).value = 'សរុបតាមទីតាំងនីមួយៗ (COLUMN TOTALS)៖';
    ws3.getCell(subtotalRow3, 5).value = matrixData.grandTotal;
    unifiedLocations.forEach((loc, cIdx) => {
      const colSum = matrixData.columnTotals[loc.id] || 0;
      ws3.getCell(subtotalRow3, 6 + cIdx).value = colSum > 0 ? colSum : '-';
    });
    ws3.mergeCells(subtotalRow3, 1, subtotalRow3, 4);

    styleRowRange(ws3, subtotalRow3, 1, 4, {
      font: { name: 'Khmer OS Siemreap', size: 9.5, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFE2E8F0',
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: subtotalBorder
    });
    styleRowRange(ws3, subtotalRow3, 5, 5, {
      font: { name: 'Khmer OS Siemreap', size: 10, bold: true, color: { argb: 'FF05402D' } },
      fillArgb: 'FFFEF3C7',
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: '#,##0',
      border: subtotalBorder
    });
    unifiedLocations.forEach((loc, cIdx) => {
      const c = 6 + cIdx;
      const colSum = matrixData.columnTotals[loc.id] || 0;
      styleRowRange(ws3, subtotalRow3, c, c, {
        font: {
          name: 'Consolas',
          size: 9,
          bold: colSum > 0,
          color: { argb: colSum > 0 ? 'FF05402D' : 'FF94A3B8' }
        },
        fillArgb: 'FFE2E8F0',
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: subtotalBorder
      });
    });

    appendOfficialSignatureBlock(ws3, subtotalRow3 + 1, cols3);

    // Write Workbook Buffer & Trigger Browser Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GDT_Executive_Stock_Report_${todayStr}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
      <div className="no-print print:hidden bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[#05402D] text-[#D4AF37] flex items-center justify-center shadow-sm shrink-0 border border-[#D4AF37]/40">
              <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold text-slate-900">
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
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
            <button
              type="button"
              onClick={fetchReportData}
              disabled={loading}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin text-[#05402D]' : ''}`} />
              <span>ធ្វើបច្ចុប្បន្នភាព</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm transition-all cursor-pointer border border-emerald-600"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300 shrink-0" />
              <span>📥 ទាញយកជា Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintA4}
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold text-[#D4AF37] bg-[#05402D] hover:bg-[#03291E] shadow-sm transition-all cursor-pointer border border-[#D4AF37]/40"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>🖨️ បោះពុម្ពរបាយការណ៍ A4</span>
            </button>
          </div>
        </div>

        {/* Report Mode Switcher & Filter Controls */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pt-1">
          {/* View Mode Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveReportTab('consolidated_two_part')}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'consolidated_two_part'
                  ? 'bg-[#05402D] text-[#D4AF37] shadow-sm'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <LayoutList className="w-4 h-4 shrink-0" />
              <span>របាយការណ៍សង្ខេបស្តុក ២ ផ្នែក (ផ្នែកទី១ & ផ្នែកទី២)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('matrix_34')}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'matrix_34'
                  ? 'bg-[#05402D] text-[#D4AF37] shadow-sm'
                  : 'text-slate-700 hover:bg-white/70'
              }`}
            >
              <Table2 className="w-4 h-4 shrink-0" />
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
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D] disabled:opacity-70"
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
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
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
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
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
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#05402D]/20 focus:border-[#05402D]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* OFFICIAL A4 LANDSCAPE PRINTABLE PAPER CONTAINER                   */}
      {/* ================================================================= */}
      <div className="print-container print-report-sheet bg-white rounded-2xl border border-slate-300 shadow-lg p-4 sm:p-8 lg:p-10 max-w-[1440px] mx-auto text-slate-900 overflow-x-hidden">
        
        {/* ----------------------------------------------------------------- */}
        {/* ១. ក្បាលទំព័រផ្លូវការ (OFFICIAL ROYAL GOVERNMENT HEADER)          */}
        {/* ----------------------------------------------------------------- */}
        <div className="overflow-x-auto print:overflow-visible">
          <div className="grid grid-cols-3 items-start gap-4 pb-3 border-b-2 border-[#05402D] min-w-[680px] print:min-w-0">
            {/* Left Side: Ministry & General Department */}
            <div className="justify-self-start text-center space-y-0.5 w-[260px]">
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

            {/* Center Column: Official GDT Logo */}
            <div className="flex flex-col items-center justify-center justify-self-center">
              <img
                src={gdtLogo || '/gdtlogo.png'}
                alt="អគ្គនាយកដ្ឋានពន្ធដារ - General Department of Taxation"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain select-none"
                onError={e => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/gdtlogo.png')) {
                    target.src = '/gdtlogo.png';
                  }
                }}
              />
            </div>

            {/* Right Side: Kingdom of Cambodia Motto */}
            <div className="justify-self-end space-y-0.5 w-[280px] text-center leading-[25px]">
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
        </div>

        {/* Report Title Centerpiece */}
        <div className="text-center py-3 space-y-1">
          <h1 className="font-moul text-sm sm:text-base lg:text-lg text-[#05402D] leading-snug">
            របាយការណ៍សង្ខេបស្តុកសម្ភារឧបករណ៍បច្ចេកទេស និងសម្ភារប្រើប្រាស់
          </h1>
          <div className="flex flex-wrap items-center justify-center text-xs font-semibold text-slate-700 pt-0.5">
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

              <div className="overflow-x-auto w-full border border-slate-400 rounded-lg">
                <table className="w-full min-w-[960px] print:min-w-0 text-left border-collapse">
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

              <div className="overflow-x-auto w-full border border-slate-400 rounded-lg">
                <table className="w-full min-w-[920px] print:min-w-0 text-left border-collapse">
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
          <div className="overflow-x-auto print:overflow-visible">
            <div className="grid grid-cols-3 gap-6 text-center text-xs min-w-[680px] print:min-w-0">
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
