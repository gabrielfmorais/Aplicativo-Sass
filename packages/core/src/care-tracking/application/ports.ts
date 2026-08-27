import type { ScheduledCare } from '../../schedule/index.ts';
import type { CareExecution } from '../domain/care-tracking.ts';

/** Everything the daily screen needs, in one read: the active plan, its cares and their executions. */
export type CareBoard = {
  readonly planId: string;
  readonly startsOn: string;
  readonly cares: readonly ScheduledCare[];
  readonly executions: readonly CareExecution[];
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
}
