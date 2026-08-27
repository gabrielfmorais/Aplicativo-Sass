import type { CareTypeCode, HairPlan, HairPlanPort, ScheduledCare } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const PLAN_COLUMNS =
  'id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, created_at';
const CARE_COLUMNS = 'id, care_type_code, planned_date';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

type PlanRow = {
  id: string;
  hair_profile_id: string;
  starts_on: string;
  assessment_algorithm_version: string;
  schedule_algorithm_version: string;
  created_at: string;
};
type CareRow = { id: string; care_type_code: string; planned_date: string };

const toCare = (r: CareRow): ScheduledCare => ({
  id: r.id,
  careTypeCode: r.care_type_code as CareTypeCode,
  plannedDate: r.planned_date,
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
      if (error) throw fail('hair_plan.generate_failed', error);
      const plan = await readActive();
      // The function only returns after create_plan_tx committed, so the active plan must be there.
      if (!plan) throw new InfrastructureError('hair_plan.generate_failed', 'no active plan after generate');
      return plan;
    },
  };
};
