import { CURRENT_ASSESSMENT_VERSION, assess, type AssessmentOutput } from '../../diagnostic/index.ts';
import type { HairProfileSnapshot } from '../../hair-profile/index.ts';
import type { LocalDate } from '../../shared/time/index.ts';
import { PLAN_WINDOW_DAYS, generateScheduleV1 } from '../engine/v1/generate-schedule.ts';
import { applyPreferredWeekdays, type PlanPreferences } from '../placement/preferred-weekdays.ts';
import type { HairPlanDraft, ScheduledCareDraft } from '../domain/plan.ts';
import type { EvidenceCode } from '../../diagnostic/index.ts';

export type PlanDraft = {
  readonly assessment: AssessmentOutput;
  readonly plan: HairPlanDraft;
  readonly cares: readonly ScheduledCareDraft[];
  /** Assessment + schedule codes, in that order, deduplicated. UI copy lives in the app. */
  readonly evidenceCodes: readonly EvidenceCode[];
  /**
   * SPEC-015 — null unless preferences were applied. `fullyHonoured: false` means her cadence
   * needs more days per week than she chose, so some cares kept their engine day (EC1).
   */
  readonly weekdayPlacement: { readonly fullyHonoured: boolean } | null;
};

/**
 * The one authoritative path from a profile snapshot to a plan (SPEC-004 AC3).
 *
 * The client preview and the `generate-plan` Edge Function both call this, so an instant preview
 * and the persisted plan cannot drift. Pure: `startsOn` is an input, never `today` read here.
 *
 * `preferences` is the premium `plan_customization` layer (SPEC-015). It is applied **after** the
 * engine and only ever moves dates — the assessment, the care types and their count are the
 * engine's alone, whether or not preferences are passed (G3/AC4). Passing them is not what grants
 * the capability: the server decides that (`has_entitlement`, FR3) and simply omits them when she
 * is not entitled.
 */
export const buildPlan = (
  snapshot: HairProfileSnapshot,
  startsOn: LocalDate,
  preferences?: PlanPreferences,
): PlanDraft => {
  const assessment = assess(snapshot);
  const schedule = generateScheduleV1(assessment, {
    snapshot,
    startsOn,
    assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
  });
  const placement = preferences
    ? applyPreferredWeekdays(schedule.cares, startsOn, PLAN_WINDOW_DAYS, preferences)
    : null;
  return {
    assessment,
    plan: schedule.plan,
    cares: placement?.cares ?? schedule.cares,
    evidenceCodes: [...new Set([...assessment.evidenceCodes, ...schedule.evidenceCodes])],
    weekdayPlacement: placement ? { fullyHonoured: placement.fullyHonoured } : null,
  };
};
