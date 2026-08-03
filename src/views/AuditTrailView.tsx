import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocationContext } from '../contexts/LocationContext';
import { mockTransactions, mockLocations } from '../mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  History, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Search, 
  Calendar, 
  Filter, 
  Building2, 
  RefreshCw, 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowDownToLine, 
  ArrowRightLeft, 
  MinusCircle, 
  SlidersHorizontal,
  Download,
  Clock
} from 'lucide-react';

export function AuditTrailView() {
  const { t, language } = useLanguage();
  const { userRole, isCentralAdmin, isBranchUser, userDisplayName } = useAuth();
  const { selectedLocationId, locations } = useLocationContext();

  // State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Fetch Transactions from Supabase with RLS compliance
  const fetchTransactions = async () => {
    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false });

        // If user is BranchUser, RLS automatically restricts rows on backend,
        // but we can also filter explicitly by location if desired
        const { data, error } = await query;

        if (error) throw error;
        setTransactions(data || []);
      } catch (err: any) {
        console.error('Error fetching audit trail from Supabase:', err);
        loadMockTransactions();
      } finally {
        setLoading(false);
      }
    } else {
      loadMockTransactions();
      setLoading(false);
    }
  };

  const loadMockTransactions = () => {
    // Standard mock transactions + additional rich sample records
    let baseData = [...mockTransactions];

    if (baseData.length < 5) {
      baseData = [
        {
          id: 'tx-001',
          date: new Date(Date.now() - 86400000 * 1).toISOString(),
          type: 'HANDOVER',
          from_location: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
          from_location_id: 'loc-hq-1',
          to_location: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)',
          to_location_id: 'loc-branch-1',
          item_code: 'T-001',
          item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)',
          quantity: 2,
          unit: 'គ្រឿង',
          recorded_by: 'CentralAdmin (មន្ត្រីកណ្តាល)',
          status: 'RECEIVED',
          remark: 'ផ្ទេរសម្ភារៈបច្ចេកទេសជូនសាខា ៧មករា'
        },
        {
          id: 'tx-002',
          date: new Date(Date.now() - 86400000 * 2).toISOString(),
          type: 'STOCK_IN',
          from_location: 'ក្រុមហ៊ុនផ្គត់ផ្គង់ (Supplier Corp)',
          to_location: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
          to_location_id: 'loc-hq-1',
          item_code: 'T-002',
          item_name_kh: 'ស្វានបុកម៉ាក BOSCH Rotary Hammer (GBH 2-26 DRE)',
          quantity: 10,
          unit: 'គ្រឿង',
          recorded_by: 'CentralAdmin (មន្ត្រីកណ្តាល)',
          status: 'RECEIVED',
          remark: 'ទិញចូលស្តុកកណ្តាលប្រចាំត្រីមាស'
        },
        {
          id: 'tx-003',
          date: new Date(Date.now() - 86400000 * 3).toISOString(),
          type: 'STOCK_OUT',
          from_location: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)',
          from_location_id: 'loc-branch-1',
          to_location: 'ការិយាល័យបច្ចេកវិទ្យាព័ត៌មាន',
          to_location_id: 'loc-branch-1',
          item_code: 'T-001',
          item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)',
          quantity: 1,
          unit: 'គ្រឿង',
          recorded_by: 'មន្ត្រីសាខា ៧មករា',
          status: 'RECEIVED',
          remark: 'ដកប្រើប្រាស់សម្រាប់ការងារជួសជុល Network'
        },
        {
          id: 'tx-004',
          date: new Date(Date.now() - 86400000 * 4).toISOString(),
          type: 'ADJUSTMENT',
          from_location: 'សាខាពន្ធដារខណ្ឌដង្កោ',
          from_location_id: 'loc-branch-2',
          to_location: 'សាខាពន្ធដារខណ្ឌដង្កោ',
          to_location_id: 'loc-branch-2',
          item_code: 'S-005',
          item_name_kh: 'ម៉ាសពេទ្យ (Medical Mask)',
          quantity: -2,
          unit: 'ប្រអប់',
          recorded_by: 'មន្ត្រីសាខា ដង្កោ',
          status: 'RECEIVED',
          remark: 'កែតម្រូវស្តុកដោយសារខូចខាតអំឡុងពេលដឹកជញ្ជូន'
        },
        {
          id: 'tx-005',
          date: new Date(Date.now() - 86400000 * 5).toISOString(),
          type: 'HANDOVER',
          from_location: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
          from_location_id: 'loc-hq-1',
          to_location: 'សាខាពន្ធដារខណ្ឌដង្កោ',
          to_location_id: 'loc-branch-2',
          item_code: 'C-003',
          item_name_kh: 'ខ្សែកាបបណ្តាញ Network Cable CAT6 Patch Cord (3m)',
          quantity: 20,
          unit: 'ខ្សែ',
          recorded_by: 'CentralAdmin (មន្ត្រីកណ្តាល)',
          status: 'PENDING',
          remark: 'ផ្ទេរខ្សែកាបបណ្តាញសម្រាប់ដំឡើងម៉ាស៊ីនបោះពុម្ព'
        }
      ];
    }

    // Apply RLS rule to Mock Data:
    // If BranchUser, only show transactions where branch matches selectedLocationId or user's assigned branch
    if (isBranchUser && selectedLocationId) {
      const selectedLocObj = mockLocations.find(l => l.id === selectedLocationId);
      const locNameKh = selectedLocObj?.name_kh || '';

      baseData = baseData.filter(tx => 
        tx.from_location_id === selectedLocationId || 
        tx.to_location_id === selectedLocationId ||
        (locNameKh && (tx.from_location?.includes(locNameKh) || tx.to_location?.includes(locNameKh)))
      );
    }

    setTransactions(baseData);
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedLocationId, isCentralAdmin, isBranchUser]);

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // 1. Text Search (Item Name, Code, Remark, Officer)
      const query = searchQuery.toLowerCase();
      const matchesQuery = !searchQuery || 
        tx.item_name_kh?.toLowerCase().includes(query) ||
        tx.item_code?.toLowerCase().includes(query) ||
        tx.recorded_by?.toLowerCase().includes(query) ||
        tx.remark?.toLowerCase().includes(query) ||
        tx.from_location?.toLowerCase().includes(query) ||
        tx.to_location?.toLowerCase().includes(query);

      // 2. Transaction Type
      const matchesType = selectedType === 'ALL' || tx.type === selectedType;

      // 3. Location Filter
      const matchesLocation = selectedLocation === 'ALL' || 
        tx.from_location_id === selectedLocation ||
        tx.to_location_id === selectedLocation ||
        tx.from_location?.includes(selectedLocation) ||
        tx.to_location?.includes(selectedLocation);

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
  }, [transactions, searchQuery, selectedType, selectedLocation, startDate, endDate]);

  // Export to Excel (CSV with UTF-8 BOM for Khmer support)
  const exportToExcel = () => {
    if (filteredTransactions.length === 0) {
      alert('គ្មានទិន្នន័យសម្រាប់ Export ទេ!');
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
      'កំណត់សម្គាល់ (Remark)'
    ];

    const csvRows = [headers.join(',')];

    filteredTransactions.forEach(tx => {
      const dateStr = new Date(tx.date || tx.created_at).toLocaleString('km-KH');
      const row = [
        `"${dateStr}"`,
        `"${tx.type}"`,
        `"${tx.from_location || '-'}"`,
        `"${tx.to_location || '-'}"`,
        `"${tx.item_code || '-'}"`,
        `"${(tx.item_name_kh || '').replace(/"/g, '""')}"`,
        tx.quantity,
        `"${tx.unit || '-'}"`,
        `"${tx.status || 'RECEIVED'}"`,
        `"${(tx.recorded_by || '').replace(/"/g, '""')}"`,
        `"${(tx.remark || '').replace(/"/g, '""')}"`
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

  // Export to PDF (Fixed for Khmer Font Support)
  const exportToPDF = () => {
    if (filteredTransactions.length === 0) {
      alert('គ្មានទិន្នន័យសម្រាប់ Generate PDF ទេ!');
      return;
    }

    // ដោយសារ jsPDF មិនមាន Text Shaping សម្រាប់ជើងអក្សរ និងស្រៈខ្មែរបានត្រឹមត្រូវ១០០%
    // យើងប្រើប្រាស់មុខងារ Print របស់ Browser ដែលគាំទ្រអក្សរខ្មែរបានល្អឥតខ្ចោះ។
    alert('ដើម្បីរក្សាទម្រង់អក្សរខ្មែរឱ្យបានត្រឹមត្រូវ មុខងារ Export PDF នឹងបើកផ្ទាំង Print។\n\nសូមជ្រើសរើស "Save as PDF" (រក្សាទុកជា PDF) នៅត្រង់ជម្រើស Destination/Printer។');
    printHtmlReport();
  };

  // High-Resolution Printable HTML Report (Native Browser Khmer Font Support)
  const printHtmlReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = filteredTransactions.map((tx, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0; font-size: 11px;">
        <td style="padding: 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px;">${new Date(tx.date || tx.created_at).toLocaleString('km-KH')}</td>
        <td style="padding: 8px; font-weight: bold; color: #03291E;">${tx.type}</td>
        <td style="padding: 8px;">${tx.from_location || '-'}</td>
        <td style="padding: 8px;">${tx.to_location || '-'}</td>
        <td style="padding: 8px; font-family: monospace;">${tx.item_code}</td>
        <td style="padding: 8px; font-weight: bold;">${tx.item_name_kh}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold;">${tx.quantity}</td>
        <td style="padding: 8px;">${tx.unit}</td>
        <td style="padding: 8px; text-align: center;">${tx.status || 'RECEIVED'}</td>
        <td style="padding: 8px;">${tx.recorded_by || '-'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>របាយការណ៍ប្រវត្តិសវនកម្ម (Audit Trail Report) - GDT</title>
          <link href="https://fonts.googleapis.com/css2?family=Siemreap&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Siemreap', sans-serif; padding: 24px; color: #0F172A; }
            h1 { font-size: 18px; color: #03291E; margin-bottom: 4px; }
            p { font-size: 12px; color: #64748B; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { background-color: #03291E; color: white; padding: 10px; font-size: 11px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>អគ្គនាយកដ្ឋានពន្ធដារ - របាយការណ៍ប្រវត្តិសវនកម្មស្តុក (Audit Trail Report)</h1>
          <p>កាលបរិច្ឆេទបង្កើត៖ ${new Date().toLocaleString('km-KH')} | ចំនួនប្រតិបត្តិការសរុប៖ ${filteredTransactions.length} ប្រតិបត្តិការ</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>កាលបរិច្ឆេទ</th>
                <th>ប្រភេទ</th>
                <th>ពីទីតាំង</th>
                <th>ទៅទីតាំង</th>
                <th>SKU</th>
                <th>ឈ្មោះសម្ភារៈ</th>
                <th>ចំនួន</th>
                <th>ខ្នាត</th>
                <th>ស្ថានភាព</th>
                <th>មន្ត្រីកត់ត្រា</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-siemreap">

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100/90 text-emerald-900 rounded-2xl border border-emerald-200 shrink-0">
            <History size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">ប្រវត្តិសវនកម្ម និង របាយការណ៍ (Audit Trail & Reports)</h2>
              <span className="bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full text-xs font-bold border border-emerald-300">
                {filteredTransactions.length} ប្រតិបត្តិការ
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              ជំហានទី៥៖ ត្រួតពិនិត្យប្រវត្តិប្រតិបត្តិការទាំងអស់ និងទាញយករបាយការណ៍ជា Excel (CSV) ឬ PDF
            </p>
          </div>
        </div>

        {/* Action Buttons: Export Excel & PDF */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={exportToExcel}
            className="flex items-center space-x-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel (CSV)</span>
          </button>

          <button
            onClick={exportToPDF}
            className="flex items-center space-x-2 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <FileText size={16} />
            <span>Export PDF</span>
          </button>

          <button
            onClick={printHtmlReport}
            className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs"
            title="បោះពុម្ពទំព័រ"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* RLS Security Indicator */}
      <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
        isCentralAdmin
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}>
        <div className="flex items-center gap-3">
          {isCentralAdmin ? (
            <ShieldCheck size={20} className="text-emerald-700 shrink-0" />
          ) : (
            <ShieldAlert size={20} className="text-amber-700 shrink-0" />
          )}
          <div>
            <span className="font-extrabold uppercase">សិទ្ធិមើលទិន្នន័យ (RLS Authorization): </span>
            {isCentralAdmin ? (
              <span>អ្នកជា <strong>CentralAdmin</strong> — មានសិទ្ធិមើលឃើញ និង Export ប្រវត្តិប្រតិបត្តិការទាំងអស់ទូទាំងអគ្គនាយកដ្ឋានពន្ធដារ។</span>
            ) : (
              <span>អ្នកជា <strong>BranchUser</strong> — ប្រព័ន្ធចម្រោះទិន្នន័យ (RLS) បង្ហាញតែប្រតិបត្តិការណាដែលពាក់ព័ន្ធនឹងសាខារបស់អ្នកប៉ុណ្ណោះ។</span>
            )}
          </div>
        </div>

        <button
          onClick={fetchTransactions}
          className="bg-white/80 hover:bg-white text-slate-800 p-2 rounded-xl border border-slate-200 shrink-0 transition-all"
          title="Refresh Data"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider border-b pb-2">
          <Filter size={15} className="text-emerald-700" />
          <span>តម្រងស្វែងរកទិន្នន័យ (Data Filters)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
            </div>
          </div>

          {/* Transaction Type Filter */}
          <div className="space-y-1">
            <label className="text-slate-500 font-semibold">ប្រភេទប្រតិបត្តិការ</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer"
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
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 cursor-pointer truncate"
            >
              <option value="ALL">-- គ្រប់ទីតាំង (All Locations) --</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>
                  {loc.name_kh}
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
                className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
              <span className="text-slate-400 font-normal">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
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
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {filteredTransactions.map((tx, idx) => {
                  const isHandover = tx.type === 'HANDOVER';
                  const isStockIn = tx.type === 'STOCK_IN';
                  const isStockOut = tx.type === 'STOCK_OUT';
                  const isPending = tx.status === 'PENDING';

                  return (
                    <tr key={tx.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">{idx + 1}</td>
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
                      <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={tx.from_location}>
                        {tx.from_location || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 max-w-[160px] truncate" title={tx.to_location}>
                        {tx.to_location || '-'}
                      </td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] text-slate-700 font-bold mr-1.5">
                          {tx.item_code}
                        </span>
                        <span className="font-bold text-slate-900">{tx.item_name_kh}</span>
                        {tx.remark && (
                          <div className="text-[11px] text-slate-500 font-normal truncate max-w-[240px]">
                            {tx.remark}
                          </div>
                        )}
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
                          <span>{isPending ? 'PENDING' : 'RECEIVED'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-semibold text-[11px] whitespace-nowrap">
                        {tx.recorded_by || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
