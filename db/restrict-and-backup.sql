-- ============================================================================
-- EveryPinYouTake — restrict the database + weekly pins backup
-- Run in Supabase → SQL Editor.
--
-- Model: `pins` is the only "hot" (writable) table, edited via the 6400 Studio.
-- Everything else is read-only to the public key. The Studio writes go through
-- the server with the service key, which only ever touches `pins`, `pins_backup`,
-- and the `pin-images` storage bucket.
-- ============================================================================


-- ── PART A — backup table + weekly snapshot (safe to run anytime) ───────────

create table if not exists public.pins_backup (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text        not null default 'manual',  -- 'weekly' | 'manual' | 'removed'
  pin_count   integer     not null default 0,
  data        jsonb       not null                     -- full pins snapshot, or one removed pin
);

-- Locked down: RLS on, no policies => the public/anon key can't read or write it.
-- (The server service key bypasses RLS; pg_cron runs as the table owner.)
alter table public.pins_backup enable row level security;

-- Snapshot function: copies ALL current pins into one backup row. Returns the count.
create or replace function public.snapshot_pins(p_kind text default 'weekly')
returns integer language plpgsql security definer as $$
declare n integer;
begin
  insert into public.pins_backup (kind, pin_count, data)
  select p_kind, count(*), coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
  from public.pins p
  returning pin_count into n;
  return n;
end; $$;

-- Weekly automatic snapshot (Sundays 05:00 UTC).
-- Enable pg_cron first: Dashboard → Database → Extensions → enable "pg_cron".
create extension if not exists pg_cron;
select cron.schedule('epyt-weekly-pins-backup', '0 5 * * 0', $$ select public.snapshot_pins('weekly'); $$);

-- (No pg_cron? Skip the two lines above and instead hit a weekly endpoint from a
--  GitHub Action / Cloudflare cron, or just use the Studio's "Back up now" button.)


-- ── PART B — read-only lockdown (apply at cutover, once the OLD site is retired)
-- This stops the public key from writing anything. The old Hostinger admin wrote
-- with an authenticated account, so only run this after that site is gone (or it
-- will block the old admin). The new Studio is unaffected (it uses the service key).

alter table public.pins          enable row level security;
alter table public.pin_archive   enable row level security;
alter table public.banner_images enable row level security;
alter table public.tiktok_urls   enable row level security;

drop policy if exists epyt_read_pins on public.pins;
create policy epyt_read_pins on public.pins for select using (true);

drop policy if exists epyt_read_archive on public.pin_archive;
create policy epyt_read_archive on public.pin_archive for select using (true);

drop policy if exists epyt_read_banners on public.banner_images;
create policy epyt_read_banners on public.banner_images for select using (true);

drop policy if exists epyt_read_tiktok on public.tiktok_urls;
create policy epyt_read_tiktok on public.tiktok_urls for select using (true);

-- contact form (if/when used): allow the public to submit, but not read.
alter table public.contact_submissions enable row level security;
drop policy if exists epyt_insert_contact on public.contact_submissions;
create policy epyt_insert_contact on public.contact_submissions for insert with check (true);

-- Intentionally NO insert/update/delete policies for the public key on pins,
-- pin_archive, banner_images, tiktok_urls => the public key is read-only there.
