import {
  markClockStale,
  noteDateHeader,
  noteServerTime,
  onAppStateChange,
  resetServerClock,
  serverNow,
  timeLeftMs,
} from './serverClock';

// FT-006 acceptance criteria: changing the phone's clock or time zone does not change any
// countdown; after a reconnect the offset is refreshed from the next reply; a daylight-saving
// change and a phone clock set one day ahead are covered.

const DAY = 24 * 60 * 60 * 1_000;
const SERVER = Date.parse('2026-11-24T20:00:00Z');

let mono = 0; // the phone's monotonic clock, in ms
let phone = SERVER; // the phone's wall clock, in ms

beforeEach(() => {
  resetServerClock();
  mono = 10_000;
  phone = SERVER;
  jest.spyOn(performance, 'now').mockImplementation(() => mono);
  jest.spyOn(Date, 'now').mockImplementation(() => phone);
});
afterEach(() => jest.restoreAllMocks());

// The phone waits `ms` of real time: both of its clocks move together.
const wait = (ms: number) => {
  mono += ms;
  phone += ms;
};

// A reply that took 100 ms round trip, stamped by the server halfway through.
function reply(serverMs: number, header = false) {
  const sentAt = mono;
  wait(100);
  if (header)
    noteDateHeader(
      new Date(Math.floor((serverMs - 50) / 1_000) * 1_000).toUTCString(),
      sentAt,
      mono,
    );
  else noteServerTime(serverMs - 50, 1, sentAt, mono);
}

it('uses the phone clock only until the first reply', () => {
  expect(serverNow()).toBe(phone);
});

it('takes the server time from the first reply', () => {
  phone = SERVER - 5 * 60_000; // the phone runs 5 minutes slow
  reply(SERVER + 100);
  expect(Math.abs(serverNow() - (SERVER + 100))).toBeLessThanOrEqual(50);
});

it('a Date header (whole seconds) is close enough for a countdown', () => {
  reply(SERVER + 100, true);
  expect(Math.abs(serverNow() - (SERVER + 100))).toBeLessThanOrEqual(1_100);
});

it('a phone clock set one day ahead does not change the countdown', () => {
  const deadline = new Date(SERVER + 2 * 60 * 60_000).toISOString(); // 2 hours away
  reply(SERVER + 100);
  const before = timeLeftMs(deadline);
  phone += DAY; // the person moves the clock forward a day
  expect(timeLeftMs(deadline)).toBe(before);
  wait(60_000);
  expect(timeLeftMs(deadline)).toBe(before - 60_000);
});

it('a time-zone change does not change the countdown', () => {
  const deadline = '2026-11-25T20:00:00.000Z';
  reply(SERVER + 100);
  const before = timeLeftMs(deadline);
  // A time-zone change moves the phone's local clock face, not the instant; the same deadline
  // written with another offset is the same instant.
  expect(timeLeftMs('2026-11-25T15:00:00.000-05:00')).toBe(before);
  expect(timeLeftMs('2026-11-26T05:00:00.000+09:00')).toBe(before);
});

it('counts across a daylight-saving change in real hours', () => {
  // Toronto springs forward at 2 a.m. on 14 March 2027 (07:00 UTC): 1:30 a.m. EST to 3:30 a.m.
  // EDT on the wall is only one real hour.
  const spring = Date.parse('2027-03-14T06:30:00Z');
  phone = spring;
  reply(spring + 100);
  expect(Math.round(timeLeftMs('2027-03-14T03:30:00-04:00') / 60_000)).toBe(60);
  // And falls back at 2 a.m. on 7 November 2027: 1:30 EDT to 1:30 EST is a real hour too.
  resetServerClock();
  const autumn = Date.parse('2027-11-07T05:30:00Z');
  phone = autumn;
  reply(autumn + 100);
  expect(Math.round(timeLeftMs('2027-11-07T01:30:00-05:00') / 60_000)).toBe(60);
});

it('never counts below zero', () => {
  reply(SERVER + 100);
  expect(timeLeftMs(new Date(SERVER - 60_000).toISOString())).toBe(0);
});

it('keeps a steady estimate while new replies agree with it', () => {
  reply(SERVER + 100);
  const before = serverNow();
  // A slower reply whose window still contains the estimate leaves it where it is.
  const sentAt = mono;
  wait(400);
  noteServerTime(SERVER + 100 + 150, 1, sentAt, mono);
  expect(serverNow() - before).toBe(400);
});

it('moves the least it must when a reply disagrees', () => {
  reply(SERVER + 100);
  const sentAt = mono;
  wait(100);
  // The server says it is 3 seconds later than we thought.
  noteServerTime(serverNow() + 3_000, 1, sentAt, mono);
  const expected = SERVER + 100 + 100 + 3_000;
  expect(Math.abs(serverNow() - expected)).toBeLessThanOrEqual(1);
});

it('after a reconnect the next reply sets the time afresh', () => {
  reply(SERVER + 100);
  markClockStale();
  // While offline the monotonic clock stood still (the phone slept for an hour).
  phone += 60 * 60_000;
  reply(SERVER + 100 + 100 + 60 * 60_000);
  expect(Math.abs(serverNow() - (SERVER + 200 + 60 * 60_000))).toBeLessThanOrEqual(50);
});

it('returning to the app also refreshes from the next reply', () => {
  reply(SERVER + 100);
  onAppStateChange('background');
  onAppStateChange('active');
  reply(SERVER + 100 + 100 + 30 * 60_000);
  expect(Math.abs(serverNow() - (SERVER + 200 + 30 * 60_000))).toBeLessThanOrEqual(50);
});
