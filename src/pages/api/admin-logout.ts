import type { APIRoute } from 'astro';
import { COOKIE } from '../../lib/adminAuth';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(COOKIE, { path: '/' });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
};
