// schedule — public surface (SPEC-004; ADR-007).
import { SCHEDULE_ALGORITHM_VERSION_V1, generateScheduleV1 } from './engine/v1/generate-schedule.ts';
import { SCHEDULE_RULES_V1 } from './engine/v1/rules.ts';

export { CARE_TYPE_CODES } from './domain/plan.ts';
export type { CareTypeCode, HairPlanDraft, ScheduledCareDraft } from './domain/plan.ts';
export { PLAN_WINDOW_DAYS } from './engine/v1/generate-schedule.ts';
export type { ScheduleContext, ScheduleResult } from './engine/v1/generate-schedule.ts';
export { buildPlan } from './application/build-plan.ts';
export type { PlanDraft } from './application/build-plan.ts';
export { SCHEDULED_CARE_STATUSES } from './application/ports.ts';
export type { HairPlan, HairPlanPort, ScheduledCare, ScheduledCareStatus } from './application/ports.ts';

/** The version every new plan is generated with. Bump only when behaviour changes (ADR-007). */
export const CURRENT_SCHEDULE_VERSION = SCHEDULE_ALGORITHM_VERSION_V1;
export const generateSchedule = generateScheduleV1;
/** Governance register of the rules behind `CURRENT_SCHEDULE_VERSION` (ADR-007 A1). */
export const CURRENT_SCHEDULE_RULES = SCHEDULE_RULES_V1;
