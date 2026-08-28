import type {
  CareBoard,
  CareExecution,
  CareTrackingPort,
  CheckIn,
  ScheduledCare,
  ScheduledCareStatus,
} from '@app/core';
import { ConflictError, InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const PLAN_COLUMNS = 'id, starts_on';
const CARE_COLUMNS = 'id, care_type_code, planned_date, status, rescheduled_to_id';
const EXECUTION_COLUMNS = 'id, scheduled_care_id, executed_at, executed_on, voided_at';
const CHECKIN_COLUMNS = 'id, care_execution_id, overall_feel';

/**
 * A transition the server refused because the care is no longer in the state the screen assumed:
 * already resolved, or an undo past its window. The screen reloads and shows the real state instead
 * of insisting on an error (SPEC-005 §16).
 */
const CONFLICT_CODES = new Set(['23514', 'P0002']);

const fail = (code: string, e: { message: string; code?: string }): Error =>
  e.code && CONFLICT_CODES.has(e.code)
    ? new ConflictError(code, e.message)
    : new InfrastructureError(code, e.message);

type CareRow = {
  id: string;
  care_type_code: string;
  planned_date: string;
  status: string;
  rescheduled_to_id: string | null;
};
type ExecutionRow = {
  id: string;
  scheduled_care_id: string;
  executed_at: string;
  executed_on: string;
  voided_at: string | null;
};
type CheckInRow = { id: string; care_execution_id: string; overall_feel: number };

const toCare = (r: CareRow): ScheduledCare => ({
  id: r.id,
  careTypeCode: r.care_type_code as ScheduledCare['careTypeCode'],
  plannedDate: r.planned_date,
  status: r.status as ScheduledCareStatus,
  rescheduledToId: r.rescheduled_to_id,
});

const toCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id,
  careExecutionId: r.care_execution_id,
  overallFeel: r.overall_feel,
});

const toExecution = (r: ExecutionRow): CareExecution => ({
  id: r.id,
  scheduledCareId: r.scheduled_care_id,
  executedAt: r.executed_at,
  executedOn: r.executed_on,
  voidedAt: r.voided_at,
});

/**
 * SPEC-005 §9/§10 — reads go straight to the tables under RLS (SELECT is the only privilege the
 * client has); every write goes through a `SECURITY DEFINER` RPC. The user is never sent: the
 * server takes it from `auth.uid()`, so nothing here can be pointed at somebody else's data.
 */
export const createCareTrackingAdapter = (client: SupabaseClient): CareTrackingPort => {
  const call = async (fn: string, args: Record<string, unknown>, code: string): Promise<void> => {
    const { error } = await client.rpc(fn, args);
    if (error) throw fail(code, error);
  };

  return {
    async getBoard(): Promise<CareBoard | null> {
      const { data: planRow, error: planError } = await client
        .from('hair_plans')
        .select(PLAN_COLUMNS)
        .eq('status', 'active')
        .maybeSingle();
      if (planError) throw fail('care.board_read_failed', planError);
      if (!planRow) return null;
      const plan = planRow as { id: string; starts_on: string };

      const { data: careRows, error: caresError } = await client
        .from('scheduled_cares')
        .select(CARE_COLUMNS)
        .eq('plan_id', plan.id)
        .order('planned_date', { ascending: true })
        .order('id', { ascending: true });
      if (caresError) throw fail('care.board_read_failed', caresError);
      const cares = (careRows ?? []).map((r) => toCare(r as CareRow));

      // Bounded by the plan's own cares: an execution from a superseded plan is not this board's.
      const careIds = cares.map((c) => c.id);
      let executions: CareExecution[] = [];
      if (careIds.length > 0) {
        const { data: executionRows, error: executionsError } = await client
          .from('care_executions')
          .select(EXECUTION_COLUMNS)
          .in('scheduled_care_id', careIds);
        if (executionsError) throw fail('care.board_read_failed', executionsError);
        executions = (executionRows ?? []).map((r) => toExecution(r as ExecutionRow));
      }

      // Bounded by this board's executions, for the same reason the executions are bounded by the
      // plan's cares: a check-in from a superseded plan is not this board's.
      const executionIds = executions.map((e) => e.id);
      let checkIns: CheckIn[] = [];
      if (executionIds.length > 0) {
        const { data: checkInRows, error: checkInsError } = await client
          .from('checkins')
          .select(CHECKIN_COLUMNS)
          .in('care_execution_id', executionIds);
        if (checkInsError) throw fail('care.board_read_failed', checkInsError);
        checkIns = (checkInRows ?? []).map((r) => toCheckIn(r as CheckInRow));
      }

      // Across every plan, not just this one (SPEC-014): `head: true` asks for the count and no
      // rows, so this stays one cheap round trip regardless of how long she has been using the app.
      const { count, error: countError } = await client
        .from('care_executions')
        .select('id', { count: 'exact', head: true })
        .is('voided_at', null);
      if (countError) throw fail('care.board_read_failed', countError);

      return {
        planId: plan.id,
        startsOn: plan.starts_on,
        cares,
        executions,
        checkIns,
        lifetimeDoneCount: count ?? 0,
      };
    },

    complete: ({ scheduledCareId, clientExecutionId, timeZone }) =>
      call(
        'complete_care',
        {
          p_scheduled_care_id: scheduledCareId,
          p_client_execution_id: clientExecutionId,
          p_timezone: timeZone,
        },
        'care.complete_failed',
      ),

    skip: (scheduledCareId) =>
      call('skip_care', { p_scheduled_care_id: scheduledCareId }, 'care.skip_failed'),

    reschedule: ({ scheduledCareId, newDate, timeZone }) =>
      call(
        'reschedule_care',
        { p_scheduled_care_id: scheduledCareId, p_new_date: newDate, p_timezone: timeZone },
        'care.reschedule_failed',
      ),

    undo: (executionId) => call('void_execution', { p_execution_id: executionId }, 'care.undo_failed'),

    submitCheckIn: ({ careExecutionId, overallFeel, clientCheckinId }) =>
      call(
        'submit_checkin',
        {
          p_care_execution_id: careExecutionId,
          p_overall_feel: overallFeel,
          p_client_checkin_id: clientCheckinId,
        },
        'care.checkin_failed',
      ),
  };
};
