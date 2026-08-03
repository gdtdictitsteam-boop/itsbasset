import React, { useEffect, useState } from 'react';
import { Database, Code2, Copy, Check, FileText, ShieldCheck, HardDrive } from 'lucide-react';

export function SqlCodeView() {
  const [activeTab, setActiveTab] = useState<'rls' | 'storage' | 'python' | 'sql'>('storage');
  const [sqlCode, setSqlCode] = useState<string>('Loading schema...');
  const [pythonCode, setPythonCode] = useState<string>('Loading app.py...');
  const [copied, setCopied] = useState<boolean>(false);

  const rlsCode = `-- =========================================================================
-- STEP 2: SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR GDT INVENTORY SYSTEM
-- =========================================================================

-- 1. បង្កើត Table user_profiles ដើម្បីផ្ទុក Role (CentralAdmin/BranchUser) និង Location ID
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'BranchUser', -- 'CentralAdmin' ឬ 'BranchUser'
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- បើកដំណើរការ RLS លើ user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CentralAdmin full access on user_profiles"
ON public.user_profiles FOR ALL
USING (
    auth.jwt() ->> 'role' = 'CentralAdmin' 
    OR auth.jwt() ->> 'role' = 'Admin-GDT'
    OR EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
    )
);

CREATE POLICY "Users view own profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);


-- =========================================================================
-- 2. បើក ROW LEVEL SECURITY (RLS) លើ TABLE INVENTORY (ការពារទិន្នន័យពី BACKEND)
-- =========================================================================
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 2.1 CentralAdmin Policy: អាច SELECT / INSERT / UPDATE / DELETE ទិន្នន័យស្តុកទាំងអស់
CREATE POLICY "CentralAdmin full access to inventory"
ON public.inventory
FOR ALL
USING (
    auth.jwt() ->> 'role' = 'CentralAdmin'
    OR auth.jwt() ->> 'role' = 'Admin-GDT'
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
    )
)
WITH CHECK (
    auth.jwt() ->> 'role' = 'CentralAdmin'
    OR auth.jwt() ->> 'role' = 'Admin-GDT'
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
    )
);

-- 2.2 BranchUser Policy: អាច SELECT/មើលឃើញ តែទិន្នន័យស្តុកណាដែលមាន location_id ត្រូវនឹងទីតាំងរបស់គាត់ប៉ុណ្ណោះ
CREATE POLICY "BranchUser view assigned location inventory only"
ON public.inventory
FOR SELECT
USING (
    location_id IN (
        SELECT location_id FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'BranchUser'
    )
    OR location_id = (auth.jwt() ->> 'location_id')::uuid
);
`;

  const storageCode = `-- =========================================================================
-- STEP 3: SUPABASE STORAGE BUCKET & STORAGE RLS POLICIES (handover_docs)
-- =========================================================================

-- 1. បង្កើត Public Storage Bucket ឈ្មោះ "handover_docs" ជាមួយកំណត់ Size Limit 5MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'handover_docs', 
    'handover_docs', 
    true, 
    5242880, -- 5MB limit គិតជា Bytes
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. បើក RLS លើ storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: អនុញ្ញាតឱ្យតែ CentralAdmin អាច Upload ឯកសារយោងចូល handover_docs Bucket
CREATE POLICY "CentralAdmin upload handover documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'handover_docs'
    AND (
        auth.jwt() ->> 'role' = 'CentralAdmin'
        OR auth.jwt() ->> 'role' = 'Admin-GDT'
        OR EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
        )
    )
);

-- 4. Policy: អនុញ្ញាតឱ្យអ្នកប្រើប្រាស់ Authenticated ទាំងអស់អាច SELECT / មើលឯកសារបាន
CREATE POLICY "Authenticated users view handover documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'handover_docs');
`;

  useEffect(() => {
    fetch('/schema.sql')
      .then(res => res.text())
      .then(text => setSqlCode(text))
      .catch(() => setSqlCode('-- schema.sql located in project root.'));

    fetch('/app.py')
      .then(res => res.text())
      .then(text => setPythonCode(text))
      .catch(() => setPythonCode('# app.py Streamlit code located in project root.'));
  }, []);

  const getCurrentCode = () => {
    if (activeTab === 'storage') return storageCode;
    if (activeTab === 'rls') return rlsCode;
    if (activeTab === 'sql') return sqlCode;
    return pythonCode;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCurrentCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-siemreap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100/80 text-emerald-800 rounded-xl border border-emerald-200/80">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">មូលទិន្នន័យ និង កូដសុវត្ថិភាព (Database, RLS & Storage)</h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Supabase Schema, Storage Bucket Policies & Atomic RPC Functions
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 bg-[#03291E] hover:bg-[#1E6047] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto"
        >
          {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          <span>{copied ? 'បានចម្លង! (Copied)' : 'ចម្លងកូដ (Copy Code)'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden font-siemreap">
        {/* Tabs */}
        <div className="bg-slate-50/90 border-b border-slate-200/80 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex flex-wrap space-x-2 gap-y-1">
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'storage'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <HardDrive size={15} className="text-teal-400" />
              <span>Storage Policies (Step 3)</span>
            </button>
            <button
              onClick={() => setActiveTab('rls')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'rls'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>Table RLS (Step 2)</span>
            </button>
            <button
              onClick={() => setActiveTab('python')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'python'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <FileText size={15} />
              <span>Python Streamlit</span>
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'sql'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Code2 size={15} />
              <span>Full schema.sql</span>
            </button>
          </div>

          <span className="text-xs font-mono text-slate-600 font-bold hidden md:inline-block">
            {activeTab === 'storage' ? 'storage_policies.sql' : activeTab === 'rls' ? 'rls_policies.sql' : activeTab === 'python' ? 'app.py' : 'schema.sql'}
          </span>
        </div>

        <div className="p-4 bg-[#0F172A] overflow-auto max-h-[620px]">
          <pre className="text-xs font-mono text-[#7DD3FC] leading-relaxed whitespace-pre-wrap">
            <code>{getCurrentCode()}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
