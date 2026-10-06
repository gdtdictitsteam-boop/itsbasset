import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials dynamically from import.meta.env or localStorage
export const getSupabaseConfig = (): { url: string; anonKey: string } => {
  const metaEnv = (import.meta as any).env || {};
  let url = (metaEnv.VITE_SUPABASE_URL || '').trim();
  let anonKey = (metaEnv.VITE_SUPABASE_ANON_KEY || '').trim();

  // If environment variable is missing, empty, or placeholder, check localStorage
  if ((!url || url.includes('YOUR_SUPABASE') || !url.startsWith('http')) && typeof window !== 'undefined') {
    const storedUrl = localStorage.getItem('gdt_supabase_url') || localStorage.getItem('VITE_SUPABASE_URL') || '';
    if (storedUrl && storedUrl.startsWith('http')) {
      url = storedUrl.trim();
    }
  }

  if ((!anonKey || anonKey.includes('YOUR_SUPABASE') || anonKey === 'placeholder-key') && typeof window !== 'undefined') {
    const storedKey = localStorage.getItem('gdt_supabase_anon_key') || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';
    if (storedKey) {
      anonKey = storedKey.trim();
    }
  }

  return { url, anonKey };
};

/**
 * Check whether valid Supabase credentials have been provided
 */
export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return false;

  const cleanUrl = url.trim().toLowerCase();
  const cleanKey = anonKey.trim().toLowerCase();

  return (
    !cleanUrl.includes('your-project.supabase.co') &&
    !cleanUrl.includes('placeholder.supabase.co') &&
    !cleanUrl.includes('your_supabase') &&
    !cleanUrl.includes('example.supabase.co') &&
    cleanKey !== 'your-anon-key' &&
    cleanKey !== 'placeholder-key' &&
    cleanKey !== 'your_anon_key' &&
    cleanKey !== 'your-key' &&
    cleanUrl.startsWith('http')
  );
};

let currentClient: SupabaseClient<any> | null = null;
let currentClientKey = '';

export const getSupabaseClient = (): SupabaseClient<any> => {
  const { url, anonKey } = getSupabaseConfig();
  const validUrl = url && url.startsWith('http') ? url : 'https://placeholder.supabase.co';
  const validKey = anonKey || 'placeholder-key';
  const key = `${validUrl}::${validKey}`;

  if (!currentClient || currentClientKey !== key) {
    currentClient = createClient<any>(validUrl, validKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    currentClientKey = key;
  }
  return currentClient;
};

// Export proxy for `supabase` so any existing `supabase.from(...)` call continues to work seamlessly with active credentials
export const supabase: SupabaseClient<any> = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export const setSupabaseConfig = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gdt_supabase_url', url.trim());
    localStorage.setItem('gdt_supabase_anon_key', anonKey.trim());
    localStorage.setItem('VITE_SUPABASE_URL', url.trim());
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', anonKey.trim());
    currentClient = null; // force recreation
    window.dispatchEvent(new Event('supabase-config-changed'));
  }
};

/**
 * Test connectivity to Supabase and return status and table counts
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  itemsCount?: number;
  locationsCount?: number;
  inventoryCount?: number;
  transactionsCount?: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      message: 'Supabase credentials not configured',
      error: 'សូមបញ្ចូល Project URL និង Anon Key',
    };
  }

  try {
    const [itemsRes, locsRes, invRes, txRes] = await Promise.all([
      supabase.from('items').select('id', { count: 'exact', head: true }),
      supabase.from('locations').select('id', { count: 'exact', head: true }),
      supabase.from('inventory').select('id', { count: 'exact', head: true }),
      supabase.from('transactions').select('id', { count: 'exact', head: true }),
    ]);

    if (itemsRes.error && locsRes.error) {
      console.error('Supabase connection test failed:', itemsRes.error || locsRes.error);
      return {
        connected: false,
        message: 'បរាជ័យក្នុងការតភ្ជាប់ទៅ Supabase',
        error: itemsRes.error?.message || locsRes.error?.message,
      };
    }

    return {
      connected: true,
      message: 'តភ្ជាប់ទៅកាន់ Supabase Database ជោគជ័យ!',
      itemsCount: itemsRes.count ?? 0,
      locationsCount: locsRes.count ?? 0,
      inventoryCount: invRes.count ?? 0,
      transactionsCount: txRes.count ?? 0,
    };
  } catch (err: any) {
    console.error('Exception testing Supabase connection:', err);
    return {
      connected: false,
      message: 'មានបញ្ហាតភ្ជាប់',
      error: err?.message || String(err),
    };
  }
}

export interface InsertNewItemParams {
  code: string;
  name_kh: string;
  name_en?: string;
  category: string;
  unit: string;
  min_stock?: number;
  initial_stock?: number;
  location_id?: string;
  recorded_by?: string;
  remark?: string;
  image_url?: string;
}

export interface InsertItemResult {
  success: boolean;
  item?: any;
  error?: string;
  errorDetails?: string;
  savedToSupabase: boolean;
}

/**
 * Upload an item image file to the Supabase Storage bucket 'item_images'
 * and retrieve the permanent public URL.
 */
export async function uploadItemImageToStorage(file: File): Promise<{
  publicUrl: string | null;
  error: any;
  errorMessage?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      publicUrl: null,
      error: new Error('Supabase not configured'),
      errorMessage: 'មិនទាន់បានកំណត់ Supabase Credentials ក្នុង .env',
    };
  }

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const cleanBaseName = file.name
      .substring(0, file.name.lastIndexOf('.') || file.name.length)
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${Date.now()}_${cleanBaseName}.${fileExt}`;
    const filePath = `items/${fileName}`;

    // Upload to bucket 'item_images'
    const { error: uploadError } = await supabase.storage
      .from('item_images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      let msg = uploadError.message;
      if (uploadError.message?.includes('Bucket not found') || (uploadError as any).statusCode === '404' || (uploadError as any).statusCode === 404) {
        msg = 'រកមិនឃើញ Storage Bucket "item_images" ក្នុង Supabase! សូមបង្កើត Bucket ឈ្មោះ "item_images" (Public) ក្នុង Supabase Dashboard -> Storage ឬដំណើរការ SQL Script។';
      }
      return {
        publicUrl: null,
        error: uploadError,
        errorMessage: msg,
      };
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('item_images')
      .getPublicUrl(filePath);

    return {
      publicUrl: publicUrlData?.publicUrl || null,
      error: null,
    };
  } catch (err: any) {
    console.error('Exception in uploadItemImageToStorage:', err);
    return {
      publicUrl: null,
      error: err,
      errorMessage: err?.message || 'បរាជ័យក្នុងការ Upload រូបភាពទៅកាន់ Supabase Storage',
    };
  }
}

/**
 * Insert a new item into Supabase `items` table and create corresponding inventory/transaction records
 */
export async function insertItemToSupabase(params: InsertNewItemParams): Promise<InsertItemResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      savedToSupabase: false,
      error: 'មិនទាន់បានរៀបចំ VITE_SUPABASE_URL ឬ VITE_SUPABASE_ANON_KEY ក្នុងឯកសារ .env',
      errorDetails: 'សូមបញ្ចូលព័ត៌មាន URL និង ANON KEY របស់ Supabase Project របស់អ្នកក្នុងឯកសារ .env',
    };
  }

  const code = params.code.trim();
  const name_kh = params.name_kh.trim();
  const name_en = (params.name_en && params.name_en.trim()) ? params.name_en.trim() : name_kh;
  const category = params.category || 'Tools';
  const unit = params.unit || 'គ្រឿង';
  const min_stock = Number(params.min_stock || 0);
  const initial_stock = Number(params.initial_stock || 0);
  const image_url = params.image_url ? params.image_url.trim() : null;

  try {
    // 1. Insert into items table with image_url
    const insertPayload: Record<string, any> = {
      code,
      name_kh,
      name_en,
      category,
      unit,
      min_stock,
    };

    if (image_url) {
      insertPayload.image_url = image_url;
    }

    let { data: itemData, error: itemError } = await supabase
      .from('items')
      .insert([insertPayload])
      .select()
      .single();

    // If error was PGRST204 regarding image_url column not existing yet, fallback without image_url with warning
    if (itemError && (itemError.code === 'PGRST204' || itemError.message?.includes('image_url'))) {
      console.warn('Column image_url does not exist yet in items table. Retrying insert without image_url...');
      delete insertPayload.image_url;
      const retryResult = await supabase
        .from('items')
        .insert([insertPayload])
        .select()
        .single();
      itemData = retryResult.data;
      itemError = retryResult.error;
    }

    if (itemError) {
      console.error('Supabase item insert error:', itemError);
      
      let errMsg = itemError.message || 'បរាជ័យក្នុងការរក្សាទុកទៅក្នុង Supabase Table items';
      let errDetails = `Error Code: ${itemError.code || 'UNKNOWN'} | Details: ${itemError.details || itemError.hint || ''}`;

      if (itemError.code === '23505') {
        errMsg = `លេខកូដសម្ភារ "${code}" មានរួចហើយនៅក្នុង Supabase (Duplicate SKU code)!`;
        errDetails = 'សូមផ្លាស់ប្តូរលេខកូដសម្ភារ ឱ្យខុសពីលេខកូដដែលមានស្រាប់។';
      } else if (itemError.code === '42501' || itemError.message?.includes('row-level security')) {
        errMsg = 'បរាជ័យដោយសារ Row Level Security (RLS) របស់ Supabase!';
        errDetails = 'សូមចូលទៅកាន់ Supabase Dashboard -> SQL Editor ហើយដំណើរការ៖ ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;';
      } else if (itemError.code === 'PGRST204' || itemError.message?.includes('Columns')) {
        errMsg = 'រចនាសម្ព័ន្ធ Table "items" ក្នុង Supabase មិនត្រូវគ្នានឹងកូដ!';
        errDetails = 'សូមប្រាកដថាតារាង items មាន column: code, name_kh, name_en, category, unit, min_stock, image_url';
      }

      return {
        success: false,
        savedToSupabase: false,
        error: errMsg,
        errorDetails: errDetails,
      };
    }

    const createdItemId = itemData.id;

    const isUuid = (val?: string): boolean => {
      if (!val) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    };

    // 2. Insert initial inventory record if location_id is provided or HQ exists
    let targetLocationId = params.location_id;

    if (!isUuid(targetLocationId)) {
      // Find HQ location from Supabase
      const { data: hqLoc } = await supabase
        .from('locations')
        .select('id')
        .or('code.eq.HQ-ITSB,code.eq.ITSB-HQ,type.eq.HQ')
        .limit(1)
        .maybeSingle();

      if (hqLoc?.id) {
        targetLocationId = hqLoc.id;
      } else {
        const { data: anyLoc } = await supabase.from('locations').select('id').limit(1).maybeSingle();
        if (anyLoc?.id) targetLocationId = anyLoc.id;
      }
    }

    if (isUuid(targetLocationId) && createdItemId) {
      // Insert inventory
      const { error: invErr } = await supabase.from('inventory').upsert([
        {
          location_id: targetLocationId,
          item_id: createdItemId,
          quantity: initial_stock,
          last_updated: new Date().toISOString(),
        },
      ], { onConflict: 'location_id,item_id' });

      if (invErr) {
        console.warn('Supabase inventory insert notice:', invErr);
      }

      // Insert transaction record if initial stock > 0
      if (initial_stock > 0) {
        await supabase.from('transactions').insert([
          {
            type: 'STOCK_IN',
            to_location: targetLocationId,
            item_id: createdItemId,
            quantity: initial_stock,
            remark: params.remark || 'បញ្ចូលសម្ភារថ្មីដំបូង',
            recorded_by: params.recorded_by || 'Admin-GDT',
          },
        ]);
      }
    }

    return {
      success: true,
      savedToSupabase: true,
      item: itemData,
    };
  } catch (err: any) {
    console.error('Unhandled exception during Supabase item insert:', err);
    return {
      success: false,
      savedToSupabase: false,
      error: err?.message || 'មានបញ្ហាតភ្ជាប់ទៅកាន់ Supabase',
      errorDetails: err?.toString() || '',
    };
  }
}

/**
 * Helper function to fetch all rows from a Supabase table, 
 * bypassing the default 1000 row limit by using pagination.
 */
export async function fetchAllRows(tableName: string, query = '*', orderBy = 'id', ascending = true) {
  let allData: any[] = [];
  let hasMore = true;
  let page = 0;
  const pageSize = 1000;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(query)
      .order(orderBy, { ascending })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error(`Error fetching data from ${tableName}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data];
      if (data.length < pageSize) {
        hasMore = false; // Last page
      } else {
        page++;
      }
    } else {
      hasMore = false; // No more data
    }
  }

  return allData;
}

/**
 * Fetch full inventory joined with items and locations from Supabase.
 * Reflects true current balance directly from the public.inventory table.
 */
export async function fetchFullInventoryFromSupabase() {
  if (!isSupabaseConfigured()) return null;

  try {
    const [itemsRes, invRes, locsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('inventory').select('*'),
      supabase.from('locations').select('*'),
    ]);

    if (itemsRes.error || locsRes.error) {
      console.warn('Error fetching items or locations from Supabase:', {
        itemsError: itemsRes.error,
        locsError: locsRes.error
      });
      return null;
    }

    const items = itemsRes.data || [];
    let inventory = invRes.data || [];
    const locations = locsRes.data || [];

    if (items.length === 0 || locations.length === 0) {
      return null;
    }

    // If Supabase inventory is completely empty or error occurred on inventory table, auto-seed standard initial inventory once
    if (inventory.length === 0 || invRes.error) {
      console.info('Supabase inventory table is empty or had query notice. Attempting to seed standard initial stock...');
      const seedRes = await seedInitialInventoryToSupabase();
      if (seedRes.success) {
        const recheckInv = await supabase.from('inventory').select('*');
        if (recheckInv.data && recheckInv.data.length > 0) {
          inventory = recheckInv.data;
        }
      }
    }

    const defaultHqLoc = locations.find(l => l.code === 'HQ-ITSB' || l.type === 'HQ' || l.code?.includes('HQ')) || locations[0];

    const locMap = new Map<string, any>();
    locations.forEach(loc => {
      locMap.set(loc.id, loc);
      locMap.set(String(loc.id).toLowerCase(), loc);
      if (loc.code) {
        locMap.set(loc.code, loc);
        locMap.set(String(loc.code).toUpperCase(), loc);
      }
    });

    const itemMap = new Map<string, any>();
    items.forEach(it => {
      itemMap.set(it.id, it);
      itemMap.set(String(it.id).toLowerCase(), it);
      if (it.code) {
        itemMap.set(it.code, it);
        itemMap.set(String(it.code).toUpperCase(), it);
      }
    });

    // Construct inventory items reflecting TRUE current balances
    const result: any[] = [];

    // 1. Process all existing inventory records in the database
    inventory.forEach(inv => {
      const it = itemMap.get(inv.item_id) || itemMap.get(String(inv.item_id).toLowerCase());
      let loc = locMap.get(inv.location_id) || locMap.get(String(inv.location_id).toLowerCase());
      if (!loc && defaultHqLoc && (inv.location_id === '1' || inv.location_id === 'HQ-ITSB' || inv.location_id === defaultHqLoc.id)) {
        loc = defaultHqLoc;
      }
      if (it) {
        const isHq = loc ? (loc.type === 'HQ' || loc.code === 'HQ-ITSB' || loc.code === 'ITSB-HQ') : false;
        result.push({
          location_id: inv.location_id,
          item_id: inv.item_id,
          quantity: inv.quantity ?? 0,
          last_updated: inv.last_updated || new Date().toISOString(),
          item_code: it.code || '',
          item_name_kh: it.name_kh || '',
          item_name_en: it.name_en || it.name_kh || '',
          category: it.category || 'Tools',
          unit: it.unit || 'គ្រឿង',
          min_stock: it.min_stock ?? 0,
          location_name_kh: loc?.name_kh || (isHq ? 'ស្តុកសម្ភារបច្ចេកទេស HQ-ITSB' : 'មិនស្គាល់ទីតាំង'),
          location_name_en: loc?.name_en || (isHq ? 'HQ-ITSB Technical Inventory' : 'Unknown Location'),
          location_code: loc?.code || (isHq ? 'HQ-ITSB' : ''),
          type: loc?.type || (isHq ? 'HQ' : 'BRANCH'),
          image_url: it.image_url || undefined,
        });
      }
    });

    // 2. Also ensure every item has at least an HQ row so HQ stock column tracks it (with 0 if no inventory row yet)
    if (defaultHqLoc) {
      items.forEach(it => {
        const hasHqInv = result.some(r => 
          (r.item_id === it.id || String(r.item_code).toUpperCase() === String(it.code).toUpperCase()) &&
          (r.location_id === defaultHqLoc.id || r.location_code === 'HQ-ITSB' || r.type === 'HQ')
        );
        if (!hasHqInv) {
          result.push({
            location_id: defaultHqLoc.id,
            item_id: it.id,
            quantity: 0,
            last_updated: it.created_at || new Date().toISOString(),
            item_code: it.code || '',
            item_name_kh: it.name_kh || '',
            item_name_en: it.name_en || it.name_kh || '',
            category: it.category || 'Tools',
            unit: it.unit || 'គ្រឿង',
            min_stock: it.min_stock ?? 0,
            location_name_kh: defaultHqLoc.name_kh,
            location_name_en: defaultHqLoc.name_en,
            location_code: defaultHqLoc.code || 'HQ-ITSB',
            type: 'HQ',
            image_url: it.image_url || undefined,
          });
        }
      });
    }

    return result;
  } catch (err) {
    console.error('Exception fetching full inventory from Supabase:', err);
    return null;
  }
}

/**
 * Fetch all transaction records directly from Supabase public.transactions
 */
export async function fetchTransactionsFromSupabase(limit = 500): Promise<any[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Supabase fetch transactions error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching transactions from Supabase:', err);
    return [];
  }
}

// Helper to check if string is UUID
const isUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

async function resolveDbItemId(itemId: string, itemCode?: string): Promise<string | null> {
  if (isUuid(itemId)) return itemId;

  if (itemCode) {
    const { data } = await supabase
      .from('items')
      .select('id')
      .or(`code.eq.${itemCode},code.ilike.${itemCode}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data } = await supabase
    .from('items')
    .select('id')
    .or(`code.eq.${itemCode || itemId},id.eq.${itemId}`)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function resolveDbLocationId(locId: string, locCode?: string): Promise<string | null> {
  if (isUuid(locId)) return locId;

  if (locCode) {
    const { data } = await supabase
      .from('locations')
      .select('id')
      .or(`code.eq.${locCode},code.ilike.${locCode}`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (locId === '1' || locId === 'HQ-ITSB' || locCode === 'HQ-ITSB') {
    const { data } = await supabase
      .from('locations')
      .select('id')
      .or('type.eq.HQ,code.eq.HQ-ITSB,code.ilike.%HQ%')
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const { data } = await supabase
    .from('locations')
    .select('id')
    .or(`code.eq.${locCode || locId},id.eq.${locId}`)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

/**
 * Execute Stock In via Supabase RPC with atomic transaction & fallback
 */
export async function supabaseRecordStockIn(params: {
  locationId: string;
  itemId: string;
  itemCode?: string;
  locationCode?: string;
  quantity: number;
  recordedBy: string;
  remark?: string;
}) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  try {
    const dbLocId = await resolveDbLocationId(params.locationId, params.locationCode);
    const dbItemId = await resolveDbItemId(params.itemId, params.itemCode);

    if (!dbLocId || !dbItemId) {
      return { success: false, error: 'Could not resolve database UUIDs for location or item' };
    }

    // 1. Try atomic RPC call
    const { data: rpcData, error: rpcErr } = await supabase.rpc('record_stock_in', {
      p_location_id: dbLocId,
      p_item_id: dbItemId,
      p_quantity: params.quantity,
      p_recorded_by: params.recordedBy,
      p_remark: params.remark || ''
    });

    if (!rpcErr && rpcData?.success) {
      return { success: true, newQuantity: rpcData.new_quantity, transactionId: rpcData.transaction_id };
    }

    // 2. Direct database query fallback
    const { data: curInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', dbLocId)
      .eq('item_id', dbItemId)
      .maybeSingle();

    const currentQty = curInv ? (curInv.quantity || 0) : 0;
    const newQty = currentQty + params.quantity;

    await supabase.from('inventory').upsert([
      {
        location_id: dbLocId,
        item_id: dbItemId,
        quantity: newQty,
        last_updated: new Date().toISOString()
      }
    ], { onConflict: 'location_id,item_id' });

    const { data: itData } = await supabase.from('items').select('code, name_kh, unit').eq('id', dbItemId).maybeSingle();

    const { data: txData } = await supabase.from('transactions').insert([
      {
        type: 'STOCK_IN',
        to_location_id: dbLocId,
        item_id: dbItemId,
        item_code: itData?.code || params.itemCode || '',
        item_name_kh: itData?.name_kh || '',
        quantity: params.quantity,
        unit: itData?.unit || 'គ្រឿង',
        recorded_by: params.recordedBy,
        remark: params.remark || 'បញ្ចូលស្តុកថ្មី',
        status: 'RECEIVED'
      }
    ]).select('id').maybeSingle();

    return { success: true, newQuantity: newQty, transactionId: txData?.id };
  } catch (err: any) {
    console.error('Supabase stock in error:', err);
    return { success: false, error: err?.message || 'Error executing stock in' };
  }
}

/**
 * Execute Stock Out via Supabase RPC with atomic transaction & fallback
 */
export async function supabaseRecordStockOut(params: {
  locationId: string;
  itemId: string;
  itemCode?: string;
  locationCode?: string;
  quantity: number;
  recordedBy: string;
  remark?: string;
}) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  try {
    const dbLocId = await resolveDbLocationId(params.locationId, params.locationCode);
    const dbItemId = await resolveDbItemId(params.itemId, params.itemCode);

    if (!dbLocId || !dbItemId) {
      return { success: false, error: 'Could not resolve database UUIDs for location or item' };
    }

    // 1. Try atomic RPC call
    const { data: rpcData, error: rpcErr } = await supabase.rpc('record_stock_out', {
      p_location_id: dbLocId,
      p_item_id: dbItemId,
      p_quantity: params.quantity,
      p_recorded_by: params.recordedBy,
      p_remark: params.remark || ''
    });

    if (!rpcErr && rpcData?.success) {
      return { success: true, newQuantity: rpcData.new_quantity, transactionId: rpcData.transaction_id };
    }

    // 2. Direct fallback
    const { data: curInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', dbLocId)
      .eq('item_id', dbItemId)
      .maybeSingle();

    const currentQty = curInv ? (curInv.quantity || 0) : 0;
    if (currentQty < params.quantity) {
      return { success: false, error: `Insufficient stock in location. Current: ${currentQty}, Requested: ${params.quantity}` };
    }

    const newQty = currentQty - params.quantity;

    await supabase.from('inventory').update({
      quantity: newQty,
      last_updated: new Date().toISOString()
    }).eq('location_id', dbLocId).eq('item_id', dbItemId);

    const { data: itData } = await supabase.from('items').select('code, name_kh, unit').eq('id', dbItemId).maybeSingle();

    const { data: txData } = await supabase.from('transactions').insert([
      {
        type: 'STOCK_OUT',
        from_location_id: dbLocId,
        item_id: dbItemId,
        item_code: itData?.code || params.itemCode || '',
        item_name_kh: itData?.name_kh || '',
        quantity: params.quantity,
        unit: itData?.unit || 'គ្រឿង',
        recorded_by: params.recordedBy,
        remark: params.remark || 'ដកប្រើប្រាស់',
        status: 'RECEIVED'
      }
    ]).select('id').maybeSingle();

    return { success: true, newQuantity: newQty, transactionId: txData?.id };
  } catch (err: any) {
    console.error('Supabase stock out error:', err);
    return { success: false, error: err?.message || 'Error executing stock out' };
  }
}

/**
 * Execute Branch Handover via Supabase RPC with atomic transaction & fallback
 */
export async function supabaseHandleHandover(params: {
  fromLocationId: string;
  toLocationId: string;
  fromLocationCode?: string;
  toLocationCode?: string;
  itemId: string;
  itemCode?: string;
  quantity: number;
  recordedBy: string;
  remark?: string;
}) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  try {
    const dbFromLocId = await resolveDbLocationId(params.fromLocationId, params.fromLocationCode);
    const dbToLocId = await resolveDbLocationId(params.toLocationId, params.toLocationCode);
    const dbItemId = await resolveDbItemId(params.itemId, params.itemCode);

    if (!dbFromLocId || !dbToLocId || !dbItemId) {
      return { success: false, error: 'Could not resolve database UUIDs for handover' };
    }

    // 1. Try atomic RPC call
    const { data: rpcData, error: rpcErr } = await supabase.rpc('handle_branch_handover', {
      p_from_location: dbFromLocId,
      p_to_location: dbToLocId,
      p_item_id: dbItemId,
      p_quantity: params.quantity,
      p_recorded_by: params.recordedBy,
      p_remark: params.remark || ''
    });

    if (!rpcErr && rpcData?.success) {
      return { success: true, transactionId: rpcData.transaction_id };
    }

    // 2. Direct fallback (Direct Handover Auto Sync)
    const { data: curSource } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', dbFromLocId)
      .eq('item_id', dbItemId)
      .maybeSingle();

    if (!curSource || curSource.quantity < params.quantity) {
      return { success: false, error: 'Insufficient stock in source location' };
    }

    // Deduct source
    await supabase.from('inventory').update({
      quantity: curSource.quantity - params.quantity,
      last_updated: new Date().toISOString()
    }).eq('location_id', dbFromLocId).eq('item_id', dbItemId);

    // Auto Sync: Increment / insert into destination branch inventory immediately
    const { data: curDest } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', dbToLocId)
      .eq('item_id', dbItemId)
      .maybeSingle();

    if (curDest) {
      await supabase.from('inventory').update({
        quantity: (curDest.quantity || 0) + params.quantity,
        last_updated: new Date().toISOString()
      }).eq('location_id', dbToLocId).eq('item_id', dbItemId);
    } else {
      await supabase.from('inventory').insert([{
        location_id: dbToLocId,
        item_id: dbItemId,
        quantity: params.quantity,
        last_updated: new Date().toISOString()
      }]);
    }

    const { data: itData } = await supabase.from('items').select('code, name_kh, unit').eq('id', dbItemId).maybeSingle();

    const { data: txData } = await supabase.from('transactions').insert([
      {
        type: 'HANDOVER',
        from_location_id: dbFromLocId,
        to_location_id: dbToLocId,
        item_id: dbItemId,
        item_code: itData?.code || params.itemCode || '',
        item_name_kh: itData?.name_kh || '',
        quantity: params.quantity,
        unit: itData?.unit || 'គ្រឿង',
        recorded_by: params.recordedBy,
        remark: params.remark || 'ផ្ទេរសម្ភារៈជូនសាខា',
        status: 'COMPLETED'
      }
    ]).select('id').maybeSingle();

    return { success: true, transactionId: txData?.id };
  } catch (err: any) {
    console.error('Supabase handover error:', err);
    return { success: false, error: err?.message || 'Error executing handover' };
  }
}

/**
 * Acknowledge received stock at branch location (Increments branch balance)
 */
export async function supabaseAcknowledgeHandover(params: {
  transactionId: string;
  receivedBy: string;
}) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  try {
    // 1. Try atomic RPC call
    const { data: rpcData, error: rpcErr } = await supabase.rpc('acknowledge_handover', {
      p_transaction_id: params.transactionId,
      p_received_by: params.receivedBy
    });

    if (!rpcErr && rpcData?.success) {
      return { success: true, newBranchQuantity: rpcData.new_branch_quantity };
    }

    // 2. Direct fallback
    const { data: tx } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', params.transactionId)
      .maybeSingle();

    if (!tx) {
      return { success: false, error: 'Transaction not found' };
    }

    await supabase
      .from('transactions')
      .update({
        status: 'RECEIVED',
        recorded_by: params.receivedBy || tx.recorded_by,
        date: new Date().toISOString()
      })
      .eq('id', params.transactionId);

    const { data: curDestInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', tx.to_location_id)
      .eq('item_id', tx.item_id)
      .maybeSingle();

    const newBranchQty = (curDestInv?.quantity || 0) + tx.quantity;

    await supabase.from('inventory').upsert([
      {
        location_id: tx.to_location_id,
        item_id: tx.item_id,
        quantity: newBranchQty,
        last_updated: new Date().toISOString()
      }
    ], { onConflict: 'location_id,item_id' });

    return { success: true, newBranchQuantity: newBranchQty };
  } catch (err: any) {
    console.error('Supabase acknowledge handover error:', err);
    return { success: false, error: err?.message || 'Error acknowledging handover' };
  }
}

/**
 * Execute Stock Adjustment via Supabase RPC with atomic transaction & fallback
 */
export async function supabaseRecordAdjustment(params: {
  locationId: string;
  itemId: string;
  itemCode?: string;
  locationCode?: string;
  actualQuantity: number;
  recordedBy: string;
  remark?: string;
}) {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  try {
    const dbLocId = await resolveDbLocationId(params.locationId, params.locationCode);
    const dbItemId = await resolveDbItemId(params.itemId, params.itemCode);

    if (!dbLocId || !dbItemId) {
      return { success: false, error: 'Could not resolve database UUIDs for location or item' };
    }

    // 1. Try atomic RPC call
    const { data: rpcData, error: rpcErr } = await supabase.rpc('record_stock_adjustment', {
      p_location_id: dbLocId,
      p_item_id: dbItemId,
      p_actual_quantity: params.actualQuantity,
      p_recorded_by: params.recordedBy,
      p_remark: params.remark || ''
    });

    if (!rpcErr && rpcData?.success) {
      return { 
        success: true, 
        previousQuantity: rpcData.previous_quantity,
        newQuantity: rpcData.new_quantity,
        delta: rpcData.delta,
        transactionId: rpcData.transaction_id 
      };
    }

    // 2. Direct fallback
    const { data: curInv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('location_id', dbLocId)
      .eq('item_id', dbItemId)
      .maybeSingle();

    const previousQty = curInv ? (curInv.quantity || 0) : 0;
    const delta = params.actualQuantity - previousQty;

    await supabase.from('inventory').upsert([
      {
        location_id: dbLocId,
        item_id: dbItemId,
        quantity: params.actualQuantity,
        last_updated: new Date().toISOString()
      }
    ], { onConflict: 'location_id,item_id' });

    const { data: itData } = await supabase.from('items').select('code, name_kh, unit').eq('id', dbItemId).maybeSingle();

    const sign = delta >= 0 ? '+' : '';
    const finalRemark = `${params.remark || 'កែតម្រូវស្តុកជាក់ស្តែង'} [ប្រព័ន្ធ: ${previousQty} -> ជាក់ស្តែង: ${params.actualQuantity} | ផលសង: ${sign}${delta} ${itData?.unit || 'គ្រឿង'}]`;

    const { data: txData } = await supabase.from('transactions').insert([
      {
        type: 'ADJUSTMENT',
        to_location_id: dbLocId,
        from_location_id: dbLocId,
        item_id: dbItemId,
        item_code: itData?.code || params.itemCode || '',
        item_name_kh: itData?.name_kh || '',
        quantity: delta,
        unit: itData?.unit || 'គ្រឿង',
        recorded_by: params.recordedBy,
        remark: finalRemark,
        status: 'RECEIVED'
      }
    ]).select('id').maybeSingle();

    return { 
      success: true, 
      previousQuantity: previousQty, 
      newQuantity: params.actualQuantity, 
      delta, 
      transactionId: txData?.id 
    };
  } catch (err: any) {
    console.error('Supabase stock adjustment error:', err);
    return { success: false, error: err?.message || 'Error executing stock adjustment' };
  }
}

/**
 * Seed or sync standard clean initial inventory to Supabase
 */
export async function seedInitialInventoryToSupabase(): Promise<{
  success: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Supabase មិនទាន់ត្រូវបានកំណត់ (Configured) ក្នុងឯកសារ .env ឡើយ។',
    };
  }

  try {
    const { mockItems, mockLocations, standardItemQuantities } = await import('../mockData');

    // 1. Fetch locations (auto-populate from mockLocations if empty)
    let { data: locs, error: locErr } = await supabase.from('locations').select('*');
    if (!locs || locs.length === 0) {
      const locsToInsert = mockLocations.map(l => ({
        code: l.code,
        name_kh: l.name_kh,
        name_en: l.name_en,
        type: l.type,
      }));
      await supabase.from('locations').upsert(locsToInsert, { onConflict: 'code' });
      const refreshed = await supabase.from('locations').select('*');
      locs = refreshed.data || [];
    }

    if (!locs || locs.length === 0) {
      return {
        success: false,
        message: 'មិនអាចទាញយក ឬបង្កើតទីតាំង (locations) ក្នុង Supabase បានឡើយ។ សូមពិនិត្យ Table locations។',
      };
    }

    const hqLoc = locs.find(l => l.code === 'HQ-ITSB' || l.type === 'HQ' || l.code?.includes('HQ')) || locs[0];

    // 2. Upsert items
    const itemsToUpsert = mockItems.map(item => ({
      code: item.code,
      name_kh: item.name_kh,
      name_en: item.name_en,
      category: item.category,
      unit: item.unit,
      min_stock: item.min_stock,
    }));

    const { data: upsertedItems, error: itemErr } = await supabase
      .from('items')
      .upsert(itemsToUpsert, { onConflict: 'code' })
      .select('id, code');

    if (itemErr) {
      console.error('Error seeding items to Supabase:', itemErr);
      return {
        success: false,
        message: `បរាជ័យក្នុងការបញ្ចូលទិន្នន័យ Items: ${itemErr.message}`,
      };
    }

    // 3. Upsert inventory records for HQ and sample branches
    const allDbItems = upsertedItems && upsertedItems.length > 0
      ? upsertedItems
      : (await supabase.from('items').select('id, code')).data || [];

    const itemByCode = new Map<string, string>();
    allDbItems.forEach(it => itemByCode.set(it.code, it.id));

    const locByCode = new Map<string, string>();
    locs.forEach(l => locByCode.set(l.code, l.id));

    const inventoryRows: any[] = [];
    allDbItems.forEach(it => {
      const standardQty = standardItemQuantities[it.code] ?? 20;
      inventoryRows.push({
        location_id: hqLoc.id,
        item_id: it.id,
        quantity: standardQty,
        last_updated: new Date().toISOString(),
      });
    });

    // Seed branch stocks so active branch officers immediately have stock visible
    const branchSeeds: Array<{ locCode: string; itemCode: string; qty: number }> = [
      // 7 Makara (7MK)
      { locCode: '7MK', itemCode: 'T-001', qty: 2 },
      { locCode: '7MK', itemCode: 'T-006', qty: 2 },
      { locCode: '7MK', itemCode: 'T-019', qty: 5 },
      { locCode: '7MK', itemCode: 'S-004', qty: 10 },
      { locCode: '7MK', itemCode: 'S-005', qty: 5 },
      // Chamkarmon (CKM)
      { locCode: 'CKM', itemCode: 'T-001', qty: 1 },
      { locCode: 'CKM', itemCode: 'T-004', qty: 1 },
      { locCode: 'CKM', itemCode: 'T-010', qty: 2 },
      { locCode: 'CKM', itemCode: 'S-004', qty: 8 },
      // Daun Penh (DPE)
      { locCode: 'DPE', itemCode: 'T-001', qty: 1 },
      { locCode: 'DPE', itemCode: 'T-002', qty: 1 },
      { locCode: 'DPE', itemCode: 'T-012', qty: 1 },
      { locCode: 'DPE', itemCode: 'S-001', qty: 2 },
      // Toul Kork (TKO)
      { locCode: 'TKO', itemCode: 'T-001', qty: 1 },
      { locCode: 'TKO', itemCode: 'T-007', qty: 2 },
      { locCode: 'TKO', itemCode: 'T-020', qty: 50 },
      { locCode: 'TKO', itemCode: 'S-005', qty: 10 },
      // Kampong Cham (KPC)
      { locCode: 'KPC', itemCode: 'T-001', qty: 1 },
      { locCode: 'KPC', itemCode: 'T-003', qty: 1 },
      { locCode: 'KPC', itemCode: 'T-013', qty: 2 },
      { locCode: 'KPC', itemCode: 'S-002', qty: 5 },
      // Tech-HQ
      { locCode: 'Tech-HQ', itemCode: 'T-001', qty: 1 },
      { locCode: 'Tech-HQ', itemCode: 'T-004', qty: 1 },
      { locCode: 'Tech-HQ', itemCode: 'T-012', qty: 1 },
      { locCode: 'Tech-HQ', itemCode: 'S-004', qty: 20 },
    ];

    branchSeeds.forEach(bs => {
      const bLocId = locByCode.get(bs.locCode);
      const bItemId = itemByCode.get(bs.itemCode);
      if (bLocId && bItemId) {
        inventoryRows.push({
          location_id: bLocId,
          item_id: bItemId,
          quantity: bs.qty,
          last_updated: new Date().toISOString(),
        });
      }
    });

    let invErr: any = null;
    const { error: batchErr } = await supabase
      .from('inventory')
      .upsert(inventoryRows, { onConflict: 'location_id,item_id' });

    if (batchErr) {
      console.warn('Batch upsert inventory notice, retrying row-by-row:', batchErr);
      // Fallback row by row with update-or-insert
      for (const row of inventoryRows) {
        const { data: existing } = await supabase
          .from('inventory')
          .select('id')
          .eq('location_id', row.location_id)
          .eq('item_id', row.item_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('inventory')
            .update({ quantity: row.quantity, last_updated: row.last_updated })
            .eq('id', existing.id);
        } else {
          await supabase.from('inventory').insert([row]);
        }
      }
    }

    // 4. Seed initial transaction records into transactions table if empty
    try {
      const { count: txCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true });
      if (!txCount || txCount === 0) {
        const initialTxRows = [
          {
            type: 'STOCK_IN',
            to_location_id: hqLoc.id,
            item_id: itemByCode.get('T-001') || allDbItems[0]?.id,
            item_code: 'T-001',
            item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)',
            quantity: 15,
            unit: 'គ្រឿង',
            recorded_by: 'Admin-GDT',
            remark: 'បញ្ចូលស្តុកកណ្តាលដំបូង HQ-ITSB',
            status: 'RECEIVED'
          },
          {
            type: 'HANDOVER',
            from_location_id: hqLoc.id,
            to_location_id: locByCode.get('7MK') || locs[1]?.id,
            item_id: itemByCode.get('T-001') || allDbItems[0]?.id,
            item_code: 'T-001',
            item_name_kh: 'ម៉ូទ័រចាប់វិសប្រើថ្មសាក BOSCH Cordless Percy Screwed (GSB 120-LI)',
            quantity: 2,
            unit: 'គ្រឿង',
            recorded_by: 'Admin-GDT',
            remark: 'ផ្ទេរសម្ភារៈបច្ចេកទេសជូនសាខា ៧មករា (7MK)',
            status: 'COMPLETED'
          }
        ];
        await supabase.from('transactions').insert(initialTxRows);
      }
    } catch (txErr) {
      console.warn('Initial transactions seed notice:', txErr);
    }

    return {
      success: true,
      message: `បានរៀបចំ និងបញ្ចូលទិន្នន័យស្តុកដំបូងទៅ Supabase ជោគជ័យចំនួន ${inventoryRows.length} មុខសម្ភារ!`,
    };
  } catch (err: any) {
    console.error('Exception seeding inventory to Supabase:', err);
    return {
      success: false,
      message: err?.message || 'មានបញ្ហាក្នុងការតភ្ជាប់ទៅកាន់ Supabase',
    };
  }
}
