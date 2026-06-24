import type { APIRoute } from 'astro';
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

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAuthed(cookies.get(COOKIE)?.value))) return json({ error: 'Not authorized.' }, 401);
  if (!hasServiceKey()) return json({ error: 'Saving is not enabled yet (set SUPABASE_SERVICE_ROLE_KEY).' }, 503);

  const sb = serviceClient();
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  try {
    switch (body.op) {
      case 'addFromArchive': {
        const row = { ...copyFields(body.pin), collected_type: body.type };
        const { data, error } = await sb.from('pins').insert(row).select(SELECT).single();
        if (error) throw error;
        return json({ pin: data });
      }
      case 'addManual': {
        const { data, error } = await sb.from('pins').insert(body.input).select(SELECT).single();
        if (error) throw error;
        return json({ pin: data });
      }
      case 'update': {
        const { data, error } = await sb.from('pins').update(body.patch).eq('id', body.id).select(SELECT).single();
        if (error) throw error;
        return json({ pin: data });
      }
      case 'setType': {
        const { error } = await sb.from('pins').update({ collected_type: body.type }).eq('id', body.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case 'remove': {
        const p = body.pin;
        // Safe remove: snapshot the removed pin into pins_backup (keeps the archive pristine).
        await sb.from('pins_backup').insert({ kind: 'removed', pin_count: 1, data: [p] });
        const { error } = await sb.from('pins').delete().eq('id', p.id);
        if (error) throw error;
        return json({ ok: true });
      }
      case 'backup': {
        // Full snapshot of the live collection into pins_backup (no row limit — runs in DB).
        const { data, error } = await sb.rpc('snapshot_pins', { p_kind: 'manual' });
        if (error) throw error;
        return json({ ok: true, count: data ?? 0 });
      }
      default:
        return json({ error: 'Unknown action.' }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Action failed.' }, 500);
  }
};
