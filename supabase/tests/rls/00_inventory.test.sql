-- Inventory checks over EVERY table, so a table added later without its rules fails here
-- (Security & Access edge case A19: "New table merged without RLS: CI must fail").
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- The 37 application tables from TRD v2.4.
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'),
  37,
  'public has exactly the 37 TRD tables'
);

select is(
  (select coalesce(array_agg(tablename order by tablename), '{}')
     from pg_tables where schemaname = 'public' and not rowsecurity),
  '{}'::name[],
  'row level security is on for every table'
);

select is(
  (select coalesce(array_agg(c.relname order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))),
  '{}'::name[],
  'a signed-out request has no privilege on any table'
);

select is(
  (select coalesce(array_agg(c.relname order by c.relname), '{}')
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('authenticated', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
           or has_any_column_privilege('authenticated', c.oid, 'INSERT,UPDATE'))),
  '{}'::name[],
  'members cannot write any table directly; writes go through database functions'
);

-- No member-facing read can return a map point.
select is(
  (select coalesce(array_agg(table_name || '.' || column_name order by table_name), '{}')
     from information_schema.columns
    where table_schema = 'public' and udt_name in ('geography', 'geometry')
      and (has_column_privilege('authenticated', format('%I.%I', table_schema, table_name), column_name, 'SELECT')
           or has_column_privilege('anon', format('%I.%I', table_schema, table_name), column_name, 'SELECT'))),
  '{}'::text[],
  'no coordinate column is readable by members or signed-out requests'
);

-- Private identity fields are never readable through the API.
select is(
  (select coalesce(array_agg(table_name || '.' || column_name order by table_name), '{}')
     from information_schema.columns
    where table_schema = 'public'
      and column_name in ('phone', 'email', 'last_name', 'date_of_birth', 'contact')
      and has_column_privilege('authenticated', format('%I.%I', table_schema, table_name), column_name, 'SELECT')),
  '{}'::text[],
  'no phone, email, last name, birth date or contact column is readable by members'
);

select ok(
  not has_table_privilege('authenticated', 'auth.users', 'SELECT')
    and not has_table_privilege('anon', 'auth.users', 'SELECT'),
  'sign-in records (phone and email) are not readable through the API'
);

select is(
  (select coalesce(array_agg(n.nspname || '.' || p.proname order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  '{}'::text[],
  'a signed-out request cannot run any of our functions'
);

select ok(
  not has_function_privilege('authenticated', 'private.write_audit(text, text, uuid, uuid, jsonb)', 'EXECUTE'),
  'members and staff cannot call the audit writer directly'
);

select * from finish();
rollback;
