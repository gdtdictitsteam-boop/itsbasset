import { Location, Item, InventoryItem } from './types';

export const mockLocations: Location[] = [
  { id: '1', name_kh: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ', name_en: 'ITSB-HQ Technical Inventory', type: 'HQ', code: 'HQ-ITSB' },
  { id: '35', name_kh: 'ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', name_en: 'Central Working Group (Tech-HQ)', type: 'BRANCH', code: 'Tech-HQ' },
  { id: '2', name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', name_en: '7 Makara Branch (7MK)', type: 'BRANCH', code: '7MK' },
  { id: '3', name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន (CKM)', name_en: 'Chamkarmon Branch (CKM)', type: 'BRANCH', code: 'CKM' },
  { id: '4', name_kh: 'សាខាពន្ធដារខណ្ឌដង្កោ (DKO)', name_en: 'Dangkor Branch (DKO)', type: 'BRANCH', code: 'DKO' },
  { id: '5', name_kh: 'សាខាពន្ធដារខណ្ឌដូនពេញ (DPE)', name_en: 'Daun Penh Branch (DPE)', type: 'BRANCH', code: 'DPE' },
  { id: '6', name_kh: 'សាខាពន្ធដារខណ្ឌទួលគោក (TKO)', name_en: 'Toul Kork Branch (TKO)', type: 'BRANCH', code: 'TKO' },
  { id: '7', name_kh: 'សាខាពន្ធដារខណ្ឌពោធិ៍សែនជ័យ (PSC)', name_en: 'Por Senchey Branch (PSC)', type: 'BRANCH', code: 'PSC' },
  { id: '8', name_kh: 'សាខាពន្ធដារខណ្ឌឫស្សីកែវ (RSK)', name_en: 'Russey Keo Branch (RSK)', type: 'BRANCH', code: 'RSK' },
  { id: '9', name_kh: 'សាខាពន្ធដារខណ្ឌសែនសុខ (SSK)', name_en: 'Sen Sok Branch (SSK)', type: 'BRANCH', code: 'SSK' },
  { id: '10', name_kh: 'សាខាពន្ធដារខណ្ឌមានជ័យ (MCH)', name_en: 'Meanchey Branch (MCH)', type: 'BRANCH', code: 'MCH' },
  { id: '11', name_kh: 'សាខាពន្ធដារខេត្តកំពត (KPO)', name_en: 'Kampot Branch (KPO)', type: 'BRANCH', code: 'KPO' },
  { id: '12', name_kh: 'សាខាពន្ធដារខេត្តតាកែវ (TKE)', name_en: 'Takeo Branch (TKE)', type: 'BRANCH', code: 'TKE' },
  { id: '13', name_kh: 'សាខាពន្ធដារខេត្តព្រះសីហនុ (SHV)', name_en: 'Preah Sihanouk Branch (SHV)', type: 'BRANCH', code: 'SHV' },
  { id: '14', name_kh: 'សាខាពន្ធដារខេត្តកោះកុង (KKO)', name_en: 'Koh Kong Branch (KKO)', type: 'BRANCH', code: 'KKO' },
  { id: '15', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ស្ពឺ (KPS)', name_en: 'Kampong Speu Branch (KPS)', type: 'BRANCH', code: 'KPS' },
  { id: '16', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ឆ្នាំង (KCH)', name_en: 'Kampong Chhnang Branch (KCH)', type: 'BRANCH', code: 'KCH' },
  { id: '17', name_kh: 'សាខាពន្ធដារខេត្តបាត់ដំបង (BTB)', name_en: 'Battambang Branch (BTB)', type: 'BRANCH', code: 'BTB' },
  { id: '18', name_kh: 'សាខាពន្ធដារខេត្តបន្ទាយមានជ័យ (BMC)', name_en: 'Banteay Meanchey Branch (BMC)', type: 'BRANCH', code: 'BMC' },
  { id: '19', name_kh: 'សាខាពន្ធដារខេត្តឧត្តរមានជ័យ (OMC)', name_en: 'Oddar Meanchey Branch (OMC)', type: 'BRANCH', code: 'OMC' },
  { id: '20', name_kh: 'សាខាពន្ធដារខេត្តសៀមរាប (SRE)', name_en: 'Siem Reap Branch (SRE)', type: 'BRANCH', code: 'SRE' },
  { id: '21', name_kh: 'សាខាពន្ធដារខេត្តកណ្តាល (KDL)', name_en: 'Kandal Branch (KDL)', type: 'BRANCH', code: 'KDL' },
  { id: '22', name_kh: 'សាខាពន្ធដារខេត្តព្រៃវែង (PVE)', name_en: 'Prey Veng Branch (PVE)', type: 'BRANCH', code: 'PVE' },
  { id: '23', name_kh: 'សាខាពន្ធដារខេត្តស្វាយរៀង (SRI)', name_en: 'Svay Rieng Branch (SRI)', type: 'BRANCH', code: 'SRI' },
  { id: '24', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ចាម (KPC)', name_en: 'Kampong Cham Branch (KPC)', type: 'BRANCH', code: 'KPC' },
  { id: '25', name_kh: 'សាខាពន្ធដារខេត្តមណ្ឌលគិរី (MDK)', name_en: 'Mondulkiri Branch (MDK)', type: 'BRANCH', code: 'MDK' },
  { id: '26', name_kh: 'សាខាពន្ធដារខេត្តរតនគិរី (RTK)', name_en: 'Ratanakiri Branch (RTK)', type: 'BRANCH', code: 'RTK' },
  { id: '27', name_kh: 'សាខាពន្ធដារខេត្តស្ទឹងត្រែង (STR)', name_en: 'Stung Treng Branch (STR)', type: 'BRANCH', code: 'STR' },
  { id: '28', name_kh: 'សាខាពន្ធដារខេត្តព្រះវិហារ (PVH)', name_en: 'Preah Vihear Branch (PVH)', type: 'BRANCH', code: 'PVH' },
  { id: '29', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ធំ (KPT)', name_en: 'Kampong Thom Branch (KPT)', type: 'BRANCH', code: 'KPT' },
  { id: '30', name_kh: 'សាខាពន្ធដារខេត្តត្បូងឃ្មុំ (TKH)', name_en: 'Tboung Khmum Branch (TKH)', type: 'BRANCH', code: 'TKH' },
  { id: '31', name_kh: 'សាខាពន្ធដារខេត្តពោធិ៍សាត់ (PSA)', name_en: 'Pursat Branch (PSA)', type: 'BRANCH', code: 'PSA' },
  { id: '32', name_kh: 'សាខាពន្ធដារខេត្តកែប (KEP)', name_en: 'KEP Branch (KEP)', type: 'BRANCH', code: 'KEP' },
  { id: '33', name_kh: 'សាខាពន្ធដារខេត្តក្រចេះ (KTI)', name_en: 'Kratie Branch (KTI)', type: 'BRANCH', code: 'KTI' },
  { id: '34', name_kh: 'សាខាពន្ធដារខេត្តប៉ៃលិន (PLI)', name_en: 'Pailin Branch (PLI)', type: 'BRANCH', code: 'PLI' },
];

export const mockItems: Item[] = [
  // Tools
  { id: '101', code: 'T-001', name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', name_en: 'BOSCH Cordless Percy Screwed (GSB 120-LI)', category: 'Tools', unit: 'គ្រឿង', min_stock: 5 },
  { id: '102', code: 'T-002', name_kh: 'ស្វានបុកម៉ាក BOSCH Rotary Hammer (GBH 2-26 DRE)', name_en: 'BOSCH Rotary Hammer (GBH 2-26 DRE)', category: 'Tools', unit: 'គ្រឿង', min_stock: 2 },
  { id: '103', code: 'T-003', name_kh: 'កេះដាក់សម្ភារៈ', name_en: 'Toolbox', category: 'Tools', unit: 'កេះ', min_stock: 5 },
  { id: '104', code: 'T-004', name_kh: 'ម៉ាស៊ីនផ្លុំធូលី Air Blower 400W', name_en: 'Air Blower 400W', category: 'Tools', unit: 'គ្រឿង', min_stock: 3 },
  { id: '105', code: 'T-005', name_kh: 'ឧបករណ៍វាស់សីតុណ្ហភាពក្នុងបន្ទប់ (Thermometer)', name_en: 'Thermometer', category: 'Tools', unit: 'គ្រឿង', min_stock: 2 },
  { id: '106', code: 'T-006', name_kh: 'កន្ត្រៃកាត់ខ្សែ Network', name_en: 'Network Cable Scissors', category: 'Tools', unit: 'ដើម', min_stock: 5 },
  { id: '107', code: 'T-007', name_kh: 'ញញួរ ដែក', name_en: 'Iron Hammer', category: 'Tools', unit: 'ដើម', min_stock: 5 },
  { id: '108', code: 'T-008', name_kh: 'ញញួរ ជ័រ', name_en: 'Rubber Hammer', category: 'Tools', unit: 'ដើម', min_stock: 5 },
  { id: '109', code: 'T-009', name_kh: 'សោតាន់ HEY Key SET', name_en: 'HEY Key SET', category: 'Tools', unit: 'ឈុត', min_stock: 2 },
  { id: '110', code: 'T-010', name_kh: 'ដង្កាប់ (មុខក្រពើ . សំប៉ែត . កាត់)', name_en: 'Pliers (Crocodile, Flat, Cutter)', category: 'Tools', unit: 'ដើម', min_stock: 5 },
  { id: '111', code: 'T-011', name_kh: 'សោរមាត់ចិញ្ជៀន ឈុត', name_en: 'Ring Spanner Set', category: 'Tools', unit: 'ឈុត', min_stock: 2 },
  { id: '112', code: 'T-012', name_kh: 'ដង្កាប់កឹបខ្សែ (Network)', name_en: 'Network Crimping Tool', category: 'Tools', unit: 'ដើម', min_stock: 5 },
  { id: '113', code: 'T-013', name_kh: 'កន្ត្រៃកាត់ទូទៅ (តូច)', name_en: 'General Scissors (Small)', category: 'Tools', unit: 'ដើម', min_stock: 10 },
  { id: '114', code: 'T-014', name_kh: 'ប៊ិចភ្លើង', name_en: 'Test Pen', category: 'Tools', unit: 'ដើម', min_stock: 10 },
  { id: '115', code: 'T-015', name_kh: 'ទុយោ ខៀវ លេខ20 (រត់ខ្សែ Network)', name_en: 'Blue Pipe No.20', category: 'Tools', unit: 'ម៉ែត្រ', min_stock: 50 },
  { id: '116', code: 'T-016', name_kh: 'ជណ្តើរអក្ស A កាំធំ កំពស់ 2.3m', name_en: 'A-Ladder 2.3m', category: 'Tools', unit: 'គ្រឿង', min_stock: 2 },
  { id: '117', code: 'T-017', name_kh: 'ខ្សែនាំ', name_en: 'Lead Wire', category: 'Tools', unit: 'ដុំ', min_stock: 5 },
  { id: '118', code: 'T-018', name_kh: 'វ៉ែនតា ថ្លា', name_en: 'Clear Glasses', category: 'Tools', unit: 'វ៉ែនតា', min_stock: 10 },
  { id: '119', code: 'T-019', name_kh: 'ខ្សែ Network Link Basic Cat6 UTP', name_en: 'Network Link Basic Cat6 UTP', category: 'Tools', unit: 'ដុំ', min_stock: 5 },
  { id: '120', code: 'T-020', name_kh: 'គ្រាប់កឹប Network', name_en: 'RJ45 Connectors', category: 'Tools', unit: 'គ្រាប់', min_stock: 100 },
  // Suppliers
  { id: '201', code: 'S-001', name_kh: 'ស្គតរុំមុខពីរ', name_en: 'Double Sided Tape', category: 'Suppliers', unit: 'ដុំ', min_stock: 20 },
  { id: '202', code: 'S-002', name_kh: 'ស្គតស្អិតខ្មៅ', name_en: 'Black Sticky Tape', category: 'Suppliers', unit: 'ដុំ', min_stock: 20 },
  { id: '203', code: 'S-003', name_kh: 'តាកេ', name_en: 'Wall Plug', category: 'Suppliers', unit: 'កញ្ចប់', min_stock: 20 },
  { id: '204', code: 'S-004', name_kh: 'ស្រោមដៃក្រណាត់', name_en: 'Cloth Gloves', category: 'Suppliers', unit: 'គូ', min_stock: 50 },
  { id: '205', code: 'S-005', name_kh: 'ម៉ាសពេទ្យ', name_en: 'Medical Mask', category: 'Suppliers', unit: 'ប្រអប់', min_stock: 50 },
  { id: '206', code: 'S-006', name_kh: 'ខ្សែរិត 300mm', name_en: 'Cable Tie 300mm', category: 'Suppliers', unit: 'កញ្ចប់', min_stock: 20 },
  { id: '207', code: 'S-007', name_kh: 'ស្គត់ក្រដាស Label', name_en: 'Paper Label Tape', category: 'Suppliers', unit: 'ដុំ', min_stock: 15 },
  { id: '208', code: 'S-008', name_kh: 'ប្រអប់ខ្សែ លេខ២', name_en: 'Cable Trunking No.2', category: 'Suppliers', unit: 'ដើម', min_stock: 50 },
  { id: '209', code: 'S-009', name_kh: 'ប្រអប់ខ្សែ លេខ៤', name_en: 'Cable Trunking No.4', category: 'Suppliers', unit: 'ដើម', min_stock: 50 },
  { id: '210', code: 'S-010', name_kh: 'ប្រអប់ខ្សែ លេខ៦', name_en: 'Cable Trunking No.6', category: 'Suppliers', unit: 'ដើម', min_stock: 30 },
  { id: '211', code: 'S-011', name_kh: 'ប្រអប់ខ្សែខ្នងអណ្តើក លេខ៤', name_en: 'Turtle Back Cable Trunking No.4', category: 'Suppliers', unit: 'ដើម', min_stock: 20 },
  { id: '212', code: 'S-012', name_kh: 'វិសអ៉ីណុកក្បាលស្នើ', name_en: 'Stainless Steel Screws', category: 'Suppliers', unit: 'កញ្ចប់', min_stock: 20 },
];

export const standardItemQuantities: Record<string, number> = {
  'T-001': 15,
  'T-002': 8,
  'T-003': 14,
  'T-004': 10,
  'T-005': 6,
  'T-006': 25,
  'T-007': 16,
  'T-008': 12,
  'T-009': 8,
  'T-010': 28,
  'T-011': 10,
  'T-012': 20,
  'T-013': 35,
  'T-014': 45,
  'T-015': 350,
  'T-016': 5,
  'T-017': 18,
  'T-018': 40,
  'T-019': 50,
  'T-020': 800,
  'S-001': 65,
  'S-002': 85,
  'S-003': 120,
  'S-004': 180,
  'S-005': 150,
  'S-006': 95,
  'S-007': 60,
  'S-008': 160,
  'S-009': 130,
  'S-010': 90,
  'S-011': 70,
  'S-012': 110,
};

export const mockInventory: InventoryItem[] = [
  // HQ Stock (Standard clean initial inventory for HQ-ITSB)
  ...mockItems.map(item => ({
    location_id: '1',
    item_id: item.id,
    quantity: standardItemQuantities[item.code] ?? 20,
    last_updated: '2026-10-01T08:00:00Z',
    item_code: item.code,
    item_name_kh: item.name_kh,
    item_name_en: item.name_en,
    category: item.category,
    unit: item.unit,
    min_stock: item.min_stock,
    location_name_kh: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
    location_name_en: 'ITSB-HQ Technical Inventory'
  })),

  // Central Working Group (Tech-HQ) Stock
  {
    location_id: '35', item_id: '101', quantity: 1, last_updated: '2026-10-02T09:00:00Z',
    item_code: 'T-001', item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', item_name_en: 'BOSCH Cordless Percy Screwed (GSB 120-LI)', category: 'Tools', unit: 'គ្រឿង', min_stock: 5, location_name_kh: 'ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', location_name_en: 'Central Working Group (Tech-HQ)'
  },
  {
    location_id: '35', item_id: '104', quantity: 1, last_updated: '2026-10-02T09:00:00Z',
    item_code: 'T-004', item_name_kh: 'ម៉ាស៊ីនផ្លុំធូលី Air Blower 400W', item_name_en: 'Air Blower 400W', category: 'Tools', unit: 'គ្រឿង', min_stock: 3, location_name_kh: 'ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', location_name_en: 'Central Working Group (Tech-HQ)'
  },
  {
    location_id: '35', item_id: '112', quantity: 1, last_updated: '2026-10-02T09:00:00Z',
    item_code: 'T-012', item_name_kh: 'ដង្កាប់កឹបខ្សែ (Network)', item_name_en: 'Network Crimping Tool', category: 'Tools', unit: 'ដើម', min_stock: 5, location_name_kh: 'ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', location_name_en: 'Central Working Group (Tech-HQ)'
  },
  {
    location_id: '35', item_id: '204', quantity: 20, last_updated: '2026-10-02T09:00:00Z',
    item_code: 'S-004', item_name_kh: 'ស្រោមដៃក្រណាត់', item_name_en: 'Cloth Gloves', category: 'Suppliers', unit: 'គូ', min_stock: 50, location_name_kh: 'ក្រុមការងារថ្នាក់កណ្តាល (Tech-HQ)', location_name_en: 'Central Working Group (Tech-HQ)'
  },

  // 7 Makara Branch Stock (7MK)
  {
    location_id: '2', item_id: '101', quantity: 2, last_updated: '2026-10-01T10:00:00Z',
    item_code: 'T-001', item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', item_name_en: 'BOSCH Cordless Percy Screwed (GSB 120-LI)', category: 'Tools', unit: 'គ្រឿង', min_stock: 5, location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', location_name_en: '7 Makara Branch (7MK)'
  },
  {
    location_id: '2', item_id: '106', quantity: 2, last_updated: '2026-10-01T10:00:00Z',
    item_code: 'T-006', item_name_kh: 'កន្ត្រៃកាត់ខ្សែ Network', item_name_en: 'Network Cable Scissors', category: 'Tools', unit: 'ដើម', min_stock: 5, location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', location_name_en: '7 Makara Branch (7MK)'
  },
  {
    location_id: '2', item_id: '119', quantity: 5, last_updated: '2026-10-01T10:00:00Z',
    item_code: 'T-019', item_name_kh: 'ខ្សែ Network Link Basic Cat6 UTP', item_name_en: 'Network Link Basic Cat6 UTP', category: 'Tools', unit: 'ដុំ', min_stock: 5, location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', location_name_en: '7 Makara Branch (7MK)'
  },
  {
    location_id: '2', item_id: '120', quantity: 100, last_updated: '2026-10-01T10:00:00Z',
    item_code: 'T-020', item_name_kh: 'គ្រាប់កឹប Network', item_name_en: 'RJ45 Connectors', category: 'Tools', unit: 'គ្រាប់', min_stock: 100, location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', location_name_en: '7 Makara Branch (7MK)'
  },
  {
    location_id: '2', item_id: '205', quantity: 15, last_updated: '2026-10-01T10:00:00Z',
    item_code: 'S-005', item_name_kh: 'ម៉ាសពេទ្យ', item_name_en: 'Medical Mask', category: 'Suppliers', unit: 'ប្រអប់', min_stock: 50, location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)', location_name_en: '7 Makara Branch (7MK)'
  },

  // Chamkarmon Branch Stock (CKM)
  {
    location_id: '3', item_id: '103', quantity: 2, last_updated: '2026-10-01T11:00:00Z',
    item_code: 'T-003', item_name_kh: 'កេះដាក់សម្ភារៈ', item_name_en: 'Toolbox', category: 'Tools', unit: 'កេះ', min_stock: 5, location_name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន (CKM)', location_name_en: 'Chamkarmon Branch (CKM)'
  },
  {
    location_id: '3', item_id: '120', quantity: 50, last_updated: '2026-10-01T11:00:00Z',
    item_code: 'T-020', item_name_kh: 'គ្រាប់កឹប Network', item_name_en: 'RJ45 Connectors', category: 'Tools', unit: 'គ្រាប់', min_stock: 100, location_name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន (CKM)', location_name_en: 'Chamkarmon Branch (CKM)'
  },
  {
    location_id: '3', item_id: '203', quantity: 20, last_updated: '2026-10-01T11:00:00Z',
    item_code: 'S-003', item_name_kh: 'តាកេ', item_name_en: 'Wall Plug', category: 'Suppliers', unit: 'កញ្ចប់', min_stock: 20, location_name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន (CKM)', location_name_en: 'Chamkarmon Branch (CKM)'
  },

  // Dangkor Branch Stock (DKO)
  {
    location_id: '4', item_id: '205', quantity: 10, last_updated: '2026-10-01T11:30:00Z',
    item_code: 'S-005', item_name_kh: 'ម៉ាសពេទ្យ', item_name_en: 'Medical Mask', category: 'Suppliers', unit: 'ប្រអប់', min_stock: 50, location_name_kh: 'សាខាពន្ធដារខណ្ឌដង្កោ (DKO)', location_name_en: 'Dangkor Branch (DKO)'
  },
  {
    location_id: '4', item_id: '114', quantity: 2, last_updated: '2026-10-01T11:30:00Z',
    item_code: 'T-014', item_name_kh: 'ប៊ិចភ្លើង', item_name_en: 'Test Pen', category: 'Tools', unit: 'ដើម', min_stock: 10, location_name_kh: 'សាខាពន្ធដារខណ្ឌដង្កោ (DKO)', location_name_en: 'Dangkor Branch (DKO)'
  }
];

export const mockTransactions: any[] = [
  {
    id: 'tx-001',
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    type: 'HANDOVER',
    from_location: 'ស្តុកសម្ភារបច្ចេកទេស ITSB-HQ',
    to_location: 'សាខាពន្ធដារខណ្ឌ៧មករា (7MK)',
    item_code: 'T-001',
    item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)',
    quantity: 2,
    unit: 'គ្រឿង',
    recorded_by: 'មន្ត្រីគ្រប់គ្រងស្តុកកណ្តាល',
    remark: 'ផ្ទេរសម្ភារៈបច្ចេកទេសជូនសាខា ៧មករា | ឯកសារយោង: https://supabase.gdt.gov.kh/storage/v1/object/public/handover_docs/demo_handover_7mk.pdf'
  }
];

