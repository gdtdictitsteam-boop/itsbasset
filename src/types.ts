export type Language = 'en' | 'kh';

export interface Location {
  id: string;
  name_kh: string;
  name_en: string;
  type: string;
  code: string;
}

export interface Item {
  id: string;
  code: string;
  name_kh: string;
  name_en: string;
  category: string;
  unit: string;
  min_stock: number;
  image_url?: string;
}

export interface InventoryItem {
  location_id: string;
  item_id: string;
  quantity: number;
  last_updated: string;
  // Joined fields for display
  item_code: string;
  item_name_kh: string;
  item_name_en: string;
  category: string;
  unit: string;
  location_name_kh: string;
  location_name_en: string;
  image_url?: string;
}

export interface Transaction {
  id: string;
  type: 'STOCK_IN' | 'STOCK_OUT' | 'HANDOVER' | 'ADJUSTMENT';
  from_location?: string;
  to_location?: string;
  item_id: string;
  quantity: number;
  remark?: string;
  recorded_by: string;
  created_at: string;
}
