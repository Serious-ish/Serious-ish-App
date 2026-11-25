// Retry-safe requests under real concurrency (FT-006; Security & Access 7.3 N01, N04, N05).
// A double tap or a retry after a timeout can reach the database while the first copy is
// still running. That needs two connections, so it is tested here rather than in pgTAP
// (supabase/tests/timing covers the single-connection cases and the limit periods).
//
// The stand-in swipe function follows the pattern record_swipe (FT-030) and send_message
// (FT-042) will use: private.lock_request, then return the stored result for a repeat,
// otherwise charge one like and store the swipe.
//
// Run with `pnpm db:test:api` while the local stack is running (`pnpm db:start`).

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import postgres from 'postgres';

const local = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json', '--agent', 'no'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
) as Record<string, string>;

const SCHEMA = `request_test_${randomUUID().replaceAll('-', '')}`;
const db = postgres(local.DB_URL!, { max: 12, onnotice: () => {} });
const a = randomUUID();
const b = randomUUID();
const c = randomUUID();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function swipe(
  sql: postgres.Sql | postgres.TransactionSql,
  target: string,
  requestId: string,
) {
  const [row] = await sql`select ${sql(SCHEMA)}.swipe(${a}, ${target}, ${requestId}) as id`;
  return row!.id as string;
}

async function stored(requestId: string) {
  const [row] = await db`
    select (select count(*)::int from public.swipes
             where swiper_id = ${a} and client_request_id = ${requestId}) as swipes,
           (select coalesce(sum(used), 0)::int from public.usage_counters
             where member_id = ${a} and kind = 'like') as likes`;
  return row as { swipes: number; likes: number };
}

describe('retry-safe requests', () => {
  before(async () => {
    for (const id of [a, b, c]) {
      await db`insert into auth.users (id, aud, role, email, created_at, updated_at)
               values (${id}, 'authenticated', 'authenticated', ${`request-test-${id}@example.test`}, now(), now())`;
      await db`insert into public.members (id, status) values (${id}, 'active')`;
    }
    await db.unsafe(`
      create schema ${SCHEMA};
      create function ${SCHEMA}.swipe(p_member uuid, p_target uuid, p_request uuid) returns uuid
      language plpgsql as $$
      declare
        v_id uuid;
      begin
        perform private.lock_request(p_member, p_request);
        select id into v_id from public.swipes
          where swiper_id = p_member and client_request_id = p_request;
        if found then
          return v_id;
        end if;
        insert into public.usage_counters (member_id, kind, period_start, used)
          select p_member, 'like', period_start, 1 from private.quota_period('like', now())
          on conflict (member_id, kind, period_start)
            do update set used = public.usage_counters.used + 1;
        -- A pause wide enough for the other copies to arrive while this one is running.
        perform pg_sleep(0.2);
        insert into public.swipes (swiper_id, target_id, action, client_request_id)
          values (p_member, p_target, 'like', p_request)
          returning id into v_id;
        return v_id;
      end;
      $$;`);
  });

  after(async () => {
    try {
      await db.unsafe(`drop schema if exists ${SCHEMA} cascade`);
      // Swipes and usage counters go with the members.
      await db`delete from public.members where id in (${a}, ${b}, ${c})`;
      await db`delete from auth.users where id in (${a}, ${b}, ${c})`;
    } finally {
      await db.end();
    }
  });

  it('a copy that arrives while the first is still running waits, then gets the same swipe', async () => {
    const requestId = randomUUID();
    let second: Promise<string> | undefined;
    const first = await db.begin(async (tx) => {
      const id = await swipe(tx, b, requestId);
      // The first copy has not committed yet; the second must wait for it, not act on its own.
      second = swipe(db, b, requestId);
      const state = await Promise.race([
        second.then(() => 'finished'),
        sleep(500).then(() => 'waiting'),
      ]);
      assert.equal(state, 'waiting');
      return id;
    });
    assert.equal(await second, first);
    assert.deepEqual(await stored(requestId), { swipes: 1, likes: 1 });
  });

  it('ten copies of one tap at the same moment make one swipe and use one like', async () => {
    const requestId = randomUUID();
    const before = (await stored(requestId)).likes;
    const ids = await Promise.all(Array.from({ length: 10 }, () => swipe(db, c, requestId)));
    assert.equal(new Set(ids).size, 1);
    const after = await stored(requestId);
    assert.equal(after.swipes, 1);
    assert.equal(after.likes - before, 1);
  });
});
