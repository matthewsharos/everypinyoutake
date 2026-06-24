import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

/**
 * Anon client used in admin islands for READS only (searching pins/archive).
 * Writes never go through here — they use the cookie-authorized server endpoints.
 */
export const supabaseBrowser = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
