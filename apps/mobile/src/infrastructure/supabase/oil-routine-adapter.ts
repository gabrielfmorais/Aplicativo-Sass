import type { OilEvent, OilEventKind, OilRoutine, OilRoutinePort, OilRoutineTime } from '@app/core';
import { InfrastructureError, localDateFromString } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const ROUTINES = 'oil_routines';
const EVENTS = 'oil_events';
const TIMES = 'oil_routine_times';

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
/**
 * ⚠️ O tipo `time` do Postgres volta como `HH:MM:SS`; o domínio e os lembretes falam `HH:MM`.
 * A conversão mora **aqui**, na fronteira, e não na tela: duas telas cortando a string do seu jeito
 * discordariam na primeira que esquecesse.
 */
const toHHMM = (t: string): string => t.slice(0, 5);

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
      .select('id, kind, happened_on, routine_time_id')
      .order('happened_on', { ascending: false });
    if (error) throw fail('oil.events_read_failed', error);
    return (
      data as { id: string; kind: OilEventKind; happened_on: string; routine_time_id: string | null }[]
    ).map((r) => ({
      id: r.id,
      kind: r.kind,
      happenedOn: localDateFromString(r.happened_on),
      // SPEC-053 FR5 — `null` é "registrei o dia", que é todo o histórico anterior a ela.
      routineTimeId: r.routine_time_id ?? null,
    }));
  },

  /**
   * SPEC-053 — os horários dela. ⚠️ **Escrita direta, sem RPC**, e o precedente é a SPEC-023: as
   * duas tabelas acima exigem RPC porque guardam invariante de servidor (o dia civil vem do fuso
   * dela, a idempotência é do servidor). Um horário do dia não tem nenhum dos dois.
   */
  async listTimes(): Promise<readonly OilRoutineTime[]> {
    const { data, error } = await client
      .from(TIMES)
      .select('id, time_local, reminder_enabled')
      .order('time_local', { ascending: true });
    if (error) throw fail('oil.times_read_failed', error);
    return (data as { id: string; time_local: string; reminder_enabled: boolean }[]).map((r) => ({
      id: r.id,
      at: toHHMM(r.time_local),
      reminderEnabled: r.reminder_enabled,
    }));
  },

  /**
   * ⚠️ **A duplicata é traduzida na fronteira, não repassada.** O índice único devolve `23505`, e
   * *"duplicate key value violates unique constraint"* não é uma frase que ela deva ler — o padrão é
   * o da Prateleira (SPEC-023).
   */
  async addTime({ at }): Promise<void> {
    const { data: session } = await client.auth.getUser();
    const userId = session.user?.id;
    if (!userId) throw new InfrastructureError('oil.time_write_failed', 'no session');
    const { error } = await client.from(TIMES).insert({ user_id: userId, time_local: at });
    if (error) {
      if (error.code === '23505') {
        throw new InfrastructureError('oil.time_duplicate', 'você já tem esse horário');
      }
      throw fail('oil.time_write_failed', error);
    }
  },

  async updateTime({ id, at }): Promise<void> {
    const { error } = await client
      .from(TIMES)
      // ⚠️ `updated_at` NÃO vem do cliente: ler o relógio do aparelho aqui é o que a ADR-008 proíbe,
      // e um carimbo de tempo do cliente é justamente o dado que não se pode acreditar.
      .update({ time_local: at })
      .eq('id', id);
    if (error) {
      if (error.code === '23505') {
        throw new InfrastructureError('oil.time_duplicate', 'você já tem esse horário');
      }
      throw fail('oil.time_write_failed', error);
    }
  },

  /** Desligar o lembrete **não** remove o horário: ele continua na rotina e registrável (FR3). */
  async setTimeReminder({ id, enabled }): Promise<void> {
    const { error } = await client.from(TIMES).update({ reminder_enabled: enabled }).eq('id', id);
    if (error) throw fail('oil.time_write_failed', error);
  },

  /**
   * ⚠️ Remover um horário **não** apaga o histórico dele: `oil_events.routine_time_id` é
   * `on delete set null`, então o evento continua existindo como *"registrei o dia"* (EC6/D-69).
   */
  async removeTime({ id }): Promise<void> {
    const { error } = await client.from(TIMES).delete().eq('id', id);
    if (error) throw fail('oil.time_delete_failed', error);
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
