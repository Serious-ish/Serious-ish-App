-- Trust and launch (TRD 4.5; Security & Access 4.3).
-- We keep the verification result and the vendor's reference, never the selfie or ID scan.

-- verifications --------------------------------------------------------------------------
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  kind public.verification_kind not null,
  vendor text,
  vendor_reference text,
  status public.verification_status not null default 'started',
  estimated_age numeric,
  assigned_staff_id uuid references public.staff (auth_user_id) on delete set null,
  decision_note text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vendor_reference is null or vendor is not null)
);
create unique index verifications_vendor_reference_key on public.verifications (vendor, vendor_reference)
  where vendor_reference is not null;
create index verifications_member_idx on public.verifications (member_id);
create index verifications_review_queue_idx on public.verifications (status) where status = 'needs_review';
create trigger verifications_set_updated_at before update on public.verifications
  for each row execute function private.set_updated_at();

alter table public.verifications enable row level security;
revoke all on public.verifications from anon, authenticated;
-- A member sees only the broad status of their own attempts: never the estimate, the
-- vendor reference, the reviewer or the note.
grant select (id, member_id, kind, status, expires_at, created_at, updated_at)
  on public.verifications to authenticated;
create policy verifications_select_own on public.verifications
  for select to authenticated
  using (member_id = (select auth.uid()));

-- consents -------------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  kind public.consent_kind not null,
  document_version text not null check (char_length(btrim(document_version)) > 0),
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (withdrawn_at is null or withdrawn_at >= accepted_at)
);
create index consents_member_kind_idx on public.consents (member_id, kind);

alter table public.consents enable row level security;
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
create policy consents_select_own on public.consents
  for select to authenticated
  using (member_id = (select auth.uid()));

-- waitlist_entries (Light) ---------------------------------------------------------------
create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  contact text not null,
  gender_group text,
  dating_group text,
  cohort text not null check (cohort in ('beta', 'waitlist', 'public')),
  status text not null default 'waiting' check (status in ('waiting', 'invited', 'joined', 'withdrawn')),
  member_id uuid references public.members (id) on delete set null,
  invited_at timestamptz,
  created_at timestamptz not null default now()
);
create index waitlist_entries_cohort_status_idx on public.waitlist_entries (cohort, status);

alter table public.waitlist_entries enable row level security;
revoke all on public.waitlist_entries from anon, authenticated;
-- No policies: launch staff only, through a restricted path.
