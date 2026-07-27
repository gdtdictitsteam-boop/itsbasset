import { Location, Item, InventoryItem } from './types';

export const mockLocations: Location[] = [
  { id: '1', name_kh: 'ទីស្នាក់ការកណ្តាល', name_en: 'Headquarters', type: 'HQ', code: 'GDT-HQ' },
  { id: '2', name_kh: 'សាខាពន្ធដារខណ្ឌដូនពេញ', name_en: 'Daun Penh Branch', type: 'BRANCH', code: 'DP-BR' },
  { id: '3', name_kh: 'សាខាពន្ធដារខេត្តសៀមរាប', name_en: 'Siem Reap Branch', type: 'BRANCH', code: 'SR-BR' },
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
