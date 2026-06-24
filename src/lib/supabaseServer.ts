import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE_ROLE_KEY } from 'astro:env/server';

/** True once the owner has set the service key (saving is enabled). */
export function hasServiceKey(): boolean {
  return !!SUPABASE_SERVICE_ROLE_KEY;
}

/** Server-only Supabase client with the service key — bypasses RLS for trusted writes. */
export function serviceClient(): SupabaseClient {
  return createClient(import.meta.env.PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
