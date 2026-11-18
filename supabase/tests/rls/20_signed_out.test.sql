-- A signed-out request cannot read or write any table (FT-002 acceptance criterion).
-- Tries every table in public, so a table added later is covered automatically.
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(3);

-- One row in a table members can normally read, to prove anon is refused, not just empty.
insert into public.interests (name, category) values ('Hiking', 'Outdoors');

create function pg_temp.tables_anon_can(p_operation text)
returns text[] language plpgsql as $$
declare
  t record;
  allowed text[] := '{}';
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    begin
      execute 'set local role anon';
      if p_operation = 'select' then
        execute format('select 1 from public.%I limit 1', t.tablename);
      elsif p_operation = 'insert' then
        execute format('insert into public.%I default values', t.tablename);
      elsif p_operation = 'delete' then
        execute format('delete from public.%I', t.tablename);
      end if;
      allowed := allowed || t.tablename::text;
      execute 'set local role postgres';
    exception
      when insufficient_privilege then
        execute 'set local role postgres';
      when others then
        -- Any other error (for example a missing required value) means the privilege
        -- check let the request through, which counts as allowed.
        allowed := allowed || (t.tablename::text || ' (' || sqlstate || ')');
        execute 'set local role postgres';
    end;
  end loop;
  return allowed;
end;
$$;

select is(pg_temp.tables_anon_can('select'), '{}'::text[], 'a signed-out request cannot read any table');
select is(pg_temp.tables_anon_can('insert'), '{}'::text[], 'a signed-out request cannot insert into any table');
select is(pg_temp.tables_anon_can('delete'), '{}'::text[], 'a signed-out request cannot delete from any table');

select * from finish();
rollback;
