-- The audit log is append-only and records who did what to which record and when
-- (FT-002 acceptance criterion; TRD 4.7; Security & Access 4.5, 4.10).
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(17);

-- Fixtures -------------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'authenticated', 'authenticated', 'mod@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000f2', 'authenticated', 'authenticated', 'admin@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.test', now(), now());
insert into public.staff (auth_user_id, role, mfa_enrolled_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'moderator', now()),
  ('00000000-0000-0000-0000-0000000000f2', 'admin', now());
insert into public.members (id, status) values
  ('00000000-0000-0000-0000-00000000000a', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'active');

create function pg_temp.claims(p_id uuid, p_aal text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

-- Writing an entry -----------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000f1', 'aal2');
create temp table entry as
  select private.write_audit('view_case', 'member', '00000000-0000-0000-0000-00000000000b',
                             null, '{"reason":"test"}') as id;

select is(
  (select actor_staff_id from public.audit_log where id = (select id from entry)),
  '00000000-0000-0000-0000-0000000000f1'::uuid,
  'records WHO: the signed-in staff member, taken from the session'
);
select is(
  (select action from public.audit_log where id = (select id from entry)),
  'view_case', 'records WHAT was done'
);
select is(
  (select subject_type || ':' || subject_id from public.audit_log where id = (select id from entry)),
  'member:00000000-0000-0000-0000-00000000000b', 'records WHICH record it was done to'
);
select ok(
  (select created_at between now() - interval '1 minute' and now() + interval '1 minute'
     from public.audit_log where id = (select id from entry)),
  'records WHEN, in server time'
);

select pg_temp.claims('00000000-0000-0000-0000-0000000000f1', 'aal1');
select throws_ok(
  $$ select private.write_audit('view_case', 'member', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null,
  'a staff session without a verified second factor cannot act'
);
select pg_temp.claims('00000000-0000-0000-0000-00000000000a', 'aal2');
select throws_ok(
  $$ select private.write_audit('view_case', 'member', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null,
  'a member cannot write audit entries'
);

-- Append-only, even for the database owner -----------------------------------------------
select throws_ok(
  $$ update public.audit_log set action = 'edited' $$,
  '42501', null, 'no one can edit an audit entry, the database owner included'
);
select throws_ok(
  $$ delete from public.audit_log $$,
  '42501', null, 'no one can delete an audit entry, the database owner included'
);
select throws_ok(
  $$ truncate public.audit_log $$,
  '42501', null, 'no one can empty the audit log, the database owner included'
);

-- Who can read it ------------------------------------------------------------------------
select pg_temp.claims('00000000-0000-0000-0000-0000000000f1', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.audit_log), 1, 'a staff member reads their own entries');
select throws_ok(
  $$ insert into public.audit_log (actor_staff_id, action, subject_type, subject_id)
     values ('00000000-0000-0000-0000-0000000000f1', 'forged', 'member', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'staff cannot write audit entries directly'
);
set local role postgres;

select pg_temp.claims('00000000-0000-0000-0000-0000000000f1', 'aal1');
set local role authenticated;
select is((select count(*)::int from public.audit_log), 0, 'without a verified second factor staff read nothing');
set local role postgres;

select pg_temp.claims('00000000-0000-0000-0000-00000000000a', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.audit_log), 0, 'a member cannot read the audit log');
set local role postgres;

select pg_temp.claims('00000000-0000-0000-0000-0000000000f2', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.audit_log), 1, 'an admin with a verified second factor reads all entries');
set local role postgres;

-- moderator_actions: append-only, except filling in a notification time once ------------
insert into public.reports (id, reporter_id, reported_member_id, reason, sla_due_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b', 'harassment', now() + interval '24 hours');
insert into public.moderator_actions (id, report_id, staff_id, action, reason_note)
values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000e1',
        '00000000-0000-0000-0000-0000000000f1', 'warn', 'first warning');

select lives_ok(
  $$ update public.moderator_actions set notified_reporter_at = now()
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  'a decision can record once when the reporter was told'
);
select throws_ok(
  $$ update public.moderator_actions set action = 'dismiss'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '42501', null, 'a recorded decision cannot be changed'
);
select throws_ok(
  $$ delete from public.moderator_actions $$,
  '42501', null, 'a recorded decision cannot be deleted'
);

select * from finish();
rollback;
