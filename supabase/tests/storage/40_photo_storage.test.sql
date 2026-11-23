-- Private photo storage and photo visibility (FT-007 acceptance criteria; Security & Access
-- 4.9, 5.3; edge cases P13, N17). Upload size, file type and link expiry are enforced by the
-- storage service itself and are tested against it in supabase/tests/storage-api.
begin;
-- Run as the database owner everywhere (hosted projects connect with a separate CLI login role).
set local role postgres;
create extension if not exists pgtap with schema extensions;
-- Find pgTAP wherever it is installed (the CLI uses a different schema on hosted projects).
select set_config('search_path', concat_ws(', ', 'public', 'extensions',
  (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap')), true);

select plan(30);

-- Fixtures: A and B are active, C is pending ------------------------------------------------
insert into auth.users (id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'a@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'b@example.test', now(), now()),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'c@example.test', now(), now());
insert into public.members (id, status) values
  ('00000000-0000-0000-0000-00000000000a', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'pending');

-- B already has two approved photos and one still waiting for screening.
insert into public.photos (id, member_id, storage_path, position, moderation_status) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000b/b1.jpg', 1, 'approved'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000b/b2.jpg', 2, 'approved'),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-00000000000b/b3.jpg', 3, 'uploaded');

-- Acts as a signed-in member until the test switches back to the database owner.
create function pg_temp.act_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_id, 'role', 'authenticated', 'aal', 'aal1')::text, true);
  execute 'set local role authenticated';
end;
$$;

-- Which of B's photos A can get a link for, as a sorted list of photo IDs.
create function pg_temp.links_a_gets() returns uuid[] language plpgsql as $$
declare
  result uuid[];
begin
  perform pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
  select coalesce(array_agg(photo_id order by photo_id), '{}') into result
    from public.photo_link_paths(array[
      '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-0000000000b3']::uuid[]);
  execute 'set local role postgres';
  return result;
end;
$$;

-- Buckets -----------------------------------------------------------------------------------
select is(
  (select array_agg(id || ':' || public::text || ':' || file_size_limit::text || ':' ||
                    array_to_string(allowed_mime_types, ',') order by id)
     from storage.buckets where id in ('photos', 'photos-intake')),
  array['photos:false:1572864:image/jpeg', 'photos-intake:false:1572864:image/jpeg'],
  'both photo buckets are private, JPEG only and capped at 1.5 MB'
);

-- Reserving and uploading ---------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
create temp table slot as select * from public.create_photo_slot(1::smallint);

select ok(
  (select storage_path like '00000000-0000-0000-0000-00000000000a/%.jpg' from slot),
  'a reserved slot is a path inside the member''s own folder'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('photos-intake', %L) $$,
         (select storage_path from slot)),
  'a member can upload to the slot they reserved'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos-intake', '00000000-0000-0000-0000-00000000000b/mine-now.jpg') $$,
  '42501', null,
  'a member cannot upload into another member''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos-intake', '00000000-0000-0000-0000-0000000000b1/b1.jpg') $$,
  '42501', null,
  'a member cannot upload over another member''s photo path'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name)
     values ('photos-intake', '00000000-0000-0000-0000-00000000000a/not-reserved.jpg') $$,
  '42501', null,
  'a member cannot upload to a path they did not reserve'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('photos', %L) $$,
         (select storage_path from slot)),
  '42501', null,
  'a member cannot write to the approved photos bucket'
);
select is(
  (select count(*)::int from storage.objects),
  0,
  'a member cannot read or list any stored file, their own included'
);
select is_empty(
  format($$ update storage.objects set name = name where name = %L returning 1 $$,
         (select storage_path from slot)),
  'a member cannot overwrite an uploaded file'
);
set local role postgres;
-- Storage refuses deletes from SQL altogether, so check the rules instead: the only rule on
-- photo files lets a member upload to a reserved slot. No read, sign, overwrite or delete.
select is(
  (select array_agg(policyname::text || ':' || cmd order by policyname) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%photos%'),
  array['photos_intake_insert_reserved:INSERT'],
  'the only rule on photo files is uploading to a reserved slot'
);
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');

select throws_ok(
  $$ select * from public.create_photo_slot(7::smallint) $$,
  'PT422', 'INVALID_POSITION',
  'positions are 1 to 6'
);
select lives_ok(
  $$ select * from public.create_photo_slot(1::smallint) $$,
  'reserving a position again replaces an upload nobody has screened yet'
);
set local role postgres;
select is(
  (select count(*)::int from public.photos
    where member_id = '00000000-0000-0000-0000-00000000000a' and moderation_status <> 'removed'),
  1,
  'the replaced upload no longer counts as a current photo'
);

-- C is pending: may reserve and upload, but sees nobody else's photos.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c');
select lives_ok(
  $$ select * from public.create_photo_slot(1::smallint) $$,
  'a pending member can reserve a slot during profile setup'
);
select is(
  (select count(*)::int from public.photo_link_paths(array['00000000-0000-0000-0000-0000000000b1']::uuid[])),
  0,
  'a pending member cannot get a link to anyone else''s photo'
);
set local role postgres;

-- B as owner: only approved photos, even their own.
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select is(
  (select array_agg(photo_id order by photo_id) from public.photo_link_paths(array[
     '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b3']::uuid[])),
  array['00000000-0000-0000-0000-0000000000b1']::uuid[],
  'an owner gets a link to their approved photo but not to their unscreened one'
);
set local role postgres;

-- Who can see B's photos ----------------------------------------------------------------------
select is(
  pg_temp.links_a_gets(),
  array['00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2']::uuid[],
  'an active member gets links to another active member''s approved photos only'
);

update public.photos set moderation_status = 'rejected' where id = '00000000-0000-0000-0000-0000000000b2';
select is(
  pg_temp.links_a_gets(),
  array['00000000-0000-0000-0000-0000000000b1']::uuid[],
  'a rejected photo gets no link'
);
update public.photos set moderation_status = 'approved' where id = '00000000-0000-0000-0000-0000000000b2';

insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links after the owner blocks the viewer');
delete from public.blocks;

insert into public.blocks (blocker_id, blocked_id)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links after the viewer blocks the owner');
delete from public.blocks;

insert into public.matches (member_low_id, member_high_id, window_hours, expires_at, status)
values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
        24, now() + interval '24 hours', 'unmatched');
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links after an unmatch');
delete from public.matches;

update public.members set deleted_at = now() where id = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links once the owner starts deleting their account');
update public.members set deleted_at = null where id = '00000000-0000-0000-0000-00000000000b';

update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000b';
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links to a suspended member''s photos');
update public.members set status = 'active' where id = '00000000-0000-0000-0000-00000000000b';

insert into public.reports (id, reporter_id, reported_member_id, reason, sla_due_at)
values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000000a',
        '00000000-0000-0000-0000-00000000000b', 'threat', now() + interval '24 hours');
insert into public.member_holds (member_id, report_id, reason, status)
values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000e1', 'threat', 'active');
select is(pg_temp.links_a_gets(), '{}'::uuid[], 'no links while the owner is on hold');
delete from public.member_holds;

select is(
  pg_temp.links_a_gets(),
  array['00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2']::uuid[],
  'links come back once nothing stands in the way'
);

-- Removing photos -----------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  $$ select public.remove_photo('00000000-0000-0000-0000-0000000000b3') $$,
  'PT404', 'NOT_AVAILABLE',
  'a member cannot remove another member''s photo, and cannot tell it exists'
);
set local role postgres;

select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  $$ select public.remove_photo('00000000-0000-0000-0000-0000000000b1') $$,
  'PT409', 'MIN_PHOTOS',
  'a live member cannot drop below two approved photos'
);
select lives_ok(
  $$ select public.remove_photo('00000000-0000-0000-0000-0000000000b3') $$,
  'an owner can remove their unscreened photo'
);
set local role postgres;

update public.photos set moderation_status = 'approved' where id = '00000000-0000-0000-0000-0000000000b3';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b');
select lives_ok(
  $$ select public.remove_photo('00000000-0000-0000-0000-0000000000b1') $$,
  'an owner with more than two approved photos can remove one'
);
set local role postgres;
select is(
  pg_temp.links_a_gets(),
  array['00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3']::uuid[],
  'a removed photo gets no new links; the remaining approved ones still do'
);

select * from finish();
rollback;
