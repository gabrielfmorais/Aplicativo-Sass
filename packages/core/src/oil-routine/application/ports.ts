import type { OilEvent, OilEventKind, OilRoutine } from '../domain/oil-routine.ts';

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
}
