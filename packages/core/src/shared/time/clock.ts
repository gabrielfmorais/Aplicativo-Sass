import type { Instant } from './instant.js';
import { toLocalDate, type LocalDate } from './local-date.js';

/**
 * Port for reading the current time (ADR-008). Engines never depend on it — they receive
 * `referenceDate` as input. Use cases and adapters receive a Clock by injection.
 */
export interface Clock {
  now(): Instant;
}

/** Deterministic clock for tests and replays. */
export const fixedClock = (instant: Instant): Clock => ({ now: () => instant });

/** The user's current civil date, given their profile timezone. */
export const todayFor = (clock: Clock, timeZone: string): LocalDate => toLocalDate(clock.now(), timeZone);
