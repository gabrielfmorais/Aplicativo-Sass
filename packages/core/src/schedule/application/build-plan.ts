import { CURRENT_ASSESSMENT_VERSION, assess, type AssessmentOutput } from '../../diagnostic/index.ts';
import type { HairProfileSnapshot } from '../../hair-profile/index.ts';
import type { LocalDate } from '../../shared/time/index.ts';
import { generateScheduleV1 } from '../engine/v1/generate-schedule.ts';
import type { HairPlanDraft, ScheduledCareDraft } from '../domain/plan.ts';
import type { EvidenceCode } from '../../diagnostic/index.ts';

export type PlanDraft = {
  readonly assessment: AssessmentOutput;
  readonly plan: HairPlanDraft;
  readonly cares: readonly ScheduledCareDraft[];
  /** Assessment + schedule codes, in that order, deduplicated. UI copy lives in the app. */
  readonly evidenceCodes: readonly EvidenceCode[];
};

/**
 * The one authoritative path from a profile snapshot to a plan (SPEC-004 AC3).
 *
 * The client preview and the `generate-plan` Edge Function both call this, so an instant preview
 * and the persisted plan cannot drift. Pure: `startsOn` is an input, never `today` read here.
 */
export const buildPlan = (snapshot: HairProfileSnapshot, startsOn: LocalDate): PlanDraft => {
  const assessment = assess(snapshot);
  const schedule = generateScheduleV1(assessment, {
    snapshot,
    startsOn,
    assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
  });
  return {
    assessment,
    plan: schedule.plan,
    cares: schedule.cares,
    evidenceCodes: [...new Set([...assessment.evidenceCodes, ...schedule.evidenceCodes])],
  };
};
