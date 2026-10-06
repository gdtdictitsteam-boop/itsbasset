import React, { useEffect, useState } from 'react';
import { Database, Code2, Copy, Check, FileText, ShieldCheck, HardDrive, Clock, SlidersHorizontal, KeyRound } from 'lucide-react';
import { SUPABASE_AUTH_USERS_SQL } from '../components/UserManagementModal';

export function SqlCodeView() {
  const [activeTab, setActiveTab] = useState<'rpcs' | 'auth' | 'step4' | 'storage' | 'rls' | 'sql'>('rpcs');
  const [sqlCode, setSqlCode] = useState<string>('Loading schema...');
  const [copied, setCopied] = useState<boolean>(false);

  const rpcsCode = `-- =========================================================================
-- COMPLETE SUPABASE ATOMIC RPC FUNCTIONS FOR GDT INVENTORY SYSTEM
-- Run this script in Supabase Dashboard -> SQL Editor
-- =========================================================================

-- Function 1: record_stock_in (Add stock to selected location)
CREATE OR REPLACE FUNCTION public.record_stock_in(
    p_location_id UUID,
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
    v_new_qty INT;
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'បរិមាណបញ្ចូលត្រូវតែធំជាង ០ (Quantity must be greater than zero)';
    END IF;

    -- Fetch item metadata
    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    IF v_item_code IS NULL THEN
        RAISE EXCEPTION 'រកមិនឃើញសម្ភារៈក្នុងប្រព័ន្ធឡើយ (Item not found)';
    END IF;

    -- Upsert inventory table
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (p_location_id, p_item_id, p_quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        last_updated = NOW()
    RETURNING quantity INTO v_new_qty;

    -- Record transaction
    INSERT INTO public.transactions (
        type, to_location_id, item_id, item_code, item_name_kh,
        quantity, unit, recorded_by, remark, status
    ) VALUES (
        'STOCK_IN', p_location_id, p_item_id, v_item_code, v_item_name_kh,
        p_quantity, v_item_unit, p_recorded_by, COALESCE(p_remark, 'បញ្ចូលស្តុកថ្មី'), 'RECEIVED'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'new_quantity', v_new_qty,
        'transaction_id', v_transaction_id
    );
END;
$$;


-- Function 2: handle_branch_handover (Direct Handover: Deducts from HQ, Adds to Branch Immediately, Status COMPLETED)
CREATE OR REPLACE FUNCTION public.handle_branch_handover(
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
    v_new_dest_qty INT;
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'បរិមាណផ្ទេរត្រូវតែធំជាង ០';
    END IF;

    -- Check source inventory
    SELECT quantity INTO v_available_qty
    FROM public.inventory
    WHERE location_id = p_from_location AND item_id = p_item_id;

    IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'ស្តុកនៅទីតាំងដើមមិនគ្រប់គ្រាន់ទេ (មាន: %, ស្នើសុំ: %)', COALESCE(v_available_qty, 0), p_quantity;
    END IF;

    -- Fetch item metadata
    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    -- 1. Deduct stock from source location immediately
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        last_updated = NOW()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 2. Increment / Insert stock into target destination branch immediately (Auto Sync)
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (p_to_location, p_item_id, p_quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        last_updated = NOW()
    RETURNING quantity INTO v_new_dest_qty;

    -- 3. Record transaction with status = 'COMPLETED'
    INSERT INTO public.transactions (
        type, from_location_id, to_location_id, item_id, item_code, 
        item_name_kh, quantity, unit, recorded_by, remark, status
    ) VALUES (
        'HANDOVER', p_from_location, p_to_location, p_item_id, v_item_code, 
        v_item_name_kh, p_quantity, v_item_unit, p_recorded_by, p_remark, 'COMPLETED'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_branch_quantity', v_new_dest_qty,
        'status', 'COMPLETED'
    );
END;
$$;


-- Function 3: acknowledge_handover (Branch receives stock, Status RECEIVED)
CREATE OR REPLACE FUNCTION public.acknowledge_handover(
    p_transaction_id UUID,
    p_received_by VARCHAR DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx RECORD;
    v_new_dest_qty INT;
BEGIN
    -- Fetch Transaction details
    SELECT * INTO v_tx
    FROM public.transactions
    WHERE id = p_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'រកមិនឃើញទិន្នន័យប្រតិបត្តិការផ្ទេរនេះឡើយ';
    END IF;

    IF v_tx.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'ប្រតិបត្តិការនេះត្រូវបានទទួលស្គាល់រួចរាល់ហើយ';
    END IF;

    -- 1. Update Transaction status to 'RECEIVED'
    UPDATE public.transactions
    SET status = 'RECEIVED',
        recorded_by = CASE WHEN p_received_by <> '' THEN p_received_by ELSE recorded_by END,
        date = NOW()
    WHERE id = p_transaction_id;

    -- 2. Add stock to destination branch location
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (v_tx.to_location_id, v_tx.item_id, v_tx.quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        last_updated = NOW()
    RETURNING quantity INTO v_new_dest_qty;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'new_branch_quantity', v_new_dest_qty,
        'status', 'RECEIVED'
    );
END;
$$;


-- Function 4: record_stock_out (Deduct stock from chosen location)
CREATE OR REPLACE FUNCTION public.record_stock_out(
    p_location_id UUID,
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
    v_current_qty INT;
    v_new_qty INT;
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'ចំនួនដកចេញត្រូវតែធំជាង ០';
    END IF;

    -- Check current stock
    SELECT quantity INTO v_current_qty
    FROM public.inventory
    WHERE location_id = p_location_id AND item_id = p_item_id;

    IF v_current_qty IS NULL OR v_current_qty < p_quantity THEN
        RAISE EXCEPTION 'បរិមាណស្តុកមិនគ្រប់គ្រាន់ទេ (មាន: %, ស្នើសុំដក: %)', COALESCE(v_current_qty, 0), p_quantity;
    END IF;

    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    -- Deduct stock
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        last_updated = NOW()
    WHERE location_id = p_location_id AND item_id = p_item_id
    RETURNING quantity INTO v_new_qty;

    -- Record transaction
    INSERT INTO public.transactions (
        type, from_location_id, item_id, item_code, item_name_kh,
        quantity, unit, recorded_by, remark, status
    ) VALUES (
        'STOCK_OUT', p_location_id, p_item_id, v_item_code, v_item_name_kh,
        p_quantity, v_item_unit, p_recorded_by, COALESCE(p_remark, 'ដកប្រើប្រាស់'), 'RECEIVED'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'new_quantity', v_new_qty,
        'transaction_id', v_transaction_id
    );
END;
$$;


-- Function 5: record_stock_adjustment (Adjust to Actual Physical Quantity & Calculate Delta)
CREATE OR REPLACE FUNCTION public.record_stock_adjustment(
    p_location_id UUID,
    p_item_id UUID,
    p_actual_quantity INT,
    p_recorded_by VARCHAR,
    p_remark TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_previous_qty INT;
    v_delta INT;
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
    v_final_remark TEXT;
BEGIN
    IF p_actual_quantity < 0 THEN
        RAISE EXCEPTION 'ចំនួនស្តុកជាក់ស្តែងមិនអាចជាលេខអវិជ្ជមានបានទេ';
    END IF;

    -- Get current quantity (0 if no record exists)
    SELECT quantity INTO v_previous_qty
    FROM public.inventory
    WHERE location_id = p_location_id AND item_id = p_item_id;

    IF v_previous_qty IS NULL THEN
        v_previous_qty := 0;
    END IF;

    -- Calculate difference (Delta)
    v_delta := p_actual_quantity - v_previous_qty;

    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    IF v_item_code IS NULL THEN
        RAISE EXCEPTION 'រកមិនឃើញសម្ភារៈឡើយ';
    END IF;

    -- Set new actual physical quantity in inventory
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (p_location_id, p_item_id, p_actual_quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = EXCLUDED.quantity,
        last_updated = NOW();

    v_final_remark := COALESCE(p_remark, 'កែតម្រូវស្តុកជាក់ស្តែង') || 
        ' [ប្រព័ន្ធ: ' || v_previous_qty || ' -> ជាក់ស្តែង: ' || p_actual_quantity || 
        ' | ផលសង: ' || CASE WHEN v_delta >= 0 THEN '+' || v_delta ELSE '' || v_delta END || ' ' || COALESCE(v_item_unit, '') || ']';

    -- Record transaction with delta and audit history
    INSERT INTO public.transactions (
        type, to_location_id, from_location_id, item_id, item_code, item_name_kh,
        quantity, unit, recorded_by, remark, status
    ) VALUES (
        'ADJUSTMENT', p_location_id, p_location_id, p_item_id, v_item_code, v_item_name_kh,
        v_delta, v_item_unit, p_recorded_by, v_final_remark, 'RECEIVED'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'previous_quantity', v_previous_qty,
        'actual_quantity', p_actual_quantity,
        'delta', v_delta,
        'transaction_id', v_transaction_id
    );
END;
$$;
`;

  const step4Code = `-- =========================================================================
-- STEP 4: 2-STEP HANDOVER & ACKNOWLEDGEMENT (ផ្ទេរ និងទទួលសម្ភារៈ)
-- =========================================================================

-- 1. បន្ថែម Column status ក្នុង Table transactions (COMPLETED)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED';

-- 2. Direct Handover Auto Sync RPC: CentralAdmin ផ្ទេរសម្ភារៈ (កាត់ស្តុក HQ, បូកចូលស្តុកសាខាភ្លាមៗ, status = 'COMPLETED')
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
    v_new_dest_qty INT;
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
        last_updated = NOW()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 2. បូកបញ្ចូលក្នុង Table inventory របស់សាខាគោលដៅភ្លាមៗ (Auto Sync)
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (p_to_location, p_item_id, p_quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        last_updated = NOW()
    RETURNING quantity INTO v_new_dest_qty;

    -- 3. កត់ត្រាប្រតិបត្តិការជាមួយ status = 'COMPLETED'
    INSERT INTO public.transactions (
        type, from_location_id, to_location_id, item_id,
        item_code, item_name_kh, quantity, unit,
        recorded_by, remark, status
    ) VALUES (
        'HANDOVER', p_from_location, p_to_location, p_item_id,
        v_item_code, v_item_name_kh, p_quantity, v_item_unit,
        p_recorded_by, p_remark, 'COMPLETED'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_branch_quantity', v_new_dest_qty,
        'status', 'COMPLETED',
        'message', 'Stock transferred directly to destination branch. Status set to COMPLETED.'
    );
END;
$$;

-- 3. Step 2 RPC: Branch User ចុចទទួលសម្ភារ (បូកស្តុកចូលសាខា, ប្តូរ status = 'RECEIVED')
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
    INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
    VALUES (v_tx.to_location_id, v_tx.item_id, v_tx.quantity, NOW())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET 
        quantity = public.inventory.quantity + EXCLUDED.quantity,
        last_updated = NOW();

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
-- STEP 2: SUPABASE ROLE-BASED ACCESS CONTROL (RBAC) & ROW LEVEL SECURITY (RLS)
-- ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិមន្ត្រី និងសុវត្ថិភាពទិន្នន័យតាមសាខា (GDT Inventory)
-- =========================================================================

-- 1. តារាង user_profiles (ចងភ្ជាប់ auth.users ទៅនឹង locations តាមរយៈ location_id)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'BranchUser', -- 'CentralAdmin' ឬ 'BranchUser'
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL, -- សាខាប្រចាំការ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- បង្កើត Index ដើម្បីបង្កើនល្បឿន Query តាម Role និង Location
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_location ON public.user_profiles(location_id);

-- 2. បើកដំណើរការ RLS លើគ្រប់ Tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

-- 3. Functions ជំនួយសម្រាប់ពិនិត្យសិទ្ធិមន្ត្រីក្នុង PostgreSQL
CREATE OR REPLACE FUNCTION public.is_central_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
  ) OR (auth.jwt() ->> 'role') IN ('CentralAdmin', 'Admin-GDT');
$$;

CREATE OR REPLACE FUNCTION public.get_user_location_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT location_id FROM public.user_profiles
  WHERE id = auth.uid();
$$;

-- 4. គោលការណ៍ RLS លើ USER_PROFILES
DROP POLICY IF EXISTS "CentralAdmin full access on user_profiles" ON public.user_profiles;
CREATE POLICY "CentralAdmin full access on user_profiles"
ON public.user_profiles FOR ALL
TO authenticated
USING (public.is_central_admin())
WITH CHECK (public.is_central_admin());

DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
ON public.user_profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 5. គោលការណ៍ RLS លើ INVENTORY (ចាក់សោ BranchUser ហាមមើល ឬកែស្តុកសាខាផ្សេង)
DROP POLICY IF EXISTS "CentralAdmin full access on inventory" ON public.inventory;
CREATE POLICY "CentralAdmin full access on inventory"
ON public.inventory FOR ALL
TO authenticated
USING (public.is_central_admin())
WITH CHECK (public.is_central_admin());

DROP POLICY IF EXISTS "BranchUser can only view own branch inventory" ON public.inventory;
CREATE POLICY "BranchUser can only view own branch inventory"
ON public.inventory FOR SELECT
TO authenticated
USING (
    public.is_central_admin() 
    OR location_id = public.get_user_location_id()
);

DROP POLICY IF EXISTS "BranchUser can only update own branch inventory" ON public.inventory;
CREATE POLICY "BranchUser can only update own branch inventory"
ON public.inventory FOR UPDATE
TO authenticated
USING (
    public.is_central_admin() 
    OR location_id = public.get_user_location_id()
)
WITH CHECK (
    public.is_central_admin() 
    OR location_id = public.get_user_location_id()
);

-- 6. គោលការណ៍ RLS លើ TRANSACTIONS (ប្រវត្តិប្រតិបត្តិការ)
DROP POLICY IF EXISTS "CentralAdmin full access on transactions" ON public.transactions;
CREATE POLICY "CentralAdmin full access on transactions"
ON public.transactions FOR ALL
TO authenticated
USING (public.is_central_admin())
WITH CHECK (public.is_central_admin());

DROP POLICY IF EXISTS "BranchUser can only view own branch transactions" ON public.transactions;
CREATE POLICY "BranchUser can only view own branch transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (
    public.is_central_admin()
    OR from_location_id = public.get_user_location_id()
    OR to_location_id = public.get_user_location_id()
);

DROP POLICY IF EXISTS "BranchUser can only record own branch transactions" ON public.transactions;
CREATE POLICY "BranchUser can only record own branch transactions"
ON public.transactions FOR INSERT
TO authenticated
WITH CHECK (
    public.is_central_admin()
    OR (
        type IN ('STOCK_OUT', 'ADJUSTMENT') 
        AND (from_location_id = public.get_user_location_id() OR to_location_id = public.get_user_location_id())
    )
);

-- 7. គោលការណ៍ RLS លើ LOCATIONS និង ITEMS (សម្ភារៈ)
DROP POLICY IF EXISTS "Allow read locations" ON public.locations;
CREATE POLICY "Allow read locations" ON public.locations FOR SELECT TO authenticated, anon USING (true);
GRANT SELECT ON TABLE public.locations TO authenticated, anon;

-- Full CRUD លើ Table items សម្រាប់ Authenticated Users (CentralAdmin អាច SELECT, INSERT, UPDATE, DELETE)
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read items" ON public.items;
DROP POLICY IF EXISTS "Allow all access on items" ON public.items;
DROP POLICY IF EXISTS "Authenticated users full access on items" ON public.items;
DROP POLICY IF EXISTS "Enable all for authenticated users only" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to manage items" ON public.items;
CREATE POLICY "Authenticated users full access on items" 
ON public.items 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- អនុញ្ញាតឱ្យ Anon Users អាចអានសម្ភារៈបានផងដែរ
DROP POLICY IF EXISTS "Allow anon read items" ON public.items;
CREATE POLICY "Allow anon read items" 
ON public.items 
FOR SELECT 
TO anon 
USING (true);

GRANT ALL ON TABLE public.items TO authenticated;
GRANT SELECT ON TABLE public.items TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
`;

  const storageCode = `-- =========================================================================
-- STEP 3: SUPABASE STORAGE BUCKETS & ITEM IMAGES SCHEMA (item_images & handover_docs)
-- =========================================================================

-- 1. បន្ថែម Column image_url ក្នុង Table items (ប្រសិនបើមិនទាន់មាន)
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. បង្កើត Public Storage Bucket "item_images" សម្រាប់ផ្ទុករូបភាពសម្ភារៈ (Item Photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item_images', 
    'item_images', 
    true, 
    5242880, 
    ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, 
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];

-- គោលការណ៍សិទ្ធិ (Storage Policies) សម្រាប់ item_images
DROP POLICY IF EXISTS "Public can view item images" ON storage.objects;
CREATE POLICY "Public can view item images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item_images');

DROP POLICY IF EXISTS "Allow upload to item_images" ON storage.objects;
CREATE POLICY "Allow upload to item_images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'item_images');

DROP POLICY IF EXISTS "Allow update to item_images" ON storage.objects;
CREATE POLICY "Allow update to item_images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'item_images');

DROP POLICY IF EXISTS "Allow delete to item_images" ON storage.objects;
CREATE POLICY "Allow delete to item_images"
ON storage.objects FOR DELETE
USING (bucket_id = 'item_images');

-- 3. បង្កើត Public Storage Bucket "handover_docs" សម្រាប់ឯកសារប្រគល់-ទទួល
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'handover_docs', 'handover_docs', true, 5242880,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- គោលការណ៍សិទ្ធិសម្រាប់ handover_docs
DROP POLICY IF EXISTS "CentralAdmin upload handover documents" ON storage.objects;
CREATE POLICY "CentralAdmin upload handover documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'handover_docs'
    AND (
        auth.jwt() ->> 'role' = 'CentralAdmin' OR auth.jwt() ->> 'role' = 'Admin-GDT'
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT'))
    )
);

DROP POLICY IF EXISTS "Authenticated users view handover documents" ON storage.objects;
CREATE POLICY "Authenticated users view handover documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'handover_docs');
`;

  useEffect(() => {
    fetch('/schema.sql')
      .then(res => res.text())
      .then(text => setSqlCode(text))
      .catch(() => setSqlCode('-- schema.sql located in project root.'));
  }, []);

  const getCurrentCode = () => {
    if (activeTab === 'rpcs') return rpcsCode;
    if (activeTab === 'auth') return SUPABASE_AUTH_USERS_SQL;
    if (activeTab === 'step4') return step4Code;
    if (activeTab === 'storage') return storageCode;
    if (activeTab === 'rls') return rlsCode;
    return sqlCode;
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
              Supabase Schema, Storage Bucket Policies, 5 Atomic RPC Functions & Handover Workflow
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 bg-[#03291E] hover:bg-[#1E6047] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
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
              onClick={() => setActiveTab('rpcs')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'rpcs'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <SlidersHorizontal size={15} className="text-emerald-400" />
              <span>មុខងារ RPC ទាំង៥ (Stock In/Out/Handover/Adjustment)</span>
            </button>
            <button
              onClick={() => setActiveTab('auth')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'auth'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <KeyRound size={15} className="text-amber-400" />
              <span>Auth Users & Password (GDT@2026)</span>
            </button>
            <button
              onClick={() => setActiveTab('step4')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'step4'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Clock size={15} className="text-amber-400" />
              <span>2-Step Handover & AI</span>
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <HardDrive size={15} className="text-teal-400" />
              <span>Storage Policies</span>
            </button>
            <button
              onClick={() => setActiveTab('rls')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'rls'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck size={15} className="text-indigo-400" />
              <span>RLS Security Policies</span>
            </button>
            <button
              onClick={() => setActiveTab('sql')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                activeTab === 'sql'
                  ? 'bg-[#03291E] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-200/60'
              }`}
            >
              <Database size={15} className="text-sky-400" />
              <span>Full schema.sql</span>
            </button>
          </div>

          <span className="text-xs font-mono text-slate-600 font-bold hidden md:inline-block">
            {activeTab === 'rpcs' ? 'supabase_rpcs_workflow.sql' : activeTab === 'auth' ? 'auth_users_and_passwords.sql' : activeTab === 'step4' ? 'step4_2step_rpc.sql' : activeTab === 'storage' ? 'storage_policies.sql' : activeTab === 'rls' ? 'rls_policies.sql' : 'schema.sql'}
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
