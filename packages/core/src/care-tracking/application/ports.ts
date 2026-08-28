import type { ScheduledCare } from '../../schedule/index.ts';
import type { CareExecution, CheckIn } from '../domain/care-tracking.ts';

/** Everything the daily screen needs, in one read: the active plan, its cares and their executions. */
export type CareBoard = {
  readonly planId: string;
  readonly startsOn: string;
  readonly cares: readonly ScheduledCare[];
  readonly executions: readonly CareExecution[];
  /** Check-ins for those executions (SPEC-006); empty until the user answers one. */
  readonly checkIns: readonly CheckIn[];
};

/**
 * Implemented by apps/mobile infrastructure (SPEC-005 §9).
 *
 * Reads go straight to the tables under RLS; every write goes through a `SECURITY DEFINER` RPC,
 * because the client holds no write privilege on either table (§10). The user is never a parameter:
 * the server takes it from `auth.uid()`.
 */
export interface CareTrackingPort {
  /** The active plan's board, or null when the user has no active plan. */
  getBoard(): Promise<CareBoard | null>;
  /**
   * Records a care as done. Idempotent by `clientExecutionId`: the same key returns the same fact,
   * so a retry after a lost response cannot create a second execution (AC3).
   */
  complete(input: { scheduledCareId: string; clientExecutionId: string; timeZone: string }): Promise<void>;
  skip(scheduledCareId: string): Promise<void>;
  reschedule(input: { scheduledCareId: string; newDate: string; timeZone: string }): Promise<void>;
  /** Undoes an accidental execution inside the approved window (D-69/D-12). */
  undo(executionId: string): Promise<void>;
  /**
   * Records how the care went (SPEC-006). Idempotent by `clientCheckinId`, and refused by the
   * server if the execution was undone or already has a check-in.
   */
  submitCheckIn(input: {
    careExecutionId: string;
    overallFeel: number;
    clientCheckinId: string;
  }): Promise<void>;
}
