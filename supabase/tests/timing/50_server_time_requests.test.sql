-- Server time, limit periods and retry-safe requests (FT-006 acceptance criteria; Security &
-- Access 7.3 N01, N04, N05, N07, N08). Two copies of a request arriving at the same moment
-- need two connections, so that case is tested in supabase/tests/api/requests.test.ts.
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(26);

-- Server time ---------------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.server_time()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.server_time()', 'EXECUTE'),
  'signed-in members can read the server time; signed-out requests use the reply''s Date header'
);
select ok(
  abs(extract(epoch from public.server_time() - clock_timestamp())) < 1,
  'server_time() is the database clock'
);
select ok(
  not has_function_privilege('authenticated', 'private.quota_period(public.usage_kind, timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.lock_request(uuid, uuid)', 'EXECUTE'),
  'members cannot call the period and request-lock helpers directly'
);

-- Daily periods (America/Toronto) -----------------------------------------------------------------
create function pg_temp.period(p_kind public.usage_kind, p_at timestamptz) returns text
language sql as $$
  select to_char(period_start at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' to ' ||
         to_char(period_end at time zone 'UTC', 'YYYY-MM-DD HH24:MI')
  from private.quota_period(p_kind, p_at);
$$;

select is(
  pg_temp.period('like', '2026-11-24 20:00+00'),
  '2026-11-24 05:00 to 2026-11-25 05:00',
  'a like on a winter afternoon counts toward that Toronto day (midnight EST is 05:00 UTC)'
);
select is(
  pg_temp.period('like', '2026-11-25 04:59:59+00'),
  '2026-11-24 05:00 to 2026-11-25 05:00',
  'one second before Toronto midnight is still the same day'
);
select is(
  pg_temp.period('like', '2026-11-25 05:00+00'),
  '2026-11-25 05:00 to 2026-11-26 05:00',
  'Toronto midnight starts a new day'
);
select is(
  pg_temp.period('rewind', '2026-07-01 03:59+00'),
  '2026-06-30 04:00 to 2026-07-01 04:00',
  'in summer the day starts at midnight EDT (04:00 UTC); rewinds follow the same days as likes'
);
select is(
  pg_temp.period('like', '2027-03-14 12:00+00'),
  '2027-03-14 05:00 to 2027-03-15 04:00',
  'on the spring daylight-saving day the period is 23 hours and still ends at local midnight'
);
select is(
  pg_temp.period('like', '2026-11-01 12:00+00'),
  '2026-11-01 04:00 to 2026-11-02 05:00',
  'on the autumn daylight-saving day the period is 25 hours and still ends at local midnight'
);
select is(
  pg_temp.period('like', '2026-11-01 05:30+00'),
  pg_temp.period('like', '2026-11-01 06:30+00'),
  'both 1:30 a.m.s on the autumn change day fall in the same day'
);

-- Weekly periods (SuperLikes) ---------------------------------------------------------------------
select is(
  pg_temp.period('superlike', '2026-11-24 20:00+00'),
  '2026-11-23 05:00 to 2026-11-30 05:00',
  'the SuperLike week runs from Monday midnight to the next Monday midnight, Toronto time'
);
select is(
  pg_temp.period('superlike', '2026-11-30 04:59+00'),
  '2026-11-23 05:00 to 2026-11-30 05:00',
  'Sunday 11:59 p.m. in Toronto is still the same week'
);
select is(
  pg_temp.period('superlike', '2026-11-01 12:00+00'),
  '2026-10-26 04:00 to 2026-11-02 05:00',
  'a week that crosses the autumn change still starts and ends at local midnight'
);

-- The time zone comes from app_config ---------------------------------------------------------------
update public.app_config set value_json = '"Europe/London"' where key = 'daily_quota_timezone';
select is(
  pg_temp.period('like', '2026-11-24 20:00+00'),
  '2026-11-24 00:00 to 2026-11-25 00:00',
  'periods follow the configured time zone'
);
delete from public.app_config where key = 'daily_quota_timezone';
select is(
  pg_temp.period('like', '2026-11-24 20:00+00'),
  '2026-11-24 05:00 to 2026-11-25 05:00',
  'without the setting, periods fall back to Toronto'
);

-- Retry-safe requests ---------------------------------------------------------------------------------
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'c@example.test', now(), now());
insert into public.members (id, status) values
  ('00000000-0000-0000-0000-00000000000a', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'active');
insert into public.matches (id, member_low_id, member_high_id, window_hours, expires_at) values
  ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b', 24, now() + interval '24 hours');

select throws_ok(
  $$ select private.lock_request('00000000-0000-0000-0000-00000000000a', null) $$,
  'PT422', 'REQUEST_ID_REQUIRED',
  'a write without a request ID is refused'
);
select throws_ok(
  $$ select private.lock_request(null, gen_random_uuid()) $$,
  'PT401', 'NOT_ALLOWED',
  'a write without a member is refused'
);

-- A stand-in for record_swipe (FT-030) that follows the documented pattern: lock, return the
-- stored result for a repeat, otherwise charge one like and store the swipe.
create function pg_temp.swipe(p_member uuid, p_target uuid, p_request uuid) returns uuid
language plpgsql as $$
declare
  v_existing public.swipes;
  v_id uuid;
begin
  perform private.lock_request(p_member, p_request);
  select * into v_existing from public.swipes
    where swiper_id = p_member and client_request_id = p_request;
  if found then
    if v_existing.target_id <> p_target then
      raise exception 'REQUEST_ID_REUSED' using errcode = 'PT409';
    end if;
    return v_existing.id;
  end if;
  insert into public.usage_counters (member_id, kind, period_start, used)
    select p_member, 'like', period_start, 1 from private.quota_period('like', now())
    on conflict (member_id, kind, period_start)
      do update set used = public.usage_counters.used + 1;
  insert into public.swipes (swiper_id, target_id, action, client_request_id)
    values (p_member, p_target, 'like', p_request)
    returning id into v_id;
  return v_id;
end;
$$;

create function pg_temp.likes_used() returns integer language sql as $$
  select coalesce(sum(used), 0)::integer from public.usage_counters
  where member_id = '00000000-0000-0000-0000-00000000000a' and kind = 'like';
$$;

create temp table first_try as
  select pg_temp.swipe('00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001') as id;
select is(
  pg_temp.swipe('00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000001'),
  (select id from first_try),
  'repeating a swipe request returns the original swipe'
);
select is(
  (select count(*)::integer from public.swipes where swiper_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'the repeat stores no second swipe'
);
select is(pg_temp.likes_used(), 1, 'the repeat uses no second like');
select throws_ok(
  $$ select pg_temp.swipe('00000000-0000-0000-0000-00000000000a',
       '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000001') $$,
  'PT409', 'REQUEST_ID_REUSED',
  'a request ID reused for a different action is refused'
);
select isnt(
  pg_temp.swipe('00000000-0000-0000-0000-00000000000a',
    '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000002'),
  (select id from first_try),
  'a new request ID is a new swipe'
);
select is(pg_temp.likes_used(), 2, 'and uses one more like');
select throws_ok(
  $$ insert into public.swipes (swiper_id, target_id, action, client_request_id)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c',
             'pass', '00000000-0000-0000-0000-000000000001') $$,
  '23505', null,
  'the database itself refuses a second swipe under the same request ID'
);

-- The same for messages (send_message, FT-042).
create function pg_temp.send(p_sender uuid, p_match uuid, p_body text, p_request uuid) returns uuid
language plpgsql as $$
declare
  v_id uuid;
begin
  perform private.lock_request(p_sender, p_request);
  select id into v_id from public.messages where sender_id = p_sender and client_request_id = p_request;
  if found then
    return v_id;
  end if;
  insert into public.messages (match_id, sender_id, body, client_request_id)
    values (p_match, p_sender, p_body, p_request)
    returning id into v_id;
  return v_id;
end;
$$;

create temp table first_send as
  select pg_temp.send('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ab',
    'Hello', '00000000-0000-0000-0000-000000000003') as id;
select is(
  pg_temp.send('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000ab',
    'Hello', '00000000-0000-0000-0000-000000000003'),
  (select id from first_send),
  'sending the same message request twice returns the original message'
);
select is(
  (select count(*)::integer from public.messages where match_id = '00000000-0000-0000-0000-0000000000ab'),
  1,
  'and stores one message'
);

select * from finish();
rollback;
