-- Receiving outside callbacks safely (FT-010; TRD 4.8 webhook_events, 5 "Scheduled jobs and
-- outside callbacks"; Security & Access 4.6, 5.2, B07, B08, S02 to S04).
--
-- RevenueCat and the age-check vendor tell us about purchases and age results by calling an
-- Edge Function (revenuecat-webhook, verification-webhook). The function proves the sender
-- first (shared secret or signature); only then does it call public.receive_webhook_event,
-- which in one transaction:
--
--   1. records (provider, event ID) once: a repeat delivery changes nothing;
--   2. refuses to apply an event more than a day old, or one older than an event already
--      applied for the same member or session, and asks for a check of the provider's current
--      state instead (webhook_reconcile_requests, worked by FT-058);
--   3. otherwise applies it (private.apply_webhook_event) and writes one audit entry.
--
-- The full payload is never stored; webhook_events keeps a SHA-256 fingerprint of it.

-- Audit entries from server services ---------------------------------------------------------
-- Until now every audit entry had a staff actor. A webhook has none, so an entry now names
-- exactly one actor: a staff member or a server service such as 'webhook:revenuecat'.
alter table public.audit_log
  alter column actor_staff_id drop not null,
  add column actor_service text check (actor_service ~ '^[a-z_]+:[a-z_-]+$'),
  add constraint audit_log_one_actor check ((actor_staff_id is null) <> (actor_service is null));

-- Only other database functions call this; members, staff and the API cannot.
create function private.write_service_audit(
  p_service text,
  p_action text,
  p_subject_type text,
  p_subject_id uuid,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (actor_service, action, subject_type, subject_id, metadata)
  values (p_service, p_action, p_subject_type, p_subject_id, coalesce(p_metadata, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.write_service_audit(text, text, text, uuid, jsonb)
  from public, anon, authenticated, service_role;

-- What we keep about each event ------------------------------------------------------------
-- Nothing has been received yet in any environment, so the new columns can be required.
alter table public.webhook_events
  add column event_type text not null check (char_length(btrim(event_type)) > 0),
  -- The member (RevenueCat app user ID) or vendor session the event is about.
  add column subject text not null check (char_length(btrim(subject)) > 0),
  -- When the provider says the event happened. Decides ordering and freshness.
  add column occurred_at timestamptz not null,
  add constraint webhook_events_known_provider check (provider in ('revenuecat', 'age_check')),
  drop constraint webhook_events_status_check,
  add constraint webhook_events_status_check
    check (status in ('received', 'processing', 'processed', 'failed', 'superseded', 'stale'));
create index webhook_events_applied_idx on public.webhook_events (provider, subject, occurred_at desc)
  where status = 'processed';

-- Checks of the provider's current state ------------------------------------------------------
-- One open request per member or session. The reconcile job (FT-058) asks the provider for the
-- current state, applies it and deletes the row. Kept in private: it is not one of the TRD's
-- member-facing tables and the API never needs to reach it.
create table private.webhook_reconcile_requests (
  provider text not null check (provider in ('revenuecat', 'age_check')),
  subject text not null check (char_length(btrim(subject)) > 0),
  reason text not null check (reason in ('out_of_order', 'stale')),
  last_event_id uuid references public.webhook_events (id) on delete set null,
  requested_at timestamptz not null default now(),
  primary key (provider, subject)
);
alter table private.webhook_reconcile_requests enable row level security;
revoke all on private.webhook_reconcile_requests from public, anon, authenticated;
-- No policies: server only.

-- Applying an event -------------------------------------------------------------------------
-- What each event changes. Plans and entitlements (FT-056) and age-check results (FT-019) fill
-- this in; until then a verified event is recorded and audited but changes nothing else.
-- It runs inside receive_webhook_event's transaction: if it raises, nothing is recorded and the
-- provider retries.
create function private.apply_webhook_event(
  p_event_id uuid,
  p_provider text,
  p_event_type text,
  p_subject text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform p_event_id, p_provider, p_event_type, p_subject;
end;
$$;
revoke all on function private.apply_webhook_event(uuid, text, text, text)
  from public, anon, authenticated, service_role;

-- Receiving an event ------------------------------------------------------------------------
-- Called only by the webhook Edge Functions, with the server key, after they have proved the
-- sender. Returns what happened: processed, duplicate, superseded or stale.
create function public.receive_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_subject text,
  p_occurred_at timestamptz,
  p_payload_hash text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_latest timestamptz;
  v_service text := 'webhook:' || p_provider;
  v_outcome text;
begin
  if p_provider is null or p_provider not in ('revenuecat', 'age_check')
     or coalesce(btrim(p_event_id), '') = ''
     or coalesce(btrim(p_event_type), '') = ''
     or coalesce(btrim(p_subject), '') = ''
     or p_occurred_at is null
     or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
     -- A few minutes of clock difference is normal; an event from the future is not.
     or p_occurred_at > now() + interval '5 minutes' then
    raise exception 'INVALID_REQUEST' using errcode = 'PT422';
  end if;

  -- Events about the same member or session are handled one at a time, so ordering holds.
  perform pg_advisory_xact_lock(hashtextextended('webhook:' || p_provider || ':' || p_subject, 0));

  insert into public.webhook_events
    (provider, provider_event_id, payload_hash, event_type, subject, occurred_at, status)
  values (p_provider, p_event_id, p_payload_hash, p_event_type, p_subject, p_occurred_at, 'processing')
  on conflict (provider, provider_event_id) do nothing
  returning id into v_id;

  -- Seen before: one state change and one audit entry already exist.
  if v_id is null then
    return 'duplicate';
  end if;

  select max(occurred_at) into v_latest
  from public.webhook_events
  where provider = p_provider and subject = p_subject and status = 'processed';

  if p_occurred_at < now() - interval '1 day' then
    v_outcome := 'stale';
  elsif v_latest is not null and p_occurred_at < v_latest then
    v_outcome := 'superseded';
  else
    v_outcome := 'processed';
  end if;

  if v_outcome = 'processed' then
    perform private.apply_webhook_event(v_id, p_provider, p_event_type, p_subject);
  else
    -- Never apply an old state over a newer one: ask the provider what is true now.
    insert into private.webhook_reconcile_requests (provider, subject, reason, last_event_id)
    values (p_provider, p_subject,
            case v_outcome when 'stale' then 'stale' else 'out_of_order' end, v_id)
    on conflict (provider, subject) do update
      set reason = excluded.reason, last_event_id = excluded.last_event_id, requested_at = now();
  end if;

  update public.webhook_events set status = v_outcome, processed_at = now() where id = v_id;
  perform private.write_service_audit(v_service, 'webhook.' || v_outcome, 'webhook_event', v_id,
    jsonb_build_object('event_type', p_event_type));
  return v_outcome;
end;
$$;
revoke all on function public.receive_webhook_event(text, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.receive_webhook_event(text, text, text, text, timestamptz, text)
  to service_role;
