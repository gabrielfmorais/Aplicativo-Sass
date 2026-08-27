import type { AssessmentOutput, EvidenceCode } from '../../../diagnostic/index.ts';
import type { HairProfileSnapshot } from '../../../hair-profile/index.ts';
import { addDays, type LocalDate } from '../../../shared/time/index.ts';
import type { CareTypeCode, HairPlanDraft, ScheduledCareDraft } from '../../domain/plan.ts';

/**
 * Schedule engine v1 — pure and deterministic (ADR-007, D-06): no clock, no network, no random.
 * `startsOn` is an input; the engine only ever produces LocalDates (ADR-008).
 * Rules are the V1 CANDIDATE product heuristics registered in `./rules.ts` (D-67).
 */
export const SCHEDULE_ALGORITHM_VERSION_V1 = 'v1' as const;

/** Fixed generation window (worksheet §6). */
export const PLAN_WINDOW_DAYS = 28;

/** Care sessions per week from the observed wash frequency (worksheet §5). Not a washing advice. */
const SESSIONS_PER_WEEK: Record<HairProfileSnapshot['washFrequency'], 1 | 2 | 3> = {
  once_or_less_weekly: 1,
  twice_weekly: 2,
  three_to_four_weekly: 3,
  five_or_more_weekly: 3,
  varies: 2, // `varies` never escalates intensity (worksheet §10).
};

/** Day offsets from `startsOn`, per sessions/week (worksheet §9). All within the 28-day window. */
const OFFSETS: Record<1 | 2 | 3, readonly number[]> = {
  1: [0, 7, 14, 21],
  2: [0, 4, 7, 11, 14, 18, 21, 25],
  3: [0, 2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26],
};

/** Day on/after which the single reconstruction replaces a care (worksheet §8). */
const RECONSTRUCTION_FROM_DAY = 14;

export type ScheduleContext = {
  /** Observed data is read straight from the snapshot; only inferences come from the assessment (§7b). */
  readonly snapshot: HairProfileSnapshot;
  readonly startsOn: LocalDate;
  /** Stamped on the plan as provenance together with this engine's version (§11). */
  readonly assessmentAlgorithmVersion: string;
};

export type ScheduleResult = {
  readonly plan: HairPlanDraft;
  readonly cares: readonly ScheduledCareDraft[];
  /** Codes for the schedule's own decisions; the assessment carries its own (worksheet §11). */
  readonly evidenceCodes: readonly EvidenceCode[];
};

/** Alternating base cycle; the emphasis decides which axis opens it (worksheet §7). */
const openingCare = (emphasis: AssessmentOutput['emphasis']): CareTypeCode =>
  emphasis === 'nutrition' ? 'nutrition' : 'hydration';

export const generateScheduleV1 = (
  assessment: AssessmentOutput,
  { snapshot, startsOn, assessmentAlgorithmVersion }: ScheduleContext,
): ScheduleResult => {
  const sessionsPerWeek = SESSIONS_PER_WEEK[snapshot.washFrequency];
  const offsets = OFFSETS[sessionsPerWeek];
  const opening = openingCare(assessment.emphasis);
  const alternate = opening === 'hydration' ? 'nutrition' : 'hydration';

  const types: CareTypeCode[] = offsets.map((_, i) => (i % 2 === 0 ? opening : alternate));

  // At most one reconstruction per window: it replaces the first care on/after day 14 (§8).
  if (assessment.includeReconstruction) {
    const at = offsets.findIndex((offset) => offset >= RECONSTRUCTION_FROM_DAY);
    if (at !== -1) types[at] = 'reconstruction';
  }

  return {
    plan: {
      hairProfileId: snapshot.hairProfileId,
      startsOn,
      assessmentAlgorithmVersion,
      scheduleAlgorithmVersion: SCHEDULE_ALGORITHM_VERSION_V1,
    },
    cares: offsets.map((offset, i) => ({
      careTypeCode: types[i] as CareTypeCode,
      plannedDate: addDays(startsOn, offset),
    })),
    evidenceCodes: ['wash_frequency_baseline'],
  };
};
