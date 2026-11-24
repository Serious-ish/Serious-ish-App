import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import { ApiError, appVersion, read } from './api';
import {
  CONFIG_REFRESH_MS,
  isBelowMinimum,
  openConfig,
  readConfig,
  type RemoteConfig,
} from './remoteConfig';
import { useSession } from './session';

// The status gate (Frontend Specification 7.1 and 7.2): from the server's status, exactly one place.
// It runs on the phone for speed; the server repeats the check on every request (row-level
// security), so a tampered phone gains nothing.

export const memberStatuses = [
  'pending',
  'active',
  'paused',
  'held',
  'suspended',
  'deleted',
] as const;
export const ageStatuses = ['not_started', 'pending', 'review', 'passed', 'blocked'] as const;
export type MemberStatus = (typeof memberStatuses)[number];
export type AgeStatus = (typeof ageStatuses)[number];

// The member's own state. onboardingStep is the number of the 11 profile steps finished; null when
// there is no profile yet (the sign-up details are not finished).
export type Member = { status: MemberStatus; ageCheck: AgeStatus; onboardingStep: number | null };

export const PROFILE_STEPS = 11;

export type Place =
  | { to: 'update-required' }
  | { to: 'maintenance' }
  | { to: 'unavailable'; error: ApiError }
  | { to: 'welcome' }
  | { to: 'details' }
  | { to: 'profile-step'; step: number }
  | { to: 'age-check' }
  | { to: 'review' }
  | { to: 'go-live' }
  | { to: 'age-blocked' }
  | { to: 'tabs'; paused: boolean }
  | { to: 'hold' }
  | { to: 'restricted' }
  | { to: 'deleted' };

export function decide(config: RemoteConfig, member: Member | null): Place {
  // System screens come before any other (7.1).
  if (isBelowMinimum(appVersion, config.minAppVersion)) return { to: 'update-required' };
  if (config.maintenance) return { to: 'maintenance' };
  if (!member) return { to: 'welcome' };

  switch (member.status) {
    case 'active':
      return { to: 'tabs', paused: false };
    case 'paused':
      return { to: 'tabs', paused: true };
    case 'held':
      return { to: 'hold' };
    case 'suspended':
      return { to: 'restricted' };
    case 'deleted':
      return { to: 'deleted' };
    case 'pending':
      return pendingPlace(member);
  }
}

// A pending member reopens on the first unfinished step: sign-up details, the 11 profile steps,
// the age check, then Review pending or Go live (7.6).
function pendingPlace({ onboardingStep, ageCheck }: Member): Place {
  if (onboardingStep === null) return { to: 'details' };
  if (onboardingStep < PROFILE_STEPS) return { to: 'profile-step', step: onboardingStep + 1 };
  switch (ageCheck) {
    case 'not_started':
      return { to: 'age-check' };
    case 'pending':
    case 'review':
      return { to: 'review' };
    case 'passed':
      return { to: 'go-live' };
    case 'blocked':
      return { to: 'age-blocked' };
  }
}

// The route group each place opens and the screen it lands on. The root layout opens only the
// group of the current place, so every other screen (a deep link to a tab, say) is closed.
export type Group =
  | 'update-required'
  | 'maintenance'
  | 'unavailable'
  | 'auth'
  | 'onboarding'
  | 'tabs'
  | 'hold'
  | 'restricted'
  | 'deleted'
  | 'age-blocked';

export function routeFor(place: Place): { group: Group; href: string } {
  switch (place.to) {
    case 'update-required':
    case 'maintenance':
    case 'unavailable':
      return { group: place.to, href: `/${place.to}` };
    case 'welcome':
      return { group: 'auth', href: '/welcome' };
    case 'details':
    case 'age-check':
    case 'review':
    case 'go-live':
      return { group: 'onboarding', href: `/${place.to}` };
    case 'profile-step':
      return { group: 'onboarding', href: `/profile/${place.step}` };
    case 'tabs':
      return { group: 'tabs', href: '/home' };
    case 'hold':
      return { group: 'hold', href: '/hold-notice' };
    case 'restricted':
    case 'deleted':
    case 'age-blocked':
      return { group: place.to, href: `/${place.to}` };
  }
}

const memberRows = z
  .array(z.object({ status: z.enum(memberStatuses), age_check_status: z.enum(ageStatuses) }))
  .length(1);
const profileRows = z.array(z.object({ onboarding_step: z.number().int() })).max(1);

// The member's own rows only: row-level security returns nothing else (9.4).
async function readMember(): Promise<Member> {
  const [[member], [profile]] = await Promise.all([
    read('members', 'select=status,age_check_status', memberRows),
    read('profiles', 'select=onboarding_step', profileRows),
  ]);
  return {
    status: member!.status,
    ageCheck: member!.age_check_status,
    onboardingStep: profile?.onboarding_step ?? null,
  };
}

export const gateKeys = { config: ['app_config'], member: ['gate'] } as const;

export type Gate = { ready: boolean; place: Place };

// Read at launch, whenever the session changes and whenever the app comes back to the front.
// Config is read again every 10 minutes.
export function useGate(): Gate {
  const session = useSession();
  const signedIn = session.userId !== null;
  const config = useQuery({
    queryKey: [...gateKeys.config, session.userId],
    queryFn: readConfig,
    enabled: signedIn,
    refetchInterval: CONFIG_REFRESH_MS,
  });
  const member = useQuery({
    queryKey: [...gateKeys.member, session.userId],
    queryFn: readMember,
    enabled: signedIn,
    refetchOnWindowFocus: 'always',
  });
  const preview = usePreview();

  if (__DEV__ && preview) return { ready: true, place: preview };
  if (!session.ready) return { ready: false, place: { to: 'welcome' } };
  if (!signedIn) return { ready: true, place: decide(openConfig, null) };
  if (member.error) {
    const error = member.error instanceof ApiError ? member.error : new ApiError('', null);
    return { ready: true, place: { to: 'unavailable', error } };
  }
  if (!member.data) return { ready: false, place: { to: 'welcome' } };
  return { ready: true, place: decide(config.data ?? openConfig, member.data) };
}

// Development builds only: the gallery can preview any place without a server.
let preview: Place | null = null;
const listeners = new Set<() => void>();
export function setGatePreview(next: Place | null) {
  preview = next;
  listeners.forEach((listener) => listener());
}
function usePreview() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => preview,
  );
}
