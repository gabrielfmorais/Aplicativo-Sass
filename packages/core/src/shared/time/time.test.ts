import { fixedClock, todayFor } from './clock.ts';
import { instantFromEpochMs, instantFromString, isInstant } from './instant.ts';
import {
  addDays,
  compareLocalDates,
  diffDays,
  isLocalDate,
  isValidTimeZone,
  localDateFromString,
  toLocalDate,
} from './local-date.ts';
import { systemClock } from './system-clock.ts';

describe('Instant', () => {
  it('validates ISO UTC strings', () => {
    expect(isInstant('2026-08-26T23:30:00Z')).toBe(true);
    expect(isInstant('2026-08-26T23:30:00.123Z')).toBe(true);
    expect(isInstant('2026-08-26T23:30:00-03:00')).toBe(false);
    expect(isInstant('2026-08-26')).toBe(false);
    expect(() => instantFromString('nope')).toThrow(TypeError);
    expect(instantFromEpochMs(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('LocalDate', () => {
  it('validates civil dates strictly', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2024-02-29')).toBe(true);
    expect(isLocalDate('26/08/2026')).toBe(false);
    expect(() => localDateFromString('2026-13-01')).toThrow(TypeError);
  });

  it('adds and diffs whole days without timezone drift', () => {
    const d = localDateFromString('2026-08-26');
    expect(addDays(d, 1)).toBe('2026-08-27');
    expect(addDays(d, -26)).toBe('2026-07-31');
    expect(addDays(d, 365)).toBe('2027-08-26');
    expect(diffDays(d, addDays(d, 56))).toBe(56);
    expect(diffDays(addDays(d, 3), d)).toBe(-3);
    expect(compareLocalDates(d, addDays(d, 1))).toBe(-1);
    expect(compareLocalDates(d, d)).toBe(0);
  });
});

describe('toLocalDate (ADR-008: the user day is the civil date in the profile timezone)', () => {
  it('turns the day over at the local midnight, not UTC', () => {
    // 23:30 in São Paulo (UTC-3) on Aug 26 is 02:30Z on Aug 27.
    const late = instantFromString('2026-08-27T02:30:00Z');
    expect(toLocalDate(late, 'America/Sao_Paulo')).toBe('2026-08-26');
    expect(toLocalDate(late, 'UTC')).toBe('2026-08-27');
    // Positive offset: Tokyo is already Aug 27 at 16:00Z of Aug 26.
    expect(toLocalDate(instantFromString('2026-08-26T16:00:00Z'), 'Asia/Tokyo')).toBe('2026-08-27');
    // Manaus (UTC-4) vs São Paulo (UTC-3) around midnight.
    const edge = instantFromString('2026-08-27T03:30:00Z');
    expect(toLocalDate(edge, 'America/Sao_Paulo')).toBe('2026-08-27');
    expect(toLocalDate(edge, 'America/Manaus')).toBe('2026-08-26');
  });

  it('respects historical DST (Brazil observed DST until 2019)', () => {
    // Dec 2018: São Paulo was on DST (UTC-2) => 02:30Z is 00:30 local on Dec 15.
    expect(toLocalDate(instantFromString('2018-12-15T02:30:00Z'), 'America/Sao_Paulo')).toBe('2018-12-15');
    // Dec 2020: no DST (UTC-3) => the same wall-clock instant is still 23:30 on Dec 14.
    expect(toLocalDate(instantFromString('2020-12-15T02:30:00Z'), 'America/Sao_Paulo')).toBe('2020-12-14');
    // The 2018 transition itself: DST started 2018-11-04 at 00:00 local (= 03:00Z).
    expect(toLocalDate(instantFromString('2018-11-04T02:59:00Z'), 'America/Sao_Paulo')).toBe('2018-11-03');
    expect(toLocalDate(instantFromString('2018-11-04T03:00:00Z'), 'America/Sao_Paulo')).toBe('2018-11-04');
  });

  it('simulates travel: same instant, different profile timezone', () => {
    const instant = instantFromString('2026-08-27T01:00:00Z');
    expect(toLocalDate(instant, 'America/Sao_Paulo')).toBe('2026-08-26');
    expect(toLocalDate(instant, 'Europe/Lisbon')).toBe('2026-08-27');
  });

  it('rejects invalid timezones and accepts valid IANA ids', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(() => toLocalDate(instantFromString('2026-08-26T12:00:00Z'), 'Mars/Olympus')).toThrow(TypeError);
  });
});

describe('Clock', () => {
  it('fixedClock is deterministic and todayFor uses the profile timezone', () => {
    const clock = fixedClock(instantFromString('2026-08-27T02:30:00Z'));
    expect(todayFor(clock, 'America/Sao_Paulo')).toBe('2026-08-26');
    expect(todayFor(clock, 'UTC')).toBe('2026-08-27');
  });
  it('systemClock returns a valid Instant', () => {
    expect(isInstant(systemClock.now())).toBe(true);
  });
});
