-- Admin-only, backup-first bulk removal from the owned collection.
-- The reference catalog in public.pin_archive is never deleted.

create or replace function public.admin_remove_pins(p_ids bigint[])
returns setof public.pins
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_ids bigint[];
  v_found integer;
  v_pin public.pins%rowtype;
begin
  select array_agg(id order by id)
  into v_ids
  from (
    select distinct id
    from unnest(p_ids) as selected(id)
    where id is not null
  ) unique_ids;

  if coalesce(cardinality(v_ids), 0) < 1 or cardinality(v_ids) > 100 then
    raise exception 'Select between 1 and 100 pins.';
  end if;

  select count(*)
  into v_found
  from public.pins
  where id = any(v_ids);

  if v_found <> cardinality(v_ids) then
    raise exception 'One or more selected pins are no longer in the collection.';
  end if;

  insert into public.pins_backup (kind, pin_count, data)
  select 'removed', 1, to_jsonb(p)
  from public.pins p
  where p.id = any(v_ids);

  for v_pin in
    delete from public.pins p
    where p.id = any(v_ids)
    returning p.*
  loop
    return next v_pin;
  end loop;

  perform public.refresh_pin_archive_site_flags();
  return;
end;
$$;

revoke all on function public.admin_remove_pins(bigint[]) from public, anon, authenticated;
grant execute on function public.admin_remove_pins(bigint[]) to service_role;

comment on function public.admin_remove_pins(bigint[]) is
  'Atomically backs up and removes 1-100 owned pins while preserving pin_archive rows.';
