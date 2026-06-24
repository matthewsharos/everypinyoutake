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
  const base = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `pins/${base}.${ext}`;

  const sb = serviceClient();
  const { error } = await sb.storage
    .from('pin-images')
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type || undefined });
  if (error) return json({ error: error.message }, 500);

  // Optimized grid thumbnail (generated client-side as WebP). Stored under the
  // same base filename in `thumbs/` so thumbUrl() can derive it from the original.
  // Best-effort: a missing thumb just falls back to the original on the grid.
  const thumb = form.get('thumb');
  if (thumb instanceof File) {
    await sb.storage
      .from('pin-images')
      .upload(`thumbs/${path}`.replace(/\.[a-z0-9]+$/i, '.webp'), thumb, {
        cacheControl: '31536000',
        upsert: true,
        contentType: 'image/webp',
      });
  }

  return json({ url: sb.storage.from('pin-images').getPublicUrl(path).data.publicUrl });
};
