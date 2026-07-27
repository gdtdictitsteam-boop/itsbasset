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
