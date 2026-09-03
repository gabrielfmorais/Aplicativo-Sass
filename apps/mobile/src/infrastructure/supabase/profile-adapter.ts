import type { ProfilePort, UserProfile } from '@app/core';
import { InfrastructureError, isHunaAvatar } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = { display_name: string | null; avatar_key: string | null };

/**
 * SPEC-018 §10 — sem RPC: a linha não guarda invariante de servidor. O `user_id` nunca vai como
 * filtro de leitura; `auth.uid()` decide qual linha é dela, então um cliente adulterado que peça
 * "todos os perfis" recebe exatamente um.
 *
 * `upsert` porque a resposta pode ser trocada — ela responde, depois apaga o nome, depois escreve
 * outro. Nunca `delete`: a existência da linha é o registro de que já perguntamos, e apagá-la faria
 * o app perguntar de novo a quem já respondeu.
 */
export const createProfileAdapter = (client: SupabaseClient, currentUserId: () => string): ProfilePort => ({
  async get(): Promise<UserProfile | null> {
    const { data, error } = await client.from('profiles').select('display_name, avatar_key').maybeSingle();
    if (error) throw new InfrastructureError('identity.profile_read_failed', error.message);
    if (!data) return null; // ainda não perguntamos — diferente de "ela não quis dizer"
    const row = data as Row;
    return {
      displayName: row.display_name,
      // Fora do vocabulário conhecido, trata como ausente: uma marca que este app não sabe desenhar
      // não pode virar um círculo vazio na tela (um cliente antigo depois de a lista crescer).
      avatar: row.avatar_key && isHunaAvatar(row.avatar_key) ? row.avatar_key : null,
    };
  },

  async save(displayName: string | null): Promise<void> {
    const { error } = await client
      .from('profiles')
      .upsert({ user_id: currentUserId(), display_name: displayName }, { onConflict: 'user_id' });
    if (error) throw new InfrastructureError('identity.profile_write_failed', error.message);
  },

  /**
   * SPEC-042 — **`update`, e não `upsert`**, e a diferença importa.
   *
   * Um `upsert` criaria a linha quando ela não existe, com `display_name` nulo — e na semântica da
   * SPEC-018 isso significa **"perguntamos o nome e ela preferiu não dizer"**. Escolher um avatar
   * passaria a apagar a pergunta do nome para sempre, sem que ninguém tivesse perguntado nada.
   *
   * A linha sempre existe quando o seletor aparece (o onboarding a cria), então o `update` é
   * suficiente; e no caso impossível ele não escreve nada, que é melhor do que escrever a mentira.
   */
  async saveAvatar(avatar): Promise<void> {
    const { error } = await client
      .from('profiles')
      .update({ avatar_key: avatar })
      .eq('user_id', currentUserId());
    if (error) throw new InfrastructureError('identity.profile_write_failed', error.message);
  },
});
