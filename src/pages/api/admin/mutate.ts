import type { APIRoute } from 'astro';
import { normalizePinMetadata, MetadataValidationError } from '../../../lib/metadata';
import { COOKIE, isAuthed } from '../../../lib/adminAuth';
import { hasServiceKey, serviceClient } from '../../../lib/supabaseServer';

export const prerender = false;

const SELECT =
  'id,pin_name,image_url,image_url2,image_url3,year,series,origin,edition,tags,notes,external_url,external_pin_id,is_limited_edition,is_mystery,is_ap,is_pp,collected_type,created_at';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function copyFields(p: any) {
  return {
    pin_name: p.pin_name,
    image_url: p.image_url,
    image_url2: p.image_url2,
    image_url3: p.image_url3,
    year: p.year,
    series: p.series,
    origin: p.origin,
    edition: p.edition,
    tags: p.tags,
    notes: p.notes,
    external_url: p.external_url,
    external_pin_id: p.external_pin_id,
    is_limited_edition: p.is_limited_edition,
    is_mystery: p.is_mystery,
    is_ap: p.is_ap,
    is_pp: p.is_pp,
  };
}

function normalizeExternalId(id: unknown): string | null {
  const normalized = String(id ?? '').trim().replace(/^0+/, '');
  return normalized || null;
}

async function findExistingPinByExternalId(sb: ReturnType<typeof serviceClient>, externalId: string) {
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from('pins')
      .select('id,pin_name,external_pin_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const match = (data ?? []).find((pin) => normalizeExternalId(pin.external_pin_id) === externalId);
    if (match) return match;
    if (!data || data.length < pageSize) return null;
  }
}

async function archivePinById(sb: ReturnType<typeof serviceClient>, id: unknown) {
  const archiveId = Number(id);
  if (!Number.isFinite(archiveId)) return null;
  const { data, error } = await sb
    .from('pin_archive')
    .select(SELECT)
    .eq('id', archiveId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markArchiveSiteFlags(sb: ReturnType<typeof serviceClient>, pinId: unknown) {
  const id = Number(pinId);
  if (!Number.isFinite(id)) return;
  const { error } = await sb.rpc('mark_pin_archive_site_flags_for_pin', { p_pin_id: id });
  if (error) console.warn(`Archive duplicate flag refresh failed for pin ${id}: ${error.message}`);
}

async function clearArchiveSiteFlagsForPin(sb: ReturnType<typeof serviceClient>, pinId: number) {
  const { error } = await sb
    .from('pin_archive')
    .update({
      already_on_site: false,
      already_on_site_pin_id: null,
      already_on_site_match: null,
      already_on_site_updated_at: new Date().toISOString(),
    })
    .eq('already_on_site_pin_id', pinId);
  if (error) console.warn(`Archive duplicate flag clear failed for pin ${pinId}: ${error.message}`);
}

async function refreshArchiveSiteFlags(sb: ReturnType<typeof serviceClient>) {
  const { error } = await sb.rpc('refresh_pin_archive_site_flags');
  if (error) console.warn(`Archive duplicate flag refresh failed: ${error.message}`);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAuthed(cookies.get(COOKIE)?.value))) return json({ error: 'Not authorized.' }, 401);
  if (!hasServiceKey()) return json({ error: 'Saving is not enabled yet (set SUPABASE_SERVICE_ROLE_KEY).' }, 503);

  const sb = serviceClient();
  let body: any = {};
  try {
    body = await request.json();
    if (!body || typeof body !== 'object') return json({ error: 'Bad request.' }, 400);
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  const requestedType = body.op === 'addFromArchive' ? body.type : body.op === 'addManual' ? body.input?.collected_type : body.patch?.collected_type;
  if (requestedType !== undefined && !['Collected', 'ISO'].includes(requestedType)) {
    return json({ error: 'Choose Collected or ISO.' }, 400);
  }

  try {
    switch (body.op) {
      case 'addFromArchive': {
        const sourcePin = await archivePinById(sb, body.archiveId);
        if (body.archiveId && !sourcePin) return json({ error: 'Archive pin not found.' }, 404);
        const row = normalizePinMetadata({ ...copyFields(sourcePin ?? body.pin), collected_type: body.type });
        const externalId = normalizeExternalId(row.external_pin_id);
        if (externalId) {
          const existing = await findExistingPinByExternalId(sb, externalId);
          if (existing) {
            return json({ error: `Already in the collection: ${existing.pin_name}` }, 409);
          }
        }
        const { data, error } = await sb.from('pins').insert(row).select(SELECT).single();
        if (error) throw error;
        await markArchiveSiteFlags(sb, data.id);
        return json({ pin: data });
      }
      case 'addManual': {
        const { data, error } = await sb.from('pins').insert(normalizePinMetadata(body.input)).select(SELECT).single();
        if (error) throw error;
        await markArchiveSiteFlags(sb, data.id);
        return json({ pin: data });
      }
      case 'update': {
        const { data, error } = await sb.from('pins').update(normalizePinMetadata(body.patch)).eq('id', body.id).select(SELECT).single();
        if (error) throw error;
        await markArchiveSiteFlags(sb, data.id);
        return json({ pin: data });
      }
      case 'delete': {
        const id = Number(body.id);
        if (!Number.isFinite(id)) return json({ error: 'Invalid pin id.' }, 400);

        const { data: pin, error: findError } = await sb.from('pins').select(SELECT).eq('id', id).maybeSingle();
        if (findError) throw findError;
        if (!pin) return json({ error: 'Pin not found.' }, 404);

        const { error: backupError } = await sb.from('pins_backup').insert({
          kind: 'removed',
          pin_count: 1,
          data: pin,
        });
        if (backupError) throw backupError;

        await clearArchiveSiteFlagsForPin(sb, id);

        const { error: deleteError } = await sb.from('pins').delete().eq('id', id);
        if (deleteError) throw deleteError;

        await refreshArchiveSiteFlags(sb);
        return json({ pin });
      }
      case 'bulkDelete': {
        if (!Array.isArray(body.ids)) return json({ error: 'Pin ids are required.' }, 400);
        const ids = [...new Set<number>(body.ids.map((id: unknown) =>
          typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id.trim())) ? Number(id) : NaN,
        ))];
        if (
          ids.length === 0
          || ids.length > 100
          || ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
        ) {
          return json({ error: 'Select between 1 and 100 valid pins.' }, 400);
        }

        const { data, error } = await sb.rpc('admin_remove_pins', { p_ids: ids });
        if (error?.code === 'P0002' || error?.message === 'One or more selected pins are no longer in the collection.') {
          return json({ error: 'A selected pin is no longer in the collection. Refresh the page and select the pins again.' }, 409);
        }
        if (error) throw error;
        return json({ pins: data ?? [] });
      }
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Action failed.' }, e instanceof MetadataValidationError ? 400 : 500);
  }
};
