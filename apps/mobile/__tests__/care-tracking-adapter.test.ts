import { ConflictError, InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createCareTrackingAdapter } from '@/infrastructure/supabase/care-tracking-adapter';

const planRow = {
  id: 'plan-1',
  starts_on: '2026-09-01',
  // SPEC-017: a origem do plano e as versões de engine viajam no mesmo select.
  hair_profile_id: 'hp-1',
  assessment_algorithm_version: 'v1',
  schedule_algorithm_version: 'v1',
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
    status: 'rescheduled',
    rescheduled_to_id: 'c3',
  },
];
const checkInRows = [{ id: 'ck1', care_execution_id: 'e1', overall_feel: 4 }];
const executionRows = [
  {
    id: 'e1',
    scheduled_care_id: 'c1',
    executed_at: '2026-09-01T12:00:00Z',
    executed_on: '2026-09-01',
    voided_at: null,
  },
];

type Result = { data: unknown; error: unknown };

/** Minimal PostgREST chain double covering `.select().eq()[.order()|.in()|.maybeSingle()]`. */
const makeClient = (
  plan: Result,
  cares: Result,
  executions: Result,
  rpcError: unknown = null,
  checkIns: Result = { data: [], error: null },
  // The lifetime count (SPEC-014) is asked for on care_executions too, but with head:true — it
  // comes back as a count and no rows, so the double answers it on its own terminator.
  lifetime: { count: number | null; error: unknown } = { count: 0, error: null },
  // SPEC-022: a pausa aberta do plano ativo, ou nenhuma.
  pause: Result = { data: null, error: null },
  // SPEC-024 FR7: quais execuções deste board já têm registro de Wash Day.
  washDays: Result = { data: [], error: null },
  // SPEC-039 FR5: as etapas de finalização já respondidas, por hub.
  finishes: Result = { data: [], error: null },
) => {
  const rpc = jest.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    data: null,
    error: rpcError,
  }));
  // As colunas pedidas são capturadas: um select que perde uma coluna não quebra nada em runtime
  // — só devolve `undefined` — e sem isto o teste passaria enquanto a tela silenciosamente morre.
  const selects: string[] = [];
  const thenable = (result: Result) => {
    const chain = {
      select: (columns?: string) => {
        if (typeof columns === 'string') selects.push(columns);
        return chain;
      },
      eq: () => chain,
      in: () => Promise.resolve(result),
      is: () => Promise.resolve(lifetime),
      order: () => chain,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  /**
   * `plan_pauses` termina em `.is().maybeSingle()`, e `care_executions` termina em `.is()` com o
   * contador vitalício — o mesmo método com dois finais diferentes, então a pausa precisa da
   * própria cadeia em vez de emprestar a genérica.
   */
  const pauseChain = {
    select: (columns?: string) => {
      if (typeof columns === 'string') selects.push(columns);
      return pauseChain;
    },
    eq: () => pauseChain,
    is: () => pauseChain,
    maybeSingle: async () => pause,
  };
  const from = jest.fn((table: string) =>
    table === 'plan_pauses'
      ? pauseChain
      : table === 'hair_plans'
        ? thenable(plan)
        : table === 'scheduled_cares'
          ? thenable(cares)
          : table === 'care_executions'
            ? thenable(executions)
            : table === 'wash_days'
              ? thenable(washDays)
              : table === 'wash_day_finish'
                ? thenable(finishes)
                : thenable(checkIns),
  );
  return { client: { from, rpc } as unknown as SupabaseClient, rpc, selects };
};

const ok = (data: unknown): Result => ({ data, error: null });

describe('care tracking adapter — reads (SPEC-005 §9)', () => {
  it('builds the board from the active plan, its cares and their executions', async () => {
    const { client } = makeClient(
      ok(planRow),
      ok(careRows),
      ok(executionRows),
      null,
      ok(checkInRows),
      { count: 7, error: null },
      { data: null, error: null },
      // SPEC-024 FR7 — a execução 'e1' já tem registro; 'e2' não. A Hoje precisa da diferença.
      ok([{ id: 'w1', care_execution_id: 'e1' }]),
      ok([{ wash_day_id: 'w1', finish_status: 'done' }]),
    );
    const boardResult = await createCareTrackingAdapter(client).getBoard();
    expect(boardResult).toEqual({
      planId: 'plan-1',
      startsOn: '2026-09-01',
      hairProfileId: 'hp-1',
      assessmentAlgorithmVersion: 'v1',
      scheduleAlgorithmVersion: 'v1',
      pausedOn: null,
      washDayExecutionIds: ['e1'],
      // SPEC-039 — a etapa vem pelo hub, e a Hoje a lê pela execução.
      careFinishes: [{ careExecutionId: 'e1', status: 'done', technique: null }],
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
          status: 'rescheduled',
          rescheduledToId: 'c3',
        },
      ],
      executions: [
        {
          id: 'e1',
          scheduledCareId: 'c1',
          executedAt: '2026-09-01T12:00:00Z',
          executedOn: '2026-09-01',
          voidedAt: null,
        },
      ],
      checkIns: [{ id: 'ck1', careExecutionId: 'e1', overallFeel: 4 }],
      lifetimeDoneCount: 7,
    });
  });

  it('returns null when there is no active plan', async () => {
    const { client } = makeClient(ok(null), ok([]), ok([]));
    expect(await createCareTrackingAdapter(client).getBoard()).toBeNull();
  });

  it('skips the execution query entirely when the plan has no cares', async () => {
    const { client } = makeClient(ok(planRow), ok([]), ok([]));
    const boardResult = await createCareTrackingAdapter(client).getBoard();
    expect(boardResult?.executions).toEqual([]);
  });

  /** SPEC-014: after a reassessment the plan is new but her history is not. */
  it('counts effective executions across every plan, not just the active one', async () => {
    const { client } = makeClient(ok(planRow), ok([]), ok([]), null, ok([]), { count: 12, error: null });
    expect((await createCareTrackingAdapter(client).getBoard())?.lifetimeDoneCount).toBe(12);
  });

  it('surfaces a failed lifetime count instead of silently reporting zero', async () => {
    const { client } = makeClient(ok(planRow), ok([]), ok([]), null, ok([]), {
      count: null,
      error: { message: 'boom' },
    });
    await expect(createCareTrackingAdapter(client).getBoard()).rejects.toMatchObject({
      code: 'care.board_read_failed',
    });
  });

  it('surfaces a read failure instead of pretending the board is empty', async () => {
    const { client } = makeClient({ data: null, error: { message: 'boom' } }, ok([]), ok([]));
    await expect(createCareTrackingAdapter(client).getBoard()).rejects.toMatchObject({
      code: 'care.board_read_failed',
    });
  });
});

describe('care tracking adapter — writes go through the RPCs only', () => {
  const client = () => makeClient(ok(planRow), ok(careRows), ok(executionRows));

  it('completes with the idempotency key and the device timezone', async () => {
    const { client: c, rpc } = client();
    await createCareTrackingAdapter(c).complete({
      scheduledCareId: 'c1',
      clientExecutionId: 'k1',
      timeZone: 'America/Sao_Paulo',
    });
    expect(rpc).toHaveBeenCalledWith('complete_care', {
      p_scheduled_care_id: 'c1',
      p_client_execution_id: 'k1',
      p_timezone: 'America/Sao_Paulo',
    });
  });

  it('skips, reschedules and undoes through their own RPCs', async () => {
    const { client: c, rpc } = client();
    const adapter = createCareTrackingAdapter(c);
    await adapter.skip('c1');
    await adapter.reschedule({ scheduledCareId: 'c1', newDate: '2026-09-12', timeZone: 'UTC' });
    await adapter.undo('e1');
    expect(rpc.mock.calls.map((call) => call[0])).toEqual(['skip_care', 'reschedule_care', 'void_execution']);
  });

  it('maps a server-side state refusal to a conflict, so the screen reloads', async () => {
    const { client: c } = makeClient(ok(planRow), ok(careRows), ok(executionRows), {
      message: 'care is no longer planned',
      code: '23514',
    });
    await expect(createCareTrackingAdapter(c).skip('c1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('maps a missing or foreign care to a conflict too (never leaks which)', async () => {
    const { client: c } = makeClient(ok(planRow), ok(careRows), ok(executionRows), {
      message: 'care not found',
      code: 'P0002',
    });
    await expect(createCareTrackingAdapter(c).skip('c1')).rejects.toBeInstanceOf(ConflictError);
  });

  it('keeps a transport failure retryable rather than calling it a conflict', async () => {
    const { client: c } = makeClient(ok(planRow), ok(careRows), ok(executionRows), {
      message: 'network down',
    });
    await expect(
      createCareTrackingAdapter(c).complete({
        scheduledCareId: 'c1',
        clientExecutionId: 'k1',
        timeZone: 'UTC',
      }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });
});

/**
 * SPEC-017 — a explicação do cronograma depende de três colunas que a Hoje não desenha. Perder uma
 * delas do `select` não quebra nada em runtime: o campo vira `undefined`, `getById(undefined)`
 * falha, e a seção **some** — que é exatamente o comportamento de fail-closed correto, aplicado ao
 * caso errado. Sem esta asserção, o defeito viajaria com a suíte verde.
 */
describe('care tracking adapter — a origem do plano viaja no board (SPEC-017)', () => {
  it('pede explicitamente a origem e as versões de engine ao ler o plano ativo', async () => {
    const { client, selects } = makeClient(ok(planRow), ok(careRows), ok(executionRows));
    await createCareTrackingAdapter(client).getBoard();

    const planSelect = selects[0] ?? '';
    for (const column of ['hair_profile_id', 'assessment_algorithm_version', 'schedule_algorithm_version']) {
      expect(planSelect).toContain(column);
    }
  });
});

/**
 * SPEC-022 fatia 2 — pausar e retomar são RPC, e a previsão vem da **mesma** função que executa.
 * Uma segunda cópia da regra de deslocamento em TypeScript divergiria da primeira.
 */
describe('care tracking adapter — pausa (SPEC-022)', () => {
  const rpcClient = (rpc: jest.Mock) => ({ from: jest.fn(), rpc }) as unknown as SupabaseClient;

  it('pausa pela RPC, mandando só o fuso — o resto o servidor decide', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: null }));
    await createCareTrackingAdapter(rpcClient(rpc)).pause('America/Sao_Paulo');
    expect(rpc).toHaveBeenCalledWith('pause_plan', { p_timezone: 'America/Sao_Paulo' });
    // O `user_id` vem de `auth.uid()` dentro da função: nomeá-lo aqui seria o buraco que a RPC fecha.
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/user_id/);
  });

  it('a previsão e a execução são a mesma chamada, separadas por p_commit', async () => {
    const rpc = jest.fn(async () => ({
      data: [{ action: 'shifted', shift_days: 4, care_count: 3 }],
      error: null,
    }));
    const adapter = createCareTrackingAdapter(rpcClient(rpc));

    await expect(adapter.resume({ timeZone: 'America/Sao_Paulo', commit: false })).resolves.toEqual({
      action: 'shifted',
      shiftDays: 4,
      careCount: 3,
    });
    expect(rpc).toHaveBeenLastCalledWith('resume_plan', {
      p_timezone: 'America/Sao_Paulo',
      p_commit: false,
    });

    await adapter.resume({ timeZone: 'America/Sao_Paulo', commit: true });
    expect(rpc).toHaveBeenLastCalledWith('resume_plan', {
      p_timezone: 'America/Sao_Paulo',
      p_commit: true,
    });
  });

  /** Sem linha, não havia pausa aberta — no-op, não erro (EC2). */
  it('resposta vazia é "não estava pausado", não uma falha', async () => {
    const rpc = jest.fn(async () => ({ data: [], error: null }));
    await expect(
      createCareTrackingAdapter(rpcClient(rpc)).resume({ timeZone: 'America/Sao_Paulo', commit: true }),
    ).resolves.toEqual({ action: 'not_paused', shiftDays: 0, careCount: 0 });
  });

  it('rejeita quando o servidor recusa, em vez de relatar uma pausa que não aconteceu', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'no active plan' } }));
    await expect(createCareTrackingAdapter(rpcClient(rpc)).pause('America/Sao_Paulo')).rejects.toMatchObject({
      code: 'care.pause_failed',
    });
  });
});

/**
 * SPEC-022 EC5 — a pausa é lida **escopada ao plano ativo**. Uma pausa cujo plano foi substituído
 * por uma reavaliação já não pausa nada, e mostrá-la faria a Hoje dizer "pausado" sobre um
 * cronograma novo em folha.
 */
describe('care tracking adapter — a pausa vem escopada ao plano ativo (SPEC-022)', () => {
  it('traz a pausa aberta do plano ativo para o board', async () => {
    const { client } = makeClient(
      ok(planRow),
      ok(careRows),
      ok(executionRows),
      null,
      ok([]),
      { count: 0, error: null },
      ok({ paused_on: '2026-09-04' }),
    );
    const board = await createCareTrackingAdapter(client).getBoard();
    expect(board?.pausedOn).toBe('2026-09-04');
  });

  it('sem pausa aberta, o board diz que o cronograma está andando', async () => {
    const { client } = makeClient(ok(planRow), ok(careRows), ok(executionRows));
    const board = await createCareTrackingAdapter(client).getBoard();
    expect(board?.pausedOn).toBeNull();
  });
});
