import type { ProfilePort, UserProfile } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = { display_name: string | null };

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
    const { data, error } = await client.from('profiles').select('display_name').maybeSingle();
    if (error) throw new InfrastructureError('identity.profile_read_failed', error.message);
    if (!data) return null; // ainda não perguntamos — diferente de "ela não quis dizer"
    return { displayName: (data as Row).display_name };
  },

  async save(displayName: string | null): Promise<void> {
    const { error } = await client
      .from('profiles')
      .upsert({ user_id: currentUserId(), display_name: displayName }, { onConflict: 'user_id' });
    if (error) throw new InfrastructureError('identity.profile_write_failed', error.message);
  },
});
