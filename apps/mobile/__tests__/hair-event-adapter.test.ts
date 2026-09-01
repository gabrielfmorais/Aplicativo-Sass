import type { SupabaseClient } from '@supabase/supabase-js';

import { createHairEventAdapter } from '@/infrastructure/supabase/hair-event-adapter';

const readClient = (result: { data: unknown; error: unknown }) => {
  const order = jest.fn();
  const chain = { order };
  order.mockReturnValue(chain);
  const is = jest.fn(() => chain);
  const select = jest.fn(() => ({ is }));
  const from = jest.fn(() => ({ select }));
  // A segunda chamada de `order` é a que resolve: o adapter ordena por dia e desempata por criação.
  order.mockReturnValueOnce(chain).mockReturnValueOnce(Promise.resolve(result) as never);
  return { client: { from } as unknown as SupabaseClient, select, is, order };
};

const rpcClient = (rpc: jest.Mock) => ({ rpc }) as unknown as SupabaseClient;

/**
 * SPEC-020 §10 — a leitura é da tabela sob RLS; **toda** escrita é RPC, porque o dia civil e a
 * idempotência são invariantes de servidor e `user_id` nunca é parâmetro.
 */
describe('hair event adapter (SPEC-020)', () => {
  it('lista só os não anulados, do mais recente para o mais antigo', async () => {
    const { client, is, order } = readClient({
      data: [
        { id: 'e1', event_type: 'haircut', occurred_on: '2026-08-30', created_at: '2026-08-30T10:00:00Z' },
      ],
      error: null,
    });
    await expect(createHairEventAdapter(client).list()).resolves.toEqual([
      { id: 'e1', eventType: 'haircut', occurredOn: '2026-08-30', createdAt: '2026-08-30T10:00:00Z' },
    ]);
    // Anulado some da lista, não do banco (BR6): o filtro é do adapter, a coluna é do servidor.
    expect(is).toHaveBeenCalledWith('voided_at', null);
    expect(order).toHaveBeenCalledWith('occurred_on', { ascending: false });
  });

  it('rejeita numa leitura que falhou em vez de devolver lista vazia', async () => {
    const { client } = readClient({ data: null, error: { message: 'boom' } });
    await expect(createHairEventAdapter(client).list()).rejects.toMatchObject({
      code: 'hair_event.list_failed',
    });
  });

  it('registra pela RPC, com a chave de idempotência e o fuso dela — e sem user_id', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    await createHairEventAdapter(rpcClient(rpc)).record({
      eventType: 'bleaching_or_highlights',
      occurredOn: '2026-09-01',
      clientEventId: 'ev-1',
      timeZone: 'America/Sao_Paulo',
    });
    expect(rpc).toHaveBeenCalledWith('record_hair_event', {
      p_event_type: 'bleaching_or_highlights',
      p_occurred_on: '2026-09-01',
      p_client_event_id: 'ev-1',
      p_timezone: 'America/Sao_Paulo',
    });
    // O `user_id` vem de `auth.uid()` dentro da função: nomeá-lo aqui seria o buraco que a RPC fecha.
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/user_id/);
  });

  it('anula pela RPC e rejeita quando o servidor recusa', async () => {
    const ok = jest.fn(async () => ({ error: null }));
    await createHairEventAdapter(rpcClient(ok)).void('e1');
    expect(ok).toHaveBeenCalledWith('void_hair_event', { p_event_id: 'e1' });

    const bad = jest.fn(async () => ({ error: { message: 'not found' } }));
    await expect(createHairEventAdapter(rpcClient(bad)).void('e9')).rejects.toMatchObject({
      code: 'hair_event.void_failed',
    });
  });

  it('rejeita numa gravação que falhou em vez de relatar um registro que não aconteceu', async () => {
    const rpc = jest.fn(async () => ({ error: { message: 'boom' } }));
    await expect(
      createHairEventAdapter(rpcClient(rpc)).record({
        eventType: 'haircut',
        occurredOn: '2026-09-01',
        clientEventId: 'ev-1',
        timeZone: 'America/Sao_Paulo',
      }),
    ).rejects.toMatchObject({ code: 'hair_event.record_failed' });
  });
});
