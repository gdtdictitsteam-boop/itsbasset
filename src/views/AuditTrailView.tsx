import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext, formatLocationOption } from '../contexts/LocationContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import gdtLogo from '../gdtlogo.png';
import { 
  History, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  ArrowDownToLine, 
  ArrowRightLeft, 
  MinusCircle, 
  SlidersHorizontal,
  Clock,
  Eye,
  ExternalLink,
  ArrowLeft
} from 'lucide-react';

export function AuditTrailView() {
  const { language } = useLanguage();
  const { isCentralAdmin, isBranchUser } = useAuth();
  const { selectedLocationId, locations } = useLocationContext();

  // State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Client-Side Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | 'ALL'>(25);

  // Fetch Transactions with RLS compliance
  const fetchTransactions = async () => {
    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*, remark')
          .order('date', { ascending: false });

        if (error) {
          console.error('Error fetching audit trail:', error);
          setTransactions([]);
        } else {
          setTransactions(data || []);
        }
      } catch (err: any) {
        console.error('Exception fetching audit trail:', err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    } else {
      setTransactions([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedLocationId, isCentralAdmin, isBranchUser]);

  // Helper to extract document URL from all possible columns and embedded remark URL
  const extractDocUrl = (tx: any): string | null => {
    if (tx.document_url && typeof tx.document_url === 'string' && tx.document_url.trim()) {
      return tx.document_url.trim();
    }
    if (tx.attachment_url && typeof tx.attachment_url === 'string' && tx.attachment_url.trim()) {
      return tx.attachment_url.trim();
    }
    if (tx.doc_url && typeof tx.doc_url === 'string' && tx.doc_url.trim()) {
      return tx.doc_url.trim();
    }
    if (tx.file_url && typeof tx.file_url === 'string' && tx.file_url.trim()) {
      return tx.file_url.trim();
    }
    // Extract URL from remark if present (e.g. "... | ឯកសារយោង: https://..." or "https://...")
    if (tx.remark && typeof tx.remark === 'string') {
      const urlMatch = tx.remark.match(/https?:\/\/[^\s"'<>]+/);
      if (urlMatch) {
        return urlMatch[0];
      }
    }
    return null;
  };

  // Helper to resolve location display name from location ID or name
  const resolveLocationName = (locName?: string, locId?: string): string => {
    if (locName && locName.trim() && locName !== '-') return locName.trim();
    if (locId) {
      const match = locations.find(l => l.id === locId || l.code === locId);
      if (match) return match.name_kh;
    }
    return '-';
  };

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Text Search (Item Name, Code, Remark, Officer, Locations)
      const query = searchQuery.toLowerCase();
      const fromLoc = resolveLocationName(tx.from_location, tx.from_location_id).toLowerCase();
      const toLoc = resolveLocationName(tx.to_location, tx.to_location_id).toLowerCase();
      const matchesQuery = !searchQuery || 
        tx.item_name_kh?.toLowerCase().includes(query) ||
        tx.item_code?.toLowerCase().includes(query) ||
        tx.recorded_by?.toLowerCase().includes(query) ||
        tx.remark?.toLowerCase().includes(query) ||
        fromLoc.includes(query) ||
        toLoc.includes(query);

      // 2. Transaction Type
      const matchesType = selectedType === 'ALL' || tx.type === selectedType;

      // 3. Location Filter
      const matchesLocation = selectedLocation === 'ALL' || 
        tx.from_location_id === selectedLocation ||
        tx.to_location_id === selectedLocation ||
        fromLoc.includes(selectedLocation) ||
        toLoc.includes(selectedLocation);

      // 4. Date Range Filter
      let matchesDate = true;
      if (startDate) {
        const txDate = new Date(tx.date || tx.created_at);
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && txDate >= sDate;
      }
      if (endDate) {
        const txDate = new Date(tx.date || tx.created_at);
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && txDate <= eDate;
      }

      return matchesQuery && matchesType && matchesLocation && matchesDate;
    });
  }, [transactions, searchQuery, selectedType, selectedLocation, startDate, endDate, locations]);

  // Reset pagination to page 1 whenever filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedLocation, startDate, endDate, itemsPerPage]);

  // Calculate Paginated Slice for On-Screen Table (Export & Print still use full filteredTransactions)
  const totalFilteredCount = filteredTransactions.length;
  const totalPages = useMemo(() => {
    if (itemsPerPage === 'ALL' || totalFilteredCount === 0) return 1;
    return Math.max(1, Math.ceil(totalFilteredCount / itemsPerPage));
  }, [totalFilteredCount, itemsPerPage]);

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = itemsPerPage === 'ALL' ? 0 : (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 'ALL' ? totalFilteredCount : Math.min(startIndex + itemsPerPage, totalFilteredCount);

  const paginatedTransactions = useMemo(() => {
    if (itemsPerPage === 'ALL') return filteredTransactions;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, itemsPerPage, startIndex, endIndex]);

  // Export to Excel (CSV with UTF-8 BOM for Khmer support)
  const exportToExcel = () => {
    if (filteredTransactions.length === 0) {
      return;
    }

    const headers = [
      'កាលបរិច្ឆេទ (Date)',
      'ប្រភេទប្រតិបត្តិការ (Type)',
      'ពីទីតាំង (From Location)',
      'ទៅទីតាំង (To Location)',
      'លេខ SKU (Item Code)',
      'ឈ្មោះសម្ភារៈ (Item Name)',
      'ចំនួន (Quantity)',
      'ខ្នាត (Unit)',
      'ស្ថានភាព (Status)',
      'មន្ត្រីកត់ត្រា (Recorded By)',
      'ឯកសារយោង (Reference)',
      'គោលបំណង (Remark)'
    ];

    const csvRows = [headers.join(',')];

    filteredTransactions.forEach(tx => {
      const dateStr = new Date(tx.date || tx.created_at).toLocaleString('km-KH');
      const docUrl = extractDocUrl(tx) || '';
      const fromLoc = resolveLocationName(tx.from_location, tx.from_location_id);
      const toLoc = resolveLocationName(tx.to_location, tx.to_location_id);
      const remarkText = tx.remark || '-';
      const row = [
        `"${dateStr}"`,
        `"${tx.type}"`,
        `"${fromLoc}"`,
        `"${toLoc}"`,
        `"${tx.item_code || '-'}"`,
        `"${(tx.item_name_kh || '').replace(/"/g, '""')}"`,
        tx.quantity,
        `"${tx.unit || '-'}"`,
        `"${tx.status || 'RECEIVED'}"`,
        `"${(tx.recorded_by || '').replace(/"/g, '""')}"`,
        `"${docUrl ? docUrl.replace(/"/g, '""') : '-'}"`,
        `"${remarkText.replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    // UTF-8 BOM prefix \uFEFF ensures Excel displays Khmer correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GDT_Audit_Trail_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open In-App Print / PDF Preview Modal
  const openPrintPreviewModal = () => {
    setIsPrintModalOpen(true);
  };

  return (
    <div className="font-siemreap">
      {/* Main Audit Trail Page Content (Hidden when Print Modal is open or during print) */}
      <div className={isPrintModalOpen ? 'hidden no-print print:hidden' : 'space-y-6 no-print print:hidden'}>
        {/* Header Banner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-emerald-100/90 text-emerald-900 rounded-2xl border border-emerald-200 shrink-0">
              <History size={24} />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="text-base sm:text-xl font-bold text-slate-900">ប្រវត្តិសវនកម្ម និង របាយការណ៍ (Audit Trail & Reports)</h2>
                <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-300">
                  {filteredTransactions.length} ប្រតិបត្តិការ
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ជំហានទី៥៖ ត្រួតពិនិត្យប្រវត្តិប្រតិបត្តិការទាំងអស់ និងទាញយករបាយការណ៍ជា Excel (CSV) ឬ PDF
              </p>
            </div>
          </div>

          {/* Action Buttons: Export Excel, Export PDF & Print */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            <button
              type="button"
              onClick={exportToExcel}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <FileSpreadsheet size={16} />
              <span>Export Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={openPrintPreviewModal}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <FileText size={16} />
              <span>Export PDF</span>
            </button>

            <button
              type="button"
              onClick={openPrintPreviewModal}
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 min-h-[42px] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
              title="បោះពុម្ពទំព័រ"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <Filter size={15} className="text-emerald-700" />
              <span>តម្រងស្វែងរកទិន្នន័យ (Data Filters)</span>
            </div>

            <button
              type="button"
              onClick={fetchTransactions}
              className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 px-3 py-1.5 min-h-[34px] rounded-xl border border-slate-200 hover:border-emerald-200 text-xs font-bold transition-all cursor-pointer active:scale-95 shrink-0"
              title="ធ្វើបច្ចុប្បន្នភាពទិន្នន័យ (Refresh Data)"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-700' : ''} />
              <span className="hidden sm:inline">ផ្ទុកឡើងវិញ</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 text-xs font-bold">
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">ស្វែងរកពាក្យគន្លឹះ</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ឈ្មោះសម្ភារៈ SKU មន្ត្រី..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 min-h-[42px] text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>

            {/* Transaction Type Filter */}
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">ប្រភេទប្រតិបត្តិការ</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[42px] text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer"
              >
                <option value="ALL">-- ទាំងអស់ (All Types) --</option>
                <option value="STOCK_IN">STOCK_IN (ទិញចូលស្តុក)</option>
                <option value="HANDOVER">HANDOVER (ប្រគល់ទទួល)</option>
                <option value="STOCK_OUT">STOCK_OUT (ដកប្រើប្រាស់)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (កែតម្រូវ)</option>
              </select>
            </div>

            {/* Location Filter */}
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">ទីតាំងសាខា</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 min-h-[42px] text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer truncate"
              >
                <option value="ALL">[ALL] ទីតាំងស្តុករួម (គ្រប់ទីតាំង)</option>
                {locations.filter(l => l.code !== 'ALL').map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {formatLocationOption(loc, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="space-y-1">
              <label className="text-slate-500 font-semibold">ចាប់ពីថ្ងៃ ដល់ ថ្ងៃ</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 min-h-[42px] text-[11px] font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
                <span className="text-slate-400 font-normal">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 min-h-[42px] text-[11px] font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Transactions Table */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto text-emerald-800 mb-2" />
              កំពុងទាញយកប្រវត្តិសវនកម្ម...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <History size={36} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-sm">មិនមានទិន្នន័យប្រតិបត្តិការទេ</h3>
              <p className="text-xs text-slate-400">សូមសាកល្បងផ្លាស់ប្តូរលក្ខខណ្ឌតម្រង (Filter) ឬពាក្យគន្លឹះស្វែងរក។</p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[960px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/90 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">កាលបរិច្ឆេទ</th>
                    <th className="py-3 px-4">ប្រភេទ</th>
                    <th className="py-3 px-4">ពីទីតាំង (From)</th>
                    <th className="py-3 px-4">ទៅទីតាំង (To)</th>
                    <th className="py-3 px-4">SKU / ឈ្មោះសម្ភារៈ</th>
                    <th className="py-3 px-4 text-right">ចំនួន</th>
                    <th className="py-3 px-4 text-center">ស្ថានភាព</th>
                    <th className="py-3 px-4">មន្ត្រីកត់ត្រា</th>
                    <th className="py-3 px-4 text-center">ឯកសារយោង (Reference)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      គោលបំណង
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {paginatedTransactions.map((tx, idx) => {
                    const isHandover = tx.type === 'HANDOVER';
                    const isStockIn = tx.type === 'STOCK_IN';
                    const isStockOut = tx.type === 'STOCK_OUT';
                    const isPending = tx.status === 'PENDING';
                    const docUrl = extractDocUrl(tx);
                    const fromLoc = resolveLocationName(tx.from_location, tx.from_location_id);
                    const toLoc = resolveLocationName(tx.to_location, tx.to_location_id);
                    const rowNumber = startIndex + idx + 1;

                    return (
                      <tr key={tx.id || rowNumber} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{rowNumber}</td>
                        <td className="py-3.5 px-4 font-mono text-[11px] whitespace-nowrap text-slate-600">
                          {new Date(tx.date || tx.created_at).toLocaleString('km-KH')}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                            isStockIn
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isStockOut
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : isHandover
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {isStockIn && <ArrowDownToLine size={13} />}
                            {isStockOut && <MinusCircle size={13} />}
                            {isHandover && <ArrowRightLeft size={13} />}
                            {!isStockIn && !isStockOut && !isHandover && <SlidersHorizontal size={13} />}
                            <span>{tx.type}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={fromLoc}>
                          {fromLoc}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={toLoc}>
                          {toLoc}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700 font-bold mr-1.5">
                            {tx.item_code}
                          </span>
                          <span className="font-bold text-slate-900">{tx.item_name_kh}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black font-mono text-sm text-slate-900 whitespace-nowrap">
                          {tx.quantity} <span className="text-xs font-normal text-slate-500">{tx.unit}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            isPending 
                              ? 'bg-amber-100 text-amber-900 border-amber-300' 
                              : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {isPending ? <Clock size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                            <span>{isPending ? 'PENDING' : (tx.status || 'COMPLETED')}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold text-[11px] whitespace-nowrap">
                          {tx.recorded_by || 'System'}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {docUrl ? (
                            <a
                              href={docUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hover:border-emerald-400 transition-colors shadow-2xs group"
                              title={`ចុចដើម្បីបើកមើលឯកសារយោង (ផ្ទាំងថ្មី):\n${docUrl}`}
                            >
                              <Eye size={13} className="text-emerald-700 group-hover:scale-110 transition-transform" />
                              <span>មើលឯកសារ</span>
                              <ExternalLink size={10} className="text-emerald-600" />
                            </a>
                          ) : (
                            <span className="text-slate-400 font-bold text-sm">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                          {tx.remark || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Smart Client-Side Pagination Footer */}
              <div className="bg-slate-50/90 border-t border-slate-200/80 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-slate-600 font-semibold">
                  <span>
                    បង្ហាញពី <strong className="text-slate-900 font-mono">{totalFilteredCount > 0 ? startIndex + 1 : 0}</strong> ដល់{' '}
                    <strong className="text-slate-900 font-mono">{endIndex}</strong> នៃ{' '}
                    <strong className="text-emerald-800 font-mono">{totalFilteredCount}</strong> ប្រតិបត្តិការ
                  </span>
                  <span className="text-slate-300 hidden sm:inline">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">បង្ហាញក្នុង ១ ទំព័រ៖</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItemsPerPage(val === 'ALL' ? 'ALL' : Number(val));
                      }}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer"
                    >
                      <option value={25}>25 ជួរដេក</option>
                      <option value={50}>50 ជួរដេក</option>
                      <option value={100}>100 ជួរដេក</option>
                      <option value="ALL">ទាំងអស់ ({totalFilteredCount})</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1 || itemsPerPage === 'ALL'}
                    className="px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  >
                    « ទំព័រមុន
                  </button>

                  <span className="px-3 py-1.5 min-h-[36px] inline-flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold">
                    ទំព័រទី <strong className="mx-1 font-mono">{safeCurrentPage}</strong> នៃ{' '}
                    <strong className="ml-1 font-mono">{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages || itemsPerPage === 'ALL'}
                    className="px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                  >
                    ទំព័របន្ទាប់ »
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen In-App Print / PDF Preview Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col print:static print:inset-auto print:bg-white print:block">
          {/* Sticky Top Action Bar (Hidden when printing) */}
          <div className="no-print print:hidden sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3 flex items-center justify-between gap-2 shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(false)}
              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs active:scale-95 flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft size={16} className="shrink-0" />
              <span>ត្រឡប់ទៅទំព័រដើម (Back / បិទ)</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#0b3d2e] hover:bg-[#14533e] text-white px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-xs active:scale-95 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Printer size={16} className="shrink-0" />
              <span>🖨️ បោះពុម្ព / រក្សាទុក PDF (Print Now)</span>
            </button>
          </div>

          {/* Scrollable Report Preview Area */}
          <div className="flex-1 overflow-auto p-3 sm:p-6 print:p-0 print:overflow-visible">
            <div className="bg-white rounded-2xl shadow-md border border-slate-200/90 p-4 sm:p-8 max-w-[1360px] mx-auto a4-print-sheet print:shadow-none print:border-none print:p-0">
              {/* Official Report Header */}
              <div className="overflow-x-auto print:overflow-visible">
                <div className="grid grid-cols-3 items-start gap-4 pb-3 border-b-2 border-[#05402D] min-w-[680px] print:min-w-0">
                  {/* Left Side: Ministry & General Department */}
                  <div className="justify-self-start text-center space-y-0.5 w-[250px]">
                    <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
                      ក្រសួងសេដ្ឋកិច្ច និងហិរញ្ញវត្ថុ
                    </p>
                    <p className="font-moul text-xs sm:text-sm text-[#05402D] leading-relaxed text-center">
                      អគ្គនាយកដ្ឋានពន្ធដារ
                    </p>
                    <p className="font-siemreap text-xs font-bold text-slate-800 text-center">
                      នាយកដ្ឋានបច្ចេកវិទ្យាព័ត៌មាន
                    </p>
                  </div>

                  {/* Center Column: Official GDT Logo */}
                  <div className="flex flex-col items-center justify-center justify-self-center">
                    <img
                      src={gdtLogo || '/gdtlogo.png'}
                      alt="អគ្គនាយកដ្ឋានពន្ធដារ - General Department of Taxation"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain select-none"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('/gdtlogo.png')) {
                          target.src = '/gdtlogo.png';
                        }
                      }}
                    />
                  </div>

                  {/* Right Side: Kingdom of Cambodia Motto */}
                  <div className="justify-self-end space-y-0.5 w-[250px] text-center leading-[25px]">
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

              {/* Report Title & Metadata */}
              <div className="text-center py-3.5 space-y-1">
                <h1 className="font-moul text-sm sm:text-base lg:text-lg text-[#03291E] leading-snug">
                  អគ្គនាយកដ្ឋានពន្ធដារ - របាយការណ៍ប្រវត្តិសវនកម្មស្តុក (Audit Trail Report)
                </h1>
                <p className="text-xs font-semibold text-slate-600">
                  កាលបរិច្ឆេទបង្កើត៖ <span className="text-slate-900 font-bold">{new Date().toLocaleString('km-KH')}</span>
                  <span className="mx-2 text-slate-400">|</span>
                  ចំនួនប្រតិបត្តិការសរុប៖ <span className="text-[#03291E] font-extrabold">{filteredTransactions.length} ប្រតិបត្តិការ</span>
                </p>
              </div>

              {/* Printable Report Table */}
              <div className="overflow-x-auto print:overflow-visible mt-2">
                <table className="w-full min-w-[960px] print:min-w-0 border-collapse border border-slate-300 text-left">
                  <thead>
                    <tr className="bg-[#03291E] text-white text-[11px] font-bold">
                      <th className="py-2.5 px-2 border border-slate-400 text-center w-10">#</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 whitespace-nowrap">កាលបរិច្ឆេទ</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 whitespace-nowrap">ប្រភេទ</th>
                      <th className="py-2.5 px-2.5 border border-slate-400">ពីទីតាំង</th>
                      <th className="py-2.5 px-2.5 border border-slate-400">ទៅទីតាំង</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 whitespace-nowrap">SKU</th>
                      <th className="py-2.5 px-2.5 border border-slate-400">ឈ្មោះសម្ភារៈ</th>
                      <th className="py-2.5 px-2.5 border border-slate-400 text-right whitespace-nowrap">ចំនួន</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center whitespace-nowrap">ខ្នាត</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center whitespace-nowrap">ស្ថានភាព</th>
                      <th className="py-2.5 px-2.5 border border-slate-400">មន្ត្រីកត់ត្រា</th>
                      <th className="py-2.5 px-2 border border-slate-400 text-center whitespace-nowrap">ឯកសារយោង</th>
                      <th className="py-2.5 px-2.5 border border-slate-400">គោលបំណង</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px] text-slate-900">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-8 text-center text-slate-500 font-semibold">
                          មិនមានទិន្នន័យប្រតិបត្តិការសម្រាប់បង្ហាញទេ
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx, idx) => {
                        const docUrl = extractDocUrl(tx);
                        const fromLoc = resolveLocationName(tx.from_location, tx.from_location_id);
                        const toLoc = resolveLocationName(tx.to_location, tx.to_location_id);
                        return (
                          <tr key={tx.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                            <td className="py-2 px-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                            <td className="py-2 px-2.5 border border-slate-300 whitespace-nowrap">
                              {new Date(tx.date || tx.created_at).toLocaleString('km-KH')}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 font-bold text-[#03291E] whitespace-nowrap">
                              {tx.type}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300">{fromLoc}</td>
                            <td className="py-2 px-2.5 border border-slate-300">{toLoc}</td>
                            <td className="py-2 px-2.5 border border-slate-300 font-mono font-semibold whitespace-nowrap">
                              {tx.item_code || '-'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 font-bold">
                              {tx.item_name_kh || '-'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 text-right font-extrabold font-mono whitespace-nowrap">
                              {tx.quantity}
                            </td>
                            <td className="py-2 px-2 border border-slate-300 text-center whitespace-nowrap">
                              {tx.unit || '-'}
                            </td>
                            <td className="py-2 px-2 border border-slate-300 text-center font-semibold whitespace-nowrap">
                              {tx.status || 'RECEIVED'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300">
                              {tx.recorded_by || '-'}
                            </td>
                            <td className="py-2 px-2 border border-slate-300 text-center whitespace-nowrap">
                              {docUrl ? (
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-700 font-bold underline"
                                >
                                  មើលឯកសារ
                                </a>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 whitespace-pre-wrap">
                              {tx.remark || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
