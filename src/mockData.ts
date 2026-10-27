import { Location, Item, InventoryItem } from './types';

export const mockLocations: Location[] = [
  { id: '1', name_kh: 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB', name_en: 'HQ-ITSB Technical Inventory', type: 'HQ', code: 'HQ-ITSB' },
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

export const mockItems: Item[] = [];

export const standardItemQuantities: Record<string, number> = {};

export const mockInventory: InventoryItem[] = [];

export const mockTransactions: any[] = [];


