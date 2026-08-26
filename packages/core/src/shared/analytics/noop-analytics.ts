import type { AnalyticsPort } from './port.js';

/** Default adapter until a provider is chosen (DECISION-REGISTER D-31). Does nothing. */
export const noopAnalytics: AnalyticsPort = {
  track: () => undefined,
  identify: () => undefined,
  reset: () => undefined,
};
