import type { SupabaseClient } from '@supabase/supabase-js';

import { createProfileAdapter } from '@/infrastructure/supabase/profile-adapter';

const USER = 'user-1';

const readClient = (result: { data: unknown; error: unknown }) =>
  ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ maybeSingle: jest.fn(async () => result) })),
    })),
  }) as unknown as SupabaseClient;

const writeClient = (upsert: jest.Mock) =>
  ({ from: jest.fn(() => ({ upsert })) }) as unknown as SupabaseClient;

/**
 * SPEC-018 — a distinção que este adapter existe para preservar: **linha ausente** é "ainda não
 * perguntamos", **`display_name` nulo** é "perguntamos e ela preferiu não dizer". Colapsar as duas
 * em `null` faria o app perguntar o nome a cada abertura exatamente a quem já disse não.
 */
describe('profile adapter (SPEC-018)', () => {
  it('lê o nome que ela deu', async () => {
    const client = readClient({ data: { display_name: 'Gabriela' }, error: null });
    await expect(createProfileAdapter(client, () => USER).get()).resolves.toEqual({
      displayName: 'Gabriela',
      avatar: null,
    });
  });

  it('linha com nome nulo é uma resposta, não uma ausência', async () => {
    const client = readClient({ data: { display_name: null }, error: null });
    await expect(createProfileAdapter(client, () => USER).get()).resolves.toEqual({
      displayName: null,
      avatar: null,
    });
  });

  it('linha ausente é a ausência da pergunta', async () => {
    const client = readClient({ data: null, error: null });
    await expect(createProfileAdapter(client, () => USER).get()).resolves.toBeNull();
  });

  /** Falhar não pode virar "nunca perguntamos": quem decide o que fazer com o erro é a rota. */
  it('rejeita numa leitura que falhou em vez de fingir que a linha não existe', async () => {
    const client = readClient({ data: null, error: { message: 'boom' } });
    await expect(createProfileAdapter(client, () => USER).get()).rejects.toMatchObject({
      code: 'identity.profile_read_failed',
    });
  });

  it('grava a própria linha, chaveada por user_id', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    await createProfileAdapter(writeClient(upsert), () => USER).save('Gabriela');
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER, display_name: 'Gabriela' },
      { onConflict: 'user_id' },
    );
  });

  it('grava a recusa como nulo — e continua sendo um upsert, nunca um delete', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    const client = writeClient(upsert);
    await createProfileAdapter(client, () => USER).save(null);
    expect(upsert).toHaveBeenCalledWith({ user_id: USER, display_name: null }, { onConflict: 'user_id' });
    expect((client.from as unknown as jest.Mock)('profiles')).not.toHaveProperty('delete');
  });

  it('rejeita numa escrita que falhou em vez de relatar um salvamento que não aconteceu', async () => {
    const upsert = jest.fn(async () => ({ error: { message: 'boom' } }));
    await expect(
      createProfileAdapter(writeClient(upsert), () => USER).save('Gabriela'),
    ).rejects.toMatchObject({
      code: 'identity.profile_write_failed',
    });
  });
});

/**
 * SPEC-042 (F34) — a marca da Huna que ela escolheu.
 */
describe('profile adapter — o avatar (SPEC-042)', () => {
  it('lê a marca escolhida', async () => {
    const client = readClient({ data: { display_name: 'Ana', avatar_key: 'flow_berry' }, error: null });
    await expect(createProfileAdapter(client, () => USER).get()).resolves.toEqual({
      displayName: 'Ana',
      avatar: 'flow_berry',
    });
  });

  /**
   * ⚠️ Um app antigo depois de a lista crescer receberia uma chave que não sabe desenhar. Tratar
   * como ausente devolve a inicial do nome — que é um estado válido e conhecido; deixar passar
   * devolveria um círculo vazio, que não é nada.
   */
  it('uma marca desconhecida vira ausência, não um círculo vazio', async () => {
    const client = readClient({ data: { display_name: 'Ana', avatar_key: 'flow_neon' }, error: null });
    await expect(createProfileAdapter(client, () => USER).get()).resolves.toEqual({
      displayName: 'Ana',
      avatar: null,
    });
  });
});
