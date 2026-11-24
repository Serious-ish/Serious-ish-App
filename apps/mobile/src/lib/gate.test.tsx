import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
  ageStatuses,
  decide,
  memberStatuses,
  routeFor,
  useGate,
  type Group,
  type Member,
  type Place,
} from './gate';
import { openConfig } from './remoteConfig';
import { useSession } from './session';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn(), init: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.2.0' } }));
jest.mock('./session', () => ({ useSession: jest.fn() }));

// Frontend Specification 7.1 and 7.2: every status lands on exactly one place.

const member = (over: Partial<Member> = {}): Member => ({
  status: 'active',
  ageCheck: 'passed',
  onboardingStep: 11,
  ...over,
});

describe('decide', () => {
  it.each<[string, Member | null, Place]>([
    ['no session', null, { to: 'welcome' }],
    ['active', member(), { to: 'tabs', paused: false }],
    ['paused', member({ status: 'paused' }), { to: 'tabs', paused: true }],
    ['held', member({ status: 'held' }), { to: 'hold' }],
    ['suspended', member({ status: 'suspended' }), { to: 'restricted' }],
    ['deleted', member({ status: 'deleted' }), { to: 'deleted' }],
    [
      'pending, no profile yet',
      member({ status: 'pending', onboardingStep: null }),
      { to: 'details' },
    ],
    [
      'pending, no steps done',
      member({ status: 'pending', onboardingStep: 0 }),
      { to: 'profile-step', step: 1 },
    ],
    [
      'pending, 4 steps done',
      member({ status: 'pending', onboardingStep: 4 }),
      { to: 'profile-step', step: 5 },
    ],
    [
      'pending, age check not started',
      member({ status: 'pending', ageCheck: 'not_started' }),
      { to: 'age-check' },
    ],
    [
      'pending, age check running',
      member({ status: 'pending', ageCheck: 'pending' }),
      { to: 'review' },
    ],
    [
      'pending, age check in review',
      member({ status: 'pending', ageCheck: 'review' }),
      { to: 'review' },
    ],
    [
      'pending, age check passed',
      member({ status: 'pending', ageCheck: 'passed' }),
      { to: 'go-live' },
    ],
    [
      'pending, under 18',
      member({ status: 'pending', ageCheck: 'blocked' }),
      { to: 'age-blocked' },
    ],
  ])('%s', (_, who, place) => {
    expect(decide(openConfig, who)).toEqual(place);
  });

  it('shows Update required before anything else when the app is too old', () => {
    for (const who of [null, member(), member({ status: 'held' })]) {
      expect(decide({ minAppVersion: '1.3.0', maintenance: true }, who)).toEqual({
        to: 'update-required',
      });
    }
    expect(decide({ minAppVersion: '1.2.0', maintenance: false }, member())).toEqual({
      to: 'tabs',
      paused: false,
    });
  });

  it('shows Maintenance before any member screen', () => {
    for (const who of [null, member(), member({ status: 'pending', onboardingStep: 2 })]) {
      expect(decide({ minAppVersion: null, maintenance: true }, who)).toEqual({
        to: 'maintenance',
      });
    }
  });
});

describe('one place at a time', () => {
  const groups: Group[] = [
    'update-required',
    'maintenance',
    'unavailable',
    'auth',
    'onboarding',
    'tabs',
    'hold',
    'restricted',
    'deleted',
    'age-blocked',
  ];
  const everyPlace = [
    null,
    ...memberStatuses.flatMap((status) =>
      ageStatuses.flatMap((ageCheck) =>
        [null, 0, 6, 11].map((onboardingStep) => ({ status, ageCheck, onboardingStep })),
      ),
    ),
  ].map((who) => decide(openConfig, who));

  it('opens exactly one group of screens, and lands on a screen in it', () => {
    for (const place of everyPlace) {
      const { group, href } = routeFor(place);
      expect(groups.filter((g) => g === group)).toHaveLength(1);
      expect(href).toMatch(/^\//);
    }
  });

  it('keeps the tabs closed for every blocking status, so a deep link to a tab is refused', () => {
    for (const status of ['held', 'suspended', 'deleted', 'pending'] as const) {
      expect(routeFor(decide(openConfig, member({ status }))).group).not.toBe('tabs');
    }
  });
});

describe('useGate reads the status from the server only', () => {
  type Reply = { status: number; body: unknown };
  const replies: Record<string, Reply> = {};
  // A fresh cache per test, cleared afterwards so no cache timer outlives the test.
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  afterEach(() => client.clear());

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    globalThis.fetch = jest.fn(async (url: string) => {
      const table = Object.keys(replies).find((t) => url.includes(`/rest/v1/${t}?`))!;
      const { status, body } = replies[table]!;
      return {
        ok: status < 300,
        status,
        headers: { get: () => null, has: () => false },
        json: async () => body,
      };
    }) as never;
    replies.members = { status: 200, body: [{ status: 'active', age_check_status: 'passed' }] };
    replies.profiles = { status: 200, body: [{ onboarding_step: 11 }] };
    replies.app_config = { status: 200, body: [{ key: 'maintenance_mode', value_json: false }] };
  });

  it('is not ready (the splash stays) until the first session check is done', async () => {
    jest.mocked(useSession).mockReturnValue({ ready: false, userId: null });
    const { result } = await renderHook(useGate, { wrapper });
    expect(result.current.ready).toBe(false);
  });

  it('signed out: Welcome, without reading anything', async () => {
    jest.mocked(useSession).mockReturnValue({ ready: true, userId: null });
    const { result } = await renderHook(useGate, { wrapper });
    expect(result.current).toEqual({ ready: true, place: { to: 'welcome' } });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('a member the server holds lands on the hold notice, whatever the phone believed', async () => {
    jest.mocked(useSession).mockReturnValue({ ready: true, userId: 'member-1' });
    replies.members = { status: 200, body: [{ status: 'held', age_check_status: 'passed' }] };
    const { result } = await renderHook(useGate, { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.place).toEqual({ to: 'hold' });
  });

  it('a pending member reopens on the next unfinished step', async () => {
    jest.mocked(useSession).mockReturnValue({ ready: true, userId: 'member-1' });
    replies.members = {
      status: 200,
      body: [{ status: 'pending', age_check_status: 'not_started' }],
    };
    replies.profiles = { status: 200, body: [{ onboarding_step: 6 }] };
    const { result } = await renderHook(useGate, { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.place).toEqual({ to: 'profile-step', step: 7 });
  });

  it('reads maintenance mode from remote config', async () => {
    jest.mocked(useSession).mockReturnValue({ ready: true, userId: 'member-1' });
    replies.app_config = { status: 200, body: [{ key: 'maintenance_mode', value_json: true }] };
    const { result } = await renderHook(useGate, { wrapper });
    await waitFor(() => expect(result.current.place).toEqual({ to: 'maintenance' }));
  });

  it('when the status cannot be read, says so instead of guessing', async () => {
    jest.useFakeTimers();
    jest.mocked(useSession).mockReturnValue({ ready: true, userId: 'member-1' });
    replies.members = { status: 503, body: null };
    const { result } = await renderHook(useGate, { wrapper });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(result.current.place).toMatchObject({ to: 'unavailable', error: { status: 503 } });
    jest.useRealTimers();
  });
});
