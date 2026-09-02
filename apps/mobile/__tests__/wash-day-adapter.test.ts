import type { SupabaseClient } from '@supabase/supabase-js';

import { createWashDayAdapter } from '@/infrastructure/supabase/wash-day-adapter';

const USER = 'user-1';
const EXECUTION = 'exec-1';
const HUB_ID = 'wash-1';

type Result = { data: unknown; error: unknown };

/**
 * Duplo mínimo do PostgREST cobrindo as três formas que o adapter usa:
 * `.upsert().select()`, `.select().eq().maybeSingle()`/`.eq()` e `.insert()` / `.delete().eq().eq()`.
 */
const makeClient = (over: Partial<Record<string, Result>> = {}) => {
  const calls = {
    upsert: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    in: jest.fn(),
    is: jest.fn(),
  };
  const results = {
    upsert: { data: [], error: null } as Result,
    hub: { data: null, error: null } as Result,
    products: { data: [], error: null } as Result,
    // A leitura dos produtos marcados, **sem** filtro de arquivado (BR3/AC4).
    shelf: { data: [], error: null } as Result,
    techniques: { data: [], error: null } as Result,
    scalp: { data: null, error: null } as Result,
    // A escrita do couro tem resultado próprio: o `upsert` de `wash_days` (criar o hub) e o de
    // `wash_day_scalp` são chamadas diferentes, e um resultado só para os dois faria o teste de
    // falha do couro tropeçar na criação do hub e passar pelo motivo errado.
    scalpWrite: { data: null, error: null } as Result,
    write: { data: null, error: null } as Result,
    ...over,
  };

  const from = jest.fn((table: string) => {
    const rows =
      table === 'wash_days'
        ? results.hub
        : table === 'wash_day_products'
          ? results.products
          : table === 'products'
            ? results.shelf
            : table === 'wash_day_scalp'
              ? results.scalp
              : results.techniques;
    const chain = {
      select: () => chain,
      eq: (column: string, value: unknown) => {
        calls.eq(table, column, value);
        return chain;
      },
      in: (column: string, values: unknown) => {
        calls.in(table, column, values);
        return chain;
      },
      is: (column: string, value: unknown) => {
        calls.is(table, column, value);
        return chain;
      },
      maybeSingle: async () => rows,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    };
    return {
      ...chain,
      upsert: (values: unknown, options: unknown) => {
        calls.upsert(table, values, options);
        const result = table === 'wash_day_scalp' ? results.scalpWrite : results.upsert;
        // Thenable **e** encadeável: `hubFor` termina em `.select()`, e `setScalpFeel` termina no
        // próprio upsert. Sem o `then`, um upsert que falha voltaria como sucesso e o teste de erro
        // passaria sem exercitar nada.
        return {
          select: async () => result,
          then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
      },
      insert: async (values: unknown) => {
        calls.insert(table, values);
        return results.write;
      },
      delete: () => {
        calls.delete(table);
        return chain;
      },
    };
  });

  return { client: { from } as unknown as SupabaseClient, calls, from };
};

const adapterOf = (client: SupabaseClient) => createWashDayAdapter(client, () => USER);

/**
 * SPEC-024 §9/§10 — sem RPC. O que este bloco protege é a fronteira: o hub nasce uma vez, uma
 * marcação repetida não vira erro, e uma leitura que falhou nunca se parece com "ela não marcou
 * nada".
 */
describe('wash day adapter (SPEC-024)', () => {
  it('nunca aberto: devolve registro vazio sem ir buscar junção nenhuma', async () => {
    const { client, from } = makeClient();
    await expect(adapterOf(client).getFor(EXECUTION)).resolves.toEqual({
      washDayId: null,
      products: [],
      techniques: [],
      scalpFeel: null,
    });
    // Uma consulta só. Buscar produtos de um hub que não existe é trabalho e é uma chance a mais de
    // a tela mostrar vazio por causa de erro.
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('lê o que ela marcou, com o nome do produto', async () => {
    const { client, calls } = makeClient({
      hub: { data: { id: HUB_ID }, error: null },
      products: { data: [{ product_id: 'p1' }], error: null },
      shelf: { data: [{ id: 'p1', name: 'Máscara da feira', category: 'mask' }], error: null },
      techniques: { data: [{ technique: 'co_wash' }], error: null },
    });
    await expect(adapterOf(client).getFor(EXECUTION)).resolves.toEqual({
      washDayId: HUB_ID,
      products: [{ id: 'p1', name: 'Máscara da feira', category: 'mask' }],
      techniques: ['co_wash'],
      scalpFeel: null,
    });
    // BR3/AC4 — **sem** `archived_at is null`: o vidro que ela usou e depois tirou de casa continua
    // tendo sido usado, e o registro não pode esquecê-lo.
    expect(calls.in).toHaveBeenCalledWith('products', 'id', ['p1']);
    expect(calls.is).not.toHaveBeenCalledWith('products', 'archived_at', null);
  });

  /** §16 — uma leitura que falhou é erro, nunca um registro vazio. */
  it('rejeita numa leitura que falhou', async () => {
    const { client } = makeClient({ hub: { data: null, error: { message: 'boom' } } });
    await expect(adapterOf(client).getFor(EXECUTION)).rejects.toMatchObject({
      code: 'care.wash_day_read_failed',
    });
  });

  /**
   * O hub nasce na **primeira marcação**, com `ON CONFLICT DO NOTHING`: dois toques simultâneos no
   * primeiro chip não brigam. E ele nasce **uma vez** — a segunda marcação não repete a viagem.
   */
  it('cria o hub uma vez e reusa nas marcações seguintes', async () => {
    const { client, calls } = makeClient({ upsert: { data: [{ id: HUB_ID }], error: null } });
    const adapter = adapterOf(client);

    await adapter.markProduct({ careExecutionId: EXECUTION, productId: 'p1', used: true });
    await adapter.markTechnique({ careExecutionId: EXECUTION, technique: 'diffuser', used: true });

    expect(calls.upsert).toHaveBeenCalledTimes(1);
    expect(calls.upsert).toHaveBeenCalledWith(
      'wash_days',
      { user_id: USER, care_execution_id: EXECUTION },
      { onConflict: 'care_execution_id', ignoreDuplicates: true },
    );
    expect(calls.insert).toHaveBeenCalledWith('wash_day_products', {
      wash_day_id: HUB_ID,
      product_id: 'p1',
      user_id: USER,
    });
    expect(calls.insert).toHaveBeenCalledWith('wash_day_techniques', {
      wash_day_id: HUB_ID,
      technique: 'diffuser',
      user_id: USER,
    });
  });

  /** O hub já existia: o upsert não devolve linha, e o id vem da leitura seguinte. */
  it('reencontra o hub quando o upsert não devolve linha', async () => {
    const { client, calls } = makeClient({ hub: { data: { id: HUB_ID }, error: null } });
    await adapterOf(client).markProduct({ careExecutionId: EXECUTION, productId: 'p1', used: true });
    expect(calls.insert).toHaveBeenCalledWith('wash_day_products', {
      wash_day_id: HUB_ID,
      product_id: 'p1',
      user_id: USER,
    });
  });

  /**
   * EC5 — marcar o que já está marcado é o estado que ela pediu. Um retry depois de resposta perdida
   * não pode devolver falha para uma marcação que entrou.
   */
  it('absorve a violação de unicidade em vez de tratá-la como falha', async () => {
    const { client } = makeClient({
      upsert: { data: [{ id: HUB_ID }], error: null },
      write: { data: null, error: { message: 'duplicate key', code: '23505' } },
    });
    await expect(
      adapterOf(client).markProduct({ careExecutionId: EXECUTION, productId: 'p1', used: true }),
    ).resolves.toBeUndefined();
  });

  it('uma falha real de escrita continua sendo falha', async () => {
    const { client } = makeClient({
      upsert: { data: [{ id: HUB_ID }], error: null },
      write: { data: null, error: { message: 'rede', code: '08006' } },
    });
    await expect(
      adapterOf(client).markProduct({ careExecutionId: EXECUTION, productId: 'p1', used: true }),
    ).rejects.toMatchObject({ code: 'care.wash_day_mark_failed' });
  });

  /**
   * SPEC-025 — trocar de resposta é **uma** escrita. Um delete+insert deixaria uma janela em que
   * ela ficou sem resposta se a segunda metade falhasse, e é por isso que o `UPDATE` desta tabela
   * está na allowlist.
   */
  it('define o couro por upsert, nunca por apaga-e-escreve', async () => {
    const { client, calls } = makeClient({ upsert: { data: [{ id: HUB_ID }], error: null } });
    await adapterOf(client).setScalpFeel({ careExecutionId: EXECUTION, scalpFeel: 'balanced' });
    expect(calls.upsert).toHaveBeenCalledWith(
      'wash_day_scalp',
      { wash_day_id: HUB_ID, scalp_feel: 'balanced', user_id: USER },
      { onConflict: 'wash_day_id' },
    );
    expect(calls.delete).not.toHaveBeenCalledWith('wash_day_scalp');
  });

  it('uma falha ao gravar o couro continua sendo falha', async () => {
    const { client } = makeClient({
      upsert: { data: [{ id: HUB_ID }], error: null },
      scalpWrite: { data: null, error: { message: 'rede' } },
    });
    await expect(
      adapterOf(client).setScalpFeel({ careExecutionId: EXECUTION, scalpFeel: 'balanced' }),
    ).rejects.toMatchObject({ code: 'care.wash_day_scalp_failed' });
  });

  it('tirar a resposta apaga a linha, e o registro do dia fica', async () => {
    const { client, calls } = makeClient({ upsert: { data: [{ id: HUB_ID }], error: null } });
    await adapterOf(client).setScalpFeel({ careExecutionId: EXECUTION, scalpFeel: null });
    expect(calls.delete).toHaveBeenCalledWith('wash_day_scalp');
    expect(calls.eq).toHaveBeenCalledWith('wash_day_scalp', 'wash_day_id', HUB_ID);
  });

  /** Desmarcar remove a linha da junção — ela está corrigindo o que marcou, não apagando histórico. */
  it('desmarcar apaga a linha da junção, escopada ao hub e ao item', async () => {
    const { client, calls } = makeClient({ upsert: { data: [{ id: HUB_ID }], error: null } });
    await adapterOf(client).markTechnique({
      careExecutionId: EXECUTION,
      technique: 'co_wash',
      used: false,
    });
    expect(calls.delete).toHaveBeenCalledWith('wash_day_techniques');
    expect(calls.eq).toHaveBeenCalledWith('wash_day_techniques', 'wash_day_id', HUB_ID);
    expect(calls.eq).toHaveBeenCalledWith('wash_day_techniques', 'technique', 'co_wash');
    // `user_id` nunca vai como filtro: quem decide é `auth.uid()` pela RLS.
    expect(calls.eq).not.toHaveBeenCalledWith('wash_day_techniques', 'user_id', USER);
  });
});
