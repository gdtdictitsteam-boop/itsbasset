import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// Initialize client safely (use fallback URL if credentials are empty to avoid crash)
const validUrl = supabaseUrl && supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Check whether valid Supabase credentials have been provided
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('YOUR_SUPABASE_PROJECT_URL') &&
    !supabaseUrl.includes('placeholder.supabase.co') &&
    supabaseUrl.startsWith('http')
  );
};

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

    // 2. Insert initial inventory record if location_id is provided or HQ exists
    let targetLocationId = params.location_id;

    if (!targetLocationId) {
      // Find default location (e.g. HQ) from Supabase
      const { data: locs } = await supabase
        .from('locations')
        .select('id, code')
        .limit(1);

      if (locs && locs.length > 0) {
        targetLocationId = locs[0].id;
      }
    }

    if (targetLocationId && createdItemId) {
      // Insert inventory
      const { error: invErr } = await supabase.from('inventory').insert([
        {
          location_id: targetLocationId,
          item_id: createdItemId,
          quantity: initial_stock,
        },
      ]);

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
 * Fetch full inventory joined with items and locations from Supabase
 */
export async function fetchFullInventoryFromSupabase() {
  if (!isSupabaseConfigured()) return null;

  try {
    const [itemsRes, invRes, locsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('inventory').select('*'),
      supabase.from('locations').select('*'),
    ]);

    if (itemsRes.error) {
      console.warn('Error fetching items from Supabase:', itemsRes.error);
      return null;
    }

    const items = itemsRes.data || [];
    const inventory = invRes.data || [];
    const locations = locsRes.data || [];

    const locMap = new Map<string, any>();
    locations.forEach(loc => locMap.set(loc.id, loc));

    const itemMap = new Map<string, any>();
    items.forEach(it => itemMap.set(it.id, it));

    // Construct inventory items
    const result: any[] = [];

    // 1. Process existing inventory records
    inventory.forEach(inv => {
      const it = itemMap.get(inv.item_id);
      const loc = locMap.get(inv.location_id);
      if (it) {
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
          location_name_kh: loc?.name_kh || 'មិនស្គាល់ទីតាំង',
          location_name_en: loc?.name_en || 'Unknown Location',
          image_url: it.image_url || undefined,
        });
      }
    });

    // 2. Also ensure items with 0 inventory or not in inventory table are visible at default HQ location
    const defaultHqLoc = locations.find(l => l.type === 'HQ' || l.code?.includes('HQ')) || locations[0];
    items.forEach(it => {
      const hasAnyInv = inventory.some(inv => inv.item_id === it.id);
      if (!hasAnyInv && defaultHqLoc) {
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
          location_name_kh: defaultHqLoc.name_kh,
          location_name_en: defaultHqLoc.name_en,
          image_url: it.image_url || undefined,
        });
      }
    });

    return result;
  } catch (err) {
    console.error('Exception fetching full inventory from Supabase:', err);
    return null;
  }
}
