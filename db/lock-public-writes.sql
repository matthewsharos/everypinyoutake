begin;
set local lock_timeout = '5s';

alter table public.pin_archive enable row level security;
alter table public.banner_images enable row level security;

drop policy if exists epyt_read_banners on public.banner_images;
create policy epyt_read_banners on public.banner_images
  for select to anon, authenticated using (true);

drop policy if exists "Allow anonymous INSERT on pins" on public.pins;
drop policy if exists "Allow anonymous UPDATE on pins" on public.pins;
drop policy if exists "Allow anonymous DELETE on pins" on public.pins;
drop policy if exists "Allow public insert tiktok_urls" on public.tiktok_urls;
drop policy if exists "Allow public delete tiktok_urls" on public.tiktok_urls;
drop policy if exists "Enable all" on public.runner_scores;

revoke insert, update, delete, truncate, references, trigger
  on public.pins, public.pin_archive, public.banner_images, public.tiktok_urls
  from public, anon, authenticated;
revoke all on public.pins_backup, public.runner_scores, public.contact_submissions
  from public, anon, authenticated;
grant insert on public.contact_submissions to anon, authenticated;

revoke all on sequence public.runner_scores_id_seq, public.pins_id_seq,
  public.banner_images_id_seq, public.pin_archive_id_seq, public.pins_backup_id_seq
  from public, anon, authenticated;

drop policy if exists "Allow anonymous upload to pin-images" on storage.objects;
drop policy if exists "Allow anonymous update to pin-images" on storage.objects;
drop policy if exists "Allow anonymous delete from pin-images" on storage.objects;
drop policy if exists "Allow public read from pin-images" on storage.objects;

alter function public.snapshot_pins(text) set search_path = pg_catalog, pg_temp;
revoke execute on function public.snapshot_pins(text),
  public.refresh_pin_archive_site_flags(),
  public.mark_pin_archive_site_flags_for_pin(bigint)
  from public, anon, authenticated;

commit;
