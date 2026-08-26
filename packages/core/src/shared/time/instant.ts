/**
 * An absolute point in time (ADR-008). Stored as ISO-8601 UTC string; nominal type prevents
 * mixing with LocalDate.
 */
export type Instant = string & { readonly __brand: 'Instant' };

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export const isInstant = (value: string): value is Instant =>
  ISO_UTC_RE.test(value) && !Number.isNaN(Date.parse(value));

export const instantFromString = (value: string): Instant => {
  if (!isInstant(value)) throw new TypeError(`Invalid Instant: ${value}`);
  return value as Instant;
};

/** Build an Instant from epoch milliseconds (used by clocks and adapters). */
export const instantFromEpochMs = (ms: number): Instant => new Date(ms).toISOString() as Instant;

export const instantToEpochMs = (instant: Instant): number => Date.parse(instant);
