import { instantToEpochMs, type Instant } from './instant.ts';

/**
 * A civil calendar date (YYYY-MM-DD) with no time and no timezone (ADR-008).
 * "The user's day" is always a LocalDate derived from an Instant + the user's IANA timezone.
 */
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');

const utcMidnightMs = (date: LocalDate): number => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};

const fromUtcMs = (ms: number): LocalDate => {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}` as LocalDate;
};

export const isLocalDate = (value: string): value is LocalDate => {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const ms = utcMidnightMs(value as LocalDate);
  return !Number.isNaN(ms) && fromUtcMs(ms) === value;
};

export const localDateFromString = (value: string): LocalDate => {
  if (!isLocalDate(value)) throw new TypeError(`Invalid LocalDate: ${value}`);
  return value as LocalDate;
};

/** Validates an IANA timezone identifier using the host Intl implementation. */
export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (tz: string): Intl.DateTimeFormat => {
  let f = formatterCache.get(tz);
  if (!f) {
    if (!isValidTimeZone(tz)) throw new TypeError(`Invalid IANA timezone: ${tz}`);
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatterCache.set(tz, f);
  }
  return f;
};

/**
 * Converts an absolute instant to the civil date observed in the given timezone.
 * Uses Intl (Node, Deno, Hermes) — no third-party date library (DECISION-REGISTER D-33).
 */
export const toLocalDate = (instant: Instant, timeZone: string): LocalDate => {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantToEpochMs(instant)));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}` as LocalDate;
};

export const addDays = (date: LocalDate, days: number): LocalDate =>
  fromUtcMs(utcMidnightMs(date) + days * MS_PER_DAY);

/** Whole days from `a` to `b` (positive when b is after a). */
export const diffDays = (a: LocalDate, b: LocalDate): number =>
  Math.round((utcMidnightMs(b) - utcMidnightMs(a)) / MS_PER_DAY);

export const compareLocalDates = (a: LocalDate, b: LocalDate): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0);

export const isBefore = (a: LocalDate, b: LocalDate): boolean => a < b;
export const isAfter = (a: LocalDate, b: LocalDate): boolean => a > b;

/** Day of the week, `0` = Sunday … `6` = Saturday (matches `Date.prototype.getUTCDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * The weekday a civil date falls on. Pure arithmetic over the date itself — nothing here reads a
 * clock, so it is safe inside the engines' world (ADR-001, D-06).
 */
export const weekdayOf = (date: LocalDate): Weekday => new Date(utcMidnightMs(date)).getUTCDay() as Weekday;

export const isWeekday = (value: unknown): value is Weekday =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
