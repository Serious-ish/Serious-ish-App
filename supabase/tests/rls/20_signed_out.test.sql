-- A signed-out request cannot read or write any table (FT-002 acceptance criterion).
-- Tries every table in public, so a table added later is covered automatically.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

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
      execute 'reset role';
    exception
      when insufficient_privilege then
        execute 'reset role';
      when others then
        -- Any other error (for example a missing required value) means the privilege
        -- check let the request through, which counts as allowed.
        allowed := allowed || (t.tablename::text || ' (' || sqlstate || ')');
        execute 'reset role';
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
