-- Staff accounts and the audit log (TRD 4.7; Security & Access 3.2, 4.5, 4.10).
-- Staff use separate named accounts with two-step sign-in. One sign-in account is either a
-- member or a staff identity, never both.

-- staff ----------------------------------------------------------------------------------
create table public.staff (
  auth_user_id uuid primary key references auth.users (id) on delete restrict,
  role public.staff_role not null,
  active boolean not null default true,
  backup_for uuid references public.staff (auth_user_id) on delete set null,
  mfa_enrolled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (backup_for is null or backup_for <> auth_user_id)
);
create trigger staff_set_updated_at before update on public.staff
  for each row execute function private.set_updated_at();

-- A sign-in account cannot be both a member and staff.
create function private.ensure_member_is_not_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.staff s where s.auth_user_id = new.id) then
    raise exception 'This account is a staff account and cannot be a member'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;
create trigger members_not_staff before insert on public.members
  for each row execute function private.ensure_member_is_not_staff();

create function private.ensure_staff_is_not_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.members m where m.id = new.auth_user_id) then
    raise exception 'This account is a member account and cannot be staff'
      using errcode = 'unique_violation';
  end if;
  return new;
end;
$$;
create trigger staff_not_member before insert on public.staff
  for each row execute function private.ensure_staff_is_not_member();

-- The caller's staff role, or null. A role only counts when the account is active, has
-- enrolled a second factor and this session was signed in with it (aal2).
create function private.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
  from public.staff s
  where s.auth_user_id = (select auth.uid())
    and s.active
    and s.mfa_enrolled_at is not null
    and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
revoke all on function private.current_staff_role() from public, anon;
grant execute on function private.current_staff_role() to authenticated, service_role;

alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;
grant select on public.staff to authenticated;
-- Staff see their own record; an admin with a verified second factor sees the roster.
create policy staff_select_own on public.staff
  for select to authenticated
  using (auth_user_id = (select auth.uid()));
create policy staff_select_admin on public.staff
  for select to authenticated
  using ((select private.current_staff_role()) = 'admin');

-- audit_log ------------------------------------------------------------------------------
-- The permanent diary of staff views and changes: who (actor), did what (action), to which
-- record (subject type and id, optional report) and when (created_at, server time).
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid not null references public.staff (auth_user_id) on delete restrict,
  action text not null check (char_length(btrim(action)) > 0),
  subject_type text not null check (char_length(btrim(subject_type)) > 0),
  subject_id uuid not null,
  report_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_actor_created_idx on public.audit_log (actor_staff_id, created_at);
create index audit_log_subject_idx on public.audit_log (subject_type, subject_id);

-- Append-only for everyone, the server and the database owner included.
create trigger audit_log_no_update before update on public.audit_log
  for each row execute function private.reject_change();
create trigger audit_log_no_delete before delete on public.audit_log
  for each row execute function private.reject_change();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.reject_change();

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
-- Staff read their own entries; an admin reads all. Nobody can write directly.
create policy audit_log_select_own on public.audit_log
  for select to authenticated
  using (
    actor_staff_id = (select auth.uid())
    and (select private.current_staff_role()) is not null
  );
create policy audit_log_select_admin on public.audit_log
  for select to authenticated
  using ((select private.current_staff_role()) = 'admin');

-- The only way to write an audit entry. The actor is always the signed-in staff member,
-- never a parameter. Staff functions (FT-011 onwards) call this before showing evidence or
-- making a change; if it fails, they fail too.
create function private.write_audit(
  p_action text,
  p_subject_type text,
  p_subject_id uuid,
  p_report_id uuid default null,
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
  if (select private.current_staff_role()) is null then
    raise exception 'Only an active staff member with a verified second factor can be audited as an actor'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log (actor_staff_id, action, subject_type, subject_id, report_id, metadata)
  values ((select auth.uid()), p_action, p_subject_type, p_subject_id, p_report_id, coalesce(p_metadata, '{}'))
  returning id into v_id;

  return v_id;
end;
$$;
-- Not callable through the API; only other database functions use it.
revoke all on function private.write_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;
