import type { CareTypeCode } from '../domain/plan.ts';

/** A plan as persisted, with its cares (SPEC-004 §10). Read-only for the client. */
export type ScheduledCare = {
  readonly id: string;
  readonly careTypeCode: CareTypeCode;
  /** ISO `YYYY-MM-DD`, the user's local day. */
  readonly plannedDate: string;
};

export type HairPlan = {
  readonly id: string;
  readonly hairProfileId: string;
  readonly startsOn: string;
  readonly assessmentAlgorithmVersion: string;
  readonly scheduleAlgorithmVersion: string;
  readonly createdAt: string;
  readonly cares: readonly ScheduledCare[];
};

/**
 * Implemented by apps/mobile infrastructure (SPEC-004 §12).
 * Reads go straight to the tables under RLS; creation is server-enforced through the
 * `generate-plan` Edge Function — the client never inserts a plan (G2/P10).
 */
export interface HairPlanPort {
  /** The user's active plan with its cares, or null when she has none. */
  getActive(): Promise<HairPlan | null>;
  /**
   * Asks the server to create the official plan.
   * `clientRequestId` makes the call idempotent: retrying with the same id returns the same plan
   * and never supersedes anything twice (SPEC-004 AC9).
   */
  generate(input: { clientRequestId: string; startsOn: string }): Promise<HairPlan>;
}
