import { Location, Item, InventoryItem } from './types';

export const mockLocations: Location[] = [
  { id: '1', name_kh: 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB', name_en: 'HQ-ITSB Technical Inventory', type: 'HQ', code: 'HQ-ITSB' },
  { id: '2', name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា', name_en: '7 Makara Branch', type: 'BRANCH', code: '7MK' },
  { id: '3', name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន', name_en: 'Chamkarmon Branch', type: 'BRANCH', code: 'CKM' },
  { id: '4', name_kh: 'សាខាពន្ធដារខណ្ឌដង្កោ', name_en: 'Dangkor Branch', type: 'BRANCH', code: 'DKO' },
  { id: '5', name_kh: 'សាខាពន្ធដារខណ្ឌដូនពេញ', name_en: 'Daun Penh Branch', type: 'BRANCH', code: 'DPE' },
  { id: '6', name_kh: 'សាខាពន្ធដារខណ្ឌទួលគោក', name_en: 'Toul Kork Branch', type: 'BRANCH', code: 'TKO' },
  { id: '7', name_kh: 'សាខាពន្ធដារខណ្ឌពោធិ៍សែនជ័យ', name_en: 'Por senchey Branch', type: 'BRANCH', code: 'PSC' },
  { id: '8', name_kh: 'សាខាពន្ធដារខណ្ឌឫស្សីកែវ', name_en: 'Russey Keo Branch', type: 'BRANCH', code: 'RSK' },
  { id: '9', name_kh: 'សាខាពន្ធដារខណ្ឌសែនសុខ', name_en: 'Sen Sok Branch', type: 'BRANCH', code: 'SSK' },
  { id: '10', name_kh: 'សាខាពន្ធដារខណ្ឌមានជ័យ', name_en: 'Meanchey Branch', type: 'BRANCH', code: 'MCH' },
  { id: '11', name_kh: 'សាខាពន្ធដារខេត្តកំពត', name_en: 'Kampot Branch', type: 'BRANCH', code: 'KPO' },
  { id: '12', name_kh: 'សាខាពន្ធដារខេត្តតាកែវ', name_en: 'Takeo Branch', type: 'BRANCH', code: 'TKE' },
  { id: '13', name_kh: 'សាខាពន្ធដារខេត្តព្រះសីហនុ', name_en: 'Preah Sihanouk Branch', type: 'BRANCH', code: 'SHV' },
  { id: '14', name_kh: 'សាខាពន្ធដារខេត្តកោះកុង', name_en: 'Koh kong Branch', type: 'BRANCH', code: 'KKO' },
  { id: '15', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ស្ពឺ', name_en: 'Kampong Speu Branch', type: 'BRANCH', code: 'KPS' },
  { id: '16', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ឆ្នាំង', name_en: 'Kampong Chhnang Branch', type: 'BRANCH', code: 'KCH' },
  { id: '17', name_kh: 'សាខាពន្ធដារខេត្តបាត់ដំបង', name_en: 'Battambang Branch', type: 'BRANCH', code: 'BTB' },
  { id: '18', name_kh: 'សាខាពន្ធដារខេត្តបន្ទាយមានជ័យ', name_en: 'Banteay Meanchey Branch', type: 'BRANCH', code: 'BMC' },
  { id: '19', name_kh: 'សាខាពន្ធដារខេត្តឧត្តរមានជ័យ', name_en: 'Oddar Meanchey Branch', type: 'BRANCH', code: 'OMC' },
  { id: '20', name_kh: 'សាខាពន្ធដារខេត្តសៀមរាប', name_en: 'Siem Reap Branch', type: 'BRANCH', code: 'SRE' },
  { id: '21', name_kh: 'សាខាពន្ធដារខេត្តកណ្តាល', name_en: 'Kandal Branch', type: 'BRANCH', code: 'KDL' },
  { id: '22', name_kh: 'សាខាពន្ធដារខេត្តព្រៃវែង', name_en: 'Prey Veng Branch', type: 'BRANCH', code: 'PVE' },
  { id: '23', name_kh: 'សាខាពន្ធដារខេត្តស្វាយរៀង', name_en: 'Svay Rieng Branch', type: 'BRANCH', code: 'SRI' },
  { id: '24', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ចាម', name_en: 'Kampong Cham Branch', type: 'BRANCH', code: 'KPC' },
  { id: '25', name_kh: 'សាខាពន្ធដារខេត្តមណ្ឌលគិរី', name_en: 'Mondulkiri Branch', type: 'BRANCH', code: 'MDK' },
  { id: '26', name_kh: 'សាខាពន្ធដារខេត្តរតនគិរី', name_en: 'Ratanakiri Branch', type: 'BRANCH', code: 'RTK' },
  { id: '27', name_kh: 'សាខាពន្ធដារខេត្តស្ទឹងត្រែង', name_en: 'Stung Treng Branch', type: 'BRANCH', code: 'STR' },
  { id: '28', name_kh: 'សាខាពន្ធដារខេត្តព្រះវិហារ', name_en: 'Preah Vihear Branch', type: 'BRANCH', code: 'PVH' },
  { id: '29', name_kh: 'សាខាពន្ធដារខេត្តកំពង់ធំ', name_en: 'Kampong Thom Branch', type: 'BRANCH', code: 'KPT' },
  { id: '30', name_kh: 'សាខាពន្ធដារខេត្តត្បូងឃ្មុំ', name_en: 'Tboung Khmum Branch', type: 'BRANCH', code: 'TKH' },
  { id: '31', name_kh: 'សាខាពន្ធដារខេត្តពោធិ៍សាត់', name_en: 'Pursat Branch', type: 'BRANCH', code: 'PSA' },
  { id: '32', name_kh: 'សាខាពន្ធដារខេត្តកែប', name_en: 'KEP Branch', type: 'BRANCH', code: 'KEP' },
  { id: '33', name_kh: 'សាខាពន្ធដារខេត្តក្រចេះ', name_en: 'Kratie Branch', type: 'BRANCH', code: 'KTI' },
  { id: '34', name_kh: 'សាខាពន្ធដារខេត្តប៉ៃលិន', name_en: 'Pailin Branch', type: 'BRANCH', code: 'PLI' },
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

export const mockInventory: InventoryItem[] = [
  // HQ Stock
  ...mockItems.map(item => ({
    location_id: '1',
    item_id: item.id,
    quantity: Math.floor(Math.random() * 100) + 10,
    last_updated: new Date().toISOString(),
    item_code: item.code,
    item_name_kh: item.name_kh,
    item_name_en: item.name_en,
    category: item.category,
    unit: item.unit,
    location_name_kh: 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB',
    location_name_en: 'HQ-ITSB Technical Inventory'
  })),
  // Some Branch Stocks
  {
    location_id: '2', item_id: '101', quantity: 2, last_updated: new Date().toISOString(),
    item_code: 'T-001', item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)', item_name_en: 'BOSCH Cordless Percy Screwed (GSB 120-LI)', category: 'Tools', unit: 'គ្រឿង', location_name_kh: 'សាខាពន្ធដារខណ្ឌ៧មករា', location_name_en: '7 Makara Branch'
  },
  {
    location_id: '3', item_id: '120', quantity: 50, last_updated: new Date().toISOString(),
    item_code: 'T-020', item_name_kh: 'គ្រាប់កឹប Network', item_name_en: 'RJ45 Connectors', category: 'Tools', unit: 'គ្រាប់', location_name_kh: 'សាខាពន្ធដារខណ្ឌចំការមន', location_name_en: 'Chamkarmon Branch'
  },
  {
    location_id: '4', item_id: '205', quantity: 10, last_updated: new Date().toISOString(),
    item_code: 'S-005', item_name_kh: 'ម៉ាសពេទ្យ', item_name_en: 'Medical Mask', category: 'Suppliers', unit: 'ប្រអប់', location_name_kh: 'សាខាពន្ធដារខណ្ឌដង្កោ', location_name_en: 'Dangkor Branch'
  }
];
