export {
  HIGH_FEEL,
  MIN_OCCURRENCES,
  MIN_RATED_CARES,
  type InsightFact,
  type InsightsView,
  type ShelfUsage,
  type Observation,
} from './domain/insights.ts';
export { buildInsights } from './application/build-insights.ts';
export { buildShelfUsage } from './application/build-shelf-usage.ts';
export type { InsightsPort } from './application/ports.ts';
