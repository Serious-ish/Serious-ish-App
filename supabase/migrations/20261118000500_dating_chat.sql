-- Dating and chat (TRD 4.6; Security & Access 4.4).
-- No direct writes: swipes, matches and messages change only through the database
-- functions in FT-030 (record_swipe), FT-036 (expiry) and FT-042/FT-043 (send_message).

-- swipes ---------------------------------------------------------------------------------
create table public.swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references public.members (id) on delete cascade,
  target_id uuid not null references public.members (id) on delete cascade,
  action public.swipe_action not null,
  client_request_id uuid not null,
  rewound_at timestamptz,
  created_at timestamptz not null default now(),
  check (swiper_id <> target_id),
  -- A retried request never creates a second swipe.
  unique (swiper_id, client_request_id)
);
-- One current decision per pair.
create unique index swipes_current_pair_key on public.swipes (swiper_id, target_id)
  where rewound_at is null;
create index swipes_target_action_idx on public.swipes (target_id, action);

alter table public.swipes enable row level security;
revoke all on public.swipes from anon, authenticated;
grant select on public.swipes to authenticated;
-- A member sees only their own actions. Incoming likes reach Elite members through a
-- separate function (FT-039), never through this table.
create policy swipes_select_own on public.swipes
  for select to authenticated
  using (swiper_id = (select auth.uid()));

-- matches --------------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  member_low_id uuid not null references public.members (id) on delete cascade,
  member_high_id uuid not null references public.members (id) on delete cascade,
  window_hours smallint not null check (window_hours in (24, 48, 168)),
  expires_at timestamptz not null,
  low_first_message_at timestamptz,
  high_first_message_at timestamptz,
  chat_opened_at timestamptz,
  status public.match_status not null default 'active',
  superlike_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The lower ID is always stored first, so a pair appears once.
  check (member_low_id < member_high_id),
  check (superlike_by is null or superlike_by in (member_low_id, member_high_id)),
  check (chat_opened_at is null or (low_first_message_at is not null and high_first_message_at is not null))
);
-- One open match per pair.
create unique index matches_open_pair_key on public.matches (member_low_id, member_high_id)
  where status in ('active', 'chat_open');
create index matches_low_idx on public.matches (member_low_id);
create index matches_high_idx on public.matches (member_high_id);
create index matches_expires_at_idx on public.matches (expires_at) where status = 'active';
create trigger matches_set_updated_at before update on public.matches
  for each row execute function private.set_updated_at();

alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
create policy matches_select_participant on public.matches
  for select to authenticated
  using ((select auth.uid()) in (member_low_id, member_high_id));

-- messages -------------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.members (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- A retried send never stores a second copy.
  unique (sender_id, client_request_id)
);
create index messages_match_created_idx on public.messages (match_id, created_at desc);

-- The sender must be one of the two matched members.
create function private.check_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.matches m
    where m.id = new.match_id and new.sender_id in (m.member_low_id, m.member_high_id)
  ) then
    raise exception 'The sender is not part of this match' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger messages_check_sender before insert on public.messages
  for each row execute function private.check_message_sender();

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select (id, match_id, sender_id, body, created_at) on public.messages to authenticated;
create policy messages_select_participant on public.messages
  for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (select auth.uid()) in (m.member_low_id, m.member_high_id)
    )
  );

-- blocks ---------------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.members (id) on delete cascade,
  blocked_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
-- A member sees whom they blocked. The blocked person is never told.
create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));
