-- Money and plans (TRD 4.8; Security & Access 4.6).
-- RevenueCat tells the server what a member bought. The server writes subscriptions and
-- entitlements; the app never grants itself a plan.

-- plan_limits ----------------------------------------------------------------------------
create table public.plan_limits (
  tier public.plan_tier primary key,
  likes_per_day integer check (likes_per_day >= 0),
  rewinds_per_day integer check (rewinds_per_day >= 0),
  superlikes_per_week integer not null check (superlikes_per_week >= 0),
  match_window_hours smallint not null check (match_window_hours in (24, 48, 168)),
  advanced_filters boolean not null default false,
  see_likes boolean not null default false,
  updated_at timestamptz not null default now()
);
comment on column public.plan_limits.likes_per_day is 'Empty means unlimited, which is different from 0.';
comment on column public.plan_limits.rewinds_per_day is 'Empty means unlimited, which is different from 0.';
create trigger plan_limits_set_updated_at before update on public.plan_limits
  for each row execute function private.set_updated_at();

-- The approved entitlement matrix (TRD 4.8).
insert into public.plan_limits
  (tier, likes_per_day, rewinds_per_day, superlikes_per_week, match_window_hours, advanced_filters, see_likes)
values
  ('free', 20, 1, 1, 24, false, false),
  ('spark', null, null, 5, 48, false, false),
  ('elite', null, null, 15, 168, true, true);

alter table public.plan_limits enable row level security;
revoke all on public.plan_limits from anon, authenticated;
-- Members read the benefit flags. The Free daily like count is never shown as a number, so
-- likes_per_day is not readable.
grant select (tier, rewinds_per_day, superlikes_per_week, match_window_hours, advanced_filters, see_likes)
  on public.plan_limits to authenticated;
create policy plan_limits_select_all on public.plan_limits
  for select to authenticated
  using (true);

-- webhook_events -------------------------------------------------------------------------
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(btrim(provider)) > 0),
  provider_event_id text not null,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received', 'processing', 'processed', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  -- A repeated delivery never counts twice.
  unique (provider, provider_event_id)
);

alter table public.webhook_events enable row level security;
revoke all on public.webhook_events from anon, authenticated;
-- No policies: server only.

-- subscriptions --------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  product_id text not null,
  tier public.plan_tier not null check (tier <> 'free'),
  term text not null check (term in ('week', 'month', 'quarter')),
  store public.store_kind not null,
  original_transaction_id text not null,
  status public.subscription_status not null,
  period_start timestamptz not null,
  current_period_end timestamptz not null,
  will_renew boolean not null,
  last_webhook_event_id uuid references public.webhook_events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store, original_transaction_id),
  check (current_period_end > period_start)
);
create index subscriptions_member_idx on public.subscriptions (member_id);
create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
-- A member reads the safe status of their own purchases, not the store transaction IDs.
grant select (id, member_id, product_id, tier, term, store, status, period_start,
  current_period_end, will_renew, created_at, updated_at) on public.subscriptions to authenticated;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (member_id = (select auth.uid()));

-- entitlements ---------------------------------------------------------------------------
create table public.entitlements (
  member_id uuid primary key references public.members (id) on delete cascade,
  tier public.plan_tier not null default 'free',
  status text not null default 'active' check (status in ('active', 'grace', 'inactive')),
  valid_until timestamptz,
  source_subscription_id uuid references public.subscriptions (id) on delete set null,
  last_synced_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger entitlements_set_updated_at before update on public.entitlements
  for each row execute function private.set_updated_at();

alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant select (member_id, tier, status, valid_until, updated_at) on public.entitlements to authenticated;
create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (member_id = (select auth.uid()));

-- usage_counters -------------------------------------------------------------------------
create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  kind public.usage_kind not null,
  period_start timestamptz not null,
  used integer not null default 0 check (used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, kind, period_start)
);
create trigger usage_counters_set_updated_at before update on public.usage_counters
  for each row execute function private.set_updated_at();

alter table public.usage_counters enable row level security;
revoke all on public.usage_counters from anon, authenticated;
-- No policies: a direct read would reveal the hidden Free daily count. Members see a safe
-- allowance through the swipe function (FT-055).
