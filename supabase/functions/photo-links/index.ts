// photo-links: short-lived display links for approved photos (FT-007; Frontend Specification
// 9.5; Security & Access 4.9, 5.3).
//
// POST { photo_ids: uuid[] } with the member's access token.
// 200  { links: [{ photo_id, url, expires_at }] }
//
// The database decides which photos the caller may see (public.photo_link_paths, run as the
// caller), so the rule lives in one tested place. This function only signs the paths it is
// given back, from the approved photos bucket, for 10 minutes. A photo the caller may not
// see is simply left out: blocked, missing and hidden look the same (error G05).
// Nothing about the photos, paths or links is logged.

import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const LINK_SECONDS = 600;
const MAX_PHOTOS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const url = required('SUPABASE_URL');
const publishableKey = required('SUPABASE_ANON_KEY');
const secretKey = required('SUPABASE_SERVICE_ROLE_KEY');

// Signs links only. It never reads tables, so it cannot widen what the caller may see.
const signer = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply(405, { code: 'METHOD_NOT_ALLOWED' });

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reply(401, { code: 'NOT_ALLOWED' });

  let photoIds: unknown;
  try {
    photoIds = (await req.json())?.photo_ids;
  } catch {
    return reply(422, { code: 'INVALID_REQUEST' });
  }
  if (
    !Array.isArray(photoIds) ||
    photoIds.length === 0 ||
    photoIds.length > MAX_PHOTOS ||
    !photoIds.every((id) => typeof id === 'string' && UUID.test(id))
  ) {
    return reply(422, { code: 'INVALID_REQUEST' });
  }

  // Ask the database as the caller which of these photos they may see.
  const asCaller = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error } = await asCaller.rpc('photo_link_paths', {
    p_photo_ids: photoIds,
  });
  if (error) {
    const status = error.code === 'PT401' || error.code === 'PGRST301' ? 401 : 500;
    console.error('photo-links: permission check failed', { status, code: error.code });
    return reply(status, { code: status === 401 ? 'NOT_ALLOWED' : 'SERVER_ERROR' });
  }

  const rows = (allowed ?? []) as { photo_id: string; storage_path: string }[];
  if (rows.length === 0) return reply(200, { links: [] });

  const expiresAt = new Date(Date.now() + LINK_SECONDS * 1000).toISOString();
  const { data: signed, error: signError } = await signer.storage.from('photos').createSignedUrls(
    rows.map((row) => row.storage_path),
    LINK_SECONDS,
  );
  if (signError) {
    console.error('photo-links: signing failed');
    return reply(500, { code: 'SERVER_ERROR' });
  }

  // A photo approved in the database but not yet copied to the photos bucket gets no link.
  const links = rows.flatMap((row, i) => {
    const entry = signed?.[i];
    return entry && !entry.error && entry.signedUrl
      ? [{ photo_id: row.photo_id, url: entry.signedUrl, expires_at: expiresAt }]
      : [];
  });
  return reply(200, { links });
});

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment value ${name}`);
  return value;
}
