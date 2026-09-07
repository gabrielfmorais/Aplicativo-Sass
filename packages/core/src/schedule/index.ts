// schedule — public surface (SPEC-004; ADR-007).
import { CURRENT_SCHEDULE_VERSION, scheduleRulesOf } from './application/build-plan.ts';

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
export { CURRENT_SCHEDULE_VERSION, scheduleRulesOf } from './application/build-plan.ts';

/**
 * Governance register of the rules behind `CURRENT_SCHEDULE_VERSION` (ADR-007 A1).
 *
 * ⚠️ **DERIVADO da versão corrente, e isso mudou ao ligar a v2.** Era `SCHEDULE_RULES_V1` escrito à
 * mão aqui, com o comentário afirmando que eram as regras da versão corrente — verdade enquanto a
 * corrente era a v1, e **mentira no minuto seguinte à troca**. O registro que o revisor de domínio
 * lê passaria a descrever um motor que ninguém executa, e nada quebraria.
 *
 * ⚠️ **`generateSchedule = generateScheduleV1` saiu junto**, pela mesma razão: era uma **segunda
 * porta** para o motor, presa na v1, contornando o `buildPlan` que a SPEC-004 AC3 definiu como
 * caminho único. Não tinha um consumidor sequer — e um export morto que fixa uma versão é
 * exatamente o tipo de coisa que alguém usa por engano quando a versão já mudou.
 */
export const CURRENT_SCHEDULE_RULES = scheduleRulesOf(CURRENT_SCHEDULE_VERSION);
