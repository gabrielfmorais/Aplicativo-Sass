// schedule — public surface (SPEC-004; ADR-007).
import { generateScheduleV1 } from './engine/v1/generate-schedule.ts';
import { SCHEDULE_RULES_V1 } from './engine/v1/rules.ts';

export { CARE_TYPE_CODES } from './domain/plan.ts';
export type { CareTypeCode, HairPlanDraft, ScheduledCareDraft } from './domain/plan.ts';
export { PLAN_WINDOW_DAYS } from './engine/v1/generate-schedule.ts';
export type { ScheduleContext, ScheduleResult } from './engine/v1/generate-schedule.ts';
export { buildPlan, isKnownScheduleVersion } from './application/build-plan.ts';
export type { PlanDraft, ScheduleVersion } from './application/build-plan.ts';
export { applyPreferredWeekdays, normalizePreferredWeekdays } from './placement/preferred-weekdays.ts';
export type { PlanPreferences, WeekdayPlacementResult } from './placement/preferred-weekdays.ts';
export { SCHEDULED_CARE_STATUSES } from './application/ports.ts';
export type {
  HairPlan,
  HairPlanPort,
  PlanPreferencesPort,
  ScheduledCare,
  ScheduledCareStatus,
} from './application/ports.ts';

/** A versao corrente mora em `build-plan.ts`, junto da tabela de despacho que a usa. */
export { CURRENT_SCHEDULE_VERSION } from './application/build-plan.ts';
export const generateSchedule = generateScheduleV1;
/** Governance register of the rules behind `CURRENT_SCHEDULE_VERSION` (ADR-007 A1). */
export const CURRENT_SCHEDULE_RULES = SCHEDULE_RULES_V1;
