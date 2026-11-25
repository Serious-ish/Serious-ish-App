import { AppState } from 'react-native';

// The server's clock, as the app sees it (FT-006; TRD 1 "The clock belongs to the server";
// Security & Access 7.3 N07). Deadlines arrive from the server in UTC. Countdowns are drawn
// with serverNow() and timeLeftMs(), never Date.now(), so changing the phone's clock or time
// zone cannot move them. The server still decides every deadline; a countdown grants nothing.
//
// How it works: elapsed time comes from the phone's monotonic clock (performance.now), which
// does not jump when someone changes the clock. We keep offset = server time - monotonic time.
// Every reply says what the server's time was somewhere between sending the request and
// receiving the reply, which puts the offset inside a window. The estimate stays put while it
// fits each new window and moves the least it must when it does not, so it does not wobble.
//
// The monotonic clock can pause while the phone sleeps, so after the app returns to the
// foreground or a call fails for lack of a connection, the next reply sets the estimate afresh.

const monotonic = () => performance.now();

let offset: number | null = null;
let stale = true;

// The server's time was serverMs (accurate to precisionMs) at some moment between sentAt and
// receivedAt on the monotonic clock.
export function noteServerTime(
  serverMs: number,
  precisionMs: number,
  sentAt: number,
  receivedAt: number,
): void {
  if (!Number.isFinite(serverMs)) return;
  const lowest = serverMs - receivedAt;
  const highest = serverMs + precisionMs - sentAt;
  if (offset === null || stale) {
    offset = (lowest + highest) / 2;
    stale = false;
  } else {
    offset = Math.min(Math.max(offset, lowest), highest);
  }
}

// Every HTTP reply carries a Date header, to the whole second.
export function noteDateHeader(header: string | null, sentAt: number, receivedAt: number): void {
  if (header) noteServerTime(Date.parse(header), 1_000, sentAt, receivedAt);
}

// The connection dropped or the app was in the background: trust the next reply over the
// current estimate.
export function markClockStale(): void {
  stale = true;
}

// Milliseconds since 1970 by the server's clock. Before the first reply it can only be the
// phone's clock, but nothing that counts down is on screen before the server has replied.
export function serverNow(): number {
  return offset === null ? Date.now() : monotonic() + offset;
}

// Milliseconds left until a server deadline (an ISO time from the server), never below zero.
export function timeLeftMs(deadline: string): number {
  return Math.max(0, Date.parse(deadline) - serverNow());
}

// For tests only: forget everything learned so far.
export function resetServerClock(): void {
  offset = null;
  stale = true;
}

// Coming back to the app: the monotonic clock may have paused while the phone slept.
export function onAppStateChange(state: string): void {
  if (state === 'active') markClockStale();
}
AppState.addEventListener('change', onAppStateChange);
