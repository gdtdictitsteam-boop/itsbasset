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
    type VARCHAR(50) NOT NULL,
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
-- STEP 2: ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
-- Note: strictly avoiding ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Items, Locations, Inventory, Transactions (Allow all to prevent RLS errors on insert/update)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all access on items" ON public.items;
CREATE POLICY "Allow all access on items" ON public.items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access on locations" ON public.locations;
CREATE POLICY "Allow all access on locations" ON public.locations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access on inventory" ON public.inventory;
CREATE POLICY "Allow all access on inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access on transactions" ON public.transactions;
CREATE POLICY "Allow all access on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);

-- -------------------------------------------------------------------------
-- User Profiles Policies
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "CentralAdmin full access on user_profiles" ON public.user_profiles;
CREATE POLICY "CentralAdmin full access on user_profiles"
ON public.user_profiles FOR ALL
USING (
    auth.jwt() ->> 'role' IN ('CentralAdmin', 'Admin-GDT')
);

DROP POLICY IF EXISTS "Users view own user_profile" ON public.user_profiles;
CREATE POLICY "Users view own user_profile"
ON public.user_profiles FOR SELECT
USING (auth.uid() = id);

-- -------------------------------------------------------------------------
-- Inventory Policies
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "CentralAdmin full access to inventory" ON public.inventory;
CREATE POLICY "CentralAdmin full access to inventory"
ON public.inventory FOR ALL
USING (
    auth.jwt() ->> 'role' IN ('CentralAdmin', 'Admin-GDT')
    OR EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role IN ('CentralAdmin', 'Admin-GDT')
    )
);

DROP POLICY IF EXISTS "BranchUser view assigned location inventory only" ON public.inventory;
CREATE POLICY "BranchUser view assigned location inventory only"
ON public.inventory FOR SELECT
USING (
    location_id IN (
        SELECT location_id FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'BranchUser'
    )
);


-- =========================================================================
-- STEP 3: STORAGE BUCKET CONFIGURATION (NO ALTER TABLE storage.objects)
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

-- 2. Create Storage Policies for handover_docs bucket
DROP POLICY IF EXISTS "CentralAdmin upload handover documents" ON storage.objects;
CREATE POLICY "CentralAdmin upload handover documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'handover_docs'
    AND (
        auth.jwt() ->> 'role' = 'CentralAdmin'
        OR auth.jwt() ->> 'role' = 'Admin-GDT'
    )
);

DROP POLICY IF EXISTS "Authenticated users view handover documents" ON storage.objects;
CREATE POLICY "Authenticated users view handover documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'handover_docs');

-- 3. Create Public Storage Bucket "item_images" (Item Photos)
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

-- Storage Policies for item_images bucket
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


-- =========================================================================
-- STEP 4: RPC FUNCTIONS (2-STEP HANDOVER)
-- =========================================================================

-- Function 1: handle_branch_handover (Deduct from source, Status PENDING)
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
    v_transaction_id UUID;
    v_item_code VARCHAR;
    v_item_name_kh VARCHAR;
    v_item_unit VARCHAR;
BEGIN
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

    -- 1. Deduct stock from source location (HQ)
    UPDATE public.inventory
    SET quantity = quantity - p_quantity,
        last_updated = NOW()
    WHERE location_id = p_from_location AND item_id = p_item_id;

    -- 2. Record transaction with status = 'PENDING'
    INSERT INTO public.transactions (
        type, from_location_id, to_location_id, item_id, item_code, 
        item_name_kh, quantity, unit, recorded_by, remark, status
    ) VALUES (
        'HANDOVER', p_from_location, p_to_location, p_item_id, v_item_code, 
        v_item_name_kh, p_quantity, v_item_unit, p_recorded_by, p_remark, 'PENDING'
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'status', 'PENDING'
    );
END;
$$;


-- Function 2: acknowledge_handover (Add stock to dest, Status RECEIVED)
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
        last_updated = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', p_transaction_id,
        'status', 'RECEIVED'
    );
END;
$$;

-- Seed Data for Locations
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

-- Seed Data for Items
INSERT INTO public.items (code, name_kh, name_en, category, unit, min_stock) VALUES
('T-001', 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', 'BOSCH Cordless Percy Screwed (GSB 120-LI)', 'Tools', 'គ្រឿង', 5),
('T-002', 'ស្វានបុកម៉ាក BOSCH Rotary Hammer (GBH 2-26 DRE)', 'BOSCH Rotary Hammer (GBH 2-26 DRE)', 'Tools', 'គ្រឿង', 2),
('T-003', 'កេះដាក់សម្ភារៈ', 'Toolbox', 'Tools', 'កេះ', 5),
('T-004', 'ម៉ាស៊ីនផ្លុំធូលី Air Blower 400W', 'Air Blower 400W', 'Tools', 'គ្រឿង', 3),
('T-005', 'ឧបករណ៍វាស់សីតុណ្ហភាពក្នុងបន្ទប់ (Thermometer)', 'Thermometer', 'Tools', 'គ្រឿង', 2),
('T-006', 'កន្ត្រៃកាត់ខ្សែ Network', 'Network Cable Scissors', 'Tools', 'ដើម', 5),
('T-007', 'ញញួរ ដែក', 'Iron Hammer', 'Tools', 'ដើម', 5),
('T-008', 'ញញួរ ជ័រ', 'Rubber Hammer', 'Tools', 'ដើម', 5),
('T-009', 'សោតាន់ HEY Key SET', 'HEY Key SET', 'Tools', 'ឈុត', 2),
('T-010', 'ដង្កាប់ (មុខក្រពើ . សំប៉ែត . កាត់)', 'Pliers (Crocodile, Flat, Cutter)', 'Tools', 'ដើម', 5),
('T-011', 'សោរមាត់ចិញ្ជៀន ឈុត', 'Ring Spanner Set', 'Tools', 'ឈុត', 2),
('T-012', 'ដង្កាប់កឹបខ្សែ (Network)', 'Network Crimping Tool', 'Tools', 'ដើម', 5),
('T-013', 'កន្ត្រៃកាត់ទូទៅ (តូច)', 'General Scissors (Small)', 'Tools', 'ដើម', 10),
('T-014', 'ប៊ិចភ្លើង', 'Test Pen', 'Tools', 'ដើម', 10),
('T-015', 'ទុយោ ខៀវ លេខ20 (រត់ខ្សែ Network)', 'Blue Pipe No.20', 'Tools', 'ម៉ែត្រ', 50),
('T-016', 'ជណ្តើរអក្ស A កាំធំ កំពស់ 2.3m', 'A-Ladder 2.3m', 'Tools', 'គ្រឿង', 2),
('T-017', 'ខ្សែនាំ', 'Lead Wire', 'Tools', 'ដុំ', 5),
('T-018', 'វ៉ែនតា ថ្លា', 'Clear Glasses', 'Tools', 'វ៉ែនតា', 10),
('T-019', 'ខ្សែ Network Link Basic Cat6 UTP', 'Network Link Basic Cat6 UTP', 'Tools', 'ដុំ', 5),
('T-020', 'គ្រាប់កឹប Network', 'RJ45 Connectors', 'Tools', 'គ្រាប់', 100),
('S-001', 'ស្គតរុំមុខពីរ', 'Double Sided Tape', 'Suppliers', 'ដុំ', 20),
('S-002', 'ស្គតស្អិតខ្មៅ', 'Black Sticky Tape', 'Suppliers', 'ដុំ', 20),
('S-003', 'តាកេ', 'Wall Plug', 'Suppliers', 'កញ្ចប់', 20),
('S-004', 'ស្រោមដៃក្រណាត់', 'Cloth Gloves', 'Suppliers', 'គូ', 50),
('S-005', 'ម៉ាសពេទ្យ', 'Medical Mask', 'Suppliers', 'ប្រអប់', 50),
('S-006', 'ខ្សែរិត 300mm', 'Cable Tie 300mm', 'Suppliers', 'កញ្ចប់', 20),
('S-007', 'ស្គត់ក្រដាស Label', 'Paper Label Tape', 'Suppliers', 'ដុំ', 15),
('S-008', 'ប្រអប់ខ្សែ លេខ២', 'Cable Trunking No.2', 'Suppliers', 'ដើម', 50),
('S-009', 'ប្រអប់ខ្សែ លេខ៤', 'Cable Trunking No.4', 'Suppliers', 'ដើម', 50),
('S-010', 'ប្រអប់ខ្សែ លេខ៦', 'Cable Trunking No.6', 'Suppliers', 'ដើម', 30),
('S-011', 'ប្រអប់ខ្សែខ្នងអណ្តើក លេខ៤', 'Turtle Back Cable Trunking No.4', 'Suppliers', 'ដើម', 20),
('S-012', 'វិសអ៉ីណុកក្បាលស្នើ', 'Stainless Steel Screws', 'Suppliers', 'កញ្ចប់', 20)
ON CONFLICT (code) DO UPDATE 
SET name_kh = EXCLUDED.name_kh,
    name_en = EXCLUDED.name_en,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_stock = EXCLUDED.min_stock;

-- Seed Initial Inventory for HQ-ITSB
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
