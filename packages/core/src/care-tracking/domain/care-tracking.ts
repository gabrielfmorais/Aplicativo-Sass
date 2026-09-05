import type { CareTypeCode, ScheduledCare } from '../../schedule/index.ts';
import { addDays, diffDays, type LocalDate } from '../../shared/time/index.ts';
import type { Instant } from '../../shared/time/index.ts';
import { instantToEpochMs } from '../../shared/time/index.ts';

/**
 * SPEC-005 — what happened against the plan.
 *
 * `ScheduledCare` is the intention, `CareExecution` is the fact (BR2). Completing inserts a fact and
 * never rewrites the intention, which is why "done" is not a stored status: it is derived from the
 * existence of an *effective* execution (BR4, D-69/D-35).
 */
export type CareExecution = {
  readonly id: string;
  readonly scheduledCareId: string;
  /** Server instant; the undo window is measured from it (D-69/D-12). */
  readonly executedAt: string;
  /** The user's civil day, computed server-side from her IANA timezone (T22). */
  readonly executedOn: string;
  /** Non-null once undone. The row stays in history — it is never deleted (BR4c). */
  readonly voidedAt: string | null;
};

/**
 * How the care went, as the user reported it (SPEC-006). Anchored to one execution, never to a
 * scheduled care or a day: undoing an execution leaves its check-in on the voided row (BR3).
 */
export type CheckIn = {
  readonly id: string;
  readonly careExecutionId: string;
  /** 1..5, required. There is no empty check-in — without an answer there is no row (BR4). */
  readonly overallFeel: number;
};

/** The options offered for "Como ficou?" — the scale already approved in DATA-MODEL §3.8. */
export const CHECKIN_SCALE = [1, 2, 3, 4, 5] as const;

/**
 * SPEC-051 (`P13`) — **o que ela notou no cabelo**, ancorado no check-in.
 *
 * O problema está escrito no Blueprint §8, pelo dono: *"o check-in atual é uma nota de 1 a 5 […]
 * insuficiente para aprender: '3' não diz se o problema foi frizz, ressecamento ou o couro cabeludo
 * coçando"*. A camada de Insights lê **quatro** eixos de entrada e **um único número** como eixo de
 * resultado — e nenhuma engenharia de agregação melhora um sinal de um bit.
 *
 * ⚠️ **Registro, nunca diagnóstico.** *"Você marcou frizz"* é relato dela; *"seu cabelo está
 * danificado"* seria alegação capilar (D-26/D-70). Vocabulário `candidate`, PUBLIC RELEASE
 * bloqueado até sign-off — exatamente como o do `F38`.
 *
 * ⛔ **A metade `couro` do Blueprint §8 NÃO está aqui** (*sensível · coçando · descamando*): a
 * fronteira com sintoma clínico é fina, e ela é a **OQ2 da SPEC-025**, atrás de **duas** chaves que
 * não são do agente — base legal LGPD (D-32) e sign-off de domínio (D-26).
 *
 * ⚠️ **A lista mistura sinais de propósito.** Dar direção a cada qualidade
 * (`maciez boa`/`maciez ruim`) dobraria vocabulário e toques, e separar em *"o que ficou bom"* e
 * *"o que incomodou"* exigiria que **engenharia** decidisse que frizz é ruim — classificação de
 * valor que a lista plana do dono não faz. A nota de 1 a 5 continua carregando a valência geral.
 *
 * 🔒 **Mudar esta lista depois quebra a série histórica** (Blueprint §8): comparar ao longo do tempo
 * exige que a palavra signifique a mesma coisa em janeiro e em junho.
 */
export const CHECKIN_MARKS = ['softness', 'shine', 'frizz', 'definition', 'dryness'] as const;

export type CheckInMark = (typeof CHECKIN_MARKS)[number];

/** Undo window approved by D-69 (D-12): 15 minutes from `executedAt`. */
export const UNDO_WINDOW_MINUTES = 15;

/** How far ahead a care may be moved (BR8) — reuses the approved 28-day plan window (D-67). */
export const RESCHEDULE_HORIZON_DAYS = 28;

/**
 * The state of a planned care as the user sees it. All of it is derived: nothing here is a column.
 * `overdue` and `done` in particular are computed, never stored (BR3/BR4, AC12).
 */
export type CareOutcome = 'planned' | 'overdue' | 'done' | 'skipped' | 'rescheduled';

export type CareItem = {
  readonly id: string;
  readonly careTypeCode: CareTypeCode;
  readonly plannedDate: string;
  readonly outcome: CareOutcome;
  /** The effective execution, when the care is done. */
  readonly execution: CareExecution | null;
  /** The check-in for that execution, when there is one (SPEC-006). */
  readonly checkIn: CheckIn | null;
  /** Whole days between the planned day and today; 0 unless overdue. */
  readonly daysLate: number;
};

export type TodayView = {
  readonly overdue: readonly CareItem[];
  readonly today: readonly CareItem[];
  readonly upcoming: readonly CareItem[];
  readonly history: readonly CareItem[];
};

const isEffective = (e: CareExecution): boolean => e.voidedAt === null;

const outcomeOf = (
  care: ScheduledCare,
  execution: CareExecution | null,
  today: LocalDate,
  paused: boolean,
): CareOutcome => {
  // An effective execution wins: completing does not change `status`, so the fact is the truth (BR4).
  if (execution) return 'done';
  if (care.status === 'skipped') return 'skipped';
  if (care.status === 'rescheduled') return 'rescheduled';
  /**
   * SPEC-022 BR1 — **atraso pressupõe compromisso vigente.** Pausada, ela não combinou nada com
   * ninguém, então nada atrasou. O cuidado volta a ser o que sempre foi: uma intenção.
   *
   * Isto é o que faz a volta não ser uma avalanche, e faz o período pausado não contar contra ela
   * em nenhum número — `buildProgress` conta `overdue`, e aqui não há nenhum (FR6/G4).
   */
  if (paused) return 'planned';
  return care.plannedDate < today ? 'overdue' : 'planned';
};

const byDate =
  (direction: 1 | -1) =>
  (a: CareItem, b: CareItem): number =>
    a.plannedDate === b.plannedDate
      ? a.id.localeCompare(b.id) * direction
      : (a.plannedDate < b.plannedDate ? -1 : 1) * direction;

/**
 * Derives the daily board from the plan's cares and the executions recorded against them.
 *
 * Pure and deterministic (G7): `today` is an input, never read from a clock (ADR-008). The same
 * function feeds the screen and the tests, so what is asserted is what the user sees.
 */
export const buildTodayView = (
  cares: readonly ScheduledCare[],
  executions: readonly CareExecution[],
  today: LocalDate,
  checkIns: readonly CheckIn[] = [],
  /**
   * SPEC-022 — o dia em que ela pausou, ou `null`. Parâmetro, não estado global: a mesma função
   * serve a Hoje, ao ciclo e aos lembretes, e os três **têm** de enxergar a mesma pausa, ou duas
   * partes do app discordam sobre o mesmo plano (BR2).
   */
  pausedOn: string | null = null,
): TodayView => {
  const effectiveByCare = new Map<string, CareExecution>();
  for (const execution of executions) {
    if (isEffective(execution)) effectiveByCare.set(execution.scheduledCareId, execution);
  }
  // Keyed by execution, so a check-in made before an undo stays with the execution it describes
  // and never reappears on the replacement (BR3).
  const checkInByExecution = new Map<string, CheckIn>();
  for (const checkIn of checkIns) checkInByExecution.set(checkIn.careExecutionId, checkIn);

  const overdue: CareItem[] = [];
  const todayItems: CareItem[] = [];
  const upcoming: CareItem[] = [];
  const history: CareItem[] = [];

  for (const care of cares) {
    const execution = effectiveByCare.get(care.id) ?? null;
    const outcome = outcomeOf(care, execution, today, pausedOn !== null);
    const item: CareItem = {
      id: care.id,
      careTypeCode: care.careTypeCode,
      plannedDate: care.plannedDate,
      outcome,
      execution,
      checkIn: execution ? (checkInByExecution.get(execution.id) ?? null) : null,
      daysLate: outcome === 'overdue' ? diffDays(care.plannedDate as LocalDate, today) : 0,
    };

    if (outcome === 'overdue') overdue.push(item);
    else if (outcome === 'skipped' || outcome === 'rescheduled') history.push(item);
    else if (care.plannedDate === today) todayItems.push(item);
    else if (outcome === 'done') history.push(item);
    else upcoming.push(item);
  }

  return {
    overdue: overdue.sort(byDate(1)),
    today: todayItems.sort(byDate(1)),
    upcoming: upcoming.sort(byDate(1)),
    history: history.sort(byDate(-1)),
  };
};

/**
 * Whether the undo affordance should still be offered (D-69/D-12).
 *
 * The server is the authority — it re-checks the window and rejects a late call. This only decides
 * what to render, so the UI does not offer something that will fail. It is evaluated at render time
 * rather than on a ticker: if the window closes while the screen is open, the tap is refused and the
 * screen reloads, which is the same recovery path as any other conflict.
 */
export const canUndo = (execution: CareExecution, now: Instant): boolean => {
  if (execution.voidedAt !== null) return false;
  const elapsedMs = instantToEpochMs(now) - Date.parse(execution.executedAt);
  return elapsedMs >= 0 && elapsedMs <= UNDO_WINDOW_MINUTES * 60_000;
};

/** The inclusive range a care may be moved to (BR8). */
export const rescheduleRange = (today: LocalDate): { readonly from: LocalDate; readonly to: LocalDate } => ({
  from: today,
  to: addDays(today, RESCHEDULE_HORIZON_DAYS),
});

/**
 * A check-in is offered exactly once, on a care that is done and has none yet (FR1/FR3).
 * Skipping it is free: nothing in the daily loop depends on it (G6).
 */
export const canCheckIn = (item: CareItem): boolean =>
  item.outcome === 'done' && item.execution !== null && item.checkIn === null;
