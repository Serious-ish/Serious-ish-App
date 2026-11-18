-- Accounts and profile (TRD 4.4; Security & Access 4.2).
-- Phone and email stay in auth.users, which is never exposed through the API.
-- Surname and date of birth sit in member_identity, which no member or staff role can read
-- directly. The rounded map point sits in member_locations, which nobody can read directly.

-- members --------------------------------------------------------------------------------
create table public.members (
  id uuid primary key references auth.users (id) on delete restrict,
  status public.member_status not null default 'pending',
  age_check_status public.age_status not null default 'not_started',
  went_live_at timestamptz,
  last_active_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger members_set_updated_at before update on public.members
  for each row execute function private.set_updated_at();

alter table public.members enable row level security;
revoke all on public.members from anon, authenticated;
-- A member reads only limited state of their own account.
grant select (id, status, age_check_status, went_live_at, created_at, updated_at)
  on public.members to authenticated;
create policy members_select_own on public.members
  for select to authenticated
  using (id = (select auth.uid()));

-- member_identity ------------------------------------------------------------------------
create table public.member_identity (
  member_id uuid primary key references public.members (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) > 0),
  last_name text not null check (char_length(btrim(last_name)) > 0),
  date_of_birth date not null check (date_of_birth > date '1900-01-01'),
  dob_locked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger member_identity_set_updated_at before update on public.member_identity
  for each row execute function private.set_updated_at();

-- A date of birth can never be in the future.
create function private.check_date_of_birth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.date_of_birth > current_date then
    raise exception 'date_of_birth cannot be in the future' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger member_identity_check_dob before insert or update of date_of_birth
  on public.member_identity for each row execute function private.check_date_of_birth();

alter table public.member_identity enable row level security;
revoke all on public.member_identity from anon, authenticated;
-- No policies: members reach their own facts only through a guarded function.

-- profiles -------------------------------------------------------------------------------
create table public.profiles (
  member_id uuid primary key references public.members (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) > 0),
  gender text not null,
  pronouns text,
  sexual_orientation text,
  ethnicity text,
  height_cm smallint check (height_cm > 0),
  area_label text not null,
  relationship_intent text not null default 'Still figuring out'
    check (relationship_intent in ('Serious', 'Serious-ish', 'Casual', 'Still figuring out')),
  education_level text,
  school text,
  currently_studying boolean,
  employer text,
  job_title text,
  has_children text,
  wants_children text,
  religion text,
  politics text,
  drinking text,
  smoking text,
  other_habits jsonb,
  bio text,
  hidden_fields text[] not null default '{}',
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 11),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- A member reads their own full profile. Other members only ever receive a safe card from
-- the feed and profile functions (FT-029, FT-031), never this row.
grant select on public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (member_id = (select auth.uid()));

-- member_locations -----------------------------------------------------------------------
create table public.member_locations (
  member_id uuid primary key references public.members (id) on delete cascade,
  approx_point extensions.geography (point, 4326) not null,
  source public.location_source not null,
  accuracy_km numeric check (accuracy_km >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index member_locations_approx_point_idx on public.member_locations using gist (approx_point);
create trigger member_locations_set_updated_at before update on public.member_locations
  for each row execute function private.set_updated_at();

alter table public.member_locations enable row level security;
revoke all on public.member_locations from anon, authenticated;
-- No policies: nobody reads a point directly, members and staff included. The feed function
-- uses it and returns at most a coarse distance band.

-- discovery_preferences ------------------------------------------------------------------
create table public.discovery_preferences (
  member_id uuid primary key references public.members (id) on delete cascade,
  seeking_genders text[] not null check (cardinality(seeking_genders) >= 1),
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null,
  max_distance_km smallint not null default 25 check (max_distance_km > 0),
  active_this_week boolean not null default false,
  complete_profiles_only boolean not null default false,
  go_further boolean not null default false,
  advanced_filters jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_max >= age_min)
);
create trigger discovery_preferences_set_updated_at before update on public.discovery_preferences
  for each row execute function private.set_updated_at();

alter table public.discovery_preferences enable row level security;
revoke all on public.discovery_preferences from anon, authenticated;
grant select on public.discovery_preferences to authenticated;
create policy discovery_preferences_select_own on public.discovery_preferences
  for select to authenticated
  using (member_id = (select auth.uid()));

-- photos ---------------------------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  storage_path text not null,
  position smallint not null check (position between 1 and 6),
  moderation_status public.photo_status not null default 'uploaded',
  screening_provider text,
  screening_labels jsonb,
  rejection_reason text,
  width_px integer check (width_px > 0),
  height_px integer check (height_px > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One current photo per position for each member.
create unique index photos_member_position_current_key on public.photos (member_id, position)
  where moderation_status <> 'removed';
create trigger photos_set_updated_at before update on public.photos
  for each row execute function private.set_updated_at();

alter table public.photos enable row level security;
revoke all on public.photos from anon, authenticated;
-- The owner sees their own photos and why one was rejected, not the screening scores.
grant select (id, member_id, storage_path, position, moderation_status, rejection_reason,
  width_px, height_px, created_at, updated_at) on public.photos to authenticated;
create policy photos_select_own on public.photos
  for select to authenticated
  using (member_id = (select auth.uid()));

-- interests ------------------------------------------------------------------------------
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index interests_name_key on public.interests (lower(name));
create trigger interests_set_updated_at before update on public.interests
  for each row execute function private.set_updated_at();

alter table public.interests enable row level security;
revoke all on public.interests from anon, authenticated;
grant select (id, name, category) on public.interests to authenticated;
create policy interests_select_active on public.interests
  for select to authenticated
  using (is_active);

-- member_interests -----------------------------------------------------------------------
create table public.member_interests (
  member_id uuid not null references public.members (id) on delete cascade,
  interest_id uuid not null references public.interests (id) on delete restrict,
  selected_at timestamptz not null default now(),
  primary key (member_id, interest_id)
);
create index member_interests_interest_idx on public.member_interests (interest_id);

alter table public.member_interests enable row level security;
revoke all on public.member_interests from anon, authenticated;
grant select on public.member_interests to authenticated;
create policy member_interests_select_own on public.member_interests
  for select to authenticated
  using (member_id = (select auth.uid()));

-- prompts --------------------------------------------------------------------------------
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(btrim(question)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index prompts_active_question_key on public.prompts (lower(question)) where is_active;
create trigger prompts_set_updated_at before update on public.prompts
  for each row execute function private.set_updated_at();

alter table public.prompts enable row level security;
revoke all on public.prompts from anon, authenticated;
grant select (id, question) on public.prompts to authenticated;
create policy prompts_select_active on public.prompts
  for select to authenticated
  using (is_active);

-- prompt_answers -------------------------------------------------------------------------
create table public.prompt_answers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  prompt_id uuid not null references public.prompts (id) on delete restrict,
  answer text not null check (char_length(btrim(answer)) > 0),
  position smallint not null check (position between 1 and 3),
  moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, prompt_id),
  unique (member_id, position)
);
create index prompt_answers_prompt_idx on public.prompt_answers (prompt_id);
create trigger prompt_answers_set_updated_at before update on public.prompt_answers
  for each row execute function private.set_updated_at();

alter table public.prompt_answers enable row level security;
revoke all on public.prompt_answers from anon, authenticated;
grant select on public.prompt_answers to authenticated;
create policy prompt_answers_select_own on public.prompt_answers
  for select to authenticated
  using (member_id = (select auth.uid()));
