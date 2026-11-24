-- Deploy the authenticated Studio archive endpoint before applying this file.
begin;
set local lock_timeout = '5s';

drop policy if exists "Allow public read access to pin_archive" on public.pin_archive;
drop policy if exists epyt_read_archive on public.pin_archive;
revoke select on public.pin_archive from public, anon, authenticated;
revoke execute on function public.search_archive(text, integer, integer),
  public.recent_archive_pins(integer) from public, anon, authenticated;

alter function public.epyt_norm_external_id(text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.epyt_pinpics_url_id(text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.epyt_pinpics_image_id(text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.epyt_norm_pin_title(text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.epyt_norm_meta(text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.refresh_pin_archive_site_flags() set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.mark_pin_archive_site_flags_for_pin(bigint) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.search_pins(text, text, integer, integer, text) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.search_archive(text, integer, integer) set search_path = pg_catalog, public, extensions, pg_temp;
alter function public.recent_archive_pins(integer) set search_path = pg_catalog, public, extensions, pg_temp;

commit;
