-- Member A against member B: A reads only what the rules allow (FT-002 acceptance
-- criteria: private fields, coordinates; Security & Access 3.5, 4.2, 4.4).
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(20);

-- Fixtures (as the database owner) ------------------------------------------------------
create function pg_temp.new_member(p_id uuid, p_phone text, p_email text, p_status public.member_status)
returns void language sql as $$
  insert into auth.users (id, aud, role, phone, email, created_at, updated_at)
  values (p_id, 'authenticated', 'authenticated', p_phone, p_email, now(), now());
  insert into public.members (id, status) values (p_id, p_status);
$$;

-- Acts as a signed-in member until the test switches back to the database owner.
create function pg_temp.act_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end;
$$;

select pg_temp.new_member('00000000-0000-0000-0000-00000000000a', '+14165550101', 'a@example.test', 'active');
select pg_temp.new_member('00000000-0000-0000-0000-00000000000b', '+14165550102', 'b@example.test', 'active');
select pg_temp.new_member('00000000-0000-0000-0000-00000000000c', '+14165550103', 'c@example.test', 'active');

insert into public.member_identity (member_id, first_name, last_name, date_of_birth) values
  ('00000000-0000-0000-0000-00000000000a', 'Ava', 'Private-A', '1995-04-01'),
  ('00000000-0000-0000-0000-00000000000b', 'Ben', 'Private-B', '1993-09-12');

insert into public.profiles (member_id, display_name, gender, area_label) values
  ('00000000-0000-0000-0000-00000000000a', 'Ava', 'woman', 'Downtown Toronto'),
  ('00000000-0000-0000-0000-00000000000b', 'Ben', 'man', 'Leslieville');

insert into public.member_locations (member_id, approx_point, source) values
  ('00000000-0000-0000-0000-00000000000a', extensions.st_geogfromtext('POINT(-79.38 43.65)'), 'device'),
  ('00000000-0000-0000-0000-00000000000b', extensions.st_geogfromtext('POINT(-79.33 43.66)'), 'device');

insert into public.verifications (member_id, kind, vendor, vendor_reference, status, estimated_age)
values ('00000000-0000-0000-0000-00000000000b', 'selfie_age', 'yoti', 'ref-b', 'passed', 27);

-- A match and a message between A and C, which B must not see.
insert into public.matches (id, member_low_id, member_high_id, window_hours, expires_at)
values ('00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c',
        24, now() + interval '24 hours');
insert into public.messages (match_id, sender_id, body, client_request_id)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a',
        'hello', gen_random_uuid());

-- As member A ------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$ select phone, email from auth.users $$,
  '42501', null,
  'A cannot read anyone''s phone or email'
);
select throws_ok(
  $$ select last_name, date_of_birth from public.member_identity $$,
  '42501', null,
  'A cannot read anyone''s last name or birth date, B''s included'
);
select throws_ok(
  $$ select last_name from public.member_identity where member_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null,
  'A cannot read B''s last name even by asking for B''s row'
);
select throws_ok(
  $$ select * from public.member_locations $$,
  '42501', null,
  'A cannot read map points, not even their own'
);

select is(
  (select count(*)::int from public.profiles where member_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'A cannot read B''s raw profile row'
);
select is(
  (select count(*)::int from public.profiles where member_id = '00000000-0000-0000-0000-00000000000a'),
  1, 'A can read their own profile'
);
select is(
  (select area_label from public.profiles where member_id = '00000000-0000-0000-0000-00000000000a'),
  'Downtown Toronto', 'the profile carries only a broad area label, not coordinates'
);
select is(
  (select count(*)::int from public.members where id = '00000000-0000-0000-0000-00000000000b'),
  0, 'A cannot read B''s account state'
);
select is(
  (select count(*)::int from public.members),
  1, 'A sees only their own account row'
);
select is(
  (select count(*)::int from public.verifications),
  0, 'A cannot see B''s verification attempts'
);
select is(
  (select count(*)::int from public.matches),
  1, 'A sees their own match'
);
select is(
  (select count(*)::int from public.messages),
  1, 'A sees messages in their own match'
);
select throws_ok(
  $$ insert into public.messages (match_id, sender_id, body, client_request_id)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'x', gen_random_uuid()) $$,
  '42501', null,
  'A cannot write a message directly; sending goes through the send function'
);
select throws_ok(
  $$ update public.members set status = 'active' where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null,
  'A cannot change their own account status'
);

set local role postgres;

-- As member B ------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');

select is(
  (select count(*)::int from public.matches),
  0, 'B cannot see a match between A and C'
);
select is(
  (select count(*)::int from public.messages),
  0, 'B cannot read A and C''s messages'
);
select throws_ok(
  $$ select estimated_age from public.verifications $$,
  '42501', null,
  'B cannot read the age estimate even on their own verification'
);
select is(
  (select status::text from public.verifications),
  'passed', 'B sees the broad status of their own verification'
);
select throws_ok(
  $$ select likes_per_day from public.plan_limits $$,
  '42501', null,
  'the Free daily like count is not readable as a number'
);
select is(
  (select array_agg(key order by key) from public.app_config),
  array['launch_phase', 'maintenance_mode'],
  'members read only the allow-listed app switches'
);

set local role postgres;
select * from finish();
rollback;
