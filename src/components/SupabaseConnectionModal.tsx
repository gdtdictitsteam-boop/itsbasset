import React, { useState, useEffect } from 'react';
import { 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Copy, 
  Check, 
  KeyRound, 
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { 
  getSupabaseConfig, 
  setSupabaseConfig, 
  isSupabaseConfigured, 
  testSupabaseConnection 
} from '../lib/supabase';
import { useInventoryContext } from '../contexts/InventoryContext';

interface SupabaseConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SupabaseConnectionModal({ isOpen, onClose }: SupabaseConnectionModalProps) {
  const { refreshInventory, reseedStandardStock } = useInventoryContext();
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    connected: boolean;
    message: string;
    itemsCount?: number;
    locationsCount?: number;
    inventoryCount?: number;
    transactionsCount?: number;
    error?: string;
  } | null>(null);

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getSupabaseConfig();
      setUrl(config.url || '');
      setAnonKey(config.anonKey || '');
      setTestResult(null);
      setSeedResult(null);

      // Auto test connection on open if configured
      if (isSupabaseConfigured()) {
        runTest();
      }
    }
  }, [isOpen]);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
    } catch (e: any) {
      setTestResult({
        connected: false,
        message: 'បរាជ័យក្នុងការតភ្ជាប់',
        error: e.message || String(e)
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) return;

    setSupabaseConfig(url.trim(), anonKey.trim());
    await runTest();
    await refreshInventory();
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await reseedStandardStock();
      setSeedResult(res);
      await runTest();
    } catch (e: any) {
      setSeedResult({ success: false, message: e.message || 'Error seeding' });
    } finally {
      setSeeding(false);
    }
  };

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-siemreap animate-in fade-in duration-200">
      <div className="bg-white w-[95vw] sm:w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-[#03291E] px-4 sm:px-6 py-4 text-white flex items-center justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30 text-emerald-300 shrink-0">
              <Database size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold flex items-center gap-2 truncate">
                <span>ការតភ្ជាប់ប្រព័ន្ធទិន្នន័យ (Database Connection)</span>
              </h3>
              <p className="text-xs text-emerald-200/80 line-clamp-2">
                ពិនិត្យស្ថានភាព ឬបញ្ចូលអាសយដ្ឋានតភ្ជាប់ប្រព័ន្ធទិន្នន័យដើម្បីដំណើរការទិន្នន័យពិតប្រាកដ
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">

          {/* Connection Status Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 ${
            isConfigured && testResult?.connected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex items-start space-x-3">
              {isConfigured && testResult?.connected ? (
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={22} className="text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <strong className="block text-sm font-bold">
                  {isConfigured && testResult?.connected
                    ? '🟢 កំពុងដំណើរការជាមួយប្រព័ន្ធទិន្នន័យ (Database) ពិតប្រាកដ'
                    : '🟡 មិនទាន់តភ្ជាប់ទៅកាន់ប្រព័ន្ធទិន្នន័យ (Database)'}
                </strong>
                <p className="text-xs mt-0.5 opacity-90">
                  {isConfigured && testResult?.connected
                    ? `ទិន្នន័យស្តុក សម្ភារៈ និងប្រតិបត្តិការទាំងអស់ កំពុងទាញ និងកត់ត្រាចូលប្រព័ន្ធទិន្នន័យផ្ទាល់។`
                    : `សូមបញ្ចូល Database URL និង API Key ខាងក្រោម រួចចុច "រក្សាទុក និងតភ្ជាប់"។`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={runTest}
              disabled={testing || !url}
              className="w-full sm:w-auto justify-center min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 shadow-2xs shrink-0 disabled:opacity-50"
            >
              <RefreshCw size={13} className={testing ? 'animate-spin' : ''} />
              <span>{testing ? 'កំពុងតេស្ត...' : 'តេស្តឡើងវិញ'}</span>
            </button>
          </div>

          {/* Table Counts if Connected */}
          {testResult?.connected && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-1.5">
                <Layers size={14} className="text-[#03291E]" />
                <span>ចំនួនទិន្នន័យបច្ចុប្បន្នក្នុងប្រព័ន្ធទិន្នន័យ (Database):</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500">Items (សម្ភារៈ)</div>
                  <div className="text-lg font-black font-mono text-[#03291E] mt-0.5">{testResult.itemsCount ?? 0}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500">Locations (ទីតាំង)</div>
                  <div className="text-lg font-black font-mono text-[#03291E] mt-0.5">{testResult.locationsCount ?? 0}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500">Inventory (ស្តុក)</div>
                  <div className="text-lg font-black font-mono text-[#03291E] mt-0.5">{testResult.inventoryCount ?? 0}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                  <div className="text-[11px] font-semibold text-slate-500">Transactions</div>
                  <div className="text-lg font-black font-mono text-[#03291E] mt-0.5">{testResult.transactionsCount ?? 0}</div>
                </div>
              </div>

              {/* Seed Button if empty */}
              {((testResult.itemsCount ?? 0) === 0 || (testResult.inventoryCount ?? 0) === 0) && (
                <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <span className="text-xs text-amber-800 font-semibold">
                    ⚠️ តារាងទិន្នន័យក្នុងប្រព័ន្ធមិនទាន់មានទិន្នន័យឡើយ!
                  </span>
                  <button
                    type="button"
                    onClick={handleSeed}
                    disabled={seeding}
                    className="w-full sm:w-auto justify-center min-h-[40px] px-3.5 py-1.5 bg-[#03291E] hover:bg-[#1E6047] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs shrink-0"
                  >
                    {seeding ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>កំពុងបញ្ចូលទិន្នន័យ...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} className="text-emerald-400" />
                        <span>បញ្ចូលទិន្នន័យដំបូង (Seed Master Data)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {seedResult && (
                <div className={`mt-2 p-2 rounded-lg text-xs font-semibold ${seedResult.success ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                  {seedResult.message}
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                <span>អាសយដ្ឋានមូលទិន្នន័យ (Database Project URL)</span>
                <span className="text-rose-500 font-bold ml-1">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://database.gdt.gov.kh"
                className="w-full min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                <span>កូដសម្ងាត់តភ្ជាប់ប្រព័ន្ធទិន្នន័យ (Database API Key)</span>
                <span className="text-rose-500 font-bold">*</span>
              </label>
              <textarea
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-[#03291E]/20 focus:border-[#03291E] resize-none"
                required
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto min-h-[42px] px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                បិទ (Close)
              </button>
              <button
                type="submit"
                className="w-full sm:w-auto min-h-[42px] justify-center px-6 py-2 bg-[#03291E] hover:bg-[#1E6047] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5"
              >
                <Check size={15} className="text-emerald-400" />
                <span>រក្សាទុក និងតភ្ជាប់ (Save & Connect)</span>
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
