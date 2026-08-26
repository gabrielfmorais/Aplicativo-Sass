import type { AnalyticsEvent } from './events.js';

/**
 * Port implemented by infrastructure (provider adapter). Application code depends on this only.
 * The adapter is responsible for consent gating (ADR-010) and must be a no-op without consent.
 */
export interface AnalyticsPort {
  track(event: AnalyticsEvent): void;
  /** Associates subsequent events with an opaque user id. Never an email. */
  identify(userId: string): void;
  reset(): void;
}
