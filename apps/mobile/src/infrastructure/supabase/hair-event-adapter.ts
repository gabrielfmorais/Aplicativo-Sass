import type { HairEvent, HairEventPort, HairEventType } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = {
  id: string;
  event_type: HairEventType;
  occurred_on: string;
  created_at: string;
};

const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * SPEC-020 §10 — leitura direta, escrita só por RPC.
 *
 * A tabela concede **apenas `SELECT`** ao cliente: o dia civil ("um evento não pode ser no futuro")
 * e a idempotência são invariantes de servidor, e `user_id` nunca é parâmetro — vem de `auth.uid()`
 * dentro da função. Um cliente adulterado não tem como nomear outra pessoa nem duplicar um evento.
 *
 * O filtro de anulados fica **aqui e no servidor**: `voided_at is null` no `select` é o que a lista
 * mostra, e a RPC de anular é a única que escreve a coluna. Ler sem o filtro devolveria o histórico
 * inteiro, que é o que o banco guarda de propósito e não é o que esta tela conta.
 */
export const createHairEventAdapter = (client: SupabaseClient): HairEventPort => ({
  async list(): Promise<readonly HairEvent[]> {
    const { data, error } = await client
      .from('hair_events')
      .select('id, event_type, occurred_on, created_at')
      .is('voided_at', null)
      // O que ela declarou primeiro é o que aconteceu por último: a ordem é a da vida dela, e
      // `created_at` desempata dois eventos do mesmo dia pela ordem em que ela os contou.
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw fail('hair_event.list_failed', error);
    return (data as Row[]).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      occurredOn: row.occurred_on,
      createdAt: row.created_at,
    }));
  },

  async record({ eventType, occurredOn, clientEventId, timeZone }): Promise<void> {
    const { error } = await client.rpc('record_hair_event', {
      p_event_type: eventType,
      p_occurred_on: occurredOn,
      p_client_event_id: clientEventId,
      p_timezone: timeZone,
    });
    if (error) throw fail('hair_event.record_failed', error);
  },

  async void(eventId: string): Promise<void> {
    const { error } = await client.rpc('void_hair_event', { p_event_id: eventId });
    if (error) throw fail('hair_event.void_failed', error);
  },
});
