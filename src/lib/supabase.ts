import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY env vars');
}

/**
 * Stateless client for server-side rendering / read queries.
 * No session persistence — public reads only. (RLS protects writes.)
 * Additive-only project rule: this app never deletes or overwrites existing rows.
 */
export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anon;
