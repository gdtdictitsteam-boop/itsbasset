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
  { id: '101', code: 'IT-LP-001', name_kh: 'កុំព្យូទ័រយួរដៃ Dell Latitude', name_en: 'Dell Latitude Laptop', category: 'IT Equipment', unit: 'គ្រឿង', min_stock: 5 },
  { id: '102', code: 'IT-PR-002', name_kh: 'ម៉ាស៊ីនបោះពុម្ព Canon', name_en: 'Canon Printer', category: 'IT Equipment', unit: 'គ្រឿង', min_stock: 2 },
  { id: '103', code: 'OF-PA-003', name_kh: 'ក្រដាស A4 (កេស)', name_en: 'A4 Paper (Box)', category: 'Office Supplies', unit: 'កេស', min_stock: 20 },
  { id: '104', code: 'IT-NW-004', name_kh: 'ឧបករណ៍បណ្តាញ Cisco Router', name_en: 'Cisco Router', category: 'Networking', unit: 'គ្រឿង', min_stock: 1 },
];

export const mockInventory: InventoryItem[] = [
  {
    location_id: '1', item_id: '101', quantity: 45, last_updated: new Date().toISOString(),
    item_code: 'IT-LP-001', item_name_kh: 'កុំព្យូទ័រយួរដៃ Dell Latitude', item_name_en: 'Dell Latitude Laptop', category: 'IT Equipment', unit: 'គ្រឿង', location_name_kh: 'ទីស្នាក់ការកណ្តាល', location_name_en: 'Headquarters'
  },
  {
    location_id: '1', item_id: '102', quantity: 12, last_updated: new Date().toISOString(),
    item_code: 'IT-PR-002', item_name_kh: 'ម៉ាស៊ីនបោះពុម្ព Canon', item_name_en: 'Canon Printer', category: 'IT Equipment', unit: 'គ្រឿង', location_name_kh: 'ទីស្នាក់ការកណ្តាល', location_name_en: 'Headquarters'
  },
  {
    location_id: '1', item_id: '103', quantity: 150, last_updated: new Date().toISOString(),
    item_code: 'OF-PA-003', item_name_kh: 'ក្រដាស A4 (កេស)', item_name_en: 'A4 Paper (Box)', category: 'Office Supplies', unit: 'កេស', location_name_kh: 'ទីស្នាក់ការកណ្តាល', location_name_en: 'Headquarters'
  },
  {
    location_id: '2', item_id: '101', quantity: 5, last_updated: new Date().toISOString(),
    item_code: 'IT-LP-001', item_name_kh: 'កុំព្យូទ័រយួរដៃ Dell Latitude', item_name_en: 'Dell Latitude Laptop', category: 'IT Equipment', unit: 'គ្រឿង', location_name_kh: 'សាខាពន្ធដារខណ្ឌដូនពេញ', location_name_en: 'Daun Penh Branch'
  }
];
