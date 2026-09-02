import { instantFromString } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createProductAdapter } from '@/infrastructure/supabase/product-adapter';

const USER = 'user-1';
const NOW = instantFromString('2026-09-01T12:00:00.000Z');

const readClient = (result: { data: unknown; error: unknown }) => {
  const order = jest.fn(async () => result);
  const is = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ is }));
  return { client: { from: jest.fn(() => ({ select })) } as unknown as SupabaseClient, is, order };
};

const writeClient = (result: { error: unknown; data?: unknown }) => {
  // `add` devolve o produto criado (SPEC-024 FR6), então o insert termina em `.select().single()`.
  const single = jest.fn(async () => ({ data: result.data ?? null, error: result.error }));
  const insertSelect = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select: insertSelect }));
  const eq = jest.fn(async () => result);
  const update = jest.fn(() => ({ eq }));
  return {
    client: { from: jest.fn(() => ({ insert, update })) } as unknown as SupabaseClient,
    insert,
    update,
    eq,
  };
};

/**
 * SPEC-023 §10 — tabela direta, sem RPC: a linha não guarda invariante de servidor. O que este
 * bloco protege é a fronteira: arquivados não vazam para a lista, e um código do Postgres não
 * chega à tela como erro cru.
 */
describe('product adapter (SPEC-023)', () => {
  it('lista só os ativos, mais recente primeiro', async () => {
    const { client, is, order } = readClient({
      data: [{ id: 'p1', name: 'Shampoo X', category: 'shampoo' }],
      error: null,
    });
    await expect(
      createProductAdapter(
        client,
        () => USER,
        () => NOW,
      ).list(),
    ).resolves.toEqual([{ id: 'p1', name: 'Shampoo X', category: 'shampoo' }]);
    // Arquivar tira da prateleira, não do banco: o filtro é aqui, a coluna é do servidor.
    expect(is).toHaveBeenCalledWith('archived_at', null);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('rejeita numa leitura que falhou em vez de devolver prateleira vazia', async () => {
    const { client } = readClient({ data: null, error: { message: 'boom' } });
    await expect(
      createProductAdapter(
        client,
        () => USER,
        () => NOW,
      ).list(),
    ).rejects.toMatchObject({
      code: 'hair_profile.product_list_failed',
    });
  });

  it('cadastra na própria linha — o `with check` valida o user_id — e devolve o produto criado', async () => {
    const { client, insert } = writeClient({
      error: null,
      data: { id: 'p9', name: 'Máscara', category: 'mask' },
    });
    // O id de volta é o que deixa o Wash Day marcar o que ela acabou de cadastrar (SPEC-024 FR6).
    await expect(
      createProductAdapter(
        client,
        () => USER,
        () => NOW,
      ).add({ name: 'Máscara', category: 'mask' }),
    ).resolves.toEqual({ id: 'p9', name: 'Máscara', category: 'mask' });
    expect(insert).toHaveBeenCalledWith({ user_id: USER, name: 'Máscara', category: 'mask' });
  });

  /** EC2 — o índice único do servidor vira uma frase, não uma falha. */
  it('traduz violação de unicidade em "duplicado", e o resto em falha', async () => {
    const dup = writeClient({ error: { message: 'duplicate key', code: '23505' } });
    await expect(
      createProductAdapter(
        dup.client,
        () => USER,
        () => NOW,
      ).add({ name: 'X', category: 'other' }),
    ).rejects.toMatchObject({ code: 'hair_profile.product_duplicate' });

    const other = writeClient({ error: { message: 'boom', code: '08006' } });
    await expect(
      createProductAdapter(
        other.client,
        () => USER,
        () => NOW,
      ).add({ name: 'X', category: 'other' }),
    ).rejects.toMatchObject({ code: 'hair_profile.product_add_failed' });
  });

  it('arquiva com UPDATE, nunca com DELETE', async () => {
    const { client, update, eq } = writeClient({ error: null });
    await createProductAdapter(
      client,
      () => USER,
      () => NOW,
    ).archive('p1');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ archived_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('id', 'p1');
    // O cliente nem tem o privilégio; o adapter não deve nem tentar.
    expect((client.from as unknown as jest.Mock)('products')).not.toHaveProperty('delete');
  });

  it('renomear reusa a mesma tradução de duplicata', async () => {
    const dup = writeClient({ error: { message: 'duplicate key', code: '23505' } });
    await expect(
      createProductAdapter(
        dup.client,
        () => USER,
        () => NOW,
      ).rename({ id: 'p1', name: 'X' }),
    ).rejects.toMatchObject({ code: 'hair_profile.product_duplicate' });
  });
});
