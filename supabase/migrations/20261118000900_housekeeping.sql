-- Housekeeping (TRD 4.10; Security & Access 4.8).

-- push_tokens ----------------------------------------------------------------------------
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  invalidated_at timestamptz,
  created_at timestamptz not null default now()
);
create index push_tokens_member_idx on public.push_tokens (member_id) where invalidated_at is null;

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;
-- No policies: members register and revoke through a function (FT-044); only the push
-- service reads the raw token.

-- notification_preferences ---------------------------------------------------------------
create table public.notification_preferences (
  member_id uuid primary key references public.members (id) on delete cascade,
  new_match boolean not null default true,
  new_message boolean not null default true,
  expiring_match boolean not null default true,
  events boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (member_id = (select auth.uid()));

-- data_exports (Light) -------------------------------------------------------------------
create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'preparing', 'ready', 'delivered', 'expired', 'denied')),
  storage_path text,
  requested_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  resolved_at timestamptz
);
create index data_exports_member_idx on public.data_exports (member_id);

alter table public.data_exports enable row level security;
revoke all on public.data_exports from anon, authenticated;
-- A member sees the status of their own requests, not the file path.
grant select (id, member_id, status, requested_at, ready_at, expires_at, resolved_at)
  on public.data_exports to authenticated;
create policy data_exports_select_own on public.data_exports
  for select to authenticated
  using (member_id = (select auth.uid()));

-- deletion_requests ----------------------------------------------------------------------
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested', 'pending_hold', 'purging', 'completed')),
  requested_at timestamptz not null default now(),
  purge_after timestamptz not null,
  purged_at timestamptz,
  exception_reason text,
  created_at timestamptz not null default now()
);
create index deletion_requests_member_idx on public.deletion_requests (member_id);
create index deletion_requests_due_idx on public.deletion_requests (purge_after)
  where status in ('requested', 'pending_hold');

alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;
-- A member sees the status of their own request, not any exception reason.
grant select (id, member_id, status, requested_at, purge_after, purged_at)
  on public.deletion_requests to authenticated;
create policy deletion_requests_select_own on public.deletion_requests
  for select to authenticated
  using (member_id = (select auth.uid()));

-- app_config -----------------------------------------------------------------------------
-- Launch switches and tunable numbers. Never a key or a secret.
create table public.app_config (
  key text primary key,
  value_json jsonb not null,
  updated_by uuid references public.staff (auth_user_id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger app_config_set_updated_at before update on public.app_config
  for each row execute function private.set_updated_at();

-- Starting values from the approved decisions (TRD 2.5, 4.8, 7.8).
insert into public.app_config (key, value_json) values
  ('launch_phase', '"development"'),
  ('age_pass_threshold', '21'),
  ('age_review_floor', '18'),
  ('daily_quota_timezone', '"America/Toronto"'),
  ('maintenance_mode', 'false');

alter table public.app_config enable row level security;
revoke all on public.app_config from anon, authenticated;
grant select (key, value_json) on public.app_config to authenticated;
-- Members read only the allow-listed, non-secret switches the app needs (FT-008).
create policy app_config_select_member_flags on public.app_config
  for select to authenticated
  using (key in ('launch_phase', 'maintenance_mode', 'min_app_version'));
