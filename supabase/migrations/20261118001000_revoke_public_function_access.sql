-- Signed-out requests and members may only run functions we grant explicitly.
--
-- Projects created in the Supabase dashboard can carry helper functions of their own in
-- public (for example rls_auto_enable, which switches row level security on for new
-- tables). They are executable by everyone by default. Removing that right keeps every
-- environment deny-by-default; the event trigger they serve keeps working, because
-- Postgres does not check EXECUTE when an event trigger fires.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
    where n.nspname = 'public'
      and d.objid is null  -- skip functions that belong to an extension
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end;
$$;
