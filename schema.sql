-- Supabase PostgreSQL Schema for GDT Inventory Management System

-- =========================================================================
-- STEP 1: CREATE TABLES (STRICT ORDER FOR FOREIGN KEYS)
-- =========================================================================

-- 1. Locations Table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Items Table
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name_kh VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    min_stock INTEGER DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure image_url column exists in items table for existing databases
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. User Profiles Table (Depends on locations and auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'BranchUser',
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Inventory Table (Depends on locations and items)
CREATE TABLE IF NOT EXISTS public.inventory (
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0 NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (location_id, item_id)
);

-- 5. Transactions Table (Depends on locations and items)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL, -- 'STOCK_IN', 'STOCK_OUT', 'HANDOVER', 'ADJUSTMENT'
    from_location_id UUID REFERENCES public.locations(id),
    to_location_id UUID REFERENCES public.locations(id),
    item_id UUID REFERENCES public.items(id) NOT NULL,
    item_code VARCHAR(100),
    item_name_kh VARCHAR(255),
    quantity INTEGER NOT NULL,
    unit VARCHAR(50),
    remark TEXT,
    recorded_by VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED', -- 'PENDING' or 'RECEIVED'
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- =========================================================================
-- STEP 2: ROW LEVEL SECURITY (RLS) POLICIES & RBAC BRANCH ISOLATION
-- =========================================================================

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Helper functions for checking RBAC in database
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

-- User Profiles Policies
DROP POLICY IF EXISTS "Allow read user_profiles" ON public.user_profiles;
CREATE POLICY "Allow read user_profiles" ON public.user_profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "CentralAdmin full access on user_profiles" ON public.user_profiles;
CREATE POLICY "CentralAdmin full access on user_profiles"
ON public.user_profiles FOR ALL TO authenticated, anon
USING (true) WITH CHECK (true);

-- Inventory Policies (Allow reading all locations so HQ and all branches are 100% visible and synchronized)
DROP POLICY IF EXISTS "CentralAdmin full access on inventory" ON public.inventory;
DROP POLICY IF EXISTS "BranchUser view assigned location inventory only" ON public.inventory;
DROP POLICY IF EXISTS "BranchUser update assigned location inventory only" ON public.inventory;
DROP POLICY IF EXISTS "Allow read inventory" ON public.inventory;
DROP POLICY IF EXISTS "Allow manage inventory" ON public.inventory;

CREATE POLICY "Allow read inventory" ON public.inventory FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow manage inventory" ON public.inventory FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- Transactions Policies
DROP POLICY IF EXISTS "CentralAdmin full access on transactions" ON public.transactions;
DROP POLICY IF EXISTS "BranchUser view own branch transactions" ON public.transactions;
DROP POLICY IF EXISTS "BranchUser insert own branch transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow read transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow update transactions" ON public.transactions;

CREATE POLICY "Allow read transactions" ON public.transactions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow insert transactions" ON public.transactions FOR INSERT TO authenticated, anon WITH CHECK (true);
CREATE POLICY "Allow update transactions" ON public.transactions FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

-- Catalog items and locations policies
DROP POLICY IF EXISTS "Allow read locations" ON public.locations;
DROP POLICY IF EXISTS "Allow all access on locations" ON public.locations;
CREATE POLICY "Allow read locations" ON public.locations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow all access on locations" ON public.locations FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read items" ON public.items;
DROP POLICY IF EXISTS "Allow all access on items" ON public.items;
CREATE POLICY "Allow read items" ON public.items FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Allow all access on items" ON public.items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);


-- =========================================================================
-- STEP 3: STORAGE BUCKET CONFIGURATION
-- =========================================================================

-- 1. Create Public Storage Bucket "handover_docs"
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'handover_docs', 
    'handover_docs', 
    true, 
    5242880, 
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

-- 2. Create Public Storage Bucket "item_images" (Item Photos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'item_images', 
    'item_images', 
    true, 
    5242880, 
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

DROP POLICY IF EXISTS "Allow public uploads to handover_docs" ON storage.objects;
CREATE POLICY "Allow public uploads to handover_docs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'handover_docs');

DROP POLICY IF EXISTS "Allow public read handover_docs" ON storage.objects;
CREATE POLICY "Allow public read handover_docs" ON storage.objects FOR SELECT USING (bucket_id = 'handover_docs');

DROP POLICY IF EXISTS "Allow public uploads to item_images" ON storage.objects;
CREATE POLICY "Allow public uploads to item_images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'item_images');

DROP POLICY IF EXISTS "Allow public read item_images" ON storage.objects;
CREATE POLICY "Allow public read item_images" ON storage.objects FOR SELECT USING (bucket_id = 'item_images');


-- =========================================================================
-- STEP 4: RPC FUNCTIONS FOR REAL-TIME ATOMIC INVENTORY WORKFLOW
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


-- Function 5: record_stock_adjustment (Adjust to Actual Physical Quantity)
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

    -- Record transaction
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
        'new_quantity', p_actual_quantity,
        'delta', v_delta,
        'transaction_id', v_transaction_id
    );
END;
$$;

-- ផ្តល់សិទ្ធិដំណើរការ RPC Functions ទាំង ៥
GRANT EXECUTE ON FUNCTION public.record_stock_in TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.handle_branch_handover TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_handover TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_out TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_stock_adjustment TO authenticated, anon;


-- =========================================================================
-- STEP 5: SEED INITIAL LOCATIONS & MASTER DATA
-- =========================================================================

-- Seed Locations
INSERT INTO public.locations (name_kh, name_en, type, code) VALUES
('ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB', 'HQ-ITSB Technical Inventory', 'HQ', 'HQ-ITSB'),
('ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', 'Central Working Group (Tech-HQ)', 'BRANCH', 'Tech-HQ'),
('សាខាពន្ធដារខណ្ឌ៧មករា', '7 Makara Branch', 'BRANCH', '7MK'),
('សាខាពន្ធដារខណ្ឌចំការមន', 'Chamkarmon Branch', 'BRANCH', 'CKM'),
('សាខាពន្ធដារខណ្ឌដង្កោ', 'Dangkor Branch', 'BRANCH', 'DKO'),
('សាខាពន្ធដារខណ្ឌដូនពេញ', 'Daun Penh Branch', 'BRANCH', 'DPE'),
('សាខាពន្ធដារខណ្ឌទួលគោក', 'Toul Kork Branch', 'BRANCH', 'TKO'),
('សាខាពន្ធដារខណ្ឌពោធិ៍សែនជ័យ', 'Por senchey Branch', 'BRANCH', 'PSC'),
('សាខាពន្ធដារខណ្ឌឫស្សីកែវ', 'Russey Keo Branch', 'BRANCH', 'RSK'),
('សាខាពន្ធដារខណ្ឌសែនសុខ', 'Sen Sok Branch', 'BRANCH', 'SSK'),
('សាខាពន្ធដារខណ្ឌច្បារអំពៅ', 'Chbar Ampov Branch', 'BRANCH', 'CAP'),
('សាខាពន្ធដារខណ្ឌជ្រោយចង្វារ', 'Chroy Changvar Branch', 'BRANCH', 'CCV'),
('សាខាពន្ធដារខណ្ឌព្រែកព្នៅ', 'Prek Pnov Branch', 'BRANCH', 'PPN'),
('សាខាពន្ធដារខណ្ឌបឹងកេងកង', 'Boeung Keng Kang Branch', 'BRANCH', 'BKK'),
('សាខាពន្ធដារខណ្ឌកំបូល', 'Kamboul Branch', 'BRANCH', 'KBL'),
('សាខាពន្ធដារខេត្តកណ្តាល', 'Kandal Province Branch', 'BRANCH', 'KDL'),
('សាខាពន្ធដារខេត្តសៀមរាប', 'Siem Reap Branch', 'BRANCH', 'SRP'),
('សាខាពន្ធដារខេត្តបាត់ដំបង', 'Battambang Branch', 'BRANCH', 'BTB'),
('សាខាពន្ធដារខេត្តព្រះសីហនុ', 'Preah Sihanouk Branch', 'BRANCH', 'SHV'),
('សាខាពន្ធដារខេត្តកំពង់ចាម', 'Kampong Cham Branch', 'BRANCH', 'KCM'),
('សាខាពន្ធដារខេត្តកំពង់ឆ្នាំង', 'Kampong Chhnang Branch', 'BRANCH', 'KCH'),
('សាខាពន្ធដារខេត្តកំពង់ធំ', 'Kampong Thom Branch', 'BRANCH', 'KTH'),
('សាខាពន្ធដារខេត្តកំពង់ស្ពឺ', 'Kampong Speu Branch', 'BRANCH', 'KSP'),
('សាខាពន្ធដារខេត្តកំពត', 'Kampot Branch', 'BRANCH', 'KPT'),
('សាខាពន្ធដារខេត្តកែប', 'Kep Branch', 'BRANCH', 'KEP'),
('សាខាពន្ធដារខេត្តកោះកុង', 'Koh Kong Branch', 'BRANCH', 'KKG'),
('សាខាពន្ធដារខេត្តក្រចេះ', 'Kratie Branch', 'BRANCH', 'KRC'),
('សាខាពន្ធដារខេត្តមណ្ឌលគិរី', 'Mondulkiri Branch', 'BRANCH', 'MDK'),
('សាខាពន្ធដារខេត្តព្រះវិហារ', 'Preah Vihear Branch', 'BRANCH', 'PVH'),
('សាខាពន្ធដារខេត្តព្រៃវែង', 'Prey Veng Branch', 'BRANCH', 'PVG'),
('សាខាពន្ធដារខេត្តពោធិ៍សាត់', 'Pursat Branch', 'BRANCH', 'PST'),
('សាខាពន្ធដារខេត្តរតនគិរី', 'Ratanakiri Branch', 'BRANCH', 'RTK'),
('សាខាពន្ធដារខេត្តស្ទឹងត្រែង', 'Stung Treng Branch', 'BRANCH', 'STR'),
('សាខាពន្ធដារខេត្តស្វាយរៀង', 'Svay Rieng Branch', 'BRANCH', 'SVR'),
('សាខាពន្ធដារខេត្តតាកែវ', 'Takeo Branch', 'BRANCH', 'TKO-P'),
('សាខាពន្ធដារខេត្តឧត្តរមានជ័យ', 'Oddar Meanchey Branch', 'BRANCH', 'OMC'),
('សាខាពន្ធដារខេត្តប៉ៃលិន', 'Pailin Branch', 'BRANCH', 'PLN'),
('សាខាពន្ធដារខេត្តត្បូងឃ្មុំ', 'Tboung Khmum Branch', 'BRANCH', 'TKM')
ON CONFLICT (code) DO UPDATE 
SET name_kh = EXCLUDED.name_kh,
    name_en = EXCLUDED.name_en,
    type = EXCLUDED.type;

-- Seed Standard Master Items
INSERT INTO public.items (code, name_kh, name_en, category, unit, min_stock) VALUES
('T-001', 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', 'BOSCH Cordless Percy Screwed (GSB 120-LI)', 'Tools', 'គ្រឿង', 5),
('T-002', 'ស្វានបុកម៉ាក BOSCH Rotary Hammer (GBH 2-26 DRE)', 'BOSCH Rotary Hammer (GBH 2-26 DRE)', 'Tools', 'គ្រឿង', 3),
('T-003', 'កេះដាក់សម្ភារៈ', 'Toolbox', 'Tools', 'កេះ', 5),
('T-004', 'ម៉ាស៊ីនផ្លុំធូលី Air Blower 400W', 'Air Blower 400W', 'Tools', 'គ្រឿង', 3),
('T-005', 'ម៉ាស៊ីនបូមធូលី', 'Vacuum Cleaner', 'Tools', 'គ្រឿង', 2),
('T-006', 'កន្ត្រៃកាត់ខ្សែ Network', 'Network Cable Scissors', 'Tools', 'ដើម', 5),
('T-007', 'ដង្កាប់កាត់', 'Cutting Pliers', 'Tools', 'ដើម', 5),
('T-008', 'ដង្កាប់ស្រែកំណាត់', 'Wire Stripping Pliers', 'Tools', 'ដើម', 5),
('T-009', 'តេស្ត័រវាស់ភ្លើង', 'Voltage Tester Pen', 'Tools', 'ឈុត', 5),
('T-010', 'ទុលឡឺវិសសំប៉ែត', 'Flathead Screwdriver', 'Tools', 'ដើម', 10),
('T-011', 'ទុលឡឺវិសបែកផ្កា', 'Phillips Screwdriver', 'Tools', 'ដើម', 10),
('T-012', 'ដង្កាប់កឹបខ្សែ (Network)', 'Network Crimping Tool', 'Tools', 'ដើម', 5),
('T-013', 'តេស្ត័រតេស្តខ្សែ Network (RJ45)', 'Network Cable Tester (RJ45)', 'Tools', 'គ្រឿង', 5),
('T-014', 'កាំបិតចិតខ្សែ (Network)', 'Network Cable Stripper Knife', 'Tools', 'ដើម', 10),
('T-015', 'ខ្សែរឹត (Cable Tie)', 'Cable Tie Pack', 'Tools', 'កញ្ចប់', 50),
('T-016', 'ពិលបំភ្លឺសាកថ្ម', 'Rechargeable Flashlight', 'Tools', 'គ្រឿង', 3),
('T-017', 'ម៉ែត្រវាស់ប្រវែង 5m', 'Measuring Tape 5m', 'Tools', 'ដុំ', 5),
('T-018', 'កាំបិតកាត់ក្រដាស', 'Utility Knife / Cutter', 'Tools', 'ដើម', 10),
('T-019', 'ខ្សែ Network Link Basic Cat6 UTP', 'Network Link Basic Cat6 UTP (305m)', 'Tools', 'ដុំ', 5),
('T-020', 'គ្រាប់កឹប Network', 'RJ45 Connectors Modular Plug', 'Tools', 'គ្រាប់', 100),
('S-001', 'អាល់កុល 70% (កាន)', 'Alcohol 70% 30L', 'Suppliers', 'កាន', 10),
('S-002', 'អាល់កុលដបតូច 500ml', 'Alcohol 500ml Bottle', 'Suppliers', 'ដប', 20),
('S-003', 'ជែលលាងដៃ 500ml', 'Hand Sanitizer Gel 500ml', 'Suppliers', 'ដប', 20),
('S-004', 'ស្រោមដៃក្រណាត់', 'Cloth Gloves', 'Suppliers', 'គូ', 50),
('S-005', 'ម៉ាសពេទ្យ', 'Medical Face Masks (Box of 50)', 'Suppliers', 'ប្រអប់', 30),
('S-006', 'ថង់ដាក់សំរាមធំ', 'Heavy Duty Garbage Bags', 'Suppliers', 'គីឡូ', 20),
('S-007', 'ទឹកជូតកញ្ចក់', 'Glass Cleaner 500ml', 'Suppliers', 'ដប', 15),
('S-008', 'ក្រដាសអនាម័យ', 'Toilet Paper Rolls Pack', 'Suppliers', 'ដុំ', 40),
('S-009', 'សាប៊ូលាងដៃដប', 'Liquid Hand Soap Bottle', 'Suppliers', 'ដប', 25),
('S-010', 'ប្រេងរំអិលកង់ម៉ាស៊ីន', 'Machine Lubricant Oil', 'Suppliers', 'កំប៉ុង', 15),
('S-011', 'កន្សែងជូតសម្អាត Microfiber', 'Microfiber Cleaning Cloths', 'Suppliers', 'កញ្ចប់', 20),
('S-012', 'ស្កុតស្អិតថ្លាធំ', 'Clear Packing Tape Heavy Duty', 'Suppliers', 'ដុំ', 30)
ON CONFLICT (code) DO UPDATE 
SET name_kh = EXCLUDED.name_kh,
    name_en = EXCLUDED.name_en,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_stock = EXCLUDED.min_stock;

-- Seed Standard Stock Balance into HQ Location
INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
SELECT 
    l.id as location_id,
    i.id as item_id,
    CASE i.code
        WHEN 'T-001' THEN 15
        WHEN 'T-002' THEN 8
        WHEN 'T-003' THEN 14
        WHEN 'T-004' THEN 10
        WHEN 'T-005' THEN 6
        WHEN 'T-006' THEN 25
        WHEN 'T-007' THEN 16
        WHEN 'T-008' THEN 12
        WHEN 'T-009' THEN 8
        WHEN 'T-010' THEN 28
        WHEN 'T-011' THEN 10
        WHEN 'T-012' THEN 20
        WHEN 'T-013' THEN 35
        WHEN 'T-014' THEN 45
        WHEN 'T-015' THEN 350
        WHEN 'T-016' THEN 5
        WHEN 'T-017' THEN 18
        WHEN 'T-018' THEN 40
        WHEN 'T-019' THEN 50
        WHEN 'T-020' THEN 800
        WHEN 'S-001' THEN 65
        WHEN 'S-002' THEN 85
        WHEN 'S-003' THEN 120
        WHEN 'S-004' THEN 180
        WHEN 'S-005' THEN 150
        WHEN 'S-006' THEN 95
        WHEN 'S-007' THEN 60
        WHEN 'S-008' THEN 160
        WHEN 'S-009' THEN 130
        WHEN 'S-010' THEN 90
        WHEN 'S-011' THEN 70
        WHEN 'S-012' THEN 110
        ELSE 20
    END as quantity,
    NOW() as last_updated
FROM public.locations l
CROSS JOIN public.items i
WHERE l.code = 'HQ-ITSB'
ON CONFLICT (location_id, item_id) DO UPDATE 
SET quantity = EXCLUDED.quantity, last_updated = NOW();

-- Seed Sample Branch Stock Balance for Active Branches (7MK, CKM, DPE, TKO, KPC, Tech-HQ)
INSERT INTO public.inventory (location_id, item_id, quantity, last_updated)
SELECT 
    l.id as location_id,
    i.id as item_id,
    vals.qty as quantity,
    NOW() as last_updated
FROM (
    VALUES
        ('7MK', 'T-001', 2),
        ('7MK', 'T-006', 2),
        ('7MK', 'T-019', 5),
        ('7MK', 'S-004', 10),
        ('7MK', 'S-005', 5),
        ('CKM', 'T-001', 1),
        ('CKM', 'T-004', 1),
        ('CKM', 'T-010', 2),
        ('CKM', 'S-004', 8),
        ('DPE', 'T-001', 1),
        ('DPE', 'T-002', 1),
        ('DPE', 'T-012', 1),
        ('DPE', 'S-001', 2),
        ('TKO', 'T-001', 1),
        ('TKO', 'T-007', 2),
        ('TKO', 'T-020', 50),
        ('TKO', 'S-005', 10),
        ('KPC', 'T-001', 1),
        ('KPC', 'T-003', 1),
        ('KPC', 'T-013', 2),
        ('KPC', 'S-002', 5),
        ('Tech-HQ', 'T-001', 1),
        ('Tech-HQ', 'T-004', 1),
        ('Tech-HQ', 'T-012', 1),
        ('Tech-HQ', 'S-004', 20)
) as vals(loc_code, item_code, qty)
JOIN public.locations l ON l.code = vals.loc_code
JOIN public.items i ON i.code = vals.item_code
ON CONFLICT (location_id, item_id) DO UPDATE 
SET quantity = EXCLUDED.quantity, last_updated = NOW();

-- =========================================================================
-- STEP 6: SUPABASE AUTH USERS & PASSWORD RPC FUNCTION
-- ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិ និងគណនីមន្ត្រីសម្រាប់ Login (GDT Inventory Management)
-- Default Password សម្រាប់គណនីទាំងអស់៖ GDT@2026
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Helper Stored Procedure: create_or_update_gdt_user
CREATE OR REPLACE FUNCTION public.create_or_update_gdt_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role TEXT,
    p_location_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pwd TEXT;
    v_location_id UUID;
BEGIN
    v_encrypted_pwd := crypt(p_password, gen_salt('bf'));

    SELECT id INTO v_location_id 
    FROM public.locations 
    WHERE code = p_location_code OR id::text = p_location_code
    LIMIT 1;

    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);

    IF v_user_id IS NULL THEN
        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
            created_at, updated_at, confirmation_token, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            lower(p_email),
            v_encrypted_pwd,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('full_name', p_full_name, 'role', p_role),
            NOW(),
            NOW(),
            '',
            ''
        );
    ELSE
        UPDATE auth.users
        SET 
            encrypted_password = v_encrypted_pwd,
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
            raw_user_meta_data = jsonb_build_object('full_name', p_full_name, 'role', p_role),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    -- Clean up any existing identity to avoid constraint conflict
    DELETE FROM auth.identities 
    WHERE user_id = v_user_id 
       OR (provider = 'email' AND provider_id = v_user_id::text)
       OR (provider = 'email' AND lower(identity_data->>'email') = lower(p_email));

    -- Insert into auth.identities (Required by GoTrue, includes provider_id)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', lower(p_email)),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
    );

    -- Upsert public.user_profiles
    INSERT INTO public.user_profiles (id, email, full_name, role, location_id, created_at)
    VALUES (
        v_user_id,
        lower(p_email),
        p_full_name,
        p_role,
        v_location_id,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        location_id = EXCLUDED.location_id;

    RETURN v_user_id;
END;
$$;

-- Stored Procedure for Frontend Admin RPC call
CREATE OR REPLACE FUNCTION public.admin_set_user_password(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT NULL,
    p_location_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    IF p_password IS NULL OR length(trim(p_password)) < 6 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Password must be at least 6 characters');
    END IF;

    v_user_id := public.create_or_update_gdt_user(
        p_email,
        p_password,
        COALESCE(p_full_name, split_part(p_email, '@', 1)),
        COALESCE(p_role, 'BranchUser'),
        COALESCE(p_location_id, '2')
    );

    RETURN jsonb_build_object(
        'success', true, 
        'user_id', v_user_id, 
        'email', p_email,
        'message', 'Password updated successfully in auth.users'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_update_gdt_user TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_password TO authenticated, service_role, anon;

-- BATCH SEED ALL EXISTING OFFICERS WITH DEFAULT PASSWORD: GDT@2026
DO $$
BEGIN
    -- 1. Central Admin (GDT ITS Team)
    PERFORM public.create_or_update_gdt_user(
        'gdt.dict.its.team@gmail.com',
        'GDT@2026',
        'ក្រុមការងារបច្ចេកវិទ្យាព័ត៌មាន (GDT ITS Team)',
        'CentralAdmin',
        'HQ-ITSB'
    );

    -- 2. Central Admin (Admin ITS)
    PERFORM public.create_or_update_gdt_user(
        'admin.its@tax.gov.kh',
        'GDT@2026',
        'មន្ត្រីកណ្តាល ITSB (រដ្ឋបាល)',
        'CentralAdmin',
        'HQ-ITSB'
    );

    -- 3. Branch 7MK Officer (៧មករា)
    PERFORM public.create_or_update_gdt_user(
        'officer.7mk@tax.gov.kh',
        'GDT@2026',
        'លោក សុខ ចាន់ថន (មន្ត្រី ៧មករា)',
        'BranchUser',
        '7MK'
    );

    -- 4. Branch CKM Officer (ចំការមន)
    PERFORM public.create_or_update_gdt_user(
        'officer.ckm@tax.gov.kh',
        'GDT@2026',
        'កញ្ញា គង់ សុជាតា (មន្ត្រី ចំការមន)',
        'BranchUser',
        'CKM'
    );

    -- 5. Branch DPE Officer (ដូនពេញ)
    PERFORM public.create_or_update_gdt_user(
        'officer.dpe@tax.gov.kh',
        'GDT@2026',
        'លោក វ៉ាន់ សុភ័ក្ត្រ (មន្ត្រី ដូនពេញ)',
        'BranchUser',
        'DPE'
    );

    -- 6. Branch TKO Officer (ទួលគោក)
    PERFORM public.create_or_update_gdt_user(
        'officer.tko@tax.gov.kh',
        'GDT@2026',
        'លោក ហេង វិបុល (មន្ត្រី ទួលគោក)',
        'BranchUser',
        'TKO'
    );

    -- 7. Branch KPC Officer (កំពង់ចាម)
    PERFORM public.create_or_update_gdt_user(
        'officer.kpc@tax.gov.kh',
        'GDT@2026',
        'លោក ជ័យ វិចិត្រ (មន្ត្រី កំពង់ចាម)',
        'BranchUser',
        'KPC'
    );
END;
$$;

