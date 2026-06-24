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

-- Ranked, typo-tolerant search over the live collection (public).
create or replace function public.search_pins(q text, p_type text default null, p_limit int default 60, p_offset int default 0)
returns setof public.pins language sql stable as $$
  select p.* from public.pins p
  where (p_type is null or p.collected_type = p_type)
    and (q = '' or p.fts @@ websearch_to_tsquery('english', q) or p.pin_name % q)
  order by
    (case when q = '' then 0
          else ts_rank(p.fts, websearch_to_tsquery('english', q)) + similarity(p.pin_name, q) end) desc,
    p.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;

-- Ranked, typo-tolerant search over the archive catalog (admin add-from-archive).
create or replace function public.search_archive(q text, p_limit int default 40, p_offset int default 0)
returns setof public.pin_archive language sql stable as $$
  select p.* from public.pin_archive p
  where (q = '' or p.fts @@ websearch_to_tsquery('english', q) or p.pin_name % q)
  order by
    (case when q = '' then 0
          else ts_rank(p.fts, websearch_to_tsquery('english', q)) + similarity(p.pin_name, q) end) desc,
    p.updated_at desc nulls last
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
$$;
