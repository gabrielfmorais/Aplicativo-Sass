import type { OilEvent, OilEventKind, OilRoutine, OilRoutineTime } from '../domain/oil-routine.ts';

/**
 * SPEC-040 §7 (F39) — a rotina de óleo.
 *
 * **Leituras direto das tabelas sob RLS; escritas só por RPC.** O dia civil depende do fuso dela
 * (ADR-008) e a idempotência é do servidor — as duas pelo mesmo motivo da SPEC-020. O cliente não
 * tem `INSERT` em nenhuma das duas tabelas, e a usuária nunca é parâmetro: vem de `auth.uid()`.
 */
export interface OilRoutinePort {
  /** A rotina dela, ou `null` quando não existe — que é o estado inicial e um estado válido. */
  getRoutine(): Promise<OilRoutine | null>;
  /** Os eventos dela, do mais novo para o mais antigo. */
  listEvents(): Promise<readonly OilEvent[]>;
  /**
   * Liga a rotina ou troca o intervalo. `startedOn` é decidido pelo servidor, no fuso dela — trocar
   * o intervalo não o reescreve.
   */
  setRoutine(input: { everyDays: number; timeZone: string }): Promise<void>;
  /** Desliga. O histórico continua (FR2/BR5). */
  clearRoutine(): Promise<void>;
  /**
   * Registra o que aconteceu. Idempotente por `clientEventId`: dois toques ou um retry depois de
   * resposta perdida produzem **um** evento, não dois.
   */
  recordEvent(input: { kind: OilEventKind; clientEventId: string; timeZone: string }): Promise<void>;

  /**
   * SPEC-053 — os horários dela, em ordem cronológica.
   *
   * ⚠️ **Estas cinco operações NÃO passam por RPC**, e o precedente é a SPEC-023. As duas tabelas
   * acima exigem RPC porque guardam invariante de servidor — o dia civil vem do fuso dela e a
   * idempotência é do servidor. Um **horário do dia** não tem nenhum dos dois: é um `time` que ela
   * escolhe, e a duplicidade cai num índice único. Uma RPC aqui seria uma função `SECURITY DEFINER`
   * a mais na allowlist sem nenhum invariante para proteger.
   */
  listTimes(): Promise<readonly OilRoutineTime[]>;
  /** Recusa duplicata na fronteira: o mesmo `HH:MM` duas vezes não são dois lembretes (FR7). */
  addTime(input: { at: string }): Promise<void>;
  updateTime(input: { id: string; at: string }): Promise<void>;
  /** Desligar o lembrete **não** remove o horário — ele continua na rotina e registrável (FR3). */
  setTimeReminder(input: { id: string; enabled: boolean }): Promise<void>;
  removeTime(input: { id: string }): Promise<void>;
}
