import type { ScheduledCare } from '../../schedule/index.ts';
import type { CareExecution, CheckIn } from '../domain/care-tracking.ts';

/** Everything the daily screen needs, in one read: the active plan, its cares and their executions. */
/**
 * SPEC-022 — o que a retomada faz, decidido pelo servidor (D-98).
 *
 * `shifted`: o que sobrou anda `shiftDays` dias, preservando os intervalos que o engine calculou.
 * `new_cycle`: o deslocamento não cabe no ciclo — a volta oferece montar o próximo.
 * `not_paused`: não havia pausa aberta. No-op, não erro.
 */
export type ResumeOutcome = {
  readonly action: 'shifted' | 'new_cycle' | 'not_paused';
  readonly shiftDays: number;
  readonly careCount: number;
};

export type CareBoard = {
  readonly planId: string;
  readonly startsOn: string;
  /**
   * SPEC-017 — o snapshot de perfil que **gerou** este plano, não o perfil de hoje.
   *
   * A diferença não é acadêmica: reavaliar e desistir no meio deixa um perfil novo salvo e o plano
   * antigo ativo (SPEC-014 G3). Explicar o cronograma a partir do perfil corrente descreveria, com
   * toda a confiança, um plano que ela não tem.
   */
  readonly hairProfileId: string;
  /**
   * As versões de engine registradas no plano. Existem para a explicação poder se **calar** quando
   * não puder ser reproduzida: uma engine futura leria o mesmo snapshot de outro jeito, e uma
   * explicação plausível e errada é pior que nenhuma (SPEC-017 FR4).
   *
   * São **duas** porque a evidência que ela leu no preview também é de duas: a avaliação diz o que
   * ela quer e tem, o cronograma diz como isso virou frequência.
   */
  readonly assessmentAlgorithmVersion: string;
  readonly scheduleAlgorithmVersion: string;
  /**
   * SPEC-022 — o dia em que ela parou, ou `null` quando o cronograma está andando.
   *
   * **É o estado inteiro.** Não existe coluna "pausado": uma pausa é uma linha com `resumed_on`
   * nulo, e o board carrega a data porque `buildTodayView` precisa dela para decidir que nada
   * atrasou — atraso pressupõe compromisso vigente (BR1).
   */
  readonly pausedOn: string | null;
  readonly cares: readonly ScheduledCare[];
  readonly executions: readonly CareExecution[];
  /** Check-ins for those executions (SPEC-006); empty until the user answers one. */
  readonly checkIns: readonly CheckIn[];
  /**
   * Effective executions across ALL her plans, superseded included (SPEC-014). Counted rather than
   * fetched: the summary needs the number, never the rows.
   */
  readonly lifetimeDoneCount: number;
};

/**
 * Implemented by apps/mobile infrastructure (SPEC-005 §9).
 *
 * Reads go straight to the tables under RLS; every write goes through a `SECURITY DEFINER` RPC,
 * because the client holds no write privilege on either table (§10). The user is never a parameter:
 * the server takes it from `auth.uid()`.
 */
export interface CareTrackingPort {
  /** The active plan's board, or null when the user has no active plan. */
  getBoard(): Promise<CareBoard | null>;
  /**
   * Records a care as done. Idempotent by `clientExecutionId`: the same key returns the same fact,
   * so a retry after a lost response cannot create a second execution (AC3).
   */
  complete(input: { scheduledCareId: string; clientExecutionId: string; timeZone: string }): Promise<void>;
  skip(scheduledCareId: string): Promise<void>;
  reschedule(input: { scheduledCareId: string; newDate: string; timeZone: string }): Promise<void>;
  /**
   * SPEC-022 — para o cronograma. Idempotente: pausar de novo devolve a pausa que já está aberta.
   */
  pause(timeZone: string): Promise<void>;
  /**
   * Retoma, ou apenas **conta o que aconteceria** (`commit: false`).
   *
   * O Blueprint exige que ela saiba antes de confirmar, e a previsão vem do servidor pela mesma
   * função que executa — uma segunda cópia da regra de deslocamento em TypeScript divergiria da
   * primeira na primeira vez que qualquer uma das duas mudasse.
   */
  resume(input: { timeZone: string; commit: boolean }): Promise<ResumeOutcome>;
  /** Undoes an accidental execution inside the approved window (D-69/D-12). */
  undo(executionId: string): Promise<void>;
  /**
   * Records how the care went (SPEC-006). Idempotent by `clientCheckinId`, and refused by the
   * server if the execution was undone or already has a check-in.
   */
  submitCheckIn(input: {
    careExecutionId: string;
    overallFeel: number;
    clientCheckinId: string;
  }): Promise<void>;
}
