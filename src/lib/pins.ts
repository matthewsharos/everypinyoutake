import { supabase } from './supabase';

export type CollectedType = 'Collected' | 'For Trade' | 'ISO';

export interface Pin {
  id: number;
  pin_name: string;
  image_url: string | null;
  image_url2: string | null;
  image_url3: string | null;
  year: number | null;
  series: string | null;
  origin: string | null;
  edition: string | null;
  tags: string | null;
  notes: string | null;
  external_url: string | null;
  external_pin_id: string | null;
  is_limited_edition: boolean | null;
  is_mystery: boolean | null;
  is_ap: boolean | null;
  is_pp: boolean | null;
  collected_type: string | null;
  created_at?: string | null;
}

const COLUMNS =
  'id,pin_name,image_url,image_url2,image_url3,year,series,origin,edition,tags,notes,external_url,external_pin_id,is_limited_edition,is_mystery,is_ap,is_pp,collected_type,created_at';

// Fields searched by the public metadata search (v1: ilike OR; task #6 upgrades to Postgres FTS + pg_trgm).
const SEARCH_FIELDS = ['pin_name', 'series', 'origin', 'edition', 'tags', 'notes'];

export type SortKey = 'created' | 'updated' | 'az';

export interface GetCollectionOpts {
  /** Filter by collected_type. Omit for the whole displayed collection. */
  type?: CollectedType;
  /** Free-text search across pin metadata. */
  search?: string;
  /** Sort order for browse views (search results are relevance-ranked). */
  sort?: SortKey;
  limit?: number;
  offset?: number;
}

function orderBy(q: any, sort: SortKey) {
  if (sort === 'updated') return q.order('updated_at', { ascending: false });
  if (sort === 'az') return q.order('pin_name', { ascending: true });
  return q.order('created_at', { ascending: false });
}

/**
 * Public collection query — reads `pins` ONLY (pin_archive is admin-only and never shown publicly).
 */
export async function getCollection(opts: GetCollectionOpts = {}): Promise<{ pins: Pin[]; total: number }> {
  const { type, search, sort = 'created', limit = 60, offset = 0 } = opts;
  const s = (search ?? '').trim();

  if (s) {
    // Ranked, typo-tolerant full-text search; falls back to ILIKE if the search
    // migration (db/search.sql) hasn't been applied yet.
    const { data, error } = await supabase.rpc('search_pins', {
      q: s,
      p_type: type ?? null,
      p_limit: limit,
      p_offset: offset,
    });
    if (!error && Array.isArray(data)) {
      return { pins: data as Pin[], total: data.length };
    }
    return ilikeCollection(type, s, sort, limit, offset);
  }

  let q = supabase
    .from('pins')
    .select(COLUMNS, { count: 'exact' })
    .range(offset, offset + limit - 1);
  if (type) q = q.eq('collected_type', type);
  q = orderBy(q, sort);

  const { data, count, error } = await q;
  if (error) throw error;
  return { pins: (data ?? []) as Pin[], total: count ?? 0 };
}

async function ilikeCollection(
  type: CollectedType | undefined,
  search: string,
  sort: SortKey,
  limit: number,
  offset: number,
): Promise<{ pins: Pin[]; total: number }> {
  const s = search.replace(/[%,()]/g, ' ').trim();
  let q = supabase
    .from('pins')
    .select(COLUMNS, { count: 'exact' })
    .range(offset, offset + limit - 1);
  if (type) q = q.eq('collected_type', type);
  if (s) q = q.or(SEARCH_FIELDS.map((f) => `${f}.ilike.%${s}%`).join(','));
  q = orderBy(q, sort);
  const { data, count, error } = await q;
  if (error) throw error;
  return { pins: (data ?? []) as Pin[], total: count ?? 0 };
}

export interface CollectionStats {
  total: number;
  collected: number;
  forTrade: number;
  iso: number;
}

export async function getStats(): Promise<CollectionStats> {
  const head = (type?: CollectedType) => {
    let q = supabase.from('pins').select('id', { count: 'exact', head: true });
    if (type) q = q.eq('collected_type', type);
    return q;
  };
  const [all, collected, forTrade, iso] = await Promise.all([
    head(),
    head('Collected'),
    head('For Trade'),
    head('ISO'),
  ]);
  return {
    total: all.count ?? 0,
    collected: collected.count ?? 0,
    forTrade: forTrade.count ?? 0,
    iso: iso.count ?? 0,
  };
}

/** Best available image for a pin, with graceful fallback across the three image columns. */
export function pinImage(pin: Pin): string | null {
  return pin.image_url || pin.image_url2 || pin.image_url3 || null;
}

export interface TikTok {
  id: string;
  url: string;
  description: string | null;
  created_at: string | null;
}

/** Curated TikTok videos (managed in the admin), newest first. */
export async function getTikToks(limit = 12): Promise<TikTok[]> {
  const { data, error } = await supabase
    .from('tiktok_urls')
    .select('id,url,description,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TikTok[];
}

/** Extract the numeric video id from a TikTok URL (for the iframe embed). */
export function tiktokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}
