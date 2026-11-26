-- Webhook follow-ups from the FT-010 review (PR #15): purchases that move between members, and
-- events that cannot be applied. Both must hold before FT-056 and FT-019 fill in
-- private.apply_webhook_event.
--
-- Transfers. RevenueCat sends a TRANSFER only once, about the member who receives the purchase,
-- and lists the member who loses it in transferred_from. Until now that member was dropped: no
-- lock, no ordering, no state check. Every other member an event names now comes in as
-- p_also_affects: they are locked with the subject, and each gets a state check.
--
-- Failures. If applying an event raised, the whole call rolled back and the provider got an
-- error. RevenueCat retries 5 times over about 80 minutes and then stops, so the event was lost
-- with nothing recorded. Now the event is kept as 'failed' (with the error code only, never the
-- message), its subject gets a state check, and the provider gets a 200.

alter table private.webhook_reconcile_requests
  drop constraint webhook_reconcile_requests_reason_check,
  add constraint webhook_reconcile_requests_reason_check
    check (reason in ('out_of_order', 'stale', 'transfer', 'apply_failed'));

drop function public.receive_webhook_event(text, text, text, text, timestamptz, text);

-- Called only by the webhook Edge Functions, with the server key, after they have proved the
-- sender. Returns what happened: processed, duplicate, superseded, stale or failed.
-- p_also_affects: other members or sessions the event changes (a transfer's other side).
create function public.receive_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_subject text,
  p_occurred_at timestamptz,
  p_payload_hash text,
  p_also_affects text[] default '{}'
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
  v_others text[];
  v_subject text;
  v_error text;
begin
  if p_provider is null or p_provider not in ('revenuecat', 'age_check')
     or coalesce(btrim(p_event_id), '') = ''
     or coalesce(btrim(p_event_type), '') = ''
     or coalesce(btrim(p_subject), '') = ''
     or p_occurred_at is null
     or coalesce(p_payload_hash, '') !~ '^[0-9a-f]{64}$'
     -- A few minutes of clock difference is normal; an event from the future is not.
     or p_occurred_at > now() + interval '5 minutes'
     or coalesce(cardinality(p_also_affects), 0) > 20
     or exists (select 1 from unnest(p_also_affects) s
                where coalesce(btrim(s), '') = '' or char_length(s) > 200) then
    raise exception 'INVALID_REQUEST' using errcode = 'PT422';
  end if;

  select coalesce(array_agg(distinct s order by s), '{}') into v_others
  from unnest(coalesce(p_also_affects, '{}')) s
  where s <> p_subject;

  -- Events about the same member or session are handled one at a time, so ordering holds.
  -- Every member the event names is locked, always in the same order, so two transfers between
  -- the same members cannot deadlock.
  for v_subject in
    select s from unnest(array_append(v_others, p_subject)) s group by s order by s
  loop
    perform pg_advisory_xact_lock(hashtextextended('webhook:' || p_provider || ':' || v_subject, 0));
  end loop;

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
    begin
      perform private.apply_webhook_event(v_id, p_provider, p_event_type, p_subject);
    exception when others then
      -- Undo only what applying did, keep the event, and ask the provider what is true now.
      v_outcome := 'failed';
      v_error := sqlstate;
    end;
  end if;

  if v_outcome <> 'processed' then
    -- Never apply an old state over a newer one, or leave a failed one behind.
    insert into private.webhook_reconcile_requests (provider, subject, reason, last_event_id)
    values (p_provider, p_subject,
            case v_outcome when 'stale' then 'stale' when 'failed' then 'apply_failed'
                           else 'out_of_order' end,
            v_id)
    on conflict (provider, subject) do update
      set reason = excluded.reason, last_event_id = excluded.last_event_id, requested_at = now();
  end if;

  -- Whatever happened to the event itself, the other members it names are checked.
  insert into private.webhook_reconcile_requests (provider, subject, reason, last_event_id)
  select p_provider, s, 'transfer', v_id from unnest(v_others) s
  on conflict (provider, subject) do update
    set reason = excluded.reason, last_event_id = excluded.last_event_id, requested_at = now();

  update public.webhook_events
  set status = v_outcome, processed_at = now(), error_code = v_error
  where id = v_id;
  perform private.write_service_audit(v_service, 'webhook.' || v_outcome, 'webhook_event', v_id,
    jsonb_build_object('event_type', p_event_type, 'also_affects', cardinality(v_others)));
  return v_outcome;
end;
$$;
revoke all on function public.receive_webhook_event(text, text, text, text, timestamptz, text, text[])
  from public, anon, authenticated;
grant execute on function public.receive_webhook_event(text, text, text, text, timestamptz, text, text[])
  to service_role;
