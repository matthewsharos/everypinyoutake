-- ============================================================================
-- EveryPinYouTake — fast, typo-tolerant search (full-text + trigram)
-- Run in Supabase → SQL Editor. Until then the app falls back to ILIKE search,
-- so nothing breaks; this just makes search ranked + fuzzy + fast.
-- ============================================================================

create extension if not exists pg_trgm;

-- Searchable text vector over all pin metadata (generated + indexed).
alter table public.pins add column if not exists fts tsvector
  generated always as (to_tsvector('english',
    coalesce(pin_name,'') || ' ' || coalesce(series,'') || ' ' || coalesce(origin,'') || ' ' ||
    coalesce(edition,'') || ' ' || coalesce(tags,'') || ' ' || coalesce(notes,'') || ' ' ||
    coalesce(external_pin_id,''))) stored;
create index if not exists pins_fts_idx on public.pins using gin (fts);
create index if not exists pins_name_trgm_idx on public.pins using gin (pin_name gin_trgm_ops);

alter table public.pin_archive add column if not exists fts tsvector
  generated always as (to_tsvector('english',
    coalesce(pin_name,'') || ' ' || coalesce(series,'') || ' ' || coalesce(origin,'') || ' ' ||
    coalesce(edition,'') || ' ' || coalesce(tags,'') || ' ' || coalesce(notes,'') || ' ' ||
    coalesce(external_pin_id,''))) stored;
create index if not exists archive_fts_idx on public.pin_archive using gin (fts);
create index if not exists archive_name_trgm_idx on public.pin_archive using gin (pin_name gin_trgm_ops);

-- Durable archive duplicate state used by admin add-from-archive.
-- `already_on_site` means the archive row is represented in public.pins, either
-- by direct PinPics id or by a high-confidence manual/title/image match.
alter table public.pin_archive add column if not exists already_on_site boolean not null default false;
alter table public.pin_archive add column if not exists already_on_site_pin_id bigint references public.pins(id) on delete set null;
alter table public.pin_archive add column if not exists already_on_site_match text;
alter table public.pin_archive add column if not exists already_on_site_updated_at timestamptz;
create index if not exists archive_already_on_site_idx on public.pin_archive (already_on_site, already_on_site_match);
create index if not exists archive_already_on_site_pin_idx on public.pin_archive (already_on_site_pin_id);

create or replace function public.epyt_norm_external_id(id text)
returns text language sql immutable as $$
  select nullif(regexp_replace(trim(coalesce(id, '')), '^0+', ''), '');
$$;

create index if not exists archive_recent_addable_pinpics_idx
  on public.pin_archive ((public.epyt_norm_external_id(external_pin_id)::bigint) desc)
  where already_on_site = false
    and public.epyt_norm_external_id(external_pin_id) ~ '^[0-9]+$';

create or replace function public.epyt_pinpics_url_id(url text)
returns text language sql immutable as $$
  select public.epyt_norm_external_id(substring(coalesce(url, '') from 'pinpics\.com/pin/([0-9]+)'));
$$;

create or replace function public.epyt_pinpics_image_id(url text)
returns text language sql immutable as $$
  select case
    when coalesce(url, '') !~* 'pinpics\.com|pin-images' then null
    else public.epyt_norm_external_id(substring(coalesce(url, '') from '(?:^|/)([0-9]{4,})(?:[-_./]|$)'))
  end;
$$;

create or replace function public.epyt_norm_pin_title(title text)
returns text language sql immutable as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(coalesce(title, '')),
              '[’‘]', '''', 'g'
            ),
            '&', ' and ', 'g'
          ),
          '^\s*(pp[0-9]+\s+)?(wdi|dssh|dsf|dis(\s+nyc|\s+uk)?|wdw|dlr|dlp|wdcs|dec|da|d23)\s*[-–—:]\s*',
          '',
          'i'
        ),
        '\mpp[0-9]+\M',
        '',
        'gi'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    ),
    ''
  );
$$;

create or replace function public.epyt_norm_meta(value text)
returns text language sql immutable as $$
  select public.epyt_norm_pin_title(value);
$$;

create or replace function public.refresh_pin_archive_site_flags()
returns table(flagged_count integer, unflagged_count integer)
language plpgsql as $$
begin
  drop table if exists pg_temp.epyt_archive_site_matches;
  drop table if exists pg_temp.epyt_pins_norm;
  drop table if exists pg_temp.epyt_archive_norm;

  create temporary table epyt_pins_norm on commit drop as
  select
    p.id,
    p.pin_name,
    p.year,
    public.epyt_norm_external_id(p.external_pin_id) as external_id_norm,
    public.epyt_pinpics_url_id(p.external_url) as pinpics_url_id,
    public.epyt_norm_external_id(substring(trim(coalesce(p.external_pin_id, '')) from '^[Pp]([0-9]+)$')) as p_prefixed_id,
    public.epyt_pinpics_image_id(p.image_url) as image_id1,
    public.epyt_pinpics_image_id(p.image_url2) as image_id2,
    public.epyt_pinpics_image_id(p.image_url3) as image_id3,
    public.epyt_norm_pin_title(p.pin_name) as title_norm,
    public.epyt_norm_meta(p.series) as series_norm,
    public.epyt_norm_meta(p.origin) as origin_norm,
    public.epyt_norm_meta(p.edition) as edition_norm
  from public.pins p;
  create index on epyt_pins_norm (external_id_norm);
  create index on epyt_pins_norm (pinpics_url_id);
  create index on epyt_pins_norm (p_prefixed_id);
  create index on epyt_pins_norm (image_id1);
  create index on epyt_pins_norm (image_id2);
  create index on epyt_pins_norm (image_id3);
  create index on epyt_pins_norm (title_norm, year);

  create temporary table epyt_archive_norm on commit drop as
  select
    a.id,
    a.pin_name,
    a.year,
    public.epyt_norm_external_id(a.external_pin_id) as external_id_norm,
    public.epyt_norm_pin_title(a.pin_name) as title_norm,
    public.epyt_norm_meta(a.series) as series_norm,
    public.epyt_norm_meta(a.origin) as origin_norm,
    public.epyt_norm_meta(a.edition) as edition_norm
  from public.pin_archive a;
  create index on epyt_archive_norm (external_id_norm);
  create index on epyt_archive_norm (title_norm, year);

  create temporary table epyt_archive_site_matches on commit drop as
  with candidates as (
    select a.id archive_id, p.id pin_id, 'external_id'::text match_kind, 100 priority
    from epyt_archive_norm a
    join epyt_pins_norm p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.external_id_norm ~ '^[0-9]+$'
     and a.external_id_norm = p.external_id_norm

    union all

    select a.id archive_id, p.id pin_id, 'pinpics_url'::text match_kind, 95 priority
    from epyt_archive_norm a
    join epyt_pins_norm p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.pinpics_url_id = a.external_id_norm

    union all

    select a.id archive_id, p.id pin_id, 'p_prefixed_id_title'::text match_kind, 90 priority
    from epyt_archive_norm a
    join epyt_pins_norm p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.p_prefixed_id = a.external_id_norm
     and similarity(p.title_norm, a.title_norm) >= 0.72

    union all

    select a.id archive_id, p.id pin_id, 'pinpics_image_id_title'::text match_kind, 85 priority
    from epyt_archive_norm a
    join epyt_pins_norm p
      on a.external_id_norm ~ '^[0-9]+$'
     and a.external_id_norm in (
       p.image_id1,
       p.image_id2,
       p.image_id3
     )
     and similarity(p.title_norm, a.title_norm) >= 0.55

    union all

    select a.id archive_id, p.id pin_id, 'title_year_metadata'::text match_kind, 70 priority
    from epyt_archive_norm a
    join epyt_pins_norm p
      on a.year = p.year
     and length(a.title_norm) > 10
     and a.title_norm = p.title_norm
     and a.title_norm not in (
       'mickey mouse', 'stitch', 'tinker bell', 'donald duck', 'winnie the pooh',
       'alice', 'figaro', 'cheshire cat', 'pooh', 'bambi'
     )
     and (
       (a.series_norm is not null and a.series_norm = p.series_norm)
       or (a.origin_norm is not null and a.origin_norm = p.origin_norm)
       or (a.edition_norm is not null and a.edition_norm = p.edition_norm)
     )
  )
  select distinct on (archive_id)
    archive_id,
    pin_id,
    match_kind
  from candidates
  order by archive_id, priority desc, pin_id;

  update public.pin_archive a
  set
    already_on_site = true,
    already_on_site_pin_id = m.pin_id,
    already_on_site_match = m.match_kind,
    already_on_site_updated_at = now()
  from pg_temp.epyt_archive_site_matches m
  where a.id = m.archive_id
    and (
      a.already_on_site is distinct from true
      or a.already_on_site_pin_id is distinct from m.pin_id
      or a.already_on_site_match is distinct from m.match_kind
    );

  update public.pin_archive a
  set
    already_on_site = false,
    already_on_site_pin_id = null,
    already_on_site_match = null,
    already_on_site_updated_at = now()
  where a.already_on_site
    and not exists (
      select 1
      from pg_temp.epyt_archive_site_matches m
      where m.archive_id = a.id
    );

  return query
  select
    (select count(*)::integer from public.pin_archive where already_on_site) as flagged_count,
    (select count(*)::integer from public.pin_archive where not already_on_site) as unflagged_count;
end;
$$;

create or replace function public.mark_pin_archive_site_flags_for_pin(p_pin_id bigint)
returns integer
language plpgsql as $$
declare
  v_count integer := 0;
begin
  update public.pin_archive
  set
    already_on_site = false,
    already_on_site_pin_id = null,
    already_on_site_match = null,
    already_on_site_updated_at = now()
  where already_on_site_pin_id = p_pin_id;

  with pin_one as (
    select
      p.id,
      p.pin_name,
      p.year,
      public.epyt_norm_external_id(p.external_pin_id) as external_id_norm,
      public.epyt_pinpics_url_id(p.external_url) as pinpics_url_id,
      public.epyt_norm_external_id(substring(trim(coalesce(p.external_pin_id, '')) from '^[Pp]([0-9]+)$')) as p_prefixed_id,
      public.epyt_pinpics_image_id(p.image_url) as image_id1,
      public.epyt_pinpics_image_id(p.image_url2) as image_id2,
      public.epyt_pinpics_image_id(p.image_url3) as image_id3,
      public.epyt_norm_pin_title(p.pin_name) as title_norm,
      public.epyt_norm_meta(p.series) as series_norm,
      public.epyt_norm_meta(p.origin) as origin_norm,
      public.epyt_norm_meta(p.edition) as edition_norm
    from public.pins p
    where p.id = p_pin_id
  ),
  archive_norm as (
    select
      a.id,
      public.epyt_norm_external_id(a.external_pin_id) as external_id_norm,
      public.epyt_norm_pin_title(a.pin_name) as title_norm,
      a.year,
      public.epyt_norm_meta(a.series) as series_norm,
      public.epyt_norm_meta(a.origin) as origin_norm,
      public.epyt_norm_meta(a.edition) as edition_norm
    from public.pin_archive a
  ),
  candidates as (
    select a.id archive_id, p.id pin_id, 'external_id'::text match_kind, 100 priority
    from archive_norm a
    join pin_one p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.external_id_norm ~ '^[0-9]+$'
     and a.external_id_norm = p.external_id_norm

    union all
    select a.id, p.id, 'pinpics_url', 95
    from archive_norm a
    join pin_one p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.pinpics_url_id = a.external_id_norm

    union all
    select a.id, p.id, 'p_prefixed_id_title', 90
    from archive_norm a
    join pin_one p
      on a.external_id_norm ~ '^[0-9]+$'
     and p.p_prefixed_id = a.external_id_norm
     and similarity(p.title_norm, a.title_norm) >= 0.72

    union all
    select a.id, p.id, 'pinpics_image_id_title', 85
    from archive_norm a
    join pin_one p
      on a.external_id_norm ~ '^[0-9]+$'
     and a.external_id_norm in (p.image_id1, p.image_id2, p.image_id3)
     and similarity(p.title_norm, a.title_norm) >= 0.55

    union all
    select a.id, p.id, 'title_year_metadata', 70
    from archive_norm a
    join pin_one p
      on a.year = p.year
     and length(a.title_norm) > 10
     and a.title_norm = p.title_norm
     and a.title_norm not in (
       'mickey mouse', 'stitch', 'tinker bell', 'donald duck', 'winnie the pooh',
       'alice', 'figaro', 'cheshire cat', 'pooh', 'bambi'
     )
     and (
       (a.series_norm is not null and a.series_norm = p.series_norm)
       or (a.origin_norm is not null and a.origin_norm = p.origin_norm)
       or (a.edition_norm is not null and a.edition_norm = p.edition_norm)
     )
  ),
  best as (
    select distinct on (archive_id) archive_id, pin_id, match_kind
    from candidates
    order by archive_id, priority desc
  ),
  updated as (
    update public.pin_archive a
    set
      already_on_site = true,
      already_on_site_pin_id = b.pin_id,
      already_on_site_match = b.match_kind,
      already_on_site_updated_at = now()
    from best b
    where a.id = b.archive_id
    returning a.id
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

drop trigger if exists refresh_pin_archive_site_flags_after_pins_change on public.pins;
drop function if exists public.refresh_pin_archive_site_flags_trigger();

revoke execute on function public.refresh_pin_archive_site_flags() from anon, authenticated;
revoke execute on function public.mark_pin_archive_site_flags_for_pin(bigint) from anon, authenticated;

-- Ranked, typo-tolerant search over the live collection (public).
create or replace function public.search_pins(q text, p_type text default null, p_limit int default 60, p_offset int default 0)
returns setof public.pins language sql stable as $$
  select p.* from public.pins p
  where (p_type is null or p.collected_type = p_type)
    and (q = '' or p.fts @@ websearch_to_tsquery('english', q) or p.pin_name % q)
  order by
    (case when q = '' then 0
          else ts_rank(p.fts, websearch_to_tsquery('english', q)) + similarity(p.pin_name, q) end) desc,
    p.created_at desc,
    p.id desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- Ranked, typo-tolerant search over the archive catalog (admin add-from-archive).
-- Excludes pins already present in the live collection by durable archive flag.
-- The write path still has a normalized-ID duplicate guard as a final backstop.
drop function if exists public.search_archive(text, int, int);
create or replace function public.search_archive(q text, p_limit int default 40, p_offset int default 0)
returns table (
  id bigint,
  pin_name text,
  image_url text,
  image_url2 text,
  image_url3 text,
  year integer,
  series text,
  origin text,
  edition text,
  external_url text,
  external_pin_id text,
  is_limited_edition boolean,
  is_mystery boolean,
  is_ap boolean,
  is_pp boolean,
  created_at timestamptz
) language plpgsql stable as $$
declare
  v_q text := trim(coalesce(q, ''));
  v_limit integer := least(greatest(coalesce(p_limit, 40), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_ts tsquery;
  v_fts_count integer := 0;
  v_returned integer := 0;
begin
  if v_q = '' then
    return query
      select
        p.id, p.pin_name, p.image_url, p.image_url2, p.image_url3, p.year, p.series,
        p.origin, p.edition, p.external_url, p.external_pin_id, p.is_limited_edition,
        p.is_mystery, p.is_ap, p.is_pp, p.created_at
      from public.pin_archive p
      where not p.already_on_site
        and public.epyt_norm_external_id(p.external_pin_id) ~ '^[0-9]+$'
      order by public.epyt_norm_external_id(p.external_pin_id)::bigint desc
      limit v_limit offset v_offset;
    return;
  end if;

  v_ts := websearch_to_tsquery('english', v_q);

  select count(*)::integer
    into v_fts_count
  from public.pin_archive p
  where not p.already_on_site
    and p.fts @@ v_ts;

  if v_offset < v_fts_count then
    return query
      select
        p.id, p.pin_name, p.image_url, p.image_url2, p.image_url3, p.year, p.series,
        p.origin, p.edition, p.external_url, p.external_pin_id, p.is_limited_edition,
        p.is_mystery, p.is_ap, p.is_pp, p.created_at
      from public.pin_archive p
      where not p.already_on_site
        and p.fts @@ v_ts
      order by
        ts_rank(p.fts, v_ts) desc,
        p.updated_at desc nulls last
      limit v_limit offset v_offset;

    get diagnostics v_returned = row_count;
  end if;

  if v_returned < v_limit then
    return query
      select
        p.id, p.pin_name, p.image_url, p.image_url2, p.image_url3, p.year, p.series,
        p.origin, p.edition, p.external_url, p.external_pin_id, p.is_limited_edition,
        p.is_mystery, p.is_ap, p.is_pp, p.created_at
      from public.pin_archive p
      where not p.already_on_site
        and p.pin_name % v_q
        and not (p.fts @@ v_ts)
      order by
        similarity(p.pin_name, v_q) desc,
        p.updated_at desc nulls last
      limit (v_limit - v_returned)
      offset greatest(v_offset - v_fts_count, 0);
  end if;
end;
$$;

-- Newest PinPics archive entries for the admin add surface.
-- PinPics IDs are numeric strings, so cast for correct newest-first ordering.
drop function if exists public.recent_archive_pins(int);
create or replace function public.recent_archive_pins(p_limit int default 18)
returns table (
  id bigint,
  pin_name text,
  image_url text,
  image_url2 text,
  image_url3 text,
  year integer,
  series text,
  origin text,
  edition text,
  external_url text,
  external_pin_id text,
  is_limited_edition boolean,
  is_mystery boolean,
  is_ap boolean,
  is_pp boolean,
  created_at timestamptz
) language sql stable as $$
  select
    p.id, p.pin_name, p.image_url, p.image_url2, p.image_url3, p.year, p.series,
    p.origin, p.edition, p.external_url, p.external_pin_id, p.is_limited_edition,
    p.is_mystery, p.is_ap, p.is_pp, p.created_at
  from public.pin_archive p
  where public.epyt_norm_external_id(p.external_pin_id) ~ '^[0-9]+$'
    and not p.already_on_site
  order by public.epyt_norm_external_id(p.external_pin_id)::bigint desc
  limit least(greatest(coalesce(p_limit, 18), 1), 500);
$$;
