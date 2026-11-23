// Photo storage, tested against the real local storage service (FT-007 acceptance criteria).
// The access rules themselves are tested in SQL (supabase/tests/storage); these tests cover
// what only the storage service enforces: file size, file type, link expiry and the
// location-stripping step, plus the photo-links Edge Function when it is being served.
//
// Run with `pnpm db:test:storage` while the local stack is running (`pnpm db:start`).

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { NotAJpegError, stripJpegMetadata } from '../../functions/_shared/jpeg-metadata.ts';

// Local keys come from the running stack, never from a file.
const local = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json', '--agent', 'no'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
) as Record<string, string>;
const API_URL = local.API_URL!;
const PUBLISHABLE_KEY = local.PUBLISHABLE_KEY ?? local.ANON_KEY!;
const SECRET_KEY = local.SECRET_KEY ?? local.SERVICE_ROLE_KEY!;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const server = createClient(API_URL, SECRET_KEY, options);

// A small JPEG: start of image, JFIF header, an Exif block holding GPS data, a comment,
// then a stand-in for the image data and the end marker.
function segment(marker: number, payload: Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return Uint8Array.from([0xff, marker, length >> 8, length & 0xff, ...payload]);
}
const text = (value: string) => new TextEncoder().encode(value);
const JFIF = segment(0xe0, Uint8Array.from([...text('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
const EXIF_WITH_GPS = segment(0xe1, text('Exif\0\0GPSLatitude 43.6532 GPSLongitude -79.3832'));
const COMMENT = segment(0xfe, text('Taken at 12 Example Street'));
const IMAGE = Uint8Array.from([
  0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9,
]);
const photoWithLocation = Uint8Array.from([
  0xff,
  0xd8,
  ...JFIF,
  ...EXIF_WITH_GPS,
  ...COMMENT,
  ...IMAGE,
]);

const contains = (haystack: Uint8Array, needle: string) =>
  Buffer.from(haystack).includes(Buffer.from(needle));

type Member = { id: string; client: SupabaseClient; token: string };

async function newMember(status: 'pending' | 'active'): Promise<Member> {
  const email = `photo-test-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data: created, error } = await server.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !created.user) throw error ?? new Error('user not created');
  const { error: memberError } = await server
    .from('members')
    .insert({ id: created.user.id, status });
  if (memberError) throw memberError;

  const client = createClient(API_URL, PUBLISHABLE_KEY, options);
  const { data: session, error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError || !session.session) throw signInError ?? new Error('not signed in');
  return { id: created.user.id, client, token: session.session.access_token };
}

async function reserve(member: Member, position: number) {
  const { data, error } = await member.client.rpc('create_photo_slot', { p_position: position });
  if (error) throw error;
  return (data as { photo_id: string; storage_path: string }[])[0]!;
}

// Stands in for photo screening (FT-023): strip, copy to the approved bucket, approve.
async function approve(slot: { photo_id: string; storage_path: string }) {
  const { data: original, error } = await server.storage
    .from('photos-intake')
    .download(slot.storage_path);
  if (error) throw error;
  const stripped = stripJpegMetadata(new Uint8Array(await original.arrayBuffer()));
  const { error: uploadError } = await server.storage
    .from('photos')
    .upload(slot.storage_path, stripped, { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;
  const { error: updateError } = await server
    .from('photos')
    .update({ moderation_status: 'approved' })
    .eq('id', slot.photo_id);
  if (updateError) throw updateError;
}

describe('location data', () => {
  it('removes Exif, GPS and comments and keeps the image data', () => {
    const stripped = stripJpegMetadata(photoWithLocation);
    assert.ok(contains(photoWithLocation, 'GPSLatitude'), 'the test photo carries a location');
    assert.ok(!contains(stripped, 'GPS'), 'no GPS data left');
    assert.ok(!contains(stripped, 'Exif'), 'no Exif block left');
    assert.ok(!contains(stripped, 'Example Street'), 'no comment left');
    assert.ok(contains(stripped, 'JFIF'), 'the JFIF header is kept');
    assert.deepEqual([...stripped.subarray(0, 2)], [0xff, 0xd8], 'still starts as a JPEG');
    assert.deepEqual([...stripped.subarray(-IMAGE.length)], [...IMAGE], 'image data unchanged');
  });

  it('leaves a photo with no metadata unchanged', () => {
    const clean = Uint8Array.from([0xff, 0xd8, ...JFIF, ...IMAGE]);
    assert.deepEqual([...stripJpegMetadata(clean)], [...clean]);
  });

  it('refuses a file that is not a JPEG', () => {
    assert.throws(() => stripJpegMetadata(text('\x89PNG\r\n')), NotAJpegError);
  });
});

describe('private photo storage', () => {
  let owner: Member;
  let viewer: Member;

  before(async () => {
    owner = await newMember('active');
    viewer = await newMember('active');
  });

  after(async () => {
    await owner.client.auth.signOut();
    await viewer.client.auth.signOut();
  });

  it('accepts a JPEG under 1.5 MB in a reserved slot', async () => {
    const slot = await reserve(owner, 1);
    const { error } = await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, photoWithLocation, { contentType: 'image/jpeg' });
    assert.equal(error, null);
  });

  it('refuses a file over 1.5 MB', async () => {
    const slot = await reserve(owner, 2);
    const oversize = new Uint8Array(1572864 + 1);
    oversize.set([0xff, 0xd8]);
    const { error } = await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, oversize, { contentType: 'image/jpeg' });
    assert.ok(error, 'oversize upload refused');
  });

  it('refuses a file that is not a JPEG', async () => {
    const slot = await reserve(owner, 3);
    const { error } = await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, text('\x89PNG\r\n'), { contentType: 'image/png' });
    assert.ok(error, 'PNG refused');
  });

  it("refuses an upload into another member's folder", async () => {
    const { error } = await viewer.client.storage
      .from('photos-intake')
      .upload(`${owner.id}/${randomUUID()}.jpg`, photoWithLocation, { contentType: 'image/jpeg' });
    assert.ok(error, 'upload into another folder refused');
  });

  it('does not let a member read or sign files, even their own', async () => {
    const slot = await reserve(owner, 4);
    await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, photoWithLocation, { contentType: 'image/jpeg' });
    const download = await owner.client.storage.from('photos-intake').download(slot.storage_path);
    assert.ok(download.error, 'download refused');
    const sign = await owner.client.storage
      .from('photos-intake')
      .createSignedUrl(slot.storage_path, 60);
    assert.ok(sign.error, 'signing refused');
  });

  it('stores the approved copy without location data', async () => {
    const slot = await reserve(owner, 5);
    await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, photoWithLocation, { contentType: 'image/jpeg' });
    await approve(slot);
    const { data, error } = await server.storage.from('photos').download(slot.storage_path);
    assert.equal(error, null);
    const stored = new Uint8Array(await data!.arrayBuffer());
    assert.ok(!contains(stored, 'GPS'), 'the approved copy has no GPS data');
  });

  it('makes links that stop working once they expire', async () => {
    const slot = await reserve(owner, 6);
    await owner.client.storage
      .from('photos-intake')
      .upload(slot.storage_path, photoWithLocation, { contentType: 'image/jpeg' });
    await approve(slot);
    const { data, error } = await server.storage
      .from('photos')
      .createSignedUrl(slot.storage_path, 1);
    assert.equal(error, null);
    assert.equal((await fetch(data!.signedUrl)).status, 200, 'link works before it expires');
    await new Promise((resolve) => setTimeout(resolve, 2500));
    assert.notEqual((await fetch(data!.signedUrl)).status, 200, 'link refused after it expires');
  });

  // Runs when the Edge Functions are being served (`pnpm exec supabase functions serve`).
  it('photo-links gives a member 10-minute links to approved photos only', async (t) => {
    const probe = await fetch(`${API_URL}/functions/v1/photo-links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${viewer.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_ids: [randomUUID()] }),
    }).catch(() => null);
    if (!probe || probe.status === 404 || probe.status === 503) {
      t.skip('Edge Functions are not being served');
      return;
    }

    const { data: photos } = await server
      .from('photos')
      .select('id, moderation_status')
      .eq('member_id', owner.id)
      .neq('moderation_status', 'removed');
    const approved = photos!.filter((p) => p.moderation_status === 'approved').map((p) => p.id);
    const unscreened = photos!.filter((p) => p.moderation_status === 'uploaded').map((p) => p.id);
    assert.ok(approved.length > 0 && unscreened.length > 0);

    const call = (member: Member) =>
      fetch(`${API_URL}/functions/v1/photo-links`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${member.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_ids: [...approved, ...unscreened] }),
      }).then((r) => r.json() as Promise<{ links: { photo_id: string; expires_at: string }[] }>);

    const { links } = await call(viewer);
    assert.deepEqual(links.map((l) => l.photo_id).sort(), [...approved].sort());
    const life = (Date.parse(links[0]!.expires_at) - Date.now()) / 1000;
    assert.ok(life > 590 && life <= 600, 'links last 10 minutes');

    // After a block, no new links.
    await server.from('blocks').insert({ blocker_id: owner.id, blocked_id: viewer.id });
    assert.deepEqual((await call(viewer)).links, []);
  });
});
