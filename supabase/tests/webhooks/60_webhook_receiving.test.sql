-- Receiving outside callbacks (FT-010 acceptance criteria; Security & Access 4.6, B07, S02).
-- Proving the sender (secret and signature checks) happens in the Edge Functions and is tested
-- with signed sample events in supabase/tests/api/webhooks.test.ts.
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(39);

-- Who can reach what ---------------------------------------------------------------------------
select ok(
  has_function_privilege('service_role', 'public.receive_webhook_event(text, text, text, text, timestamptz, text, text[])', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.receive_webhook_event(text, text, text, text, timestamptz, text, text[])', 'EXECUTE')
    and not has_function_privilege('anon', 'public.receive_webhook_event(text, text, text, text, timestamptz, text, text[])', 'EXECUTE'),
  'only the server key can hand in a webhook event; a member cannot forward one'
);
select ok(
  not has_function_privilege('service_role', 'private.apply_webhook_event(uuid, text, text, text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'private.write_service_audit(text, text, text, uuid, jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'private.write_service_audit(text, text, text, uuid, jsonb)', 'EXECUTE'),
  'applying an event and writing a service audit entry happen only inside receive_webhook_event'
);
select ok(
  not has_table_privilege('authenticated', 'public.webhook_events', 'SELECT')
    and not has_table_privilege('anon', 'public.webhook_events', 'SELECT')
    and not has_table_privilege('authenticated', 'private.webhook_reconcile_requests', 'SELECT')
    and not has_table_privilege('authenticated', 'private.webhook_reconcile_requests', 'INSERT'),
  'members can neither read webhook events nor queue reconcile requests'
);

-- Input checks ------------------------------------------------------------------------------------
create function pg_temp.receive(
  p_provider text, p_event text, p_subject text, p_at timestamptz, p_hash text default repeat('a', 64)
) returns text language sql as $$
  select public.receive_webhook_event(p_provider, p_event, 'RENEWAL', p_subject, p_at, p_hash);
$$;

select throws_ok(
  $$ select pg_temp.receive('stripe', 'evt-0', 'member-1', now()) $$,
  'PT422', 'INVALID_REQUEST', 'an unknown provider is refused'
);
select throws_ok(
  $$ select pg_temp.receive('revenuecat', 'evt-0', 'member-1', now(), 'not-a-sha256') $$,
  'PT422', 'INVALID_REQUEST', 'a missing payload fingerprint is refused'
);
select throws_ok(
  $$ select pg_temp.receive('revenuecat', 'evt-0', 'member-1', now() + interval '1 hour') $$,
  'PT422', 'INVALID_REQUEST', 'an event dated in the future is refused'
);
select throws_ok(
  $$ select pg_temp.receive('revenuecat', ' ', 'member-1', now()) $$,
  'PT422', 'INVALID_REQUEST', 'an event without an ID is refused'
);
select is(
  (select count(*)::int from public.webhook_events where subject = 'member-1'), 0,
  'a refused event leaves nothing behind'
);

-- One state change and one audit entry per event ID --------------------------------------------------
create function pg_temp.audit_count(p_event text) returns int language sql as $$
  select count(*)::int from public.audit_log a
  join public.webhook_events e on e.id = a.subject_id
  where a.subject_type = 'webhook_event' and e.provider_event_id = p_event;
$$;

select is(pg_temp.receive('revenuecat', 'evt-1', 'member-1', now() - interval '10 minutes'),
  'processed', 'a new event is applied');
select is(
  (select status || ':' || (processed_at is not null)::text from public.webhook_events
    where provider_event_id = 'evt-1'),
  'processed:true', 'and recorded as processed'
);
select is(
  (select actor_service || ':' || action || ':' || (actor_staff_id is null)::text
     from public.audit_log a join public.webhook_events e on e.id = a.subject_id
    where e.provider_event_id = 'evt-1'),
  'webhook:revenuecat:webhook.processed:true',
  'with one audit entry whose actor is the webhook service, not a person'
);
select is(pg_temp.receive('revenuecat', 'evt-1', 'member-1', now() - interval '10 minutes'),
  'duplicate', 'a replayed event ID is recognised');
select is(pg_temp.receive('revenuecat', 'evt-1', 'member-1', now() - interval '10 minutes', repeat('b', 64)),
  'duplicate', 'even when the replayed body differs');
select is(
  (select count(*)::int from public.webhook_events where provider_event_id = 'evt-1'), 1,
  'a replay stores nothing new'
);
select is(pg_temp.audit_count('evt-1'), 1, 'and writes no second audit entry');
select is(pg_temp.receive('age_check', 'evt-1', 'session-1', now()),
  'processed', 'event IDs are unique per provider, not across providers');

-- Out-of-order and old events ---------------------------------------------------------------------
select is(pg_temp.receive('revenuecat', 'evt-2', 'member-1', now() - interval '1 hour'),
  'superseded', 'an event older than one already applied for the same member is not applied');
select is(
  (select reason || ':' || (last_event_id = (select id from public.webhook_events where provider_event_id = 'evt-2'))::text
     from private.webhook_reconcile_requests where provider = 'revenuecat' and subject = 'member-1'),
  'out_of_order:true', 'and asks for a check of the member''s current state'
);
select is(pg_temp.audit_count('evt-2'), 1, 'a superseded event is audited once');
select is(pg_temp.receive('revenuecat', 'evt-3', 'member-2', now() - interval '1 hour'),
  'processed', 'ordering is per member: an older time for someone else still applies');
select is(pg_temp.receive('revenuecat', 'evt-4', 'member-1', now() - interval '10 minutes'),
  'processed', 'an event at the same time as the latest one still applies');
select is(pg_temp.receive('revenuecat', 'evt-5', 'member-3', now() - interval '2 days'),
  'stale', 'an event more than a day old is not applied');
select is(
  (select reason from private.webhook_reconcile_requests where provider = 'revenuecat' and subject = 'member-3'),
  'stale', 'and asks for a check of the current state instead'
);
select is(pg_temp.receive('revenuecat', 'evt-5', 'member-3', now() - interval '2 days'),
  'duplicate', 'a stale event delivered again is a duplicate');
select is(
  (select string_agg(a.action, ',') from public.audit_log a
     join public.webhook_events e on e.id = a.subject_id where e.provider_event_id = 'evt-5'),
  'webhook.stale', 'a stale event is audited once'
);

-- Transfers: one event, several members --------------------------------------------------------
-- RevenueCat sends a TRANSFER once, about the receiving member; the members who lose the
-- purchase come in p_also_affects.
create function pg_temp.transfer(p_event text, p_to text, p_at timestamptz, p_others text[])
returns text language sql as $$
  select public.receive_webhook_event('revenuecat', p_event, 'TRANSFER', p_to, p_at,
                                      repeat('a', 64), p_others);
$$;
select is(pg_temp.transfer('evt-t1', 'member-4', now() - interval '5 minutes',
                           array['member-5', 'member-6', 'member-4']),
  'processed', 'a transfer is applied to the member who receives the purchase');
select is(
  (select string_agg(subject || ':' || reason, ',' order by subject)
     from private.webhook_reconcile_requests
    where provider = 'revenuecat' and subject in ('member-4', 'member-5', 'member-6')),
  'member-5:transfer,member-6:transfer',
  'and every other member it names gets a check of their current state'
);
select is(pg_temp.transfer('evt-t2', 'member-7', now() - interval '2 days', array['member-8']),
  'stale', 'a transfer more than a day old is not applied');
select is(
  (select reason from private.webhook_reconcile_requests
    where provider = 'revenuecat' and subject = 'member-8'),
  'transfer', 'but the member who lost the purchase is still checked'
);
select throws_ok(
  $$ select pg_temp.transfer('evt-t3', 'member-4', now(),
       (select array_agg('member-x' || i) from generate_series(1, 21) i)) $$,
  'PT422', 'INVALID_REQUEST', 'an event naming more than 20 other members is refused'
);
select throws_ok(
  $$ select pg_temp.transfer('evt-t3', 'member-4', now(), array[' ']) $$,
  'PT422', 'INVALID_REQUEST', 'an empty member in the list is refused'
);

-- Audit entries name exactly one actor ------------------------------------------------------------
select throws_ok(
  $$ insert into public.audit_log (action, subject_type, subject_id)
     values ('test', 'test', gen_random_uuid()) $$,
  '23514', null, 'an audit entry without an actor is refused'
);
select throws_ok(
  $$ insert into public.audit_log (actor_service, action, subject_type, subject_id)
     values ('Webhook RevenueCat', 'test', 'test', gen_random_uuid()) $$,
  '23514', null, 'a service actor must be a fixed name such as webhook:revenuecat'
);
select throws_ok(
  $$ insert into public.audit_log (actor_staff_id, actor_service, action, subject_type, subject_id)
     values (gen_random_uuid(), 'webhook:revenuecat', 'test', 'test', gen_random_uuid()) $$,
  '23514', null, 'an audit entry cannot name both a staff member and a service'
);

-- An event that cannot be applied is kept ----------------------------------------------------
-- Stand in for a future apply step that fails (FT-056, FT-019). Rolled back with the rest.
create or replace function private.apply_webhook_event(
  p_event_id uuid, p_provider text, p_event_type text, p_subject text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'cannot apply: card 4111 1111 1111 1111' using errcode = 'P0001';
end;
$$;
select is(pg_temp.receive('revenuecat', 'evt-f1', 'member-9', now() - interval '1 minute'),
  'failed', 'an event that cannot be applied is kept, not lost after the provider stops retrying');
select is(
  (select status || ':' || error_code from public.webhook_events where provider_event_id = 'evt-f1'),
  'failed:P0001', 'it is recorded as failed with the error code only, never the message'
);
select is(
  (select reason from private.webhook_reconcile_requests
    where provider = 'revenuecat' and subject = 'member-9'),
  'apply_failed', 'and its member gets a check of their current state'
);
select is(
  (select string_agg(a.action, ',') from public.audit_log a
     join public.webhook_events e on e.id = a.subject_id where e.provider_event_id = 'evt-f1'),
  'webhook.failed', 'it is audited once'
);
select is(pg_temp.receive('revenuecat', 'evt-f1', 'member-9', now() - interval '1 minute'),
  'duplicate', 'delivered again, it changes nothing more');

select * from finish();
rollback;
