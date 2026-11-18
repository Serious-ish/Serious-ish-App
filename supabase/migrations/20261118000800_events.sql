-- Curated events (TRD 4.9; Security & Access 4.7).
-- Hand-approved listings that link to the organiser's own ticket page. No in-app payment in
-- version 1.

-- hosts ----------------------------------------------------------------------------------
create table public.hosts (
  id uuid primary key default gen_random_uuid(),
  public_name text not null check (char_length(btrim(public_name)) > 0),
  public_website text check (public_website is null or public_website like 'https://%'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'paused', 'rejected')),
  approved_by uuid references public.staff (auth_user_id) on delete set null,
  vetting_note text,
  agreement_version text,
  agreement_signed_at timestamptz,
  agreement_document_path text,
  insurance_expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- No host is approved without an accepted agreement.
  check (status <> 'approved' or (agreement_version is not null and agreement_signed_at is not null))
);
create trigger hosts_set_updated_at before update on public.hosts
  for each row execute function private.set_updated_at();

alter table public.hosts enable row level security;
revoke all on public.hosts from anon, authenticated;
-- Members see only approved hosts' public names.
grant select (id, public_name, public_website) on public.hosts to authenticated;
create policy hosts_select_approved on public.hosts
  for select to authenticated
  using (status = 'approved');

-- events ---------------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.hosts (id) on delete restrict,
  title text not null check (char_length(btrim(title)) > 0),
  description text not null,
  category text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,
  venue_address text,
  area_label text not null,
  organizer_url text not null check (organizer_url like 'https://%'),
  cover_storage_path text,
  status public.event_status not null default 'draft',
  approved_by uuid references public.staff (auth_user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index events_host_idx on public.events (host_id);
create index events_listing_idx on public.events (starts_at) where status = 'approved';
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();

-- Reports may point at an event.
alter table public.reports
  add constraint reports_reported_event_id_fkey foreign key (reported_event_id)
  references public.events (id) on delete restrict;

-- True when the caller is an active member. Used by member-facing rules that need it.
create function private.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = (select auth.uid()) and m.status = 'active'
  );
$$;
revoke all on function private.is_active_member() from public, anon;
grant execute on function private.is_active_member() to authenticated, service_role;

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select (id, host_id, title, description, category, starts_at, ends_at, venue_name,
  venue_address, area_label, organizer_url, cover_storage_path, status) on public.events to authenticated;
-- Active members see approved events that have not ended, from approved hosts.
create policy events_select_current on public.events
  for select to authenticated
  using (
    status = 'approved'
    and ends_at > now()
    and (select private.is_active_member())
    and exists (select 1 from public.hosts h where h.id = host_id and h.status = 'approved')
  );
