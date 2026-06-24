import type { APIRoute } from 'astro';
import { COOKIE, PIN, sessionToken } from '../../lib/adminAuth';

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Check the 4-digit code (server-side) and, if correct, set a long-lived cookie. */
export const POST: APIRoute = async ({ request, cookies }) => {
  let pin = '';
  try {
    pin = String(((await request.json()) as { pin?: unknown })?.pin ?? '');
  } catch {
    // ignore
  }

  await new Promise((r) => setTimeout(r, 500)); // brute-force speed bump

  if (!PIN) return json({ error: 'Admin code is not configured (set ADMIN_PIN).' }, 503);
  if (pin !== PIN) return json({ error: 'Incorrect code.' }, 401);

  cookies.set(COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 24 * 365, // save device for a year
  });
  return json({ ok: true });
};
