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

  /**
   * A fetch that never completed carries no Response, which on web is exactly what a failed CORS
   * preflight looks like from JavaScript — indistinguishable from a dead network. Pointing at the
   * check that answers it is the difference between five seconds and an hour.
   */
  it('points at the diagnostic when there is no response at all (D-90)', async () => {
    const { client } = makeClient(
      { data: null, error: null },
      { data: [], error: null },
      { error: new Error('Failed to send a request to the Edge Function') },
    );
    await expect(
      createHairPlanAdapter(client).generate({ clientRequestId: 'req-1', startsOn: '2026-09-01' }),
    ).rejects.toMatchObject({
      code: 'hair_plan.generate_failed',
      message: 'Failed to send a request to the Edge Function (sem resposta — verifique: pnpm check:remote)',
    });
  });

  /**
   * D-90. `functions.invoke` collapses every non-2xx into one `FunctionsHttpError` whose message is
   * the constant "Edge Function returned a non-2xx status code". That is what the app reported for
   * an evening while `generate-plan` was simply not deployed — and "tente novamente" invited a retry
   * that could never work. The status and body are the whole diagnosis, so the adapter must carry
   * them; the screen then shows them under `__DEV__` only.
   */
  it('carries the gateway status and body into the error, so a failure is diagnosable (D-90)', async () => {
    const { client } = makeClient(
      { data: null, error: null },
      { data: [], error: null },
      {
        error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
          context: new Response('{"code":"NOT_FOUND","message":"Requested function was not found"}', {
            status: 404,
          }),
        }),
      },
    );
    await expect(
      createHairPlanAdapter(client).generate({ clientRequestId: 'req-1', startsOn: '2026-09-01' }),
    ).rejects.toMatchObject({
      code: 'hair_plan.generate_failed',
      message: 'HTTP 404: {"code":"NOT_FOUND","message":"Requested function was not found"}',
    });
  });

  /** A body that cannot be read must not swallow the status, which already says most of it. */
  it('still reports the status when the response body is unreadable', async () => {
    const unreadable = new Response('x', { status: 503 });
    await unreadable.text(); // consume it, so a second read throws
    const { client } = makeClient(
      { data: null, error: null },
      { data: [], error: null },
      { error: Object.assign(new Error('boom'), { context: unreadable }) },
    );
    await expect(
      createHairPlanAdapter(client).generate({ clientRequestId: 'req-1', startsOn: '2026-09-01' }),
    ).rejects.toMatchObject({ code: 'hair_plan.generate_failed', message: 'HTTP 503: boom' });
  });
});

/**
 * SPEC-046 — o contrato de versão na fronteira do cliente (SPEC-038 OQ4).
 *
 * ⚠️ **O app é binário de loja e a Edge Function versiona à parte.** Mandar a versão prevista é o
 * que impede ela de **prever um cronograma e receber outro** — a quebra do SPEC-004 AC3.
 */
describe('a versão do motor vai no corpo da chamada (SPEC-046)', () => {
  const planRow = {
    id: 'plan-1',
    starts_on: '2026-09-01',
    hair_profile_id: 'hp-1',
    assessment_algorithm_version: 'v1',
    schedule_algorithm_version: 'v1',
  };
  const careRows: unknown[] = [];

  it('manda a versão quando a tela informa qual previu', async () => {
    const { client, invokeFn } = makeClient({ data: planRow, error: null }, { data: careRows, error: null });
    await createHairPlanAdapter(client).generate({
      clientRequestId: 'req-1',
      startsOn: '2026-09-01',
      scheduleVersion: 'v2',
    });
    expect(invokeFn).toHaveBeenCalledWith('generate-plan', {
      body: { clientRequestId: 'req-1', startsOn: '2026-09-01', scheduleVersion: 'v2' },
    });
  });

  /**
   * ⚠️ **Compatibilidade:** sem versão, o campo **não vai** no corpo — e não vai como `undefined`,
   * que numa serialização vira uma chave presente. Um servidor antigo tem de receber exatamente o
   * corpo que sempre recebeu.
   */
  it('sem versão, o campo nem aparece no corpo', async () => {
    const { client, invokeFn } = makeClient({ data: planRow, error: null }, { data: careRows, error: null });
    await createHairPlanAdapter(client).generate({ clientRequestId: 'req-1', startsOn: '2026-09-01' });
    const [, arg] = invokeFn.mock.calls[0] as unknown as [string, { body: Record<string, unknown> }];
    // `in`, e não uma comparação de igualdade: uma chave presente valendo `undefined` passaria
    // despercebida por `toHaveBeenCalledWith` e chegaria ao servidor como campo existente.
    expect('scheduleVersion' in arg.body).toBe(false);
  });
});
