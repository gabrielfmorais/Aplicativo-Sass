import type { LocalDate } from '../../shared/time/index.ts';

/**
 * SPEC-004 §10 — the plan and its scheduled cares, as produced by the engine (not yet persisted).
 *
 * `careTypeCode` is a plain code here and a `text` + CHECK in Postgres: the `care_types` table,
 * its FK and the pt-BR content belong to SPEC-007 (§9). Codes are approved by D-67.
 */
export const CARE_TYPE_CODES = ['hydration', 'nutrition', 'reconstruction'] as const;
export type CareTypeCode = (typeof CARE_TYPE_CODES)[number];

export type ScheduledCareDraft = {
  readonly careTypeCode: CareTypeCode;
  /** The user's local day (ADR-008) — the engine never reads a clock; `startsOn` is an input. */
  readonly plannedDate: LocalDate;
};

/**
 * Provenance of a persisted plan is `hairProfileId` + both algorithm versions (§9/§11):
 * the engines are deterministic and released versions are immutable, so no input snapshot is copied.
 */
export type HairPlanDraft = {
  readonly hairProfileId: string;
  readonly startsOn: LocalDate;
  readonly assessmentAlgorithmVersion: string;
  readonly scheduleAlgorithmVersion: string;
};
