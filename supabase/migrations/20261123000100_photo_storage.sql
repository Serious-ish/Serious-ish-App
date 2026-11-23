-- Private photo storage and the rules for who may see a photo (FT-007; TRD 4.4 photos,
-- 7.4 storage; Security & Access 4.9, 5.3; Frontend Specification 9.5).
--
-- Two private buckets:
--   * photos-intake: members upload here, one file per reserved slot. Never shown to anyone.
--   * photos:        approved copies with their metadata (including location) removed.
--                    Only the server writes here (photo screening, FT-023), and display links
--                    are only ever signed from this bucket, by the photo-links Edge Function.
-- A file keeps the same name in both buckets: '<member id>/<photo id>.jpg'.
-- photos.storage_path holds that name.

-- Buckets --------------------------------------------------------------------------------
-- JPEG only: the app converts and resizes before upload (2048 px, under 1.5 MB; FT-024).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos-intake', 'photos-intake', false, 1572864, array['image/jpeg']),
  ('photos', 'photos', false, 1572864, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Who may upload -------------------------------------------------------------------------
-- True when the caller has reserved this exact path and nothing has been uploaded to it yet.
create function private.photo_upload_allowed(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos p
    join public.members m on m.id = p.member_id
    where p.storage_path = p_name
      and p.member_id = (select auth.uid())
      and p.moderation_status = 'uploaded'
      and m.status in ('pending', 'active')
      and m.deleted_at is null
  );
$$;
revoke all on function private.photo_upload_allowed(text) from public, anon;
grant execute on function private.photo_upload_allowed(text) to authenticated;

-- A member may upload only into their own folder of photos-intake, only to a path they
-- reserved with create_photo_slot. There is no update policy, so a file cannot be
-- overwritten, and no select or delete policy, so members cannot read, list, sign or remove
-- files directly: links come from the server, and removal goes through remove_photo.
create policy photos_intake_insert_reserved on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos-intake'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.photo_upload_allowed(name))
  );

-- Who may see a photo --------------------------------------------------------------------
-- The one rule every member-facing photo read uses (photo links now; the discovery feed,
-- preview and full profile later). Only approved photos are ever visible, even to their
-- owner: a pending or rejected photo shows as a review tile (Frontend Specification 7.6).
--   * Own photo: the owner is pending or active and not deleted or on hold.
--   * Someone else's: both are active, neither is on hold, neither has blocked the other,
--     and they have not unmatched (Security & Access 3.5, 5.3; FT-007).
create function private.photo_visible_to(p_photo_id uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.photos p
    join public.members owner on owner.id = p.member_id
    join public.members viewer on viewer.id = p_viewer
    where p.id = p_photo_id
      and p.moderation_status = 'approved'
      and owner.deleted_at is null
      and viewer.deleted_at is null
      and not exists (
        select 1 from public.member_holds h
        where h.member_id in (owner.id, viewer.id) and h.status = 'active'
      )
      and (
        (viewer.id = owner.id and owner.status in ('pending', 'active'))
        or (
          viewer.id <> owner.id
          and owner.status = 'active'
          and viewer.status = 'active'
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = owner.id and b.blocked_id = viewer.id)
               or (b.blocker_id = viewer.id and b.blocked_id = owner.id)
          )
          and not exists (
            select 1 from public.matches m
            where m.member_low_id = least(owner.id, viewer.id)
              and m.member_high_id = greatest(owner.id, viewer.id)
              and m.status in ('unmatched', 'blocked')
          )
        )
      )
  );
$$;
revoke all on function private.photo_visible_to(uuid, uuid) from public, anon, authenticated;

-- Photo links ----------------------------------------------------------------------------
-- Returns the storage names of the requested photos the caller may see, so the photo-links
-- Edge Function can sign them. The caller is always the signed-in member; a photo the caller
-- may not see is left out, with no reason given (error G05: blocked, missing and hidden look
-- the same).
create function public.photo_link_paths(p_photo_ids uuid[])
returns table (photo_id uuid, storage_path text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_ALLOWED' using errcode = 'PT401';
  end if;
  if coalesce(cardinality(p_photo_ids), 0) > 60 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = 'PT422';
  end if;

  return query
    select p.id, p.storage_path
    from public.photos p
    where p.id = any (p_photo_ids)
      and private.photo_visible_to(p.id, (select auth.uid()));
end;
$$;
revoke all on function public.photo_link_paths(uuid[]) from public, anon;
grant execute on function public.photo_link_paths(uuid[]) to authenticated;

-- Reserving an upload slot ---------------------------------------------------------------
-- Creates the photo row and returns the only path the member may upload to. Positions are
-- 1 to 6 and position 1 is the card photo. Reserving a position that holds a photo nobody
-- has screened yet replaces it; any other occupied position must be removed first.
create function public.create_photo_slot(p_position smallint)
returns table (photo_id uuid, storage_path text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if not exists (
    select 1 from public.members m
    where m.id = v_member and m.status in ('pending', 'active') and m.deleted_at is null
  ) then
    raise exception 'NOT_ALLOWED' using errcode = 'PT403';
  end if;
  if p_position is null or p_position not between 1 and 6 then
    raise exception 'INVALID_POSITION' using errcode = 'PT422';
  end if;

  -- One reservation at a time per member, so two taps cannot race for the same slot.
  perform pg_advisory_xact_lock(hashtextextended(v_member::text, 0));

  -- An unscreened upload in this position is replaced.
  update public.photos
     set moderation_status = 'removed'
   where member_id = v_member and position = p_position and moderation_status = 'uploaded';

  if exists (
    select 1 from public.photos
    where member_id = v_member and position = p_position and moderation_status <> 'removed'
  ) then
    raise exception 'POSITION_TAKEN' using errcode = 'PT409';
  end if;

  v_path := v_member::text || '/' || v_id::text || '.jpg';
  insert into public.photos (id, member_id, storage_path, position)
  values (v_id, v_member, v_path, p_position);

  return query select v_id, v_path;
end;
$$;
revoke all on function public.create_photo_slot(smallint) from public, anon;
grant execute on function public.create_photo_slot(smallint) to authenticated;

-- Removing a photo -----------------------------------------------------------------------
-- Marks the caller's photo as removed, which stops new links at once. The files are erased
-- later by the scheduled purge (30 days for removed photos; Security & Access 8.1). A live
-- member cannot drop below two approved photos (FT-028; edge case F13).
create function public.remove_photo(p_photo_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_member uuid := (select auth.uid());
  v_photo public.photos%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_member::text, 0));

  select * into v_photo from public.photos
   where id = p_photo_id and member_id = v_member and moderation_status <> 'removed';
  if not found then
    -- Another member's photo looks the same as a missing one (error G05).
    raise exception 'NOT_AVAILABLE' using errcode = 'PT404';
  end if;

  if v_photo.moderation_status = 'approved'
     and exists (select 1 from public.members m where m.id = v_member and m.status = 'active')
     and (select count(*) from public.photos
           where member_id = v_member and moderation_status = 'approved') <= 2 then
    raise exception 'MIN_PHOTOS' using errcode = 'PT409';
  end if;

  update public.photos set moderation_status = 'removed' where id = p_photo_id;
end;
$$;
revoke all on function public.remove_photo(uuid) from public, anon;
grant execute on function public.remove_photo(uuid) to authenticated;
