import type { SupabaseClient } from '@supabase/supabase-js';

import { createHairPlanAdapter } from '@/infrastructure/supabase/hair-plan-adapter';

const planRow = {
  id: 'plan-1',
  hair_profile_id: 'hp-1',
  starts_on: '2026-09-01',
  assessment_algorithm_version: 'v1',
  schedule_algorithm_version: 'v1',
  created_at: '2026-09-01T10:00:00Z',
};
const careRows = [
  {
    id: 'c1',
    care_type_code: 'hydration',
    planned_date: '2026-09-01',
    status: 'planned',
    rescheduled_to_id: null,
  },
  {
    id: 'c2',
    care_type_code: 'nutrition',
    planned_date: '2026-09-05',
    status: 'skipped',
    rescheduled_to_id: null,
  },
];

/** Minimal PostgREST chain double: `.select().eq().maybeSingle()` and `.select().eq().order().order()`. */
const makeClient = (
  plan: { data: unknown; error: unknown },
  cares: { data: unknown; error: unknown },
  invoke: { error: unknown } = { error: null },
) => {
  const invokeFn = jest.fn(async () => invoke);
  const from = jest.fn((table: string) => {
    if (table === 'hair_plans') {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => plan,
      };
      return chain;
    }
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(cares).then(resolve),
    };
    return chain;
  });
  return { client: { from, functions: { invoke: invokeFn } } as unknown as SupabaseClient, invokeFn };
};

describe('hair plan adapter (SPEC-004 §12)', () => {
  it('reads the active plan with its cares', async () => {
    const { client } = makeClient({ data: planRow, error: null }, { data: careRows, error: null });
    const plan = await createHairPlanAdapter(client).getActive();
    expect(plan).toEqual({
      id: 'plan-1',
      hairProfileId: 'hp-1',
      startsOn: '2026-09-01',
      assessmentAlgorithmVersion: 'v1',
      scheduleAlgorithmVersion: 'v1',
      createdAt: '2026-09-01T10:00:00Z',
      cares: [
        {
          id: 'c1',
          careTypeCode: 'hydration',
          plannedDate: '2026-09-01',
          status: 'planned',
          rescheduledToId: null,
        },
        {
          id: 'c2',
          careTypeCode: 'nutrition',
          plannedDate: '2026-09-05',
          status: 'skipped',
          rescheduledToId: null,
        },
      ],
    });
  });

  it('returns null when the user has no active plan', async () => {
    const { client } = makeClient({ data: null, error: null }, { data: [], error: null });
    expect(await createHairPlanAdapter(client).getActive()).toBeNull();
  });

  it('surfaces a read failure instead of pretending there is no plan', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } }, { data: [], error: null });
    await expect(createHairPlanAdapter(client).getActive()).rejects.toMatchObject({
      code: 'hair_plan.read_failed',
    });
  });

  it('creates a plan through the Edge Function and never writes the tables directly', async () => {
    const { client, invokeFn } = makeClient({ data: planRow, error: null }, { data: careRows, error: null });
    const plan = await createHairPlanAdapter(client).generate({
      clientRequestId: 'req-1',
      startsOn: '2026-09-01',
    });
    expect(invokeFn).toHaveBeenCalledWith('generate-plan', {
      body: { clientRequestId: 'req-1', startsOn: '2026-09-01' },
    });
    expect(plan.id).toBe('plan-1');
  });

  it('fails loudly when the Edge Function rejects the request', async () => {
    const { client } = makeClient(
      { data: null, error: null },
      { data: [], error: null },
      {
        error: { message: 'too_many_requests' },
      },
    );
    await expect(
      createHairPlanAdapter(client).generate({ clientRequestId: 'req-1', startsOn: '2026-09-01' }),
    ).rejects.toMatchObject({ code: 'hair_plan.generate_failed' });
  });
});
