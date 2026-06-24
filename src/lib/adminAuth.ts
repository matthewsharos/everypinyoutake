import { ADMIN_PIN } from 'astro:env/server';

/** The admin code — from the ADMIN_PIN env var only, never hardcoded in source. */
export const PIN = ADMIN_PIN ?? '';

export const COOKIE = 'epyt_admin';

/** Opaque cookie value derived from the code (we never store the raw code in a cookie). */
export async function sessionToken(): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('epyt-admin:' + PIN));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isAuthed(cookieValue: string | undefined): Promise<boolean> {
  return !!cookieValue && cookieValue === (await sessionToken());
}
