import React, { useEffect, useState } from 'react';
import { Database, Code2, Copy, Check, FileText, ShieldCheck, HardDrive, Clock } from 'lucide-react';

export function SqlCodeView() {
  const [activeTab, setActiveTab] = useState<'step4' | 'storage' | 'rls' | 'python' | 'sql'>('step4');
  const [sqlCode, setSqlCode] = useState<string>('Loading schema...');
  const [pythonCode, setPythonCode] = useState<string>('Loading app.py...');
  const [copied, setCopied] = useState<boolean>(false);

  const step4Code = `-- =========================================================================
-- STEP 4: 2-STEP HANDOVER & ACKNOWLEDGEMENT WITH AI OCR VERIFICATION
-- =========================================================================

-- 1. បន្ថែម Column status ក្នុង Table transactions (PENDING -> RECEIVED)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 2. Step 1 RPC: CentralAdmin ផ្ទេរសម្ភារៈ (កាត់ស្តុកកណ្តាល HQ, កត់ត្រា status = 'PENDING')
CREATE OR REPLACE FUNCTION handle_branch_handover(
    p_from_location UUID,
    p_to_location UUID,
    p_item_id UUID,
    p_quantity INT,
    p_recorded_by VARCHAR,
    p_remark TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_available_qty INT;
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
BEGIN
    -- Authorization Check
    IF (auth.jwt() ->> 'role') NOT IN ('CentralAdmin', 'Admin-GDT') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Only CentralAdmin can perform stock handover.';
        END IF;
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    -- ពិនិត្យចំនួនស្តុកនៅ HQ
    SELECT quantity INTO v_available_qty
    FROM public.inventory
    WHERE location_id = p_from_location AND item_id = p_item_id;

    IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in HQ. Available: %, Requested: %', COALESCE(v_available_qty, 0), p_quantity;
    END IF;

    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    -- 1. កាត់ស្តុកចេញពី HQ
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 2. កត់ត្រាប្រតិបត្តិការជាមួយ status = 'PENDING'
    INSERT INTO public.transactions (
        type, from_location_id, to_location_id, item_id,
        item_code, item_name_kh, quantity, unit,
        recorded_by, remark, status
    ) VALUES (
        'HANDOVER', p_from_location, p_to_location, p_item_id,
        v_item_code, v_item_name_kh, p_quantity, v_item_unit,
        p_recorded_by, p_remark, 'PENDING'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'status', 'PENDING',
        'message', 'Stock deducted from HQ. Status set to PENDING awaiting branch acknowledgment.'
    );
END;
$$;

-- 3. Step 2 RPC: Branch User ចុចទទួលទំនិញ (បូកស្តុកចូលសាខា, ប្តូរ status = 'RECEIVED')
CREATE OR REPLACE FUNCTION acknowledge_handover(
    p_transaction_id UUID,
    p_received_by VARCHAR DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx RECORD;
    v_user_role VARCHAR;
    v_user_location UUID;
BEGIN
    SELECT * INTO v_tx
    FROM public.transactions
    WHERE id = p_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Transaction record not found.';
    END IF;

    IF v_tx.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'Transaction has already been acknowledged.';
    END IF;

    -- ពិនិត្យសិទ្ធិមន្ត្រីទទួលតាម Role និង Location ID
    SELECT role, location_id INTO v_user_role, v_user_location
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF v_user_role NOT IN ('CentralAdmin', 'Admin-GDT') AND (v_user_location IS NULL OR v_user_location != v_tx.to_location_id) THEN
        RAISE EXCEPTION 'Unauthorized: You can only acknowledge transfers destined for your assigned branch location.';
    END IF;

    -- 1. ប្តូរ status ទៅជា 'RECEIVED'
    UPDATE public.transactions
    SET status = 'RECEIVED',
        recorded_by = CASE WHEN p_received_by <> '' THEN p_received_by ELSE recorded_by END
    WHERE id = p_transaction_id;

    -- 2. បូកស្តុកចូលសាខាគោលដៅ (to_location_id)
    INSERT INTO public.inventory (location_id, item_id, quantity, updated_at)
    VALUES (v_tx.to_location_id, v_tx.item_id, v_tx.quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'status', 'RECEIVED',
        'message', 'Handover acknowledged successfully. Stock added to destination branch.'
    );
END;
$$;
`;

  const rlsCode = `-- =========================================================================
-- STEP 2: SUPABASE ROW LEVEL SECURITY (RLS) POLICIES FOR GDT INVENTORY SYSTEM
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'BranchUser',
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CentralAdmin full access to inventory"
ON public.inventory FOR ALL
USING (
    auth.jwt() ->> 'role' = 'CentralAdmin' OR auth.jwt() ->> 'role' = 'Admin-GDT'
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT'))
);

CREATE POLICY "BranchUser view assigned location inventory only"
ON public.inventory FOR SELECT
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

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'handover_docs', 'handover_docs', true, 5242880,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CentralAdmin upload handover documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'handover_docs'
    AND (
        auth.jwt() ->> 'role' = 'CentralAdmin' OR auth.jwt() ->> 'role' = 'Admin-GDT'
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT'))
    )
);

CREATE POLICY "Authenticated users view handover documents"
ON storage.objects FOR SELECT TO authenticated
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
    if (activeTab === 'step4') return step4Code;
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
              Supabase Schema, Storage Bucket Policies, 2-Step Handover & Atomic RPC Functions
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
              onClick={() => setActiveTab('step4')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'step4'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Clock size={15} className="text-amber-400" />
              <span>2-Step RPC & AI (Step 4)</span>
            </button>
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
            {activeTab === 'step4' ? 'step4_2step_rpc.sql' : activeTab === 'storage' ? 'storage_policies.sql' : activeTab === 'rls' ? 'rls_policies.sql' : activeTab === 'python' ? 'app.py' : 'schema.sql'}
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
