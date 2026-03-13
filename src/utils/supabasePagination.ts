import { supabase } from '@/integrations/supabase/client';

type TableName = 'accounts' | 'contacts' | 'leads' | 'deals' | 'action_items';

interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
}

interface PaginationOptions {
  page: number;
  pageSize: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  searchTerm?: string;
  searchFields?: string[];
  filters?: Record<string, string>;
}

/**
 * Fetch a single page of data with server-side pagination, sorting, search and filters.
 * Uses Supabase `.range()` and `{ count: 'exact' }` to return only the rows for the
 * current page plus the total matching count.
 */
export async function fetchPaginatedData<T = any>(
  tableName: TableName,
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  const {
    page,
    pageSize,
    sortField,
    sortDirection = 'asc',
    searchTerm,
    searchFields = [],
    filters = {},
  } = options;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query: any = supabase
    .from(tableName)
    .select('*', { count: 'exact' });

  // Server-side search across multiple columns
  if (searchTerm && searchFields.length > 0) {
    const orClauses = searchFields
      .map(field => `${field}.ilike.%${searchTerm}%`)
      .join(',');
    query = query.or(orClauses);
  }

  // Server-side equality filters
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== 'all') {
      query = query.eq(key, value);
    }
  }

  // Server-side sorting
  if (sortField) {
    query = query.order(sortField, { ascending: sortDirection === 'asc' });
  } else {
    // Default sort by created_time/created_at descending
    const defaultSort = tableName === 'deals' ? 'modified_at' : 'created_time';
    query = query.order(defaultSort, { ascending: false });
  }

  // Pagination range
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) throw error;

  return {
    data: (data || []) as T[],
    totalCount: count ?? 0,
  };
}

/**
 * Fetch ALL records from a table by looping through paginated requests of 1000 rows.
 * Used for CSV exports and hooks that need the complete dataset.
 */
export async function fetchAllRecords<T = any>(
  tableName: TableName,
  orderField: string = 'created_time',
  ascending: boolean = false
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderField, { ascending })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;

    allData = [...allData, ...(data || []) as T[]];
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allData;
}
