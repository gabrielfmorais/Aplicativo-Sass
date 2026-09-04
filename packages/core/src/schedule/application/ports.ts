import type { CareTypeCode } from '../domain/plan.ts';
import type { PlanPreferences } from '../placement/preferred-weekdays.ts';

/**
 * Lifecycle of the *intention* (SPEC-005). There is no `completed`: a care is done when an
 * effective execution exists (SPEC-005 §8.2, D-69) — one fact, one source of truth.
 */
export const SCHEDULED_CARE_STATUSES = ['planned', 'skipped', 'rescheduled'] as const;
export type ScheduledCareStatus = (typeof SCHEDULED_CARE_STATUSES)[number];

/**
 * A plan as persisted, with its cares (SPEC-004 §10). Read-only for the client.
 * Shared kernel between Schedule and Care Tracking (DOMAIN-MAP §6): Schedule creates cares,
 * Care Tracking transitions them.
 */
export type ScheduledCare = {
  readonly id: string;
  readonly careTypeCode: CareTypeCode;
  /** ISO `YYYY-MM-DD`, the user's local day. Never rewritten — rescheduling creates a new row. */
  readonly plannedDate: string;
  readonly status: ScheduledCareStatus;
  /** Set only when `status === 'rescheduled'`: the row that replaced this one. */
  readonly rescheduledToId: string | null;
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
   *
   * ⚠️ **`scheduleVersion` é a versão com que ELA VIU o preview** (SPEC-046). O servidor a valida
   * contra a allowlist e gera com ela — é isso que impede o app de prever um cronograma e receber
   * outro quando o binário de loja e a Edge Function versionam à parte. Omitida (app antigo), o
   * servidor usa a versão corrente **dele**, que é o comportamento que sempre existiu.
   */
  generate(input: { clientRequestId: string; startsOn: string; scheduleVersion?: string }): Promise<HairPlan>;
}

/**
 * SPEC-015 — her routine preference, stored server-side (`plan_preferences`).
 *
 * Holding a preference grants nothing: the premium gate is where it is **applied**, in
 * `generate-plan` (FR3). This port is a plain read/write of her own row, so a client that lies
 * about entitlement gains a saved preference and no effect at all.
 */
export interface PlanPreferencesPort {
  /** Her stored preference, or null when she has never saved one. */
  get(): Promise<PlanPreferences | null>;
  save(preferences: PlanPreferences): Promise<void>;
}
