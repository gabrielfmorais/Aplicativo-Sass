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
    ).resolves.toEqual([{ id: 'p1', name: 'Shampoo X', category: 'shampoo', catalog: null }]);
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
    ).resolves.toEqual({ id: 'p9', name: 'Máscara', category: 'mask', catalog: null });
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

/**
 * ⚠️ **SPEC-054 (F32) — a identidade do catálogo, e o que acontece quando ela não existe.**
 *
 * O que este bloco protege, em ordem: que a prateleira **sem catálogo continue byte a byte a de
 * hoje** (AC1) — porque é o estado de todas as prateleiras que existem —, e que a marca não suma em
 * silêncio quando o PostgREST devolver o embedding na outra forma.
 */
describe('product adapter — o vínculo com o catálogo (SPEC-054)', () => {
  const catalogRow = {
    id: 'c1',
    brand: 'Marca Fictícia',
    line: 'Linha',
    name: 'Shampoo Real',
    variant: '300ml',
    category: 'shampoo',
    image_url: 'https://exemplo.test/p.jpg',
  };
  const identity = {
    id: 'c1',
    brand: 'Marca Fictícia',
    line: 'Linha',
    name: 'Shampoo Real',
    variant: '300ml',
    category: 'shampoo',
    imageUrl: 'https://exemplo.test/p.jpg',
  };

  it('a leitura pede a identidade do catálogo junto, numa viagem só', async () => {
    const { client, order } = readClient({ data: [], error: null });
    await createProductAdapter(
      client,
      () => USER,
      () => NOW,
    ).list();
    const fromMock = client.from as unknown as jest.Mock;
    const selectArg = String(fromMock.mock.results[0]?.value.select.mock.calls[0]?.[0] ?? '');
    expect(selectArg).toContain('catalog_products');
    expect(selectArg).toContain('image_url');
    expect(order).toHaveBeenCalled();
  });

  /** ⚠️ **O caso de hoje**: sem vínculo, `catalog` é `null` — e `null` é o caminho completo. */
  it('sem vínculo, o produto é manual e nada muda', async () => {
    const { client } = readClient({
      data: [{ id: 'p1', name: 'Máscara da feira', category: 'mask', catalog_products: null }],
      error: null,
    });
    await expect(
      createProductAdapter(
        client,
        () => USER,
        () => NOW,
      ).list(),
    ).resolves.toEqual([{ id: 'p1', name: 'Máscara da feira', category: 'mask', catalog: null }]);
  });

  it('com vínculo, traz marca, linha, variante e imagem', async () => {
    const { client } = readClient({
      data: [{ id: 'p1', name: 'Meu shampoo', category: 'shampoo', catalog_products: catalogRow }],
      error: null,
    });
    await expect(
      createProductAdapter(
        client,
        () => USER,
        () => NOW,
      ).list(),
    ).resolves.toEqual([{ id: 'p1', name: 'Meu shampoo', category: 'shampoo', catalog: identity }]);
  });

  /**
   * ⚠️ **A forma de array, que a tipagem gerada afirma e o PostgREST às vezes devolve.** Tratar só o
   * objeto faria a marca **nunca aparecer** — e a prateleira ficaria idêntica à de um produto
   * manual: nada quebraria, nada acusaria. É a classe de defeito mais cara que existe.
   */
  it('aceita o embedding como array, sem a marca sumir em silêncio', async () => {
    const { client } = readClient({
      data: [{ id: 'p1', name: 'Meu shampoo', category: 'shampoo', catalog_products: [catalogRow] }],
      error: null,
    });
    const [p] = await createProductAdapter(
      client,
      () => USER,
      () => NOW,
    ).list();
    expect(p?.catalog).toEqual(identity);
  });

  /** FR7 — produto de catálogo **sem foto** é caminho normal, não estado de erro. */
  it('produto de catálogo sem imagem continua sendo produto de catálogo', async () => {
    const { client } = readClient({
      data: [
        {
          id: 'p1',
          name: 'Meu shampoo',
          category: 'shampoo',
          catalog_products: { ...catalogRow, image_url: null },
        },
      ],
      error: null,
    });
    const [p] = await createProductAdapter(
      client,
      () => USER,
      () => NOW,
    ).list();
    expect(p?.catalog?.brand).toBe('Marca Fictícia');
    expect(p?.catalog?.imageUrl).toBeNull();
  });

  it('adicionar do catálogo grava o vínculo; digitar não grava campo nenhum', async () => {
    const { client, insert } = writeClient({
      data: { id: 'p9', name: 'Meu shampoo', category: 'shampoo', catalog_products: catalogRow },
      error: null,
    });
    const adapter = createProductAdapter(
      client,
      () => USER,
      () => NOW,
    );

    await adapter.add({ name: 'Meu shampoo', category: 'shampoo', catalogProductId: 'c1' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ catalog_product_id: 'c1' }));

    const { client: c2, insert: insert2 } = writeClient({
      data: { id: 'p8', name: 'Digitado', category: 'other', catalog_products: null },
      error: null,
    });
    await createProductAdapter(
      c2,
      () => USER,
      () => NOW,
    ).add({ name: 'Digitado', category: 'other' });
    // `in`, e não igualdade: uma chave presente valendo `undefined` chegaria ao servidor como campo.
    const payload = ((insert2 as unknown as jest.Mock).mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
    expect('catalog_product_id' in payload).toBe(false);
  });
});
