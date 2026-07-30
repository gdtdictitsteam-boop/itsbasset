import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// Initialize client safely (use fallback URL if credentials are empty to avoid crash)
const validUrl = supabaseUrl && supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(validUrl, validKey);

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
}

export interface InsertItemResult {
  success: boolean;
  item?: any;
  error?: string;
  errorDetails?: string;
  savedToSupabase: boolean;
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

  try {
    // 1. Insert into items table
    const { data: itemData, error: itemError } = await supabase
      .from('items')
      .insert([
        {
          code,
          name_kh,
          name_en,
          category,
          unit,
          min_stock,
        },
      ])
      .select()
      .single();

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
        errDetails = 'សូមប្រាកដថាតារាង items មាន column: code, name_kh, name_en, category, unit, min_stock';
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

