-- Safety and staff (TRD 4.7; Security & Access 4.5).
-- Reports keep metadata apart from the protected evidence copy, any temporary hold and the
-- decisions made. Staff reach cases only through audited functions (FT-011, FT-048).

-- reports --------------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.members (id) on delete restrict,
  reported_member_id uuid references public.members (id) on delete restrict,
  reported_event_id uuid,
  reported_message_id uuid references public.messages (id) on delete set null,
  reason public.report_reason not null,
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent')),
  status public.report_status not null default 'new',
  assigned_to uuid references public.staff (auth_user_id) on delete set null,
  sla_due_at timestamptz not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(reported_member_id, reported_event_id, reported_message_id) >= 1),
  check (reported_member_id is null or reported_member_id <> reporter_id)
);
create index reports_queue_idx on public.reports (urgency, status, sla_due_at);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_reported_member_idx on public.reports (reported_member_id);
create trigger reports_set_updated_at before update on public.reports
  for each row execute function private.set_updated_at();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
-- The reporter sees only the basic status of their own reports. The reported person never
-- learns who reported them.
grant select (id, reason, status, created_at, updated_at, resolved_at) on public.reports to authenticated;
create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

-- The audit log can now point at a case.
alter table public.audit_log
  add constraint audit_log_report_id_fkey foreign key (report_id)
  references public.reports (id) on delete restrict;

-- report_evidence ------------------------------------------------------------------------
create table public.report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete restrict,
  evidence_kind text not null
    check (evidence_kind in ('profile_snapshot', 'message_context', 'event_snapshot')),
  payload bytea not null,
  key_version text not null,
  context_count smallint not null default 0 check (context_count between 0 and 10),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index report_evidence_report_expires_idx on public.report_evidence (report_id, expires_at);

alter table public.report_evidence enable row level security;
revoke all on public.report_evidence from anon, authenticated;
-- No policies: nobody reads evidence directly. A narrow, MFA-protected, audited function
-- opens it (FT-047, FT-048).

-- member_holds ---------------------------------------------------------------------------
create table public.member_holds (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  report_id uuid not null references public.reports (id) on delete restrict,
  reason text not null check (reason in ('underage', 'threat', 'unsafe_event')),
  status text not null default 'active' check (status in ('active', 'lifted', 'converted')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid references public.staff (auth_user_id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);
-- One report cannot create duplicate active holds.
create unique index member_holds_active_key on public.member_holds (report_id, member_id)
  where status = 'active';
create index member_holds_member_active_idx on public.member_holds (member_id) where status = 'active';

alter table public.member_holds enable row level security;
revoke all on public.member_holds from anon, authenticated;
-- The member sees their own hold notice, not the report behind it.
grant select (id, member_id, status, started_at, ended_at) on public.member_holds to authenticated;
create policy member_holds_select_own on public.member_holds
  for select to authenticated
  using (member_id = (select auth.uid()));

-- appeals --------------------------------------------------------------------------------
create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  hold_id uuid references public.member_holds (id) on delete restrict,
  report_id uuid references public.reports (id) on delete restrict,
  message text not null check (char_length(btrim(message)) > 0),
  status text not null default 'open' check (status in ('open', 'reviewing', 'accepted', 'rejected')),
  decided_by uuid references public.staff (auth_user_id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(hold_id, report_id) >= 1)
);
create index appeals_member_idx on public.appeals (member_id);
create index appeals_open_idx on public.appeals (status) where status in ('open', 'reviewing');

alter table public.appeals enable row level security;
revoke all on public.appeals from anon, authenticated;
grant select (id, member_id, hold_id, report_id, message, status, decided_at, created_at)
  on public.appeals to authenticated;
create policy appeals_select_own on public.appeals
  for select to authenticated
  using (member_id = (select auth.uid()));

-- moderator_actions ----------------------------------------------------------------------
create table public.moderator_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete restrict,
  staff_id uuid not null references public.staff (auth_user_id) on delete restrict,
  action public.moderation_action not null,
  reason_note text not null check (char_length(btrim(reason_note)) > 0),
  notified_reporter_at timestamptz,
  notified_subject_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderator_actions_report_idx on public.moderator_actions (report_id);
create index moderator_actions_staff_idx on public.moderator_actions (staff_id, created_at);

-- Decisions are append-only. The one allowed change is recording, once, when the reporter
-- or the reported member was told (TRD 4.7).
create function private.moderator_actions_allow_notice_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.report_id, new.staff_id, new.action, new.reason_note, new.created_at)
       is distinct from
     (old.id, old.report_id, old.staff_id, old.action, old.reason_note, old.created_at)
     or (old.notified_reporter_at is not null and new.notified_reporter_at is distinct from old.notified_reporter_at)
     or (old.notified_subject_at is not null and new.notified_subject_at is distinct from old.notified_subject_at)
  then
    raise exception 'moderator_actions is append-only: only an empty notification time can be filled in'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger moderator_actions_no_update before update on public.moderator_actions
  for each row execute function private.moderator_actions_allow_notice_only();
create trigger moderator_actions_no_delete before delete on public.moderator_actions
  for each row execute function private.reject_change();
create trigger moderator_actions_no_truncate before truncate on public.moderator_actions
  for each statement execute function private.reject_change();

alter table public.moderator_actions enable row level security;
revoke all on public.moderator_actions from anon, authenticated;
grant select on public.moderator_actions to authenticated;
create policy moderator_actions_select_own on public.moderator_actions
  for select to authenticated
  using (
    staff_id = (select auth.uid())
    and (select private.current_staff_role()) is not null
  );
create policy moderator_actions_select_admin on public.moderator_actions
  for select to authenticated
  using ((select private.current_staff_role()) = 'admin');

-- support_requests (Light) ---------------------------------------------------------------
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete restrict,
  request_type text not null check (request_type in
    ('dob_correction', 'account_recovery', 'deletion_query', 'data_access', 'appeal_help', 'other')),
  status text not null default 'open' check (status in ('open', 'assigned', 'resolved', 'rejected')),
  details text,
  assigned_to uuid references public.staff (auth_user_id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_requests_member_idx on public.support_requests (member_id);
create index support_requests_open_idx on public.support_requests (status) where status in ('open', 'assigned');
create trigger support_requests_set_updated_at before update on public.support_requests
  for each row execute function private.set_updated_at();

alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select (id, member_id, request_type, status, details, resolved_at, created_at, updated_at)
  on public.support_requests to authenticated;
create policy support_requests_select_own on public.support_requests
  for select to authenticated
  using (member_id = (select auth.uid()));
