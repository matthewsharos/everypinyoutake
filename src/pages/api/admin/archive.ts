import type { APIRoute } from 'astro';
import { COOKIE, isAuthed } from '../../../lib/adminAuth';
import { hasServiceKey, serviceClient } from '../../../lib/supabaseServer';

export const prerender = false;

const CARD_SELECT =
  'id,pin_name,image_url,image_url2,image_url3,year,series,origin,edition,external_url,external_pin_id,is_limited_edition,is_mystery,is_ap,is_pp,created_at';
const SEARCH_FIELDS = ['pin_name', 'series', 'origin', 'edition', 'tags', 'notes'];

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'private, no-store' } });
}

export const GET: APIRoute = async ({ url, cookies }) => {
  if (!(await isAuthed(cookies.get(COOKIE)?.value))) return json({ error: 'Not authorized.' }, 401);
  if (!hasServiceKey()) return json({ error: 'Archive access is unavailable.' }, 503);

  const search = url.searchParams.get('q')?.trim();
  const recent = search === undefined;
  const limit = Number(url.searchParams.get('limit') ?? (recent ? 18 : 90));
  const offset = Number(url.searchParams.get('offset') ?? 0);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 2147483647) {
    return json({ error: 'Invalid archive pagination.' }, 400);
  }

  const sb = serviceClient();
  const rpc = recent
    ? sb.rpc('recent_archive_pins', { p_limit: limit })
    : sb.rpc('search_archive', { q: search, p_limit: limit, p_offset: offset });
  const { data, error } = await rpc.select(CARD_SELECT);
  if (!error && Array.isArray(data)) return json({ pins: data });

  let query = sb.from('pin_archive').select(CARD_SELECT).eq('already_on_site', false);
  if (recent) {
    query = query.order('id', { ascending: false }).limit(limit);
  } else {
    query = query.range(offset, offset + limit - 1);
    const term = search.replace(/[%,()]/g, ' ').trim();
    query = term
      ? query.or(SEARCH_FIELDS.map((field) => `${field}.ilike.%${term}%`).join(','))
      : query.order('updated_at', { ascending: false });
  }
  const fallback = await query;
  if (fallback.error) return json({ error: 'Unable to load the pin archive.' }, 502);
  return json({ pins: fallback.data ?? [] });
};
