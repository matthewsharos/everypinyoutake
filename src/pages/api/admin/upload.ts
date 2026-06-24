import type { APIRoute } from 'astro';
import { COOKIE, isAuthed } from '../../../lib/adminAuth';
import { hasServiceKey, serviceClient } from '../../../lib/supabaseServer';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAuthed(cookies.get(COOKIE)?.value))) return json({ error: 'Not authorized.' }, 401);
  if (!hasServiceKey()) return json({ error: 'Uploads not enabled yet (set SUPABASE_SERVICE_ROLE_KEY).' }, 503);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file provided.' }, 400);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `pins/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const sb = serviceClient();
  const { error } = await sb.storage
    .from('pin-images')
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined });
  if (error) return json({ error: error.message }, 500);

  return json({ url: sb.storage.from('pin-images').getPublicUrl(path).data.publicUrl });
};
