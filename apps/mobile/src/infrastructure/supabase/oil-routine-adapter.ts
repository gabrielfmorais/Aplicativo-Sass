import type { OilEvent, OilEventKind, OilRoutine, OilRoutinePort } from '@app/core';
import { InfrastructureError, localDateFromString } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const ROUTINES = 'oil_routines';
const EVENTS = 'oil_events';

const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * SPEC-040 §7 (F39) — leituras direto das tabelas sob RLS; **escritas só por RPC**.
 *
 * O dia civil depende do fuso dela (ADR-008) e `current_date` no servidor é UTC: deixar o cliente
 * mandar a data faria a verdade do histórico depender de um relógio que ele controla. A
 * idempotência por `client_event_id` é invariante de servidor pelo mesmo motivo de `complete_care`.
 *
 * A usuária nunca é parâmetro: vem de `auth.uid()` dentro das funções.
 */
export const createOilRoutineAdapter = (client: SupabaseClient): OilRoutinePort => ({
  async getRoutine(): Promise<OilRoutine | null> {
    const { data, error } = await client.from(ROUTINES).select('every_days, started_on').maybeSingle();
    if (error) throw fail('oil.routine_read_failed', error);
    const row = data as { every_days: number; started_on: string } | null;
    // Sem rotina é o estado inicial e um estado válido — nunca um erro (EC6).
    return row ? { everyDays: row.every_days, startedOn: localDateFromString(row.started_on) } : null;
  },

  async listEvents(): Promise<readonly OilEvent[]> {
    const { data, error } = await client
      .from(EVENTS)
      .select('id, kind, happened_on')
      .order('happened_on', { ascending: false });
    if (error) throw fail('oil.events_read_failed', error);
    return (data as { id: string; kind: OilEventKind; happened_on: string }[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      happenedOn: localDateFromString(r.happened_on),
    }));
  },

  async setRoutine({ everyDays, timeZone }): Promise<void> {
    const { error } = await client.rpc('set_oil_routine', {
      p_every_days: everyDays,
      p_timezone: timeZone,
    });
    if (error) throw fail('oil.routine_write_failed', error);
  },

  /**
   * Desligar é `DELETE` na própria linha — o único privilégio de escrita que o cliente tem aqui, e
   * ele não alcança o histórico: `oil_events` não tem grant de `DELETE` (FR2/BR5).
   */
  async clearRoutine(): Promise<void> {
    const { error } = await client.from(ROUTINES).delete().not('user_id', 'is', null);
    if (error) throw fail('oil.routine_clear_failed', error);
  },

  async recordEvent({ kind, clientEventId, timeZone }): Promise<void> {
    const { error } = await client.rpc('record_oil_event', {
      p_kind: kind,
      p_client_event_id: clientEventId,
      p_timezone: timeZone,
    });
    if (error) throw fail('oil.event_write_failed', error);
  },
});
