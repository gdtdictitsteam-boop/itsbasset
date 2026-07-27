import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
