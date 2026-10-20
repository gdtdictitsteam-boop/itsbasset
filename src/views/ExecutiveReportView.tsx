import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { useInventoryContext, isHqLocationOrRow } from '../contexts/InventoryContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockLocations } from '../mockData';
import * as XLSX from 'xlsx';
import {
  FileBarChart2,
  Printer,
  FileSpreadsheet,
  Calendar,
  MapPin,
  RefreshCw,
  ArrowDownToLine,
  PackageCheck,
  UserCheck,
  SlidersHorizontal,
  Search,
  Building2,
  Layers,
  Grid3X3,
  Wrench,
  PackageOpen
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

// ផ្នែកទី ១៖ សម្ភារប្រើប្រាស់មិនអស់ (ទ្រព្យសម្បត្តិឧបករណ៍បច្ចេកទេស - 11 ជួរឈរ)
interface NonConsumableRow {
  no: number;
  itemCode: string;
  itemNameKh: string;
  unit: string;
  totalInboundA: number;        // សរុបរួម (A = B + C + D)
  activeInUseB: number;         // កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)
  damagedAdjustedC: number;     // ខូច / បាត់បង់ / កែតម្រូវ (C)
  warehouseAvailableD: number;  // ស្តុកនៅសល់ក្នុងឃ្លាំង (D = A - B - C)
  assignedHolders: string;      // សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង
  purposeAndDate: string;       // គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ
  statusBadge: string;          // 🟢 ស្តុកគ្រប់គ្រាន់ | 🟡 ស្តុកទាប | 🔴 អស់ពីស្តុក
  statusType: 'NORMAL' | 'LOW' | 'OUT';
}

// ផ្នែកទី ២៖ សម្ភារប្រើប្រាស់អស់ទៅ (សម្ភារបរិក្ខារ និងអនាម័យ - 10 ជួរឈរ)
interface ConsumableRow {
  no: number;
  itemCode: string;
  itemNameKh: string;
  unit: string;
  totalInboundA: number;        // សរុបរួមនាំចូល (A)
  totalConsumedB: number;       // បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
  remainingStockC: number;      // ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)
  issuedRecipients: string;     // សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់
  purposeAndDate: string;       // គោលបំណង និងកាលបរិច្ឆេទបើកបែក
  statusBadge: string;          // 🟢 ស្តុកគ្រប់គ្រាន់ | 🟡 ស្តុកទាប | 🔴 អស់ពីស្តុក
  statusType: 'NORMAL' | 'LOW' | 'OUT';
}

// Cross-Tab Matrix types
interface SortedLocationCol {
  id: string;
  code: string;
  nameKh: string;
  shortLabel: string;
  category: 'HQ' | 'KHAN' | 'PROVINCE';
}

interface MatrixItemRow {
  no: number;
  itemId: string;
  itemCode: string;
  itemNameKh: string;
  unit: string;
  totalQty: number;
  quantitiesByLocId: Record<string, number>;
}

// Helper: Determine if an item belongs to Part 1 (Non-Consumable / Technical Equipment)
// vs Part 2 (Consumable / Supplies & Hygiene)
function isNonConsumableEquipment(item: any): boolean {
  const code = String(item.code || '').trim().toUpperCase();
  const cat = String(item.category || '').trim().toUpperCase();

  if (code.startsWith('T-') || code.startsWith('TK') || code.startsWith('EQ') || code.startsWith('IT')) {
    return true;
  }
  if (code.startsWith('S-') || code.startsWith('TM') || code.startsWith('CS')) {
    return false;
  }
  if (
    cat.includes('TOOL') ||
    cat.includes('EQUIPMENT') ||
    cat.includes('HARDWARE') ||
    cat.includes('ASSET') ||
    cat.includes('ឧបករណ៍')
  ) {
    return true;
  }
  if (
    cat.includes('SUPPL') ||
    cat.includes('CONSUM') ||
    cat.includes('សម្ភារប្រើប្រាស់អស់') ||
    cat.includes('បរិក្ខារ')
  ) {
    return false;
  }
  return true;
}

// Format concise Khmer header label for each of the 34 locations in the Matrix table
function getShortLocationHeader(loc: any, allLocs: any[]): string {
  const nameKh = String(loc.name_kh || '').trim();
  const code = String(loc.code || '').trim().toUpperCase();

  if (isHqLocationOrRow(loc, allLocs)) {
    return 'ថ្នាក់កណ្តាល';
  }
  if (code === 'TECH-HQ' || nameKh.includes('ក្រុមការងារថ្នាក់កណ្តាល')) {
    return 'ក្រុមការងារកណ្តាល';
  }

  return nameKh
    .replace(/^សាខាពន្ធដារ/, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .trim();
}

export function ExecutiveReportView() {
  const { language } = useLanguage();
  const { isBranchUser, userDisplayName } = useAuth();
  const { selectedLocationId, selectedLocation, locations } = useLocationContext();
  const { items: ctxItems, inventory: ctxInventory, transactions: ctxTransactions } = useInventoryContext();

  // Independent Read-Only State fetched directly from Supabase
  const [dbItems, setDbItems] = useState<any[]>([]);
  const [dbLocations, setDbLocations] = useState<any[]>([]);
  const [dbInventory, setDbInventory] = useState<any[]>([]);
  const [dbAuditTrail, setDbAuditTrail] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // View Tab State: Default to 'CONSOLIDATED' (2-Part Consolidated Report: Part 1 + Part 2)
  const [activeReportTab, setActiveReportTab] = useState<'CONSOLIDATED' | 'PART_1' | 'PART_2' | 'MATRIX'>('CONSOLIDATED');
  const [reportLocationId, setReportLocationId] = useState<string>(
    isBranchUser ? selectedLocationId : (selectedLocationId || 'ALL')
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Keep report location synced if Sidebar location changes or if BranchUser is locked
  useEffect(() => {
    if (isBranchUser) {
      setReportLocationId(selectedLocationId);
    } else if (selectedLocationId) {
      setReportLocationId(selectedLocationId);
    }
  }, [selectedLocationId, isBranchUser]);

  // Strict Read-Only Fetch from Supabase (`SELECT` only — Zero Side-Effects)
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    if (!isSupabaseConfigured()) {
      setDbItems(ctxItems);
      setDbLocations(locations.length > 0 ? locations : mockLocations);
      setDbInventory(ctxInventory);
      setDbAuditTrail(ctxTransactions);
      setLoading(false);
      return;
    }

    try {
      const [itemsRes, locsRes, invRes, txRes] = await Promise.all([
        supabase.from('items').select('*').order('code', { ascending: true }),
        supabase.from('locations').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false })
      ]);

      setDbItems(itemsRes.data && itemsRes.data.length > 0 ? itemsRes.data : ctxItems);
      setDbLocations(
        locsRes.data && locsRes.data.length > 0
          ? locsRes.data
          : locations.length > 0
          ? locations
          : mockLocations
      );
      setDbInventory(invRes.data && invRes.data.length > 0 ? invRes.data : ctxInventory);
      setDbAuditTrail(txRes.data && txRes.data.length > 0 ? txRes.data : ctxTransactions);
    } catch (err) {
      console.error('Error fetching read-only consolidated report data:', err);
      setDbItems(ctxItems);
      setDbLocations(locations.length > 0 ? locations : mockLocations);
      setDbInventory(ctxInventory);
      setDbAuditTrail(ctxTransactions);
    } finally {
      setLoading(false);
    }
  }, [ctxItems, ctxInventory, ctxTransactions, locations]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Clean URL from remark for cleaner display
  const cleanRemarkText = (remark?: string): string => {
    if (!remark) return '';
    return remark
      .replace(/\|\s*ឯកសារយោង:\s*https?:\/\/[^\s"'<>]+/gi, '')
      .replace(/ឯកសារយោង:\s*https?:\/\/[^\s"'<>]+/gi, '')
      .replace(/https?:\/\/[^\s"'<>]+/gi, '')
      .trim();
  };

  // Format short date for Purpose & Date column
  const formatShortDate = (rawDate?: string): string => {
    if (!rawDate) return '';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('km-KH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Sorted 34 locations (1. HQ -> 2. Khan Branches -> 3. Province Branches)
  const sortedLocations: SortedLocationCol[] = useMemo(() => {
    const rawList =
      dbLocations.length > 0 ? dbLocations : locations.length > 0 ? locations : mockLocations;

    const validLocs = rawList.filter(
      (loc) =>
        String(loc.id).toUpperCase() !== 'ALL' &&
        String(loc.code || '').toUpperCase() !== 'ALL' &&
        String(loc.type || '').toUpperCase() !== 'ALL'
    );

    const classifyLoc = (loc: any): 'HQ' | 'KHAN' | 'PROVINCE' => {
      const nameKh = String(loc.name_kh || '');
      const code = String(loc.code || '').toUpperCase();
      if (isHqLocationOrRow(loc, validLocs) || code === 'TECH-HQ' || nameKh.includes('ថ្នាក់កណ្តាល') || nameKh.includes('HQ')) {
        return 'HQ';
      }
      if (nameKh.includes('ខណ្ឌ')) {
        return 'KHAN';
      }
      return 'PROVINCE';
    };

    const sorted = [...validLocs].sort((a, b) => {
      const orderMap = { HQ: 1, KHAN: 2, PROVINCE: 3 };
      const catA = classifyLoc(a);
      const catB = classifyLoc(b);
      if (catA !== catB) return orderMap[catA] - orderMap[catB];

      if (catA === 'HQ') {
        const isMainHqA = isHqLocationOrRow(a, validLocs);
        const isMainHqB = isHqLocationOrRow(b, validLocs);
        if (isMainHqA !== isMainHqB) return isMainHqA ? -1 : 1;
      }

      const shortA = getShortLocationHeader(a, validLocs);
      const shortB = getShortLocationHeader(b, validLocs);
      return shortA.localeCompare(shortB, 'km');
    });

    return sorted.map((loc) => ({
      id: String(loc.id),
      code: String(loc.code || ''),
      nameKh: String(loc.name_kh || ''),
      shortLabel: getShortLocationHeader(loc, validLocs),
      category: classifyLoc(loc)
    }));
  }, [dbLocations, locations]);

  // Helper to check if a record belongs to a specific location
  const matchesTargetLocation = useCallback(
    (locObj: { id: string; code: string; nameKh?: string; name_kh?: string }, locIdOrCode?: string, locName?: string): boolean => {
      if (!locObj) return false;
      const cleanVal = String(locIdOrCode || '').trim().toUpperCase();
      const cleanName = String(locName || '').trim();
      const targetId = String(locObj.id || '').trim().toUpperCase();
      const targetCode = String(locObj.code || '').trim().toUpperCase();
      const targetNameKh = String(locObj.nameKh || locObj.name_kh || '').trim();

      if (cleanVal && (cleanVal === targetId || (targetCode && cleanVal === targetCode))) return true;
      if (
        cleanName &&
        targetNameKh &&
        (cleanName === targetNameKh || cleanName.includes(targetNameKh) || targetNameKh.includes(cleanName))
      ) {
        return true;
      }
      if (cleanName && targetCode && cleanName.toUpperCase().includes(`(${targetCode})`)) {
        return true;
      }
      return false;
    },
    []
  );

  // Helper to check if a record matches the active filter dropdown
  const matchesFilterLocation = useCallback(
    (locIdOrCode?: string, locName?: string): boolean => {
      if (!reportLocationId || reportLocationId === 'ALL') return true;
      const targetLoc = sortedLocations.find(
        (l) =>
          String(l.id) === String(reportLocationId) ||
          String(l.code).toUpperCase() === String(reportLocationId).toUpperCase()
      );
      if (targetLoc) {
        return matchesTargetLocation(targetLoc, locIdOrCode, locName);
      }
      return String(locIdOrCode || '').trim().toUpperCase() === String(reportLocationId).trim().toUpperCase();
    },
    [reportLocationId, sortedLocations, matchesTargetLocation]
  );

  // Active selected location object
  const activeLocationObj = useMemo(() => {
    if (!reportLocationId || reportLocationId === 'ALL') {
      return {
        id: 'ALL',
        code: 'ALL',
        name_kh: 'គ្រប់ទីតាំងថ្នាក់កណ្តាល និងសាខាពន្ធដារខេត្ត-ខណ្ឌទាំងអស់',
        name_en: 'All Locations (HQ & Branches)',
        type: 'ALL'
      };
    }
    const found = sortedLocations.find(
      (l) =>
        String(l.id) === String(reportLocationId) ||
        String(l.code).toUpperCase() === String(reportLocationId).toUpperCase()
    );
    if (found) {
      return {
        id: found.id,
        code: found.code,
        name_kh: found.nameKh,
        name_en: found.nameKh,
        type: found.category
      };
    }
    return selectedLocation;
  }, [reportLocationId, sortedLocations, selectedLocation]);

  // Filter audit trail / transactions by Date Range & Location
  const filteredTransactions = useMemo(() => {
    return dbAuditTrail.filter((tx) => {
      if (reportLocationId !== 'ALL') {
        const fromMatch = matchesFilterLocation(tx.from_location_id || tx.from_location, tx.from_location);
        const toMatch = matchesFilterLocation(tx.to_location_id || tx.to_location, tx.to_location);
        if (!fromMatch && !toMatch) return false;
      }

      const rawDate = tx.date || tx.created_at;
      if (rawDate && (startDate || endDate)) {
        const txDate = new Date(rawDate);
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (txDate < sDate) return false;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (txDate > eDate) return false;
        }
      }
      return true;
    });
  }, [dbAuditTrail, reportLocationId, startDate, endDate, matchesFilterLocation]);

  // =========================================================================
  // PART 1: ប្រភេទទី១៖ សម្ភារប្រើប្រាស់មិនអស់ (ទ្រព្យសម្បត្តិឧបករណ៍បច្ចេកទេស - 11 ជួរឈរ)
  // =========================================================================
  const part1NonConsumableRows: NonConsumableRow[] = useMemo(() => {
    const rawItems = dbItems.length > 0 ? dbItems : ctxItems;
    const toolItems = rawItems
      .filter((item) => isNonConsumableEquipment(item))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));

    const rows: NonConsumableRow[] = toolItems.map((item, idx) => {
      const itemIdStr = String(item.id);
      const itemCodeStr = String(item.code || '').toUpperCase();

      // Match inventory rows for this item
      const itemInvAll = dbInventory.filter(
        (inv) =>
          String(inv.item_id) === itemIdStr ||
          String(inv.item_code || '').toUpperCase() === itemCodeStr
      );

      // Match transactions for this item
      const itemTxs = filteredTransactions.filter(
        (tx) =>
          String(tx.item_id) === itemIdStr ||
          String(tx.item_code || '').toUpperCase() === itemCodeStr ||
          (tx.item_name_kh && tx.item_name_kh === item.name_kh)
      );

      // Warehouse Available Qty (D):
      // If viewing ALL locations, D is Central HQ Warehouse stock; if viewing a specific branch, D is that branch's available stock
      let warehouseAvailableD = 0;
      if (reportLocationId === 'ALL') {
        warehouseAvailableD = itemInvAll
          .filter((inv) => isHqLocationOrRow(inv, dbLocations))
          .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
      } else {
        warehouseAvailableD = itemInvAll
          .filter(
            (inv) =>
              matchesFilterLocation(inv.location_id, inv.location_name_kh) ||
              matchesFilterLocation(inv.location_code, inv.location_name_kh)
          )
          .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
      }

      // Active In-Use / Handed Over Qty (B):
      // Branch stock + STOCK_OUT / HANDOVER transactions
      const branchInvQty =
        reportLocationId === 'ALL'
          ? itemInvAll
              .filter((inv) => !isHqLocationOrRow(inv, dbLocations))
              .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0)
          : 0;

      const usageTxs = itemTxs.filter((tx) => {
        const tType = String(tx.type || '').toUpperCase();
        return tType === 'STOCK_OUT' || tType === 'HANDOVER';
      });
      const txUsedQty = usageTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

      const activeInUseB = Math.max(branchInvQty, txUsedQty);

      // Damaged / Lost / Adjusted Qty (C):
      const adjustTxs = itemTxs.filter((tx) => String(tx.type || '').toUpperCase() === 'ADJUSTMENT');
      const damagedAdjustedC = adjustTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

      // Total Inbound Qty (A = B + C + D)
      const totalInboundA = warehouseAvailableD + activeInUseB + damagedAdjustedC;

      // Assigned Branch / Officer from audit trail & branch inventory
      const holderSet = new Set<string>();
      usageTxs.forEach((tx) => {
        if (tx.to_location && String(tx.to_location).trim() && tx.to_location !== '-') {
          holderSet.add(String(tx.to_location).trim().replace(/^សាខាពន្ធដារ/, ''));
        }
        if (tx.recorded_by && String(tx.recorded_by).trim()) {
          holderSet.add(String(tx.recorded_by).trim());
        }
        const cleaned = cleanRemarkText(tx.remark || tx.purpose);
        const officerMatch = cleaned.match(/មន្ត្រីទទួល:\s*([^|,-]+)/i);
        if (officerMatch && officerMatch[1]) {
          holderSet.add(officerMatch[1].trim());
        }
      });

      itemInvAll.forEach((inv) => {
        if (!isHqLocationOrRow(inv, dbLocations) && (Number(inv.quantity) || 0) > 0) {
          if (reportLocationId === 'ALL' || matchesFilterLocation(inv.location_id, inv.location_name_kh)) {
            const locLabel = String(inv.location_name_kh || inv.location_code || '')
              .replace(/^សាខាពន្ធដារ/, '')
              .trim();
            if (locLabel) holderSet.add(`${locLabel} (${inv.quantity})`);
          }
        }
      });

      const assignedHolders =
        holderSet.size > 0
          ? Array.from(holderSet).slice(0, 4).join(', ')
          : warehouseAvailableD > 0
          ? 'រក្សាទុកនៅឃ្លាំងស្តុកកណ្តាល (HQ-ITSB)'
          : '-';

      // Purpose & Date from audit trail
      const purposeEntries: string[] = [];
      usageTxs.slice(0, 2).forEach((tx) => {
        const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
        const dStr = formatShortDate(tx.date || tx.created_at);
        if (cleaned && cleaned !== '-') {
          purposeEntries.push(dStr ? `${cleaned} (${dStr})` : cleaned);
        }
      });

      if (purposeEntries.length === 0 && itemTxs.length > 0) {
        itemTxs.slice(0, 1).forEach((tx) => {
          const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
          const dStr = formatShortDate(tx.date || tx.created_at);
          if (cleaned && cleaned !== '-') {
            purposeEntries.push(dStr ? `${cleaned} (${dStr})` : cleaned);
          }
        });
      }

      const purposeAndDate =
        purposeEntries.length > 0
          ? purposeEntries.join(' | ')
          : activeInUseB > 0
          ? 'ប្រគល់ជូនសាខា និងមន្ត្រីបម្រើការងារបច្ចេកទេស'
          : 'ស្តុកបម្រុងសម្រាប់បម្រើការងារបច្ចេកទេស';

      // Stock Status Badge (🟢 ស្តុកគ្រប់គ្រាន់, 🟡 ស្តុកទាប, 🔴 អស់ពីស្តុក)
      const minStock = Number(item.min_stock) || 5;
      let statusBadge = '🟢 ស្តុកគ្រប់គ្រាន់';
      let statusType: 'NORMAL' | 'LOW' | 'OUT' = 'NORMAL';
      if (warehouseAvailableD <= 0) {
        statusBadge = '🔴 អស់ពីស្តុក';
        statusType = 'OUT';
      } else if (warehouseAvailableD <= minStock) {
        statusBadge = '🟡 ស្តុកទាប';
        statusType = 'LOW';
      }

      return {
        no: idx + 1,
        itemCode: item.code || '-',
        itemNameKh: item.name_kh || '-',
        unit: item.unit || 'គ្រឿង',
        totalInboundA,
        activeInUseB,
        damagedAdjustedC,
        warehouseAvailableD,
        assignedHolders,
        purposeAndDate,
        statusBadge,
        statusType
      };
    });

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows
      .filter(
        (r) =>
          r.itemCode.toLowerCase().includes(q) ||
          r.itemNameKh.toLowerCase().includes(q) ||
          r.assignedHolders.toLowerCase().includes(q) ||
          r.purposeAndDate.toLowerCase().includes(q)
      )
      .map((r, i) => ({ ...r, no: i + 1 }));
  }, [dbItems, ctxItems, dbInventory, dbLocations, filteredTransactions, reportLocationId, matchesFilterLocation, searchQuery]);

  // =========================================================================
  // PART 2: ប្រភេទទី២៖ សម្ភារប្រើប្រាស់អស់ទៅ (សម្ភារបរិក្ខារ និងអនាម័យ - 10 ជួរឈរ)
  // =========================================================================
  const part2ConsumableRows: ConsumableRow[] = useMemo(() => {
    const rawItems = dbItems.length > 0 ? dbItems : ctxItems;
    const supplyItems = rawItems
      .filter((item) => !isNonConsumableEquipment(item))
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));

    const rows: ConsumableRow[] = supplyItems.map((item, idx) => {
      const itemIdStr = String(item.id);
      const itemCodeStr = String(item.code || '').toUpperCase();

      const itemInvAll = dbInventory.filter(
        (inv) =>
          String(inv.item_id) === itemIdStr ||
          String(inv.item_code || '').toUpperCase() === itemCodeStr
      );

      const itemTxs = filteredTransactions.filter(
        (tx) =>
          String(tx.item_id) === itemIdStr ||
          String(tx.item_code || '').toUpperCase() === itemCodeStr ||
          (tx.item_name_kh && tx.item_name_kh === item.name_kh)
      );

      // Remaining Stock Qty in Warehouse (C):
      let remainingStockC = 0;
      if (reportLocationId === 'ALL') {
        remainingStockC = itemInvAll
          .filter((inv) => isHqLocationOrRow(inv, dbLocations))
          .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
      } else {
        remainingStockC = itemInvAll
          .filter(
            (inv) =>
              matchesFilterLocation(inv.location_id, inv.location_name_kh) ||
              matchesFilterLocation(inv.location_code, inv.location_name_kh)
          )
          .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
      }

      // Total Issued / Consumed Qty (B):
      const branchIssuedQty =
        reportLocationId === 'ALL'
          ? itemInvAll
              .filter((inv) => !isHqLocationOrRow(inv, dbLocations))
              .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0)
          : 0;

      const consumedTxs = itemTxs.filter((tx) => {
        const tType = String(tx.type || '').toUpperCase();
        return tType === 'STOCK_OUT' || tType === 'HANDOVER';
      });
      const txConsumedQty = consumedTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

      const totalConsumedB = Math.max(branchIssuedQty, txConsumedQty);

      // Total Inbound Qty (A = B + C)
      const totalInboundA = remainingStockC + totalConsumedB;

      // Issued Branches / Recipients
      const recipientSet = new Set<string>();
      consumedTxs.forEach((tx) => {
        if (tx.to_location && String(tx.to_location).trim() && tx.to_location !== '-') {
          recipientSet.add(String(tx.to_location).trim().replace(/^សាខាពន្ធដារ/, ''));
        }
        if (tx.recorded_by && String(tx.recorded_by).trim()) {
          recipientSet.add(String(tx.recorded_by).trim());
        }
      });

      itemInvAll.forEach((inv) => {
        if (!isHqLocationOrRow(inv, dbLocations) && (Number(inv.quantity) || 0) > 0) {
          if (reportLocationId === 'ALL' || matchesFilterLocation(inv.location_id, inv.location_name_kh)) {
            const locLabel = String(inv.location_name_kh || inv.location_code || '')
              .replace(/^សាខាពន្ធដារ/, '')
              .trim();
            if (locLabel) recipientSet.add(`${locLabel} (${inv.quantity})`);
          }
        }
      });

      const issuedRecipients =
        recipientSet.size > 0
          ? Array.from(recipientSet).slice(0, 4).join(', ')
          : remainingStockC > 0
          ? 'រក្សាទុកនៅឃ្លាំងស្តុកកណ្តាល (HQ-ITSB)'
          : '-';

      // Purpose & Date
      const purposeEntries: string[] = [];
      consumedTxs.slice(0, 2).forEach((tx) => {
        const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
        const dStr = formatShortDate(tx.date || tx.created_at);
        if (cleaned && cleaned !== '-') {
          purposeEntries.push(dStr ? `${cleaned} (${dStr})` : cleaned);
        }
      });

      if (purposeEntries.length === 0 && itemTxs.length > 0) {
        itemTxs.slice(0, 1).forEach((tx) => {
          const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
          const dStr = formatShortDate(tx.date || tx.created_at);
          if (cleaned && cleaned !== '-') {
            purposeEntries.push(dStr ? `${cleaned} (${dStr})` : cleaned);
          }
        });
      }

      const purposeAndDate =
        purposeEntries.length > 0
          ? purposeEntries.join(' | ')
          : totalConsumedB > 0
          ? 'បើកផ្តល់ជូនសាខា និងអង្គភាពប្រើប្រាស់ប្រចាំថ្ងៃ'
          : 'ស្តុកបម្រុងសម្រាប់បើកផ្តល់ជូនសាខា និងអង្គភាព';

      // Stock Status Badge
      const minStock = Number(item.min_stock) || 20;
      let statusBadge = '🟢 ស្តុកគ្រប់គ្រាន់';
      let statusType: 'NORMAL' | 'LOW' | 'OUT' = 'NORMAL';
      if (remainingStockC <= 0) {
        statusBadge = '🔴 អស់ពីស្តុក';
        statusType = 'OUT';
      } else if (remainingStockC <= minStock) {
        statusBadge = '🟡 ស្តុកទាប';
        statusType = 'LOW';
      }

      return {
        no: idx + 1,
        itemCode: item.code || '-',
        itemNameKh: item.name_kh || '-',
        unit: item.unit || 'ដុំ',
        totalInboundA,
        totalConsumedB,
        remainingStockC,
        issuedRecipients,
        purposeAndDate,
        statusBadge,
        statusType
      };
    });

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows
      .filter(
        (r) =>
          r.itemCode.toLowerCase().includes(q) ||
          r.itemNameKh.toLowerCase().includes(q) ||
          r.issuedRecipients.toLowerCase().includes(q) ||
          r.purposeAndDate.toLowerCase().includes(q)
      )
      .map((r, i) => ({ ...r, no: i + 1 }));
  }, [dbItems, ctxItems, dbInventory, dbLocations, filteredTransactions, reportLocationId, matchesFilterLocation, searchQuery]);

  // =========================================================================
  // CROSS-TAB STOCK DISTRIBUTION MATRIX (34 LOCATIONS)
  // =========================================================================
  const matrixData = useMemo(() => {
    const rawItems = dbItems.length > 0 ? dbItems : ctxItems;
    const sortedItems = [...rawItems].sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
    );

    const q = searchQuery.toLowerCase().trim();
    const filteredItems = q
      ? sortedItems.filter(
          (item) =>
            String(item.code || '').toLowerCase().includes(q) ||
            String(item.name_kh || '').toLowerCase().includes(q) ||
            String(item.unit || '').toLowerCase().includes(q)
        )
      : sortedItems;

    const itemsToUse = filteredItems.length > 0 ? filteredItems : sortedItems;

    const rows: MatrixItemRow[] = itemsToUse.map((item, idx) => {
      const itemIdStr = String(item.id);
      const itemCodeStr = String(item.code || '').toUpperCase();
      const quantitiesByLocId: Record<string, number> = {};
      let rowTotal = 0;

      sortedLocations.forEach((loc) => {
        const matchingInv = dbInventory.filter((inv) => {
          const itemMatches =
            String(inv.item_id) === itemIdStr ||
            String(inv.item_code || '').toUpperCase() === itemCodeStr;
          if (!itemMatches) return false;

          return (
            matchesTargetLocation(loc, inv.location_id, inv.location_name_kh) ||
            matchesTargetLocation(loc, inv.location_code, inv.location_name_kh)
          );
        });

        const qty = matchingInv.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);
        quantitiesByLocId[loc.id] = qty;
        rowTotal += qty;
      });

      return {
        no: idx + 1,
        itemId: itemIdStr,
        itemCode: item.code || '-',
        itemNameKh: item.name_kh || '-',
        unit: item.unit || 'គ្រឿង',
        totalQty: rowTotal,
        quantitiesByLocId
      };
    });

    const columnTotalsByLocId: Record<string, number> = {};
    let grandTotalQty = 0;

    sortedLocations.forEach((loc) => {
      const colSum = rows.reduce((sum, r) => sum + (r.quantitiesByLocId[loc.id] || 0), 0);
      columnTotalsByLocId[loc.id] = colSum;
      grandTotalQty += colSum;
    });

    return {
      rows,
      columnTotalsByLocId,
      grandTotalQty
    };
  }, [dbItems, ctxItems, sortedLocations, dbInventory, matchesTargetLocation, searchQuery]);

  // =========================================================================
  // Totals for Part 1 & Part 2 Footers + Executive KPI Cards
  // =========================================================================
  const part1Totals = useMemo(() => {
    return {
      totalInboundA: part1NonConsumableRows.reduce((s, r) => s + r.totalInboundA, 0),
      activeInUseB: part1NonConsumableRows.reduce((s, r) => s + r.activeInUseB, 0),
      damagedAdjustedC: part1NonConsumableRows.reduce((s, r) => s + r.damagedAdjustedC, 0),
      warehouseAvailableD: part1NonConsumableRows.reduce((s, r) => s + r.warehouseAvailableD, 0)
    };
  }, [part1NonConsumableRows]);

  const part2Totals = useMemo(() => {
    return {
      totalInboundA: part2ConsumableRows.reduce((s, r) => s + r.totalInboundA, 0),
      totalConsumedB: part2ConsumableRows.reduce((s, r) => s + r.totalConsumedB, 0),
      remainingStockC: part2ConsumableRows.reduce((s, r) => s + r.remainingStockC, 0)
    };
  }, [part2ConsumableRows]);

  const kpiSummary = useMemo(() => {
    return {
      totalInbound: part1Totals.totalInboundA + part2Totals.totalInboundA,
      warehouseAvailable: part1Totals.warehouseAvailableD + part2Totals.remainingStockC,
      activeInUseAndIssued: part1Totals.activeInUseB + part2Totals.totalConsumedB,
      damagedAdjusted: part1Totals.damagedAdjustedC
    };
  }, [part1Totals, part2Totals]);

  // Trigger Official Landscape A4 Print
  const handlePrintLandscapeA4 = () => {
    window.print();
  };

  // =========================================================================
  // 2. EXPORT TO EXCEL (.xlsx) WITH SHEETS FOR PART 1, PART 2 & MATRIX
  // =========================================================================
  const exportToExcel = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const locationTitle = activeLocationObj?.name_kh || 'គ្រប់ទីតាំងស្តុកទាំងអស់';
    const dateRangeTitle =
      startDate || endDate
        ? `ចាប់ពី ${startDate || 'ដើមគ្រា'} ដល់ ${endDate || 'បច្ចុប្បន្ន'}`
        : `គិតត្រឹមថ្ងៃទី ${new Date().toLocaleDateString('km-KH')}`;

    const workbook = XLSX.utils.book_new();

    // -----------------------------------------------------------------------
    // SHEET 1: ឧបករណ៍បច្ចេកទេស (ប្រភេទទី១) - 11 ជួរឈរ
    // -----------------------------------------------------------------------
    const sheet1Data: any[][] = [
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន (ITSB)'],
      [],
      ['របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារប្រើប្រាស់មិនអស់ (ទ្រព្យសម្បត្តិឧបករណ៍បច្ចេកទេស)»'],
      [`កាលបរិច្ឆេទ៖ ${dateRangeTitle} | ទីតាំង៖ ${locationTitle}`],
      [],
      [
        'ល.រ',
        'កូដ',
        'ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស',
        'ឯកតា',
        'សរុបរួម (A=B+C+D)',
        'កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)',
        'ខូច / បាត់បង់ / កែតម្រូវ (C)',
        'ស្តុកនៅសល់ក្នុងឃ្លាំង (D)',
        'សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង',
        'គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ',
        'ស្ថានភាពស្តុក'
      ]
    ];

    part1NonConsumableRows.forEach((row) => {
      sheet1Data.push([
        row.no,
        row.itemCode,
        row.itemNameKh,
        row.unit,
        row.totalInboundA,
        row.activeInUseB,
        row.damagedAdjustedC,
        row.warehouseAvailableD,
        row.assignedHolders,
        row.purposeAndDate,
        row.statusBadge
      ]);
    });

    sheet1Data.push([
      '',
      '',
      'សរុបរួមឧបករណ៍បច្ចេកទេស (TOTAL PART 1)',
      '',
      part1Totals.totalInboundA,
      part1Totals.activeInUseB,
      part1Totals.damagedAdjustedC,
      part1Totals.warehouseAvailableD,
      '',
      '',
      ''
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
    ws1['!cols'] = [
      { wch: 7 },  // ល.រ
      { wch: 12 }, // កូដ
      { wch: 40 }, // ឈ្មោះឧបករណ៍
      { wch: 10 }, // ឯកតា
      { wch: 18 }, // សរុបរួម (A)
      { wch: 24 }, // កំពុងប្រើប្រាស់ (B)
      { wch: 22 }, // ខូច/កែតម្រូវ (C)
      { wch: 22 }, // ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
      { wch: 34 }, // សាខា/មន្ត្រីទទួលកាន់កាប់
      { wch: 42 }, // គោលបំណង និងកាលបរិច្ឆេទ
      { wch: 18 }  // ស្ថានភាពស្តុក
    ];
    XLSX.utils.book_append_sheet(workbook, ws1, 'ឧបករណ៍បច្ចេកទេស (ប្រភេទទី១)');

    // -----------------------------------------------------------------------
    // SHEET 2: សម្ភារប្រើប្រាស់អស់ទៅ (ប្រភេទទី២) - 10 ជួរឈរ
    // -----------------------------------------------------------------------
    const sheet2Data: any[][] = [
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន (ITSB)'],
      [],
      ['របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារប្រើប្រាស់អស់ទៅ (សម្ភារបរិក្ខារ និងអនាម័យ)»'],
      [`កាលបរិច្ឆេទ៖ ${dateRangeTitle} | ទីតាំង៖ ${locationTitle}`],
      [],
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

    part2ConsumableRows.forEach((row) => {
      sheet2Data.push([
        row.no,
        row.itemCode,
        row.itemNameKh,
        row.unit,
        row.totalInboundA,
        row.totalConsumedB,
        row.remainingStockC,
        row.issuedRecipients,
        row.purposeAndDate,
        row.statusBadge
      ]);
    });

    sheet2Data.push([
      '',
      '',
      'សរុបរួមសម្ភារប្រើប្រាស់អស់ទៅ (TOTAL PART 2)',
      '',
      part2Totals.totalInboundA,
      part2Totals.totalConsumedB,
      part2Totals.remainingStockC,
      '',
      '',
      ''
    ]);

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [
      { wch: 7 },  // ល.រ
      { wch: 12 }, // កូដ
      { wch: 36 }, // ឈ្មោះសម្ភារប្រើប្រាស់អស់ទៅ
      { wch: 10 }, // ឯកតា
      { wch: 18 }, // សរុបរួមនាំចូល (A)
      { wch: 26 }, // បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
      { wch: 24 }, // ស្តុកនៅសល់ក្នុងឃ្លាំង (C = A - B)
      { wch: 34 }, // សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់
      { wch: 42 }, // គោលបំណង និងកាលបរិច្ឆេទបើកបែក
      { wch: 18 }  // ស្ថានភាពស្តុក
    ];
    XLSX.utils.book_append_sheet(workbook, ws2, 'សម្ភារប្រើប្រាស់អស់ទៅ (ប្រភេទទី២)');

    // -----------------------------------------------------------------------
    // SHEET 3: តារាងម៉ាទ្រីសគ្រប់ទីតាំង (34 ទីតាំង)
    // -----------------------------------------------------------------------
    const matrixHeaders = [
      'ល.រ',
      'លេខកូដ',
      'ឈ្មោះឧបករណ៍ / សម្ភារ',
      'ឯកតា',
      'សរុប',
      ...sortedLocations.map((loc) => loc.shortLabel)
    ];

    const sheetMatrixData: any[][] = [
      ['តារាងបូកសរុបស្តុកតាមបណ្តាទីតាំង (ថ្នាក់កណ្តាល និង ៣៣ សាខា)'],
      [`កាលបរិច្ឆេទ៖ ${dateRangeTitle}`],
      [],
      matrixHeaders
    ];

    matrixData.rows.forEach((row) => {
      sheetMatrixData.push([
        row.no,
        row.itemCode,
        row.itemNameKh,
        row.unit,
        row.totalQty,
        ...sortedLocations.map((loc) => row.quantitiesByLocId[loc.id] ?? 0)
      ]);
    });

    sheetMatrixData.push([
      '',
      '',
      'សរុបរួមតាមទីតាំង (GRAND TOTAL)',
      '',
      matrixData.grandTotalQty,
      ...sortedLocations.map((loc) => matrixData.columnTotalsByLocId[loc.id] ?? 0)
    ]);

    const wsMatrix = XLSX.utils.aoa_to_sheet(sheetMatrixData);
    wsMatrix['!cols'] = [
      { wch: 6 },
      { wch: 11 },
      { wch: 38 },
      { wch: 9 },
      { wch: 10 },
      ...sortedLocations.map(() => ({ wch: 12 }))
    ];
    XLSX.utils.book_append_sheet(workbook, wsMatrix, 'តារាងម៉ាទ្រីសគ្រប់ទីតាំង');

    const fileName = `GDT_Inventory_Executive_Report_${todayStr}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const formattedCurrentDateKh = new Date().toLocaleDateString('km-KH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-5 font-siemreap executive-report-wrapper">
      {/* ===================================================================== */}
      {/* SCREEN UI CONTROLS & ACTION BAR (Hidden during @media print)          */}
      {/* ===================================================================== */}
      <div className="no-print space-y-4">
        {/* Top Action Header */}
        <div className="bg-white rounded-2xl p-5 border border-[#CDE5DA] shadow-xs flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-[#004D40] text-[#A3D8C2] shadow-xs shrink-0">
              <FileBarChart2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className="text-lg sm:text-xl font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  {language === 'kh'
                    ? 'របាយការណ៍សង្ខេបស្តុក (Executive Consolidated Report)'
                    : 'Executive Consolidated Inventory Report'}
                </h2>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#004D40] border border-emerald-300">
                  Read-Only • A4 Landscape
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                បែងចែកជា ២ ផ្នែកដាច់ពីគ្នា៖ ប្រភេទទី១ (ឧបករណ៍បច្ចេកទេស/ប្រើប្រាស់មិនអស់) និងប្រភេទទី២ (សម្ភារប្រើប្រាស់អស់ទៅ) រួមជាមួយតារាងម៉ាទ្រីស ៣៤ ទីតាំង
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={fetchReportData}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
              title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យពី Supabase"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-teal-700' : 'text-teal-700'} />
              <span>ផ្ទុកឡើងវិញ</span>
            </button>

            <button
              type="button"
              onClick={handlePrintLandscapeA4}
              className="px-4 py-2.5 rounded-xl bg-[#004D40] hover:bg-[#03291E] text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Printer size={16} />
              <span>🖨️ បោះពុម្ពរបាយការណ៍ A4</span>
            </button>

            <button
              type="button"
              onClick={exportToExcel}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>📥 ទាញយកជា Excel (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Filter Bar & Report View Mode Tabs */}
        <div className="bg-white rounded-2xl p-4 border border-[#CDE5DA] shadow-2xs space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 items-end">
            {/* Location Dropdown Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E6047] uppercase mb-1.5 flex items-center gap-1.5">
                <MapPin size={13} />
                <span>ជ្រើសរើសទីតាំង/សាខា (Location Filter)</span>
              </label>
              {isBranchUser ? (
                <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 truncate">
                  {formatLocationOption(selectedLocation)}
                </div>
              ) : (
                <select
                  value={reportLocationId}
                  onChange={(e) => setReportLocationId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7FCFA] border border-[#BDE0D0] rounded-xl text-xs font-bold text-[#03291E] outline-none focus:ring-2 focus:ring-[#004D40]/20 cursor-pointer"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {formatLocationOption(loc)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E6047] uppercase mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} />
                <span>ចាប់ពីថ្ងៃទី (Start Date)</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7FCFA] border border-[#BDE0D0] rounded-xl text-xs font-semibold text-[#03291E] outline-none focus:ring-2 focus:ring-[#004D40]/20"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-[#1E6047] uppercase mb-1.5 flex items-center gap-1.5">
                <Calendar size={13} />
                <span>ដល់ថ្ងៃទី (End Date)</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#F7FCFA] border border-[#BDE0D0] rounded-xl text-xs font-semibold text-[#03291E] outline-none focus:ring-2 focus:ring-[#004D40]/20"
              />
            </div>

            {/* Search Input */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-[#1E6047] uppercase mb-1.5 flex items-center gap-1.5">
                  <Search size={13} />
                  <span>ស្វែងរកសម្ភារ / កូដ / សាខា / មន្ត្រី</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="វាយកូដ T-001, S-001, ឈ្មោះសម្ភារ, សាខា..."
                  className="w-full px-3 py-2 bg-[#F7FCFA] border border-[#BDE0D0] rounded-xl text-xs font-medium text-[#03291E] outline-none focus:ring-2 focus:ring-[#004D40]/20"
                />
              </div>
              {(startDate || endDate || searchQuery || (reportLocationId !== 'ALL' && !isBranchUser)) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                    if (!isBranchUser) setReportLocationId('ALL');
                  }}
                  className="mt-5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition cursor-pointer shrink-0"
                >
                  សម្អាត
                </button>
              )}
            </div>
          </div>

          {/* Section Switcher Tabs */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-600">ជ្រើសរើសផ្នែកនៃរបាយការណ៍៖</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveReportTab('CONSOLIDATED')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'CONSOLIDATED'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers size={15} />
                <span>បង្ហាញរបាយការណ៍សង្ខេបទាំង ២ ផ្នែក (ផ្នែកទី១ + ផ្នែកទី២)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('PART_1')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'PART_1'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Wrench size={15} />
                <span>ផ្នែកទី ១៖ សម្ភារប្រើប្រាស់មិនអស់ ({part1NonConsumableRows.length} មុខ)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('PART_2')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'PART_2'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <PackageOpen size={15} />
                <span>ផ្នែកទី ២៖ សម្ភារប្រើប្រាស់អស់ទៅ ({part2ConsumableRows.length} មុខ)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('MATRIX')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'MATRIX'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Grid3X3 size={15} />
                <span>តារាងម៉ាទ្រីសគ្រប់ទីតាំង ({sortedLocations.length} ទីតាំង)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* OFFICIAL LANDSCAPE A4 REPORT CONTAINER (Screen Preview & Print Ready) */}
      {/* ===================================================================== */}
      <div className="print-container a4-print-sheet bg-white rounded-2xl border border-[#CDE5DA] shadow-sm p-4 sm:p-6 lg:p-8 text-[#03291E] space-y-6">
        {/* ----------------------------------------------------------------- */}
        {/* OFFICIAL ADMINISTRATIVE HEADER (ក្បាលទំព័ររបាយការណ៍រដ្ឋបាលផ្លូវការ)    */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex flex-row justify-between items-start gap-4 pb-3 border-b-2 border-[#03291E]">
          {/* Left Side: Ministry, GDT, ITSB */}
          <div className="text-left space-y-0.5">
            <p
              className="text-xs sm:text-sm font-bold text-[#03291E]"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ
            </p>
            <p
              className="text-xs sm:text-sm font-bold text-[#03291E]"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              អគ្គនាយកដ្ឋានពន្ធដារ
            </p>
            <p
              className="text-[11px] sm:text-xs font-bold text-[#004D40]"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន (ITSB)
            </p>
            <p className="text-[10px] font-semibold text-slate-600">
              លេខ៖ ........................... អពដ/នបព
            </p>
          </div>

          {/* Center Title */}
          <div className="text-center space-y-1 flex-1 px-2">
            <h1
              className="text-sm sm:text-base lg:text-lg font-bold text-[#03291E] leading-relaxed"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              {activeReportTab === 'MATRIX'
                ? 'តារាងបូកសរុបស្តុកតាមបណ្តាទីតាំង (ថ្នាក់កណ្តាល និង ៣៣ សាខា)'
                : 'របាយការណ៍សង្ខេបតុល្យភាពស្តុកសម្ភារបច្ចេកវិទ្យាព័ត៌មាន និងសម្ភារបរិក្ខារ'}
            </h1>
            <p className="text-[11px] font-bold text-[#004D40] bg-[#EBF4F0] border border-[#BDE0D0] inline-block px-3 py-0.5 rounded-full">
              គ្របដណ្តប់ទីតាំងថ្នាក់កណ្តាល (១) និងសាខាពន្ធដារខេត្ត-ខណ្ឌ (៣៣)
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-0.5 text-[11px] font-bold text-slate-700">
              <span>
                ទីតាំង៖ <strong className="text-[#03291E]">{activeLocationObj?.name_kh}</strong>
              </span>
              <span>|</span>
              <span>
                កាលបរិច្ឆេទ៖{' '}
                <strong className="text-[#03291E]">
                  {startDate || endDate
                    ? `ចាប់ពី ${startDate || 'ដើមគ្រា'} ដល់ ${endDate || 'បច្ចុប្បន្ន'}`
                    : `គិតត្រឹមថ្ងៃទី ${formattedCurrentDateKh}`}
                </strong>
              </span>
            </div>
          </div>

          {/* Right Side: Kingdom of Cambodia Motto */}
          <div className="text-center space-y-0.5 shrink-0">
            <p
              className="text-xs sm:text-sm font-bold text-[#03291E]"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              ព្រះរាជាណាចក្រកម្ពុជា
            </p>
            <p
              className="text-xs sm:text-sm font-bold text-[#03291E]"
              style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
            >
              ជាតិ សាសនា ព្រះមហាក្សត្រ
            </p>
            <div className="text-center text-xs font-bold text-[#03291E] tracking-widest">
              ✦✦✦
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* EXECUTIVE KPI SUMMARY CARDS                                       */}
        {/* ----------------------------------------------------------------- */}
        <div className={`grid grid-cols-4 gap-3 ${activeReportTab === 'MATRIX' ? 'no-print' : ''}`}>
          <div className="rounded-xl p-3 bg-[#F2F9F6] border border-[#004D40]/25 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#004D40]">សម្ភារសរុបរួមនាំចូល (A)</p>
              <p className="text-[10px] text-slate-500">Total Inbound Qty</p>
              <p className="text-xl font-black text-[#03291E] mt-0.5">
                {kpiSummary.totalInbound.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#004D40] text-white flex items-center justify-center shrink-0">
              <ArrowDownToLine size={18} />
            </div>
          </div>

          <div className="rounded-xl p-3 bg-blue-50/70 border border-blue-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-900">កំពុងប្រើប្រាស់ និងបានបើកផ្តល់ (B)</p>
              <p className="text-[10px] text-blue-700">Active In-Use & Issued Qty</p>
              <p className="text-xl font-black text-blue-800 mt-0.5">
                {kpiSummary.activeInUseAndIssued.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <UserCheck size={18} />
            </div>
          </div>

          <div className="rounded-xl p-3 bg-amber-50/70 border border-amber-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-900">ខូច / បាត់បង់ / កែតម្រូវ (C)</p>
              <p className="text-[10px] text-amber-700">Damaged / Adjusted Qty</p>
              <p className="text-xl font-black text-amber-800 mt-0.5">
                {kpiSummary.damagedAdjusted.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} />
            </div>
          </div>

          <div className="rounded-xl p-3 bg-emerald-50/70 border border-emerald-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-900">ស្តុកនៅសល់ក្នុងឃ្លាំង (D)</p>
              <p className="text-[10px] text-emerald-700">Warehouse Available Qty</p>
              <p className="text-xl font-black text-emerald-800 mt-0.5">
                {kpiSummary.warehouseAvailable.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <PackageCheck size={18} />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* PART 1: ប្រភេទទី១៖ សម្ភារប្រើប្រាស់មិនអស់ (ទ្រព្យសម្បត្តិឧបករណ៍បច្ចេកទេស) */}
        {/* ================================================================= */}
        {(activeReportTab === 'CONSOLIDATED' || activeReportTab === 'PART_1') && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-l-4 border-[#004D40] pl-3 py-1.5 bg-[#E8F4EE] rounded-r-lg">
              <div>
                <h2
                  className="text-xs sm:text-sm font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  ផ្នែកទី ១៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី១៖ សម្ភារប្រើប្រាស់មិនអស់ (ទ្រព្យសម្បត្តិឧបករណ៍បច្ចេកទេស)»
                </h2>
                <p className="text-[11px] text-slate-600">
                  រូបមន្តតុល្យភាព៖ សរុបរួម (A) = កំពុងប្រើប្រាស់/បានប្រគល់ជូន (B) + ខូច/បាត់បង់/កែតម្រូវ (C) + ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#004D40] px-2.5 py-1 bg-white rounded-md border border-[#CDE5DA] mr-2 shrink-0">
                សរុប {part1NonConsumableRows.length} មុខ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-[#004D40] text-white">
                    <th className="border border-slate-400 py-2 px-1.5 text-center w-9">ល.រ</th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-16">កូដ</th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[175px]">
                      ឈ្មោះឧបករណ៍ / សម្ភារបច្ចេកទេស
                    </th>
                    <th className="border border-slate-400 py-2 px-1.5 text-center w-14">ឯកតា</th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-24 bg-[#00382E]">
                      សរុបរួម
                      <span className="block text-[9.5px] font-normal text-emerald-200">(A=B+C+D)</span>
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-28">
                      កំពុងប្រើប្រាស់ / បានប្រគល់ជូន (B)
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-24">
                      ខូច / បាត់បង់ / កែតម្រូវ (C)
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-26 bg-emerald-900">
                      ស្តុកនៅសល់ក្នុងឃ្លាំង (D)
                    </th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[155px]">
                      សាខា ឬមន្ត្រីទទួលកាន់កាប់ជាក់ស្តែង
                    </th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[175px]">
                      គោលបំណងប្រើប្រាស់ និងកាលបរិច្ឆេទ
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-28">
                      ស្ថានភាពស្តុក
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500 font-semibold">
                        កំពុងទាញយកទិន្នន័យឧបករណ៍បច្ចេកទេស (ប្រភេទទី១)...
                      </td>
                    </tr>
                  ) : part1NonConsumableRows.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-slate-500 font-semibold">
                        មិនមានទិន្នន័យឧបករណ៍បច្ចេកទេសត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                      </td>
                    </tr>
                  ) : (
                    part1NonConsumableRows.map((row) => (
                      <tr
                        key={row.itemCode}
                        className="odd:bg-white even:bg-slate-50/70 hover:bg-emerald-50/40 transition-colors"
                      >
                        <td className="border border-slate-300 py-1.5 px-1.5 text-center font-bold text-slate-700">
                          {row.no}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-mono font-bold text-[#004D40]">
                          {row.itemCode}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 font-bold text-slate-900">
                          {row.itemNameKh}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-1.5 text-center text-slate-700">
                          {row.unit}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-[#03291E] bg-slate-100/80">
                          {row.totalInboundA.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-blue-800 bg-blue-50/40">
                          {row.activeInUseB.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-bold text-amber-800 bg-amber-50/30">
                          {row.damagedAdjustedC.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-emerald-800 bg-emerald-50/60">
                          {row.warehouseAvailableD.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-slate-800 font-medium leading-snug">
                          {row.assignedHolders}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-slate-700 leading-snug">
                          {row.purposeAndDate}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              row.statusType === 'NORMAL'
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : row.statusType === 'LOW'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-rose-50 text-rose-900 border-rose-300'
                            }`}
                          >
                            {row.statusBadge}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {part1NonConsumableRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#D6EDE2] font-black text-[#03291E]">
                      <td colSpan={4} className="border border-slate-400 py-2 px-3 text-right">
                        សរុបរួមផ្នែកទី ១ (ឧបករណ៍បច្ចេកទេស)៖
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-[#03291E]">
                        {part1Totals.totalInboundA.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-blue-900">
                        {part1Totals.activeInUseB.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-amber-900">
                        {part1Totals.damagedAdjustedC.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-emerald-900">
                        {part1Totals.warehouseAvailableD.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-slate-400 py-2 px-2.5 text-left text-[10.5px] font-bold text-[#004D40]">
                        ឧបករណ៍បច្ចេកទេសសរុប {part1NonConsumableRows.length} មុខ
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* PART 2: ប្រភេទទី២៖ សម្ភារប្រើប្រាស់អស់ទៅ (សម្ភារបរិក្ខារ និងអនាម័យ)   */}
        {/* ================================================================= */}
        {(activeReportTab === 'CONSOLIDATED' || activeReportTab === 'PART_2') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-l-4 border-teal-700 pl-3 py-1.5 bg-[#EBF7F4] rounded-r-lg">
              <div>
                <h2
                  className="text-xs sm:text-sm font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  ផ្នែកទី ២៖ របាយការណ៍តុល្យភាពស្តុក «ប្រភេទទី២៖ សម្ភារប្រើប្រាស់អស់ទៅ (សម្ភារបរិក្ខារ និងអនាម័យ)»
                </h2>
                <p className="text-[11px] text-slate-600">
                  រូបមន្តតុល្យភាព៖ ស្តុកនៅសល់ក្នុងឃ្លាំង (C) = សរុបរួមនាំចូល (A) - បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
                </p>
              </div>
              <span className="text-[11px] font-bold text-teal-800 px-2.5 py-1 bg-white rounded-md border border-teal-200 mr-2 shrink-0">
                សរុប {part2ConsumableRows.length} មុខ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-400 text-[11px]">
                <thead>
                  <tr className="bg-[#0F5246] text-white">
                    <th className="border border-slate-400 py-2 px-1.5 text-center w-9">ល.រ</th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-16">កូដ</th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[180px]">
                      ឈ្មោះសម្ភារប្រើប្រាស់អស់ទៅ
                    </th>
                    <th className="border border-slate-400 py-2 px-1.5 text-center w-14">ឯកតា</th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-28 bg-[#093B32]">
                      សរុបរួមនាំចូល (A)
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-32">
                      បានបើកផ្តល់ និងប្រើប្រាស់សរុប (B)
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-32 bg-emerald-900">
                      ស្តុកនៅសល់ក្នុងឃ្លាំង
                      <span className="block text-[9.5px] font-normal text-emerald-200">(C = A - B)</span>
                    </th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[170px]">
                      សាខា ឬអង្គភាពបានបើកយកទៅប្រើប្រាស់
                    </th>
                    <th className="border border-slate-400 py-2 px-2.5 text-left min-w-[185px]">
                      គោលបំណង និងកាលបរិច្ឆេទបើកបែក
                    </th>
                    <th className="border border-slate-400 py-2 px-2 text-center w-28">
                      ស្ថានភាពស្តុក
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-semibold">
                        កំពុងទាញយកទិន្នន័យសម្ភារប្រើប្រាស់អស់ទៅ (ប្រភេទទី២)...
                      </td>
                    </tr>
                  ) : part2ConsumableRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-semibold">
                        មិនមានទិន្នន័យសម្ភារប្រើប្រាស់អស់ទៅត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                      </td>
                    </tr>
                  ) : (
                    part2ConsumableRows.map((row) => (
                      <tr
                        key={row.itemCode}
                        className="odd:bg-white even:bg-slate-50/70 hover:bg-emerald-50/40 transition-colors"
                      >
                        <td className="border border-slate-300 py-1.5 px-1.5 text-center font-bold text-slate-700">
                          {row.no}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-mono font-bold text-teal-800">
                          {row.itemCode}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 font-bold text-slate-900">
                          {row.itemNameKh}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-1.5 text-center text-slate-700">
                          {row.unit}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-[#03291E] bg-slate-100/80">
                          {row.totalInboundA.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-blue-800 bg-blue-50/40">
                          {row.totalConsumedB.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-black text-emerald-800 bg-emerald-50/60">
                          {row.remainingStockC.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-slate-800 font-medium leading-snug">
                          {row.issuedRecipients}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-slate-700 leading-snug">
                          {row.purposeAndDate}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              row.statusType === 'NORMAL'
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                : row.statusType === 'LOW'
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-rose-50 text-rose-900 border-rose-300'
                            }`}
                          >
                            {row.statusBadge}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {part2ConsumableRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#D6EDE2] font-black text-[#03291E]">
                      <td colSpan={4} className="border border-slate-400 py-2 px-3 text-right">
                        សរុបរួមផ្នែកទី ២ (សម្ភារប្រើប្រាស់អស់ទៅ)៖
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-[#03291E]">
                        {part2Totals.totalInboundA.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-blue-900">
                        {part2Totals.totalConsumedB.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 py-2 px-2 text-center text-emerald-900">
                        {part2Totals.remainingStockC.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-slate-400 py-2 px-2.5 text-left text-[10.5px] font-bold text-[#004D40]">
                        សម្ភារប្រើប្រាស់អស់ទៅសរុប {part2ConsumableRows.length} មុខ
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: CROSS-TAB STOCK DISTRIBUTION MATRIX (39 COLUMNS)           */}
        {/* ================================================================= */}
        {activeReportTab === 'MATRIX' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between border-l-4 border-[#004D40] pl-3 py-1 bg-[#F4F9F6] rounded-r-lg no-print">
              <div>
                <h2
                  className="text-xs sm:text-sm font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  តារាងម៉ាទ្រីសបែងចែកស្តុកតាមបណ្តាទីតាំងទាំងអស់ (Cross-Tab Stock Distribution Matrix)
                </h2>
                <p className="text-[11px] text-slate-600">
                  បង្ហាញបរិមាណសម្ភារនីមួយៗតាមជួរឈរទីតាំងស្តុកទាំង {sortedLocations.length} (ថ្នាក់កណ្តាល → សាខាខណ្ឌ → សាខាខេត្ត)
                </p>
              </div>
              <div className="flex items-center gap-2 pr-2 text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                  ថ្នាក់កណ្តាល
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300">
                  សាខាខណ្ឌ
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                  សាខាខេត្ត
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="matrix-table w-full border-collapse border border-slate-800 text-[10px] leading-tight">
                <thead>
                  <tr className="bg-[#E8F4EE] text-[#03291E] h-[126px]">
                    <th className="border border-slate-700 px-1 py-2 text-center font-bold w-[26px] align-middle bg-[#D6EDE2]">
                      ល.រ
                    </th>
                    <th className="border border-slate-700 px-1 py-2 text-center font-bold w-[46px] align-middle bg-[#D6EDE2]">
                      លេខកូដ
                    </th>
                    <th className="border border-slate-700 px-2 py-2 text-left font-bold min-w-[165px] w-[185px] align-middle bg-[#D6EDE2]">
                      ឈ្មោះឧបករណ៍ / សម្ភារ
                    </th>
                    <th className="border border-slate-700 px-1 py-2 text-center font-bold w-[36px] align-middle bg-[#D6EDE2]">
                      ឯកតា
                    </th>
                    <th className="border border-slate-700 px-1 py-2 text-center font-black w-[42px] align-middle bg-[#BCE3D0] text-[#00382B]">
                      សរុប
                    </th>

                    {sortedLocations.map((loc) => {
                      const headerBg =
                        loc.category === 'HQ'
                          ? 'bg-emerald-200/90 text-[#03291E]'
                          : loc.category === 'KHAN'
                          ? 'bg-sky-100/80 text-slate-900'
                          : 'bg-slate-100 text-slate-900';

                      return (
                        <th
                          key={loc.id}
                          title={loc.nameKh}
                          className={`border border-slate-700 p-0 w-[24px] min-w-[23px] max-w-[26px] h-[126px] align-bottom relative overflow-hidden ${headerBg}`}
                        >
                          <div className="w-full h-full flex items-end justify-center pb-1.5">
                            <span
                              className="block whitespace-nowrap font-bold text-[9.5px] tracking-tight leading-none select-none"
                              style={{
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg) skewY(-12deg)',
                                maxHeight: '116px'
                              }}
                            >
                              {loc.shortLabel}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5 + sortedLocations.length}
                        className="py-10 text-center text-slate-500 font-semibold text-xs"
                      >
                        កំពុងទាញយកទិន្នន័យម៉ាទ្រីសស្តុកពី Supabase Database...
                      </td>
                    </tr>
                  ) : (
                    matrixData.rows.map((row) => (
                      <tr
                        key={row.itemId}
                        className="odd:bg-white even:bg-slate-50/70 hover:bg-emerald-50/50 transition-colors"
                      >
                        <td className="border border-slate-600 py-1 px-1 text-center font-bold text-slate-700">
                          {row.no}
                        </td>
                        <td className="border border-slate-600 py-1 px-1 text-center font-mono font-bold text-[#004D40]">
                          {row.itemCode}
                        </td>
                        <td
                          className="border border-slate-600 py-1 px-1.5 font-bold text-slate-900 truncate max-w-[185px]"
                          title={row.itemNameKh}
                        >
                          {row.itemNameKh}
                        </td>
                        <td className="border border-slate-600 py-1 px-1 text-center font-medium text-slate-700">
                          {row.unit}
                        </td>
                        <td className="border border-slate-600 py-1 px-1 text-center font-black bg-[#DDF2E8] text-[#00382B]">
                          {row.totalQty}
                        </td>

                        {sortedLocations.map((loc) => {
                          const qty = row.quantitiesByLocId[loc.id] ?? 0;
                          const isHq = loc.category === 'HQ';
                          return (
                            <td
                              key={loc.id}
                              title={`${row.itemNameKh} — ${loc.nameKh}: ${qty} ${row.unit}`}
                              className={`border border-slate-600 py-1 px-0.5 text-center ${
                                qty > 0
                                  ? isHq
                                    ? 'bg-emerald-50/90 font-black text-[#004D40]'
                                    : 'bg-teal-50/60 font-bold text-slate-950'
                                  : 'text-slate-400 font-normal'
                              }`}
                            >
                              {qty}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>

                {matrixData.rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#CDE8DC] text-[#03291E] font-black">
                      <td colSpan={4} className="border border-slate-700 py-1.5 px-2 text-right">
                        សរុបរួមតាមទីតាំង (TOTAL)៖
                      </td>
                      <td className="border border-slate-700 py-1.5 px-1 text-center bg-[#A3D8C2] text-[#03291E]">
                        {matrixData.grandTotalQty}
                      </td>
                      {sortedLocations.map((loc) => {
                        const colTotal = matrixData.columnTotalsByLocId[loc.id] ?? 0;
                        return (
                          <td
                            key={loc.id}
                            className={`border border-slate-700 py-1.5 px-0.5 text-center ${
                              colTotal > 0 ? 'text-[#03291E] font-black' : 'text-slate-400 font-normal'
                            }`}
                          >
                            {colTotal}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* SIGNATURES & ENDORSEMENT BLOCK (ផ្នែកកន្ទុយទំព័រហត្ថលេខា ៣ ផ្នែក)    */}
        {/* ----------------------------------------------------------------- */}
        <div className="pt-4 mt-4 border-t border-slate-200">
          <div className="flex justify-end mb-3 text-[11px] font-semibold text-slate-800">
            <div className="text-center">
              <p>ថ្ងៃ..........................ខែ.............ឆ្នាំ..........ព.ស.២៥៦...</p>
              <p className="mt-0.5">រាជធានីភ្នំពេញ, ថ្ងៃទី.........ខែ..............ឆ្នាំ២០២...</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center text-xs mt-1">
            {/* Left: Prepared By (រៀបចំដោយ - មន្ត្រីគ្រប់គ្រងស្តុក) */}
            <div className="space-y-12">
              <div>
                <p
                  className="font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  រៀបចំដោយ
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  មន្ត្រីគ្រប់គ្រងស្តុក ({userDisplayName || 'មន្ត្រីជំនាញ ITSB'})
                </p>
              </div>
              <div className="border-t border-dotted border-slate-400 w-40 mx-auto pt-1 text-[10px] text-slate-500">
                ហត្ថលេខា និងឈ្មោះ
              </div>
            </div>

            {/* Center: Checked By (បានឃើញ និងពិនិត្យត្រឹមត្រូវ - ប្រធានការិយាល័យ) */}
            <div className="space-y-12">
              <div>
                <p
                  className="font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  បានឃើញ និងពិនិត្យត្រឹមត្រូវ
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  ប្រធានការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន
                </p>
              </div>
              <div className="border-t border-dotted border-slate-400 w-40 mx-auto pt-1 text-[10px] text-slate-500">
                ហត្ថលេខា និងឈ្មោះ
              </div>
            </div>

            {/* Right: Approved By (បានឃើញ និងឯកភាព - ថ្នាក់ដឹកនាំអគ្គនាយកដ្ឋាន) */}
            <div className="space-y-12">
              <div>
                <p
                  className="font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  បានឃើញ និងឯកភាព
                </p>
                <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  ថ្នាក់ដឹកនាំអគ្គនាយកដ្ឋានពន្ធដារ
                </p>
              </div>
              <div className="border-t border-dotted border-slate-400 w-40 mx-auto pt-1 text-[10px] text-slate-500">
                ហត្ថលេខា និងត្រា
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
