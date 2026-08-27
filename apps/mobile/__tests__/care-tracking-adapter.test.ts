import { ConflictError, InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createCareTrackingAdapter } from '@/infrastructure/supabase/care-tracking-adapter';

const planRow = { id: 'plan-1', starts_on: '2026-09-01' };
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
const makeClient = (plan: Result, cares: Result, executions: Result, rpcError: unknown = null) => {
  const rpc = jest.fn(async (_fn: string, _args: Record<string, unknown>) => ({
    data: null,
    error: rpcError,
  }));
  const thenable = (result: Result) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => Promise.resolve(result),
      order: () => chain,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const from = jest.fn((table: string) =>
    table === 'hair_plans'
      ? thenable(plan)
      : table === 'scheduled_cares'
        ? thenable(cares)
        : thenable(executions),
  );
  return { client: { from, rpc } as unknown as SupabaseClient, rpc };
};

const ok = (data: unknown): Result => ({ data, error: null });

describe('care tracking adapter — reads (SPEC-005 §9)', () => {
  it('builds the board from the active plan, its cares and their executions', async () => {
    const { client } = makeClient(ok(planRow), ok(careRows), ok(executionRows));
    const boardResult = await createCareTrackingAdapter(client).getBoard();
    expect(boardResult).toEqual({
      planId: 'plan-1',
      startsOn: '2026-09-01',
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
