import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Item, InventoryItem, Location } from '../types';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Printer,
  RefreshCw,
  MapPin,
  Calendar,
  Boxes,
  ArrowUpFromLine,
  Warehouse,
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
    return clean
      .replace(/^សាខាពន្ធដារខណ្ឌ\s*/, 'ខណ្ឌ')
      .replace(/^សាខាពន្ធដារខេត្ត\s*/, 'ខេត្ត')
      .replace(/^សាខាពន្ធដារ\s*/, 'សាខា');
  }
  const code = String(loc.code || '').trim();
  const nameKh = String(loc.name_kh || loc.name_en || code).trim();
  if (code === 'HQ-ITSB' || loc.type === 'HQ' || loc.id === '1') {
    return 'ឃ្លាំងកណ្តាល (HQ-ITSB)';
  }
  return nameKh
    .replace(/^សាខាពន្ធដារខណ្ឌ\s*/, 'ខណ្ឌ')
    .replace(/^សាខាពន្ធដារខេត្ត\s*/, 'ខេត្ត')
    .replace(/^សាខាពន្ធដារ\s*/, 'សាខា');
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

  // Export 2-Sheet Excel (.xlsx) — GDT_Executive_Stock_Report_YYYY-MM-DD.xlsx
  const handleExportExcel = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const locationLabel =
      reportLocationId === 'ALL' || !activeSelectedLocationObj
        ? 'គ្រប់ទីតាំងស្តុកទាំងអស់ (ឃ្លាំងកណ្តាល HQ-ITSB និង ៣៣ សាខាពន្ធដារ)'
        : formatLocationOption(activeSelectedLocationObj, 'kh');
    const dateRangeLabel =
      startDate || endDate
        ? `ចាប់ពីថ្ងៃទី ${startDate || '...'} ដល់ថ្ងៃទី ${endDate || '...'}`
        : `គិតត្រឹមថ្ងៃទី ${new Date().toLocaleDateString('km-KH', { day: '2-digit', month: 'long', year: 'numeric' })}`;

    const wb = XLSX.utils.book_new();

    // =========================================================================
    // SHEET 1: "ឧបករណ៍បច្ចេកទេស-មិនអស់" (11 Columns)
    // =========================================================================
    const sheet1Data: (string | number)[][] = [
      ['ព្រះរាជាណាចក្រកម្ពុជា'],
      ['ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ - នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន'],
      [''],
      ['ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់)»'],
      ['និយមន័យ៖ ជាឧបករណ៍/សម្ភារដែលមានតម្លៃគង់វង្ស ពេលដកចេញគឺមិនអស់រូបរាងឡើយ គឺស្ថិតក្នុងស្ថានភាពកំពុងប្រើប្រាស់ជាក់ស្តែងក្នុងដៃមន្ត្រី ឬសាខា។'],
      [`វិសាលភាពទីតាំង៖ ${locationLabel} | កាលបរិច្ឆេទ៖ ${dateRangeLabel}`],
      [''],
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស',
        'ឯកតា',
        'សរុបរួម (A=B+C)',
        'កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)',
        'ខូច / បាត់បង់ / កែតម្រូវ (C)',
        'ស្តុកនៅសល់ក្នុងឃ្លាំង (D)',
        'សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង',
        'គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ',
        'ស្ថានភាពស្តុក'
      ]
    ];

    nonConsumableRows.forEach(r => {
      sheet1Data.push([
        r.no,
        r.itemCode,
        `${r.nameKh} (${r.nameEn})`,
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

    sheet1Data.push([
      '',
      '',
      'សរុបរួមផ្នែកទី ១ (SUBTOTAL - ឧបករណ៍បច្ចេកទេសប្រើប្រាស់មិនអស់)',
      'គ្រឿង/ឈុត',
      part1Totals.totalInboundA,
      part1Totals.inUseB,
      part1Totals.damagedAdjustedC,
      part1Totals.warehouseAvailD,
      `សរុប ${nonConsumableRows.length} មុខឧបករណ៍`,
      'ផ្ទៀងផ្ទាត់ត្រឹមត្រូវតាមបញ្ជីសារពើភណ្ឌ',
      ''
    ]);

    sheet1Data.push(['']);
    sheet1Data.push([
      '',
      'អ្នករៀបចំរបាយការណ៍ (មន្ត្រីកាន់ស្តុក)',
      '',
      '',
      'បានពិនិត្យត្រឹមត្រូវ (ប្រធានការិយាល័យ)',
      '',
      '',
      '',
      'បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋាន)',
      '',
      ''
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!cols'] = [
      { wch: 6 },
      { wch: 11 },
      { wch: 38 },
      { wch: 10 },
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
      { wch: 20 },
      { wch: 36 },
      { wch: 38 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'ឧបករណ៍បច្ចេកទេស-មិនអស់');

    // =========================================================================
    // SHEET 2: "សម្ភារប្រើប្រាស់-អស់ទៅ" (10 Columns)
    // =========================================================================
    const sheet2Data: (string | number)[][] = [
      ['ព្រះរាជាណាចក្រកម្ពុជា'],
      ['ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ - នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន'],
      [''],
      ['ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ)»'],
      ['និយមន័យ៖ ជាសម្ភារបរិក្ខារដែលពេលដកចេញ គឺបានបើកផ្តល់ និងប្រើប្រាស់អស់ទៅតាមការងារជាក់ស្តែង គ្មានការយកត្រឡប់ចូលឃ្លាំងវិញទេ។'],
      [`វិសាលភាពទីតាំង៖ ${locationLabel} | កាលបរិច្ឆេទ៖ ${dateRangeLabel}`],
      [''],
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះសម្ភារប្រើប្រាស់អស់ទៅ',
        'ឯកតា',
        'សរុបរួមនាំចូល (A)',
        'បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)',
        'ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)',
        'សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់',
        'គោលបំណង និងកាលបរិច្ឆេទបើកបែក',
        'ស្ថានភាពស្តុក'
      ]
    ];

    consumableRows.forEach(r => {
      sheet2Data.push([
        r.no,
        r.itemCode,
        `${r.nameKh} (${r.nameEn})`,
        r.unitKh,
        r.totalInboundA,
        r.totalIssuedB,
        r.remainingStockC,
        r.issuedRecipients,
        r.purposeAndDate,
        r.statusLabelKh
      ]);
    });

    sheet2Data.push([
      '',
      '',
      'សរុបរួមផ្នែកទី ២ (SUBTOTAL - សម្ភារប្រើប្រាស់អស់ទៅ)',
      'ឯកតា',
      part2Totals.totalInboundA,
      part2Totals.totalIssuedB,
      part2Totals.remainingStockC,
      `សរុប ${consumableRows.length} មុខសម្ភារ`,
      'ផ្ទៀងផ្ទាត់ត្រឹមត្រូវតាមបញ្ជីសារពើភណ្ឌ',
      ''
    ]);

    sheet2Data.push(['']);
    sheet2Data.push([
      '',
      'អ្នករៀបចំរបាយការណ៍ (មន្ត្រីកាន់ស្តុក)',
      '',
      '',
      'បានពិនិត្យត្រឹមត្រូវ (ប្រធានការិយាល័យ)',
      '',
      '',
      'បានឃើញ និងឯកភាព (ប្រធាននាយកដ្ឋាន)',
      '',
      ''
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [
      { wch: 6 },
      { wch: 11 },
      { wch: 38 },
      { wch: 10 },
      { wch: 18 },
      { wch: 24 },
      { wch: 22 },
      { wch: 36 },
      { wch: 38 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws2, 'សម្ភារប្រើប្រាស់-អស់ទៅ');

    XLSX.writeFile(wb, `GDT_Executive_Stock_Report_${todayStr}.xlsx`);
  };

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
          <div className="text-left space-y-0.5">
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed">
              ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ
            </p>
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed">
              អគ្គនាយកដ្ឋានពន្ធដារ
            </p>
            <p className="font-siemreap text-xs font-bold text-slate-800">
              នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន
            </p>
            <p className="text-[11px] text-slate-600 font-medium">
              លេខ៖ ........................... អពដ/នបព
            </p>
          </div>

          {/* Right Side: Kingdom of Cambodia Motto */}
          <div className="text-left sm:text-right space-y-0.5">
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed">
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed">
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <div className="text-[#D4AF37] font-bold tracking-[0.25em] text-xs select-none">
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

        {/* ----------------------------------------------------------------- */}
        {/* ២. ផ្ទាំងសង្ខេបតួលេខរួមទាំង ៤ (4 KPI EXECUTIVE SUMMARY CARDS)      */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-3">
          {/* Card 1: ឧបករណ៍បច្ចេកទេសសរុប (ប្រើប្រាស់មិនអស់) */}
          <div className="rounded-xl border border-slate-300 bg-slate-50/90 p-3 flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-slate-700">
                ១. សម្ភារឧបករណ៍បច្ចេកទេស (មិនអស់)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-slate-900">
                {part1Totals.totalInboundA.toLocaleString()} <span className="text-xs font-semibold text-slate-500">គ្រឿង/ឈុត</span>
              </p>
              <p className="text-[10px] text-slate-600 font-medium">
                សរុប <strong className="text-[#05402D]">{nonConsumableRows.length} មុខឧបករណ៍</strong> (A = B + C + D)
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#05402D]/10 text-[#05402D] flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4" />
            </div>
          </div>

          {/* Card 2: កំពុងប្រើប្រាស់ជាក់ស្តែង និងសល់ក្នុងឃ្លាំង (ផ្នែកទី១) */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-blue-900">
                ២. ឧបករណ៍កំពុងប្រើប្រាស់ (B) / សល់ក្នុងឃ្លាំង (D)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-blue-800">
                {part1Totals.inUseB.toLocaleString()}{' '}
                <span className="text-xs font-semibold text-slate-500">/</span>{' '}
                <span className="text-emerald-700">{part1Totals.warehouseAvailD.toLocaleString()}</span>
              </p>
              <p className="text-[10px] text-blue-700 font-medium">
                កំពុងប្រើប្រាស់ (B) និងស្តុកក្នុងឃ្លាំង (D)
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-600/15 text-blue-700 flex items-center justify-center shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
          </div>

          {/* Card 3: សម្ភារបរិក្ខារប្រើប្រាស់អស់ទៅសរុបនាំចូល (A) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-amber-900">
                ៣. សម្ភារប្រើប្រាស់អស់ទៅនាំចូល (A)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-amber-800">
                {part2Totals.totalInboundA.toLocaleString()} <span className="text-xs font-semibold text-amber-700">ឯកតា</span>
              </p>
              <p className="text-[10px] text-amber-700 font-medium">
                សរុប <strong className="text-amber-900">{consumableRows.length} មុខសម្ភារ</strong> | បើកផ្តល់ (B): {part2Totals.totalIssuedB.toLocaleString()}
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <ArrowUpFromLine className="w-4 h-4" />
            </div>
          </div>

          {/* Card 4: ស្តុកនៅសល់ក្នុងឃ្លាំងសរុបរួម (ផ្នែកទី២ C) */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 flex items-start justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-[#05402D]">
                ៤. ស្តុកសម្ភារអស់ទៅនៅសល់ក្នុងឃ្លាំង (C)
              </p>
              <p className="text-lg sm:text-xl font-extrabold text-[#05402D]">
                {part2Totals.remainingStockC.toLocaleString()} <span className="text-xs font-semibold text-emerald-800">ឯកតា</span>
              </p>
              <p className="text-[10px] text-emerald-800 font-medium">
                តុល្យភាពស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#05402D] text-[#D4AF37] flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TWO-PART CONSOLIDATED REPORT TABLES (ផ្នែកទី១ & ផ្នែកទី២)         */}
        {/* ================================================================= */}
        {activeReportTab === 'consolidated_two_part' && (
          <div className="space-y-7 mt-4">
            {/* ------------------------------------------------------------- */}
            {/* ផ្នែកទី ១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់) - 11 COLS */}
            {/* ------------------------------------------------------------- */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 bg-[#05402D]/5 border-l-4 border-[#05402D] px-3.5 py-2 rounded-r-xl">
                <div className="flex items-start gap-2.5">
                  <Wrench className="w-4 h-4 text-[#05402D] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-moul text-xs sm:text-sm text-[#05402D]">
                      ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារឧបករណ៍បច្ចេកទេស (ប្រើប្រាស់មិនអស់)»
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
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[180px]">ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-14">ឯកតា</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-24 bg-[#03291E]">
                        សរុបរួម (A=B+C)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-28">
                        កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-24">
                        ខូច / បាត់បង់ / កែតម្រូវ (C)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-400 text-right w-28 bg-emerald-950 text-[#D4AF37]">
                        ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
                        <div className="text-[9px] font-normal text-emerald-200">(D = A - B - C)</div>
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[175px]">
                        សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-400 min-w-[180px]">
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
                      ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារបរិក្ខារ និងសម្ភារប្រើប្រាស់ (ប្រើប្រាស់អស់ទៅ)»
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
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[10px] w-7 align-bottom">
                      ល.រ
                    </th>
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[10px] w-14 align-bottom">
                      កូដ
                    </th>
                    <th className="py-2 px-2 border border-slate-400 text-left text-[10px] min-w-[145px] align-bottom">
                      ឈ្មោះសម្ភារៈ
                    </th>
                    <th className="py-2 px-1 border border-slate-400 text-center text-[10px] w-11 align-bottom">
                      ខ្នាត
                    </th>
                    <th className="py-2 px-1.5 border border-slate-400 text-center text-[10px] w-14 align-bottom bg-[#03291E] text-[#D4AF37]">
                      សរុបរួម
                    </th>
                    {unifiedLocations.map((loc, idx) => {
                      const shortName = getShortLocationHeader(loc);
                      const isCentral = idx === 0;
                      return (
                        <th
                          key={loc.id}
                          title={loc.name_kh}
                          className={`border border-slate-400 p-0 align-bottom relative h-36 min-w-[26px] max-w-[30px] ${
                            isCentral ? 'bg-emerald-950 text-[#D4AF37]' : 'bg-[#05402D] text-white'
                          }`}
                        >
                          <div className="w-full h-full flex items-end justify-center pb-2">
                            <span
                              className="inline-block whitespace-nowrap text-[9px] font-semibold leading-none tracking-tight origin-bottom-left"
                              style={{
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                maxHeight: '132px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {shortName}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="text-[10px] divide-y divide-slate-300">
                  {matrixData.rows.map((row, rIdx) => (
                    <tr
                      key={row.itemCode}
                      className={`${rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/90'} hover:bg-emerald-50/50`}
                    >
                      <td className="py-1 px-1 border border-slate-300 text-center font-semibold text-slate-700">
                        {row.no}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 text-center font-mono font-bold text-[#05402D]">
                        {row.itemCode}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 font-bold text-slate-900 truncate max-w-[165px]" title={`${row.nameKh} (${row.nameEn})`}>
                        {row.nameKh}
                      </td>
                      <td className="py-1 px-1 border border-slate-300 text-center text-slate-700">
                        {row.unitKh}
                      </td>
                      <td className="py-1 px-1.5 border border-slate-300 text-center font-extrabold text-[#05402D] bg-emerald-50/80">
                        {row.totalQty.toLocaleString()}
                      </td>
                      {unifiedLocations.map((loc, cIdx) => {
                        const val = row.locationQuantities[loc.id] || 0;
                        const isCentral = cIdx === 0;
                        return (
                          <td
                            key={loc.id}
                            title={`${row.nameKh} @ ${loc.name_kh}: ${val}`}
                            className={`py-1 px-0.5 border border-slate-300 text-center font-mono ${
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
                  <tr className="bg-slate-200 font-extrabold text-[10px] text-slate-900 border-t-2 border-[#05402D]">
                    <td colSpan={4} className="py-1.5 px-2 border border-slate-400 text-right text-[#05402D]">
                      សរុបតាមទីតាំងនីមួយៗ (COLUMN TOTALS)៖
                    </td>
                    <td className="py-1.5 px-1.5 border border-slate-400 text-center text-[#05402D] bg-amber-100/80">
                      {matrixData.grandTotal.toLocaleString()}
                    </td>
                    {unifiedLocations.map(loc => {
                      const colSum = matrixData.columnTotals[loc.id] || 0;
                      return (
                        <td
                          key={loc.id}
                          className="py-1.5 px-0.5 border border-slate-400 text-center font-mono text-[9px] text-[#05402D]"
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
            {/* Left Signature: អ្នករៀបចំរបាយការណ៍ */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  អ្នករៀបចំរបាយការណ៍
                </p>
                <p className="text-[10px] font-semibold text-slate-600">
                  (មន្ត្រីទទួលបន្ទុកកាន់ស្តុក)
                </p>
              </div>
              <div className="pt-2">
                <div className="w-40 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="font-bold text-slate-800 text-[11px]">
                  {user?.full_name || (user as any)?.fullName || (user as any)?.name || 'មន្ត្រីគ្រប់គ្រងស្តុក'}
                </p>
              </div>
            </div>

            {/* Center Signature: បានពិនិត្យត្រឹមត្រូវ */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  បានពិនិត្យត្រឹមត្រូវ
                </p>
                <p className="text-[10px] font-semibold text-slate-600">
                  ប្រធានការិយាល័យ
                </p>
              </div>
              <div className="pt-2">
                <div className="w-40 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="text-[11px] text-slate-500">ហត្ថលេខា និងឈ្មោះ</p>
              </div>
            </div>

            {/* Right Signature: បានឃើញ និងឯកភាព */}
            <div className="space-y-10">
              <div className="space-y-0.5">
                <p className="text-[11px] text-slate-700 font-medium">
                  ថ្ងៃ.......................... ខែ............. ឆ្នាំម្សាញ់ សប្តស័ក ព.ស.២៥៦៩
                </p>
                <p className="text-[11px] text-slate-700 font-medium">
                  រាជធានីភ្នំពេញ, ថ្ងៃទី........ ខែ............. ឆ្នាំ២០២៦
                </p>
                <p className="font-moul text-xs text-[#05402D] pt-1">
                  បានឃើញ និងឯកភាព
                </p>
                <p className="text-[10px] font-semibold text-slate-600">
                  ប្រធាននាយកដ្ឋាន / ប្រធានអង្គភាព
                </p>
              </div>
              <div className="pt-2">
                <div className="w-40 mx-auto border-b border-dotted border-slate-400 mb-1" />
                <p className="text-[11px] text-slate-500">ហត្ថលេខា និងត្រា</p>
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
