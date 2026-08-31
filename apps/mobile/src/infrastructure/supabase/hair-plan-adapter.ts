import type { CareTypeCode, HairPlan, HairPlanPort, ScheduledCare, ScheduledCareStatus } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const PLAN_COLUMNS =
  'id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, created_at';
const CARE_COLUMNS = 'id, care_type_code, planned_date, status, rescheduled_to_id';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/** How much of a function's response body is worth carrying into the error. */
const DETAIL_LIMIT = 200;

/**
 * What the edge gateway actually said.
 *
 * `functions.invoke` collapses every non-2xx into one `FunctionsHttpError` whose message is the
 * constant "Edge Function returned a non-2xx status code" — true, and useless. The status and the
 * body are the difference between "the function is not deployed" (`404 NOT_FOUND`) and "it ran and
 * refused you" (`401`, `409 no_hair_profile`, `429 too_many_requests`), and those call for opposite
 * responses from whoever is looking. D-90: the app spent an evening saying "tente novamente" about
 * a function that was not there, so retrying could never have helped.
 *
 * The body is read best-effort and truncated. It reaches the user only under `__DEV__`, via
 * `reasonOf` — it is never logged and never leaves the device (SECURITY-BASELINE §3).
 */
const invokeReason = async (error: unknown): Promise<string> => {
  const context = (error as { context?: unknown }).context;
  const message = error instanceof Error ? error.message : String(error);
  // No Response at all means the fetch never completed — on web, that is what a failed CORS
  // preflight looks like from JavaScript, and it reads like a flaky network when it usually is not.
  // Naming the check that answers it in five seconds beats guessing at it for an hour.
  if (!(context instanceof Response)) return `${message} (sem resposta — verifique: pnpm check:remote)`;
  let body = '';
  try {
    body = (await context.text()).slice(0, DETAIL_LIMIT);
  } catch {
    // A body that cannot be read is not worth failing over; the status alone already says a lot.
  }
  return body ? `HTTP ${context.status}: ${body}` : `HTTP ${context.status}: ${message}`;
};

type PlanRow = {
  id: string;
  hair_profile_id: string;
  starts_on: string;
  assessment_algorithm_version: string;
  schedule_algorithm_version: string;
  created_at: string;
};
type CareRow = {
  id: string;
  care_type_code: string;
  planned_date: string;
  status: string;
  rescheduled_to_id: string | null;
};

const toCare = (r: CareRow): ScheduledCare => ({
  id: r.id,
  careTypeCode: r.care_type_code as CareTypeCode,
  plannedDate: r.planned_date,
  status: r.status as ScheduledCareStatus,
  rescheduledToId: r.rescheduled_to_id,
});

/**
 * SPEC-004 §12/§14 — reads go straight to the tables under RLS (SELECT is the only privilege the
 * client has); creation goes through the `generate-plan` Edge Function, which is the only path that
 * can write. `clientRequestId` is generated once per attempt by the caller and reused on retry, so
 * a retry can never produce a second plan (AC9).
 */
export const createHairPlanAdapter = (client: SupabaseClient): HairPlanPort => {
  const readActive = async (): Promise<HairPlan | null> => {
    const { data: planRow, error: planError } = await client
      .from('hair_plans')
      .select(PLAN_COLUMNS)
      .eq('status', 'active')
      .maybeSingle();
    if (planError) throw fail('hair_plan.read_failed', planError);
    if (!planRow) return null;

    const plan = planRow as PlanRow;
    const { data: careRows, error: caresError } = await client
      .from('scheduled_cares')
      .select(CARE_COLUMNS)
      .eq('plan_id', plan.id)
      .order('planned_date', { ascending: true })
      .order('id', { ascending: true });
    if (caresError) throw fail('hair_plan.cares_read_failed', caresError);

    return {
      id: plan.id,
      hairProfileId: plan.hair_profile_id,
      startsOn: plan.starts_on,
      assessmentAlgorithmVersion: plan.assessment_algorithm_version,
      scheduleAlgorithmVersion: plan.schedule_algorithm_version,
      createdAt: plan.created_at,
      cares: (careRows ?? []).map((r) => toCare(r as CareRow)),
    };
  };

  return {
    getActive: readActive,
    async generate({ clientRequestId, startsOn }) {
      const { error } = await client.functions.invoke('generate-plan', {
        body: { clientRequestId, startsOn },
      });
      if (error) throw new InfrastructureError('hair_plan.generate_failed', await invokeReason(error));
      const plan = await readActive();
      // The function only returns after create_plan_tx committed, so the active plan must be there.
      if (!plan) throw new InfrastructureError('hair_plan.generate_failed', 'no active plan after generate');
      return plan;
    },
  };
};
