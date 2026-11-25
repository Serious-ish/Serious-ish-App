-- Server time and retry-safe requests (FT-006; TRD 1 "The clock belongs to the server", 5
-- "Matching and chat, step by step"; Security & Access 7.3 N01, N04, N05, N07, N08).
--
-- The server's clock is the only one that counts. Deadlines are stored in UTC and compared
-- with the database clock; the phone's clock only draws countdowns. Daily and weekly limits
-- run on America/Toronto calendar days (app_config.daily_quota_timezone), whatever the phone's
-- time zone or clock says.

-- Server time ----------------------------------------------------------------------------
-- The app keeps its countdowns in step with this. Every reply also carries the server's time in
-- its Date header (to the second), which is all the app needs before sign-in; this gives the
-- exact time to the millisecond once a member is signed in.
create function public.server_time()
returns timestamptz
language sql
volatile
set search_path = ''
as $$
  select clock_timestamp();
$$;
revoke all on function public.server_time() from public, anon;
grant execute on function public.server_time() to authenticated;

-- Limit periods --------------------------------------------------------------------------
-- The time zone that limit periods follow. Falls back to Toronto if the setting is missing.
create function private.quota_timezone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select value_json #>> '{}' from public.app_config where key = 'daily_quota_timezone'),
    'America/Toronto'
  );
$$;
revoke all on function private.quota_timezone() from public, anon, authenticated;

-- The limit period that contains p_at, as UTC instants: [period_start, period_end).
-- Likes and rewinds reset at local midnight; SuperLikes reset at local midnight on Monday.
-- Working in local calendar days keeps a reset at midnight across daylight-saving changes,
-- when a local day is 23 or 25 hours long. period_start is the key in usage_counters.
create function private.quota_period(p_kind public.usage_kind, p_at timestamptz default now())
returns table (period_start timestamptz, period_end timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with local as (
    select private.quota_timezone() as tz,
           case when p_kind = 'superlike' then 'week' else 'day' end as unit
  ),
  bounds as (
    select tz,
           date_trunc(unit, p_at at time zone tz) as local_start,
           case unit when 'week' then interval '7 days' else interval '1 day' end as length
    from local
  )
  select local_start at time zone tz, (local_start + length) at time zone tz
  from bounds;
$$;
revoke all on function private.quota_period(public.usage_kind, timestamptz)
  from public, anon, authenticated;

-- Retry-safe requests ----------------------------------------------------------------------
-- Every swipe and message carries a client_request_id made once by the phone and reused on
-- each retry. A function that acts on one follows this pattern, all in one transaction:
--
--   1. perform private.lock_request(member, request_id);
--   2. Look for the row already stored under (member, request_id). If it is there, return the
--      original result without charging a limit again. If it was stored for a different
--      target, match or action, raise REQUEST_ID_REUSED.
--   3. Otherwise check the rules, charge the limit and store the row.
--
-- The lock makes a second copy that arrives while the first is still running wait for it,
-- then find its row in step 2, so a double tap or a retry after a timeout acts exactly once.
-- The unique (member, client_request_id) keys on swipes and messages back this up.
create function private.lock_request(p_member uuid, p_request_id uuid)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_member is null then
    raise exception 'NOT_ALLOWED' using errcode = 'PT401';
  end if;
  if p_request_id is null then
    raise exception 'REQUEST_ID_REQUIRED' using errcode = 'PT422';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended('request:' || p_member::text || ':' || p_request_id::text, 0)
  );
end;
$$;
revoke all on function private.lock_request(uuid, uuid) from public, anon, authenticated;
