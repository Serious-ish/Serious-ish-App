-- Appeals and support requests from members (FT-046; Security & Access 4; error R08).
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(22);

-- Fixtures: R reports H (held) and S (suspended by a moderator's decision). T is suspended with
-- no decision on record, A is active, D is deleted and M is staff.
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'r@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'h@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 's@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 't@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a5', 'authenticated', 'authenticated', 'a@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a6', 'authenticated', 'authenticated', 'd@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000a7', 'authenticated', 'authenticated', 'm@example.test', now(), now());
insert into public.members (id, status, deleted_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'active', null),
  ('00000000-0000-0000-0000-0000000000a2', 'held', null),
  ('00000000-0000-0000-0000-0000000000a3', 'suspended', null),
  ('00000000-0000-0000-0000-0000000000a4', 'suspended', null),
  ('00000000-0000-0000-0000-0000000000a5', 'active', null),
  ('00000000-0000-0000-0000-0000000000a6', 'deleted', now());
insert into public.staff (auth_user_id, role, mfa_enrolled_at) values
  ('00000000-0000-0000-0000-0000000000a7', 'moderator', now());
insert into public.reports (id, reporter_id, reported_member_id, reason, urgency, sla_due_at) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a2', 'threat', 'urgent', now() + interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a3', 'harassment', 'normal', now() + interval '1 day');
insert into public.member_holds (id, member_id, report_id, reason) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2',
   '00000000-0000-0000-0000-0000000000b1', 'threat');
insert into public.moderator_actions (report_id, staff_id, action, reason_note) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a7',
   'suspend', 'Repeated harassment');

-- Acts as a signed-in user until the test switches back to the database owner.
create function pg_temp.act_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- A held member appeals their hold ----------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
select is(public.submit_appeal('  Please look again.  '), 'appeal',
  'a held member can appeal their hold');
select is(public.submit_appeal('Please look again, again.'), 'appeal',
  'a second tap is accepted');
select is((select count(*)::int from public.appeals), 1,
  'while the appeal is open a second one adds nothing, and the member sees their own');
select throws_ok(
  $$ insert into public.appeals (member_id, hold_id, message)
     values ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'x') $$,
  '42501', null,
  'members cannot write appeals directly'
);
select throws_ok($$ select public.submit_appeal('   ') $$, 'PT422', 'INVALID_REQUEST',
  'an empty appeal is refused');
select throws_ok($$ select public.submit_appeal(repeat('a', 1001)) $$, 'PT422', 'INVALID_REQUEST',
  'an appeal over 1,000 characters is refused');
set local role postgres;
select is(
  (select hold_id || ' ' || report_id || ' ' || message from public.appeals
    where member_id = '00000000-0000-0000-0000-0000000000a2'),
  '00000000-0000-0000-0000-0000000000c1 00000000-0000-0000-0000-0000000000b1 Please look again.',
  'the appeal names the hold and its report, with the message trimmed'
);

-- A suspended member appeals the decision -------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
select is(public.submit_appeal('I did not do this.'), 'appeal',
  'a suspended member can appeal the decision');
set local role postgres;
select is(
  (select coalesce(hold_id::text, 'no hold') || ' ' || report_id from public.appeals
    where member_id = '00000000-0000-0000-0000-0000000000a3'),
  'no hold 00000000-0000-0000-0000-0000000000b2',
  'the appeal names the report behind the suspension'
);

-- Nothing to appeal: the request goes to support (R08) -------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
select is(public.submit_appeal('Why?'), 'support',
  'with no decision on record the request goes to support');
set local role postgres;
select is(
  (select request_type || ' ' || details from public.support_requests
    where member_id = '00000000-0000-0000-0000-0000000000a4'),
  'appeal_help Why?',
  'it is logged as an appeal help request'
);
select is(
  (select count(*)::int from public.appeals where member_id = '00000000-0000-0000-0000-0000000000a4'),
  0,
  'and no appeal is invented'
);

-- An active member has nothing to appeal and sees nobody else's -----------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a5');
select throws_ok($$ select public.submit_appeal('Hello') $$, 'PT403', 'NOT_ALLOWED',
  'an active member cannot appeal');
select is((select count(*)::int from public.appeals), 0,
  'members cannot see other members'' appeals');

-- Support ---------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a6');
select lives_ok($$ select public.request_support('deletion_query', 'When is my data erased?') $$,
  'a deleted member can contact support');
select is(public.request_support('deletion_query', 'Hello?'),
  (select id from public.support_requests),
  'while a request of the same type is open, asking again returns it');
select is((select count(*)::int from public.support_requests), 1,
  'only one request was kept, and the member sees their own');
select lives_ok($$ select public.request_support('other', 'Something else') $$,
  'a request of another type is a new request');
select throws_ok($$ select public.request_support('refund', 'Money back') $$, 'PT422',
  'INVALID_REQUEST', 'an unknown request type is refused');
select throws_ok($$ select public.request_support('other', '  ') $$, 'PT422', 'INVALID_REQUEST',
  'an empty request is refused');

select pg_temp.act_as('00000000-0000-0000-0000-0000000000a7');
select throws_ok($$ select public.request_support('other', 'Hi') $$, 'PT403', 'NOT_ALLOWED',
  'staff are not members and cannot use the member route');
set local role postgres;

select ok(
  not has_function_privilege('anon', 'public.submit_appeal(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.request_support(text, text)', 'EXECUTE'),
  'a signed-out request can neither appeal nor contact support'
);

select * from finish();
rollback;
