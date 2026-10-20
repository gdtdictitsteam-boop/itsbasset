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
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  ListChecks,
  Grid3X3
} from 'lucide-react';

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

interface LocationBalanceRow {
  no: number;
  locationId: string;
  locationCode: string;
  locationNameKh: string;
  locationCategory: 'HQ' | 'KHAN' | 'PROVINCE';
  locationCategoryLabel: string;
  skuCount: number;
  totalItems: number;
  inStock: number;
  inUseQty: number;
  statusLabel: string;
  statusType: 'ACTIVE' | 'EMPTY' | 'STANDBY';
}

interface ItemDetailRow {
  no: number;
  itemCode: string;
  itemNameKh: string;
  unit: string;
  inStock: number;
  inUseQty: number;
  assignedOfficersOrBranches: string;
  usagePurpose: string;
  statusLabel: string;
  statusType: 'NORMAL' | 'LOW' | 'OUT';
  minStock: number;
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
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Tab States
  // Default to 'MATRIX' so the new Cross-Tab Stock Distribution Matrix is prominently shown
  const [activeReportTab, setActiveReportTab] = useState<'MATRIX' | 'PART_A' | 'PART_B' | 'ALL'>('MATRIX');
  const [reportLocationId, setReportLocationId] = useState<string>(
    isBranchUser ? selectedLocationId : (selectedLocationId || 'ALL')
  );
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sync location if Sidebar location changes or if BranchUser is locked
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
      setDbTransactions(ctxTransactions);
      setLoading(false);
      return;
    }

    try {
      const [itemsRes, locsRes, invRes, txRes] = await Promise.all([
        supabase.from('items').select('id, code, name_kh, name_en, category, unit, min_stock').order('code', { ascending: true }),
        supabase.from('locations').select('id, code, name_kh, name_en, type'),
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
      setDbTransactions(txRes.data && txRes.data.length > 0 ? txRes.data : ctxTransactions);
    } catch (err) {
      console.error('Error fetching read-only executive report data:', err);
      setDbItems(ctxItems);
      setDbLocations(locations.length > 0 ? locations : mockLocations);
      setDbInventory(ctxInventory);
      setDbTransactions(ctxTransactions);
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

  // =========================================================================
  // 1. SORTED LOCATIONS (1. HQ/Central -> 2. Khan Branches -> 3. Province Branches)
  // =========================================================================
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

  // Helper to check if an inventory record belongs to a specific location
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

  // =========================================================================
  // 2. CROSS-TAB STOCK DISTRIBUTION MATRIX (inventoryMap[item_id][location_id] = quantity)
  // =========================================================================
  const matrixData = useMemo(() => {
    const rawItems = dbItems.length > 0 ? dbItems : ctxItems;
    const sortedItems = [...rawItems].sort((a, b) =>
      String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true })
    );

    // Filter items by search query if user searches for an item code or name
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

    // Build Pivot Map: inventoryMap[itemKey][locationId] = quantity
    const rows: MatrixItemRow[] = itemsToUse.map((item, idx) => {
      const itemIdStr = String(item.id);
      const itemCodeStr = String(item.code || '').toUpperCase();
      const quantitiesByLocId: Record<string, number> = {};
      let rowTotal = 0;

      sortedLocations.forEach((loc) => {
        // Find matching inventory records for (item, loc)
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

    // Column totals per location + Grand Total
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

  // Active selected location object for filtered views
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

  // Filter transactions by Date Range
  const dateFilteredTransactions = useMemo(() => {
    return dbTransactions.filter((tx) => {
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
  }, [dbTransactions, startDate, endDate]);

  // =========================================================================
  // PART A: Stock Balance by Locations (តារាងតុល្យភាពស្តុកតាមបណ្តាទីតាំងទាំងអស់)
  // =========================================================================
  const locationBalanceRows: LocationBalanceRow[] = useMemo(() => {
    const locsToDisplay =
      reportLocationId === 'ALL'
        ? sortedLocations
        : sortedLocations.filter(
            (l) =>
              String(l.id) === String(reportLocationId) ||
              String(l.code).toUpperCase() === String(reportLocationId).toUpperCase()
          );

    const rows = locsToDisplay.map((loc, idx) => {
      let locationCategoryLabel = 'សាខាពន្ធដារខេត្ត';
      if (loc.category === 'HQ') {
        locationCategoryLabel =
          loc.shortLabel === 'ថ្នាក់កណ្តាល' ? 'ឃ្លាំងស្តុកកណ្តាល (HQ-ITSB)' : 'ក្រុមការងារថ្នាក់កណ្តាល';
      } else if (loc.category === 'KHAN') {
        locationCategoryLabel = 'សាខាពន្ធដារខណ្ឌ';
      }

      const locInv = dbInventory.filter(
        (inv) =>
          matchesTargetLocation(loc, inv.location_id, inv.location_name_kh) ||
          matchesTargetLocation(loc, inv.location_code, inv.location_name_kh)
      );

      const skuSet = new Set<string>();
      locInv.forEach((inv) => {
        if ((Number(inv.quantity) || 0) > 0) {
          skuSet.add(String(inv.item_code || inv.item_id));
        }
      });

      const inStock = locInv.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);

      const isMainHq = loc.shortLabel === 'ថ្នាក់កណ្តាល';
      const locTxs = dateFilteredTransactions.filter((tx) => {
        const tType = String(tx.type || '').toUpperCase();
        const fromMatches = matchesTargetLocation(loc, tx.from_location_id || tx.from_location, tx.from_location);
        const toMatches = matchesTargetLocation(loc, tx.to_location_id || tx.to_location, tx.to_location);

        if (isMainHq) {
          return (tType === 'STOCK_OUT' || tType === 'HANDOVER') && fromMatches;
        } else {
          return (tType === 'STOCK_OUT' && (fromMatches || toMatches)) || (tType === 'HANDOVER' && toMatches);
        }
      });

      locTxs.forEach((tx) => {
        if (tx.item_code || tx.item_id) {
          skuSet.add(String(tx.item_code || tx.item_id));
        }
      });

      const inUseQty = locTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);
      const totalItems = inStock + inUseQty;

      let statusLabel = 'ដំណើរការធម្មតា';
      let statusType: 'ACTIVE' | 'EMPTY' | 'STANDBY' = 'ACTIVE';
      if (inStock === 0 && inUseQty === 0) {
        statusLabel = 'មិនទាន់បើកសម្ភារ';
        statusType = 'STANDBY';
      } else if (inStock === 0 && inUseQty > 0) {
        statusLabel = 'កំពុងប្រើប្រាស់ ១០០%';
        statusType = 'ACTIVE';
      }

      return {
        no: idx + 1,
        locationId: loc.id,
        locationCode: loc.code || '-',
        locationNameKh: loc.nameKh || '-',
        locationCategory: loc.category,
        locationCategoryLabel,
        skuCount: skuSet.size,
        totalItems,
        inStock,
        inUseQty,
        statusLabel,
        statusType
      };
    });

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    const matched = rows.filter(
      (r) =>
        r.locationNameKh.toLowerCase().includes(q) ||
        r.locationCode.toLowerCase().includes(q) ||
        r.locationCategoryLabel.toLowerCase().includes(q)
    );
    return matched.length > 0 ? matched.map((r, i) => ({ ...r, no: i + 1 })) : rows;
  }, [sortedLocations, reportLocationId, dbInventory, dateFilteredTransactions, matchesTargetLocation, searchQuery]);

  // =========================================================================
  // PART B: Itemized Details & Purposes (តារាងលម្អិតសម្ភារ និងគោលបំណងនៃការប្រើប្រាស់)
  // =========================================================================
  const filteredTransactionsForItems = useMemo(() => {
    return dateFilteredTransactions.filter((tx) => {
      if (reportLocationId === 'ALL') return true;
      const fromMatch = matchesFilterLocation(tx.from_location_id || tx.from_location, tx.from_location);
      const toMatch = matchesFilterLocation(tx.to_location_id || tx.to_location, tx.to_location);
      return fromMatch || toMatch;
    });
  }, [dateFilteredTransactions, reportLocationId, matchesFilterLocation]);

  const filteredInventoryForItems = useMemo(() => {
    return dbInventory.filter((inv) => {
      if (reportLocationId === 'ALL') return true;
      return (
        matchesFilterLocation(inv.location_id, inv.location_name_kh) ||
        matchesFilterLocation(inv.location_code, inv.location_name_kh)
      );
    });
  }, [dbInventory, reportLocationId, matchesFilterLocation]);

  const itemDetailRows: ItemDetailRow[] = useMemo(() => {
    const masterItems = dbItems.length > 0 ? dbItems : ctxItems;

    const rows: ItemDetailRow[] = masterItems.map((item, idx) => {
      const itemIdStr = String(item.id);
      const itemCodeStr = String(item.code || '').toUpperCase();

      const itemInvRows = filteredInventoryForItems.filter(
        (inv) =>
          String(inv.item_id) === itemIdStr ||
          String(inv.item_code || '').toUpperCase() === itemCodeStr
      );
      const inStock = itemInvRows.reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);

      const itemTxs = filteredTransactionsForItems.filter(
        (tx) =>
          String(tx.item_id) === itemIdStr ||
          String(tx.item_code || '').toUpperCase() === itemCodeStr ||
          (tx.item_name_kh && tx.item_name_kh === item.name_kh)
      );

      const usageTxs = itemTxs.filter((tx) => {
        const tType = String(tx.type || '').toUpperCase();
        return tType === 'STOCK_OUT' || tType === 'HANDOVER';
      });

      const txUsedQty = usageTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

      const branchAllocatedQty = itemInvRows
        .filter((inv) => !isHqLocationOrRow(inv, dbLocations))
        .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);

      const inUseQty = Math.max(txUsedQty, branchAllocatedQty);

      const holderSet = new Set<string>();
      usageTxs.forEach((tx) => {
        if (tx.to_location && String(tx.to_location).trim() && tx.to_location !== '-') {
          holderSet.add(String(tx.to_location).trim());
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

      itemInvRows.forEach((inv) => {
        if (!isHqLocationOrRow(inv, dbLocations) && (Number(inv.quantity) || 0) > 0) {
          if (inv.location_name_kh) {
            holderSet.add(String(inv.location_name_kh).trim());
          } else if (inv.location_code) {
            holderSet.add(String(inv.location_code).trim());
          }
        }
      });

      const assignedOfficersOrBranches =
        holderSet.size > 0
          ? Array.from(holderSet).slice(0, 3).join(', ')
          : inStock > 0
          ? 'ឃ្លាំងស្តុកកណ្តាល (HQ-ITSB)'
          : '-';

      const purposeSet = new Set<string>();
      usageTxs.forEach((tx) => {
        const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
        if (cleaned && cleaned !== '-') {
          purposeSet.add(cleaned);
        }
      });

      if (purposeSet.size === 0 && itemTxs.length > 0) {
        itemTxs.slice(0, 2).forEach((tx) => {
          const cleaned = cleanRemarkText(tx.remark || tx.purpose || tx.notes);
          if (cleaned && cleaned !== '-') {
            purposeSet.add(cleaned);
          }
        });
      }

      const usagePurpose =
        purposeSet.size > 0
          ? Array.from(purposeSet).slice(0, 2).join(' | ')
          : inUseQty > 0
          ? 'ប្រគល់ជូនសាខា និងមន្ត្រីបម្រើការងារបច្ចេកទេស'
          : inStock > 0
          ? 'រក្សាទុកក្នុងឃ្លាំងស្តុកបម្រុងសម្រាប់បើកផ្តល់ជូនសាខា'
          : '-';

      const minStock = Number(item.min_stock) || 5;
      let statusLabel = 'ស្តុកធម្មតា';
      let statusType: 'NORMAL' | 'LOW' | 'OUT' = 'NORMAL';
      if (inStock <= 0) {
        statusLabel = 'អស់ពីស្តុក';
        statusType = 'OUT';
      } else if (inStock <= minStock) {
        statusLabel = 'ស្តុកទាប';
        statusType = 'LOW';
      }

      return {
        no: idx + 1,
        itemCode: item.code || '-',
        itemNameKh: item.name_kh || '-',
        unit: item.unit || 'គ្រឿង',
        inStock,
        inUseQty,
        assignedOfficersOrBranches,
        usagePurpose,
        statusLabel,
        statusType,
        minStock
      };
    });

    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows
      .filter(
        (r) =>
          r.itemCode.toLowerCase().includes(q) ||
          r.itemNameKh.toLowerCase().includes(q) ||
          r.assignedOfficersOrBranches.toLowerCase().includes(q) ||
          r.usagePurpose.toLowerCase().includes(q)
      )
      .map((r, i) => ({ ...r, no: i + 1 }));
  }, [
    dbItems,
    ctxItems,
    filteredInventoryForItems,
    filteredTransactionsForItems,
    dbLocations,
    searchQuery
  ]);

  // =========================================================================
  // EXECUTIVE KPI SUMMARY MATRIX (4 Standard Metrics)
  // =========================================================================
  const kpiMatrix = useMemo(() => {
    const centralHqStockBalance = dbInventory
      .filter((inv) => isHqLocationOrRow(inv, dbLocations))
      .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);

    const branchStockSum = dbInventory
      .filter((inv) => !isHqLocationOrRow(inv, dbLocations))
      .reduce((sum, inv) => sum + (Number(inv.quantity) || 0), 0);

    const stockOutAndHandoverSum = dateFilteredTransactions
      .filter((tx) => {
        const tType = String(tx.type || '').toUpperCase();
        return tType === 'STOCK_OUT' || tType === 'HANDOVER';
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

    const activeBranchDeployed = Math.max(branchStockSum, stockOutAndHandoverSum);

    const stockInTxSum = dateFilteredTransactions
      .filter((tx) => String(tx.type || '').toUpperCase() === 'STOCK_IN')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

    const totalInventoryInbound = Math.max(centralHqStockBalance + activeBranchDeployed, stockInTxSum);

    const totalAdjusted = dateFilteredTransactions
      .filter((tx) => String(tx.type || '').toUpperCase() === 'ADJUSTMENT')
      .reduce((sum, tx) => sum + Math.abs(Number(tx.quantity) || 0), 0);

    return {
      totalInventoryInbound,
      centralHqStockBalance,
      activeBranchDeployed,
      totalAdjusted
    };
  }, [dbInventory, dbLocations, dateFilteredTransactions]);

  // Totals for Part A & Part B Footers
  const partATotals = useMemo(() => {
    return {
      totalItems: locationBalanceRows.reduce((s, r) => s + r.totalItems, 0),
      inStock: locationBalanceRows.reduce((s, r) => s + r.inStock, 0),
      inUseQty: locationBalanceRows.reduce((s, r) => s + r.inUseQty, 0)
    };
  }, [locationBalanceRows]);

  const partBTotals = useMemo(() => {
    return {
      inStock: itemDetailRows.reduce((s, r) => s + r.inStock, 0),
      inUseQty: itemDetailRows.reduce((s, r) => s + r.inUseQty, 0)
    };
  }, [itemDetailRows]);

  // Trigger Official Landscape A4 Print
  const handlePrintLandscapeA4 = () => {
    window.print();
  };

  // =========================================================================
  // 3. EXPORT TO EXCEL (.xlsx) WITH FULL 34-LOCATION CROSS-TAB MATRIX SHEET
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
    // SHEET 1: តារាងម៉ាទ្រីសបែងចែកស្តុកគ្រប់ទីតាំង (Cross-Tab Matrix - 39 Columns)
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
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន (ITSB)'],
      [],
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

    // Footer Total Row across all 34 locations
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
      { wch: 6 },  // ល.រ
      { wch: 11 }, // លេខកូដ
      { wch: 38 }, // ឈ្មោះឧបករណ៍ / សម្ភារ
      { wch: 9 },  // ឯកតា
      { wch: 10 }, // សរុប
      ...sortedLocations.map(() => ({ wch: 12 }))
    ];
    XLSX.utils.book_append_sheet(workbook, wsMatrix, '១_តារាងម៉ាទ្រីសគ្រប់ទីតាំង');

    // -----------------------------------------------------------------------
    // SHEET 2: តារាងលម្អិតសម្ភារ និងគោលបំណងនៃការប្រើប្រាស់ (Itemized Details)
    // -----------------------------------------------------------------------
    const sheetBData: any[][] = [
      ['ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ', '', '', '', '', '', 'ព្រះរាជាណាចក្រកម្ពុជា'],
      ['អគ្គនាយកដ្ឋានពន្ធដារ', '', '', '', '', '', 'ជាតិ សាសនា ព្រះមហាក្សត្រ'],
      ['ការិយាល័យសេវាកម្មបច្ចេកវិទ្យាព័ត៌មាន (ITSB)'],
      [],
      ['តារាងលម្អិតសម្ភារ និងគោលបំណងនៃការប្រើប្រាស់ (Itemized Details & Purposes)'],
      [`កាលបរិច្ឆេទ៖ ${dateRangeTitle} | ទីតាំង៖ ${locationTitle}`],
      [],
      [
        'ល.រ',
        'កូដសម្ភារ',
        'ឈ្មោះសម្ភារ',
        'ឯកតា',
        'ស្តុកនៅសល់',
        'កំពុងប្រើប្រាស់',
        'មន្ត្រី/សាខាទទួលកាន់កាប់',
        'គោលបំណងនៃការប្រើប្រាស់ (Purpose/Remark)',
        'ស្ថានភាព'
      ]
    ];

    itemDetailRows.forEach((row) => {
      sheetBData.push([
        row.no,
        row.itemCode,
        row.itemNameKh,
        row.unit,
        row.inStock,
        row.inUseQty,
        row.assignedOfficersOrBranches,
        row.usagePurpose,
        row.statusLabel
      ]);
    });

    sheetBData.push([
      '',
      '',
      'សរុបរួម (GRAND TOTAL)',
      '',
      partBTotals.inStock,
      partBTotals.inUseQty,
      '',
      '',
      ''
    ]);

    const wsB = XLSX.utils.aoa_to_sheet(sheetBData);
    wsB['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 38 },
      { wch: 11 },
      { wch: 15 },
      { wch: 16 },
      { wch: 32 },
      { wch: 46 },
      { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(workbook, wsB, '២_លម្អិតសម្ភារនិងគោលបំណង');

    // -----------------------------------------------------------------------
    // SHEET 3: តារាងតុល្យភាពស្តុកតាមបណ្តាទីតាំង (Stock by Locations Summary)
    // -----------------------------------------------------------------------
    const sheetAData: any[][] = [
      ['តារាងតុល្យភាពស្តុកតាមបណ្តាទីតាំង (Stock by Locations - 34 Locations)'],
      [
        'ល.រ',
        'ឈ្មោះទីតាំង/សាខា',
        'ប្រភេទទីតាំង',
        'ចំនួនមុខសម្ភារ',
        'សម្ភារសរុប',
        'នៅសល់ក្នុងស្តុក',
        'កំពុងប្រើប្រាស់',
        'ស្ថានភាព'
      ]
    ];

    locationBalanceRows.forEach((r) => {
      sheetAData.push([
        r.no,
        r.locationNameKh,
        r.locationCategoryLabel,
        r.skuCount,
        r.totalItems,
        r.inStock,
        r.inUseQty,
        r.statusLabel
      ]);
    });

    sheetAData.push([
      '',
      'សរុបរួមទូទាំងទីតាំង (GRAND TOTAL)',
      `${locationBalanceRows.length} ទីតាំង`,
      '',
      partATotals.totalItems,
      partATotals.inStock,
      partATotals.inUseQty,
      ''
    ]);

    const wsA = XLSX.utils.aoa_to_sheet(sheetAData);
    wsA['!cols'] = [
      { wch: 8 },
      { wch: 38 },
      { wch: 26 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(workbook, wsA, '៣_តុល្យភាពតាមទីតាំង');

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
                    ? 'របាយការណ៍រួម និងតារាងម៉ាទ្រីសស្តុក (Executive Report & Matrix)'
                    : 'Executive Summary & Cross-Tab Stock Distribution Matrix'}
                </h2>
                <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#004D40] border border-emerald-300">
                  Read-Only • A4 Landscape
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                តារាងបូកសរុបស្តុកតាមបណ្តាទីតាំង (ថ្នាក់កណ្តាល និង ៣៣ សាខា) និងរបាយការណ៍លម្អិតសម្រាប់បោះពុម្ពលើក្រដាស A4 ជួរដេក
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
              <span>🖨️ បោះពុម្ព A4 ជួរដេក (Print Landscape A4)</span>
            </button>

            <button
              type="button"
              onClick={exportToExcel}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>📥 ទាញយកជា Excel (Export .xlsx)</span>
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
                  <span>ស្វែងរកសម្ភារ / លេខកូដ / សាខា</span>
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="វាយកូដសម្ភារ, ឈ្មោះសម្ភារ, សាខា..."
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
            <span className="text-xs font-bold text-slate-600">ជ្រើសរើសទម្រង់តារាងរបាយការណ៍៖</span>
            <div className="flex flex-wrap items-center gap-2">
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
                <span>តារាងទី ១៖ តារាងម៉ាទ្រីសគ្រប់ទីតាំង ({sortedLocations.length} ទីតាំង)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('PART_B')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'PART_B'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <ListChecks size={15} />
                <span>តារាងទី ២៖ តារាងលម្អិត និងគោលបំណងប្រើប្រាស់ ({itemDetailRows.length} មុខ)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('PART_A')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'PART_A'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Building2 size={15} />
                <span>តារាងទី ៣៖ តុល្យភាពស្តុកតាមសាខា ({locationBalanceRows.length} ទីតាំង)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveReportTab('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeReportTab === 'ALL'
                    ? 'bg-[#004D40] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers size={15} />
                <span>បង្ហាញគ្រប់តារាងទាំងអស់</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* OFFICIAL LANDSCAPE A4 REPORT CONTAINER (Screen Preview & Print Ready) */}
      {/* ===================================================================== */}
      <div className="print-container a4-print-sheet bg-white rounded-2xl border border-[#CDE5DA] shadow-sm p-4 sm:p-6 lg:p-8 text-[#03291E] space-y-5">
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
                : 'របាយការណ៍បូកសរុបស្ថានភាពសម្ភារបច្ចេកវិទ្យាព័ត៌មានទូទាំងអង្គភាព'}
            </h1>
            <p className="text-[11px] font-bold text-[#004D40] bg-[#EBF4F0] border border-[#BDE0D0] inline-block px-3 py-0.5 rounded-full">
              គ្របដណ្តប់ទីតាំងថ្នាក់កណ្តាល (១) និងសាខាពន្ធដារខេត្ត-ខណ្ឌ (៣៣)
            </p>
            <div className="text-[11px] font-bold text-slate-700">
              កាលបរិច្ឆេទរបាយការណ៍៖{' '}
              <strong className="text-[#03291E]">
                {startDate || endDate
                  ? `ចាប់ពី ${startDate || 'ដើមគ្រា'} ដល់ ${endDate || 'បច្ចុប្បន្ន'}`
                  : `គិតត្រឹមថ្ងៃទី ${formattedCurrentDateKh}`}
              </strong>
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
        {/* EXECUTIVE KPI SUMMARY MATRIX (Hidden when printing Matrix alone so 32 rows fit on 1 page) */}
        {/* ----------------------------------------------------------------- */}
        <div className={`grid grid-cols-4 gap-3 ${activeReportTab === 'MATRIX' ? 'no-print' : ''}`}>
          {/* KPI 1: Total Inventory Inbound */}
          <div className="rounded-xl p-3 bg-[#F2F9F6] border border-[#004D40]/25 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#004D40]">សម្ភារសរុបក្នុងប្រព័ន្ធ</p>
              <p className="text-[10px] text-slate-500">Total Inventory Inbound</p>
              <p className="text-xl font-black text-[#03291E] mt-0.5">
                {kpiMatrix.totalInventoryInbound.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-[#004D40] text-white flex items-center justify-center shrink-0">
              <ArrowDownToLine size={18} />
            </div>
          </div>

          {/* KPI 2: Central HQ Stock Balance */}
          <div className="rounded-xl p-3 bg-emerald-50/70 border border-emerald-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-emerald-900">ស្តុកនៅសល់ជាក់ស្តែងថ្នាក់កណ្តាល</p>
              <p className="text-[10px] text-emerald-700">Central HQ Stock Balance</p>
              <p className="text-xl font-black text-emerald-800 mt-0.5">
                {kpiMatrix.centralHqStockBalance.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <PackageCheck size={18} />
            </div>
          </div>

          {/* KPI 3: Active Deployed at 33 Branches */}
          <div className="rounded-xl p-3 bg-blue-50/70 border border-blue-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-900">សម្ភារកំពុងប្រើប្រាស់តាម ៣៣ សាខា</p>
              <p className="text-[10px] text-blue-700">Active Deployed at 33 Branches</p>
              <p className="text-xl font-black text-blue-800 mt-0.5">
                {kpiMatrix.activeBranchDeployed.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center shrink-0">
              <UserCheck size={18} />
            </div>
          </div>

          {/* KPI 4: Adjusted / Damaged Items */}
          <div className="rounded-xl p-3 bg-amber-50/70 border border-amber-300 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-amber-900">សម្ភារខូច/កែសម្រួល</p>
              <p className="text-[10px] text-amber-700">Adjusted / Damaged Items</p>
              <p className="text-xl font-black text-amber-800 mt-0.5">
                {kpiMatrix.totalAdjusted.toLocaleString()}
              </p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <SlidersHorizontal size={18} />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TABLE 1: CROSS-TAB STOCK DISTRIBUTION MATRIX (39 COLUMNS)         */}
        {/* ================================================================= */}
        {(activeReportTab === 'MATRIX' || activeReportTab === 'ALL') && (
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
                    {/* 5 Base Columns on Left */}
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

                    {/* Dynamic 34 Location Columns with Slanted / Rotated Header */}
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
                  ) : matrixData.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + sortedLocations.length}
                        className="py-10 text-center text-slate-500 font-semibold text-xs"
                      >
                        មិនមានទិន្នន័យសម្ភារត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
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

                        {/* 34 Location Cells */}
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

        {/* ================================================================= */}
        {/* TABLE 2: ITEMIZED DETAILS & USAGE PURPOSES TABLE                  */}
        {/* ================================================================= */}
        {(activeReportTab === 'PART_B' || activeReportTab === 'ALL') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-l-4 border-[#004D40] pl-3 py-1 bg-[#F4F9F6] rounded-r-lg">
              <div>
                <h2
                  className="text-xs sm:text-sm font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  តារាងលម្អិតសម្ភារ និងគោលបំណងនៃការប្រើប្រាស់ (Itemized Details & Purposes)
                </h2>
                <p className="text-[11px] text-slate-600">
                  បង្ហាញបរិមាណស្តុកនៅសល់ បរិមាណកំពុងប្រើប្រាស់ មន្ត្រី/សាខាទទួលកាន់កាប់ និងគោលបំណងនៃការប្រើប្រាស់ពីប្រតិបត្តិការជាក់ស្តែង
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#004D40] px-2.5 py-1 bg-white rounded-md border border-[#CDE5DA] mr-2">
                សម្ភារសរុប {itemDetailRows.length} មុខ
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-[#004D40] text-white">
                    <th className="border border-slate-300 py-2 px-2 text-center w-10">ល.រ</th>
                    <th className="border border-slate-300 py-2 px-2.5 text-left w-24">កូដសម្ភារ</th>
                    <th className="border border-slate-300 py-2 px-3 text-left min-w-[180px]">
                      ឈ្មោះសម្ភារ
                    </th>
                    <th className="border border-slate-300 py-2 px-2 text-center w-16">ឯកតា</th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-24">
                      ស្តុកនៅសល់
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-28">
                      កំពុងប្រើប្រាស់
                    </th>
                    <th className="border border-slate-300 py-2 px-3 text-left min-w-[160px]">
                      មន្ត្រី/សាខាទទួលកាន់កាប់
                    </th>
                    <th className="border border-slate-300 py-2 px-3 text-left min-w-[210px]">
                      គោលបំណងនៃការប្រើប្រាស់ (Purpose/Remark)
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-24">
                      ស្ថានភាព
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-semibold">
                        កំពុងទាញយកទិន្នន័យលម្អិតសម្ភារ...
                      </td>
                    </tr>
                  ) : itemDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 font-semibold">
                        មិនមានទិន្នន័យសម្ភារត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                      </td>
                    </tr>
                  ) : (
                    itemDetailRows.map((row) => (
                      <tr
                        key={row.itemCode}
                        className="hover:bg-emerald-50/40 transition-colors odd:bg-white even:bg-slate-50/60"
                      >
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-bold text-slate-700">
                          {row.no}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 font-mono font-bold text-[#004D40]">
                          {row.itemCode}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-3 font-bold text-slate-900">
                          {row.itemNameKh}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center text-slate-700">
                          {row.unit}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-black text-emerald-800 bg-emerald-50/40">
                          {row.inStock.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-black text-blue-800 bg-blue-50/30">
                          {row.inUseQty.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-3 text-slate-800 font-medium">
                          {row.assignedOfficersOrBranches}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-3 text-slate-700 leading-relaxed">
                          {row.usagePurpose}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2 text-center">
                          {row.statusType === 'NORMAL' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={10} />
                              {row.statusLabel}
                            </span>
                          )}
                          {row.statusType === 'LOW' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <AlertTriangle size={10} />
                              {row.statusLabel}
                            </span>
                          )}
                          {row.statusType === 'OUT' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle size={10} />
                              {row.statusLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {itemDetailRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#E1F2EA] font-black text-[#03291E]">
                      <td colSpan={4} className="border border-slate-300 py-2 px-3 text-right">
                        សរុបរួមបរិមាណសម្ភារទាំងអស់ (GRAND TOTAL)៖
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-emerald-900">
                        {partBTotals.inStock.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-blue-900">
                        {partBTotals.inUseQty.toLocaleString()}
                      </td>
                      <td colSpan={3} className="border border-slate-300 py-2 px-3 text-left text-[11px] font-bold text-[#004D40]">
                        សម្ភារសរុបចំនួន {itemDetailRows.length} មុខ (SKUs)
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TABLE 3: STOCK BALANCE BY LOCATIONS SUMMARY TABLE                 */}
        {/* ================================================================= */}
        {(activeReportTab === 'PART_A' || activeReportTab === 'ALL') && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between border-l-4 border-[#004D40] pl-3 py-1 bg-[#F4F9F6] rounded-r-lg">
              <div>
                <h2
                  className="text-xs sm:text-sm font-bold text-[#03291E]"
                  style={{ fontFamily: "'Khmer OS Muol Light', 'Moul', serif" }}
                >
                  តារាងតុល្យភាពស្តុកតាមបណ្តាទីតាំង (Stock by Locations - {locationBalanceRows.length} Locations)
                </h2>
                <p className="text-[11px] text-slate-600">
                  បង្ហាញតុល្យភាពស្តុកសម្ភារបច្ចេកទេសនៅថ្នាក់កណ្តាល (HQ-ITSB), សាខាពន្ធដារខណ្ឌ និងសាខាពន្ធដារខេត្តទាំងអស់
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#004D40] px-2.5 py-1 bg-white rounded-md border border-[#CDE5DA] mr-2">
                សរុប {locationBalanceRows.length} ទីតាំង
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-[#004D40] text-white">
                    <th className="border border-slate-300 py-2 px-2 text-center w-10">ល.រ</th>
                    <th className="border border-slate-300 py-2 px-3 text-left min-w-[210px]">
                      ឈ្មោះទីតាំង/សាខា
                    </th>
                    <th className="border border-slate-300 py-2 px-3 text-left w-44">
                      ប្រភេទទីតាំង
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-28">
                      ចំនួនមុខសម្ភារ
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-28">
                      សម្ភារសរុប
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-32">
                      នៅសល់ក្នុងស្តុក
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-32">
                      កំពុងប្រើប្រាស់
                    </th>
                    <th className="border border-slate-300 py-2 px-2.5 text-center w-32">
                      ស្ថានភាព
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-semibold">
                        កំពុងទាញយកទិន្នន័យតុល្យភាពស្តុកតាមទីតាំង...
                      </td>
                    </tr>
                  ) : locationBalanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 font-semibold">
                        មិនមានទិន្នន័យទីតាំងត្រូវនឹងលក្ខខណ្ឌស្វែងរកឡើយ
                      </td>
                    </tr>
                  ) : (
                    locationBalanceRows.map((locRow) => (
                      <tr
                        key={locRow.locationId}
                        className={`transition-colors ${
                          locRow.locationCategory === 'HQ'
                            ? 'bg-emerald-50/70 font-semibold'
                            : 'odd:bg-white even:bg-slate-50/60 hover:bg-emerald-50/30'
                        }`}
                      >
                        <td className="border border-slate-300 py-1.5 px-2 text-center font-bold text-slate-700">
                          {locRow.no}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-3 font-bold text-[#03291E]">
                          {locRow.locationNameKh}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              locRow.locationCategory === 'HQ'
                                ? 'bg-teal-100 text-teal-900 border-teal-300'
                                : locRow.locationCategory === 'KHAN'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            {locRow.locationCategoryLabel}
                          </span>
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-bold text-slate-700">
                          {locRow.skuCount} មុខ
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-black text-slate-900">
                          {locRow.totalItems.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-black text-emerald-800 bg-emerald-50/40">
                          {locRow.inStock.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center font-black text-blue-800 bg-blue-50/30">
                          {locRow.inUseQty.toLocaleString()}
                        </td>
                        <td className="border border-slate-300 py-1.5 px-2.5 text-center">
                          {locRow.statusType === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 size={10} />
                              {locRow.statusLabel}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300">
                              {locRow.statusLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {locationBalanceRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-[#E1F2EA] font-black text-[#03291E]">
                      <td colSpan={4} className="border border-slate-300 py-2 px-3 text-right">
                        សរុបរួមតាមបណ្តាទីតាំងទាំងអស់ ({locationBalanceRows.length} ទីតាំង)៖
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-[#03291E]">
                        {partATotals.totalItems.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-emerald-900">
                        {partATotals.inStock.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-blue-900">
                        {partATotals.inUseQty.toLocaleString()}
                      </td>
                      <td className="border border-slate-300 py-2 px-2.5 text-center text-[11px] font-bold text-[#004D40]">
                        ត្រឹមត្រូវ ១០០%
                      </td>
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
