-- Supabase PostgreSQL Schema for GDT Inventory Management System

-- Create locations table
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- e.g., 'HQ', 'BRANCH'
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create items table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    min_stock INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create inventory table
CREATE TABLE public.inventory (
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (location_id, item_id)
);

-- Create transactions table
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'STOCK_IN', 'STOCK_OUT', 'HANDOVER', 'ADJUSTMENT'
    from_location UUID REFERENCES public.locations(id),
    to_location UUID REFERENCES public.locations(id),
    item_id UUID REFERENCES public.items(id) NOT NULL,
    quantity INTEGER NOT NULL,
    remark TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RPC Function for Atomic Branch Handover
CREATE OR REPLACE FUNCTION public.handle_branch_handover(
    p_from_location UUID,
    p_to_location UUID,
    p_item_id UUID,
    p_quantity INTEGER,
    p_recorded_by VARCHAR,
    p_remark TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_available_qty INTEGER;
BEGIN
    -- 1. Check available stock at source location
    SELECT quantity INTO v_available_qty
    FROM public.inventory
    WHERE location_id = p_from_location AND item_id = p_item_id
    FOR UPDATE; -- Lock row for atomic operation

    IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock at source location';
    END IF;

    -- 2. Deduct from source location
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        last_updated = now()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 3. Add to destination location
    INSERT INTO public.inventory (location_id, item_id, quantity)
    VALUES (p_to_location, p_item_id, p_quantity)
    ON CONFLICT (location_id, item_id) 
    DO UPDATE SET quantity = public.inventory.quantity + p_quantity,
                  last_updated = now();

    -- 4. Record transaction
    INSERT INTO public.transactions (type, from_location, to_location, item_id, quantity, remark, recorded_by)
    VALUES ('HANDOVER', p_from_location, p_to_location, p_item_id, p_quantity, p_remark, p_recorded_by);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Seed Data for Locations
INSERT INTO public.locations (name_kh, name_en, type, code) VALUES
('ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB', 'HQ-ITSB Technical Inventory', 'HQ', 'HQ-ITSB'),
('សាខាពន្ធដារខណ្ឌ៧មករា', '7 Makara Branch', 'BRANCH', '7MK'),
('សាខាពន្ធដារខណ្ឌចំការមន', 'Chamkarmon Branch', 'BRANCH', 'CKM'),
('សាខាពន្ធដារខណ្ឌដង្កោ', 'Dangkor Branch', 'BRANCH', 'DKO'),
('សាខាពន្ធដារខណ្ឌដូនពេញ', 'Daun Penh Branch', 'BRANCH', 'DPE'),
('សាខាពន្ធដារខណ្ឌទួលគោក', 'Toul Kork Branch', 'BRANCH', 'TKO'),
('សាខាពន្ធដារខណ្ឌពោធិ៍សែនជ័យ', 'Por senchey Branch', 'BRANCH', 'PSC'),
('សាខាពន្ធដារខណ្ឌឫស្សីកែវ', 'Russey Keo Branch', 'BRANCH', 'RSK'),
('សាខាពន្ធដារខណ្ឌសែនសុខ', 'Sen Sok Branch', 'BRANCH', 'SSK'),
('សាខាពន្ធដារខណ្ឌមានជ័យ', 'Meanchey Branch', 'BRANCH', 'MCH'),
('សាខាពន្ធដារខេត្តកំពត', 'Kampot Branch', 'BRANCH', 'KPO'),
('សាខាពន្ធដារខេត្តតាកែវ', 'Takeo Branch', 'BRANCH', 'TKE'),
('សាខាពន្ធដារខេត្តព្រះសីហនុ', 'Preah Sihanouk Branch', 'BRANCH', 'SHV'),
('សាខាពន្ធដារខេត្តកោះកុង', 'Koh kong Branch', 'BRANCH', 'KKO'),
('សាខាពន្ធដារខេត្តកំពង់ស្ពឺ', 'Kampong Speu Branch', 'BRANCH', 'KPS'),
('សាខាពន្ធដារខេត្តកំពង់ឆ្នាំង', 'Kampong Chhnang Branch', 'BRANCH', 'KCH'),
('សាខាពន្ធដារខេត្តបាត់ដំបង', 'Battambang Branch', 'BRANCH', 'BTB'),
('សាខាពន្ធដារខេត្តបន្ទាយមានជ័យ', 'Banteay Meanchey Branch', 'BRANCH', 'BMC'),
('សាខាពន្ធដារខេត្តឧត្តរមានជ័យ', 'Oddar Meanchey Branch', 'BRANCH', 'OMC'),
('សាខាពន្ធដារខេត្តសៀមរាប', 'Siem Reap Branch', 'BRANCH', 'SRE'),
('សាខាពន្ធដារខេត្តកណ្តាល', 'Kandal Branch', 'BRANCH', 'KDL'),
('សាខាពន្ធដារខេត្តព្រៃវែង', 'Prey Veng Branch', 'BRANCH', 'PVE'),
('សាខាពន្ធដារខេត្តស្វាយរៀង', 'Svay Rieng Branch', 'BRANCH', 'SRI'),
('សាខាពន្ធដារខេត្តកំពង់ចាម', 'Kampong Cham Branch', 'BRANCH', 'KPC'),
('សាខាពន្ធដារខេត្តមណ្ឌលគិរី', 'Mondulkiri Branch', 'BRANCH', 'MDK'),
('សាខាពន្ធដារខេត្តរតនគិរី', 'Ratanakiri Branch', 'BRANCH', 'RTK'),
('សាខាពន្ធដារខេត្តស្ទឹងត្រែង', 'Stung Treng Branch', 'BRANCH', 'STR'),
('សាខាពន្ធដារខេត្តព្រះវិហារ', 'Preah Vihear Branch', 'BRANCH', 'PVH'),
('សាខាពន្ធដារខេត្តកំពង់ធំ', 'Kampong Thom Branch', 'BRANCH', 'KPT'),
('សាខាពន្ធដារខេត្តត្បូងឃ្មុំ', 'Tboung Khmum Branch', 'BRANCH', 'TKH'),
('សាខាពន្ធដារខេត្តពោធិ៍សាត់', 'Pursat Branch', 'BRANCH', 'PSA'),
('សាខាពន្ធដារខេត្តកែប', 'KEP Branch', 'BRANCH', 'KEP'),
('សាខាពន្ធដារខេត្តក្រចេះ', 'Kratie Branch', 'BRANCH', 'KTI'),
('សាខាពន្ធដារខេត្តប៉ៃលិន', 'Pailin Branch', 'BRANCH', 'PLI')
ON CONFLICT (code) DO NOTHING;

-- =========================================================================
-- STEP 2: USER PROFILES & ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- 1. Create User Profiles Table linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'BranchUser', -- 'CentralAdmin' or 'BranchUser'
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: CentralAdmin full access, User read own profile
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

CREATE POLICY "Users view own user_profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

-- 2. ENABLE ROW LEVEL SECURITY ON INVENTORY TABLE
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- 2.1 CentralAdmin Policy: Can SELECT, INSERT, UPDATE, DELETE all inventory rows
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

-- 2.2 BranchUser Policy: Can ONLY SELECT inventory rows matching their assigned location_id
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

-- =========================================================================
-- STEP 3: SUPABASE STORAGE BUCKET & STORAGE POLICIES FOR HANDOVER DOCS
-- =========================================================================

-- 1. Create Public Storage Bucket "handover_docs"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'handover_docs', 
    'handover_docs', 
    true, 
    5242880, -- 5MB limit in bytes
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Policy: CentralAdmin Can Upload / Insert documents to handover_docs bucket
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

-- 4. Policy: Authenticated users can SELECT / Read handover documents
CREATE POLICY "Authenticated users view handover documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'handover_docs');


-- =========================================================================
-- STEP 4: 2-STEP HANDOVER & ACKNOWLEDGEMENT WITH AI OCR VERIFICATION
-- =========================================================================

-- 1. Add status column to transactions table (PENDING -> RECEIVED)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';

-- 2. Step 1 RPC: CentralAdmin initiates handover (Deducts stock from HQ, status = 'PENDING')
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

    -- Validate quantity
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero.';
    END IF;

    -- Check source inventory
    SELECT quantity INTO v_available_qty
    FROM public.inventory
    WHERE location_id = p_from_location AND item_id = p_item_id;

    IF v_available_qty IS NULL OR v_available_qty < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in source location. Available: %, Requested: %', COALESCE(v_available_qty, 0), p_quantity;
    END IF;

    -- Fetch item metadata
    SELECT code, name_kh, unit INTO v_item_code, v_item_name_kh, v_item_unit
    FROM public.items WHERE id = p_item_id;

    -- 1. Deduct stock from Central HQ
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        updated_at = NOW()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 2. Record transaction with status = 'PENDING'
    INSERT INTO public.transactions (
        type,
        from_location_id,
        to_location_id,
        item_id,
        item_code,
        item_name_kh,
        quantity,
        unit,
        recorded_by,
        remark,
        status
    ) VALUES (
        'HANDOVER',
        p_from_location,
        p_to_location,
        p_item_id,
        v_item_code,
        v_item_name_kh,
        p_quantity,
        v_item_unit,
        p_recorded_by,
        p_remark,
        'PENDING'
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

-- 3. Step 2 RPC: Branch User acknowledges receipt (Adds stock to Branch, status = 'RECEIVED')
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
    -- Fetch Transaction details
    SELECT * INTO v_tx
    FROM public.transactions
    WHERE id = p_transaction_id;

    IF v_tx.id IS NULL THEN
        RAISE EXCEPTION 'Transaction record not found.';
    END IF;

    IF v_tx.status = 'RECEIVED' THEN
        RAISE EXCEPTION 'Transaction has already been acknowledged and received.';
    END IF;

    -- Role & Location Authorization Check
    SELECT role, location_id INTO v_user_role, v_user_location
    FROM public.user_profiles
    WHERE id = auth.uid();

    -- Strictly ensure the user is either CentralAdmin OR belongs to the destination branch (to_location_id)
    IF v_user_role NOT IN ('CentralAdmin', 'Admin-GDT') AND (v_user_location IS NULL OR v_user_location != v_tx.to_location_id) THEN
        RAISE EXCEPTION 'Unauthorized: You can only acknowledge transfers destined for your assigned branch location.';
    END IF;

    -- 1. Update Transaction status to 'RECEIVED'
    UPDATE public.transactions
    SET status = 'RECEIVED',
        recorded_by = CASE WHEN p_received_by <> '' THEN p_received_by ELSE recorded_by END
    WHERE id = p_transaction_id;

    -- 2. Add stock to destination branch location
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


