-- Appeals and support requests from members (FT-046; Security & Access 4: "Member submits";
-- error R08). Members cannot write these tables directly, so these two functions are the only
-- way in. Staff read them through the moderation page (FT-048).

-- ponytail: 1,000 characters is our own cap against abuse; no document sets one.

-- Appeal ---------------------------------------------------------------------------------------
-- A held member appeals their active hold; a suspended member appeals the decision that
-- suspended them. With nothing to appeal, the request is logged for support instead (R08:
-- "Do not invent indefinite appeal; log request"). Returns 'appeal' or 'support'.
create function public.submit_appeal(p_message text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_status public.member_status;
  v_message text := btrim(p_message);
  v_hold uuid;
  v_report uuid;
begin
  select m.status into v_status from public.members m where m.id = v_member;
  if v_status is null or v_status not in ('held', 'suspended') then
    raise exception 'NOT_ALLOWED' using errcode = 'PT403';
  end if;
  if v_message is null or char_length(v_message) not between 1 and 1000 then
    raise exception 'INVALID_REQUEST' using errcode = 'PT422';
  end if;

  -- One submission at a time per member, so a double tap cannot create two appeals.
  perform pg_advisory_xact_lock(hashtextextended(v_member::text, 1));

  if v_status = 'held' then
    select h.id, h.report_id into v_hold, v_report
      from public.member_holds h
     where h.member_id = v_member and h.status = 'active'
     order by h.started_at desc
     limit 1;
  else
    select a.report_id into v_report
      from public.moderator_actions a
      join public.reports r on r.id = a.report_id
     where r.reported_member_id = v_member and a.action in ('suspend', 'ban')
     order by a.created_at desc
     limit 1;
  end if;

  if v_hold is null and v_report is null then
    insert into public.support_requests (member_id, request_type, details)
    values (v_member, 'appeal_help', v_message);
    return 'support';
  end if;

  -- While an appeal of the same decision is open, a second one adds nothing.
  if not exists (
    select 1 from public.appeals a
    where a.member_id = v_member
      and a.status in ('open', 'reviewing')
      and a.hold_id is not distinct from v_hold
      and a.report_id is not distinct from v_report
  ) then
    insert into public.appeals (member_id, hold_id, report_id, message)
    values (v_member, v_hold, v_report, v_message);
  end if;
  return 'appeal';
end;
$$;
revoke all on function public.submit_appeal(text) from public, anon;
grant execute on function public.submit_appeal(text) to authenticated;

-- Support ----------------------------------------------------------------------------------
-- Any member, whatever their status, can ask support for help. While a request of the same
-- type is open, a second one returns it instead of adding another. Returns the request ID.
create function public.request_support(p_type text, p_details text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_details text := btrim(p_details);
  v_id uuid;
begin
  if not exists (select 1 from public.members m where m.id = v_member) then
    raise exception 'NOT_ALLOWED' using errcode = 'PT403';
  end if;
  if p_type is null
     or p_type not in ('dob_correction', 'account_recovery', 'deletion_query', 'data_access',
                       'appeal_help', 'other')
     or v_details is null
     or char_length(v_details) not between 1 and 1000 then
    raise exception 'INVALID_REQUEST' using errcode = 'PT422';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_member::text, 1));

  select s.id into v_id
    from public.support_requests s
   where s.member_id = v_member and s.request_type = p_type and s.status in ('open', 'assigned')
   order by s.created_at
   limit 1;
  if v_id is null then
    insert into public.support_requests (member_id, request_type, details)
    values (v_member, p_type, v_details)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.request_support(text, text) from public, anon;
grant execute on function public.request_support(text, text) to authenticated;
