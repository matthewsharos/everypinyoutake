import type { APIRoute } from 'astro';
import { COOKIE, isAuthed } from '../../lib/adminAuth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const authed = await isAuthed(cookies.get(COOKIE)?.value);
  return new Response(JSON.stringify({ authed }), { headers: { 'content-type': 'application/json' } });
};
