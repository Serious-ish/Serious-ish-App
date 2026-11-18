-- Bootstrap: extensions, the private helper schema, allowed values (TRD 4.2),
-- default privileges and shared helper functions.
--
-- Access model (Security & Access 04, TRD 4.14):
--   * Every table has row level security on; with no matching policy, nobody can read it.
--   * Signed-out requests (role anon) get no privileges on any table, now or in future.
--   * Signed-in members (role authenticated) get SELECT only, on named columns, where a
--     policy allows it. Every write goes through a database function or the server.
--   * Server code (service_role) is used only inside Edge Functions and jobs.

create extension if not exists postgis with schema extensions;

-- Helpers that must never be reachable through the API live in their own schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

-- Nothing is granted by default: each table and function opts in explicitly.
-- Postgres lets everyone (PUBLIC) execute new functions; that global default can only be
-- removed without "in schema", so it is revoked first.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- Allowed values (TRD 4.2). The database rejects anything else.
create type public.member_status as enum ('pending', 'active', 'paused', 'held', 'suspended', 'deleted');
create type public.age_status as enum ('not_started', 'pending', 'review', 'passed', 'blocked');
create type public.plan_tier as enum ('free', 'spark', 'elite');
create type public.location_source as enum ('device', 'selected_area');
create type public.photo_status as enum ('uploaded', 'scanning', 'approved', 'rejected', 'removed');
create type public.consent_kind as enum ('terms', 'privacy', 'biometric_check', 'location', 'notifications', 'marketing');
create type public.verification_kind as enum ('selfie_age', 'id_fallback', 'store_age_signal');
create type public.verification_status as enum ('started', 'passed', 'failed', 'needs_review', 'expired');
create type public.swipe_action as enum ('pass', 'like', 'superlike');
create type public.match_status as enum ('active', 'chat_open', 'expired', 'unmatched', 'blocked');
create type public.report_reason as enum ('underage', 'threat', 'unsafe_event', 'harassment', 'fake', 'scam', 'spam', 'other');
create type public.report_status as enum ('new', 'in_review', 'resolved', 'appealed');
create type public.moderation_action as enum ('dismiss', 'warn', 'remove_content', 'suspend', 'ban', 'reinstate', 'escalate');
create type public.staff_role as enum ('moderator', 'age_reviewer', 'support', 'admin');
create type public.subscription_status as enum ('active', 'grace', 'canceled_but_active', 'expired', 'refunded');
create type public.usage_kind as enum ('like', 'rewind', 'superlike');
create type public.event_status as enum ('draft', 'approved', 'canceled', 'removed');
create type public.store_kind as enum ('apple', 'google');

-- Keeps updated_at current on every row change.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rejects any change to an append-only table, whoever makes it (including the owner and
-- the server). Used by audit_log and moderator_actions.
create function private.reject_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Table %.% is append-only: % is not allowed', tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end;
$$;
