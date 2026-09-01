// ADR-006 / `core-context-isolation`: another context is entered only through its public index.
// Care Tracking → Progress is a published-language read model (DOMAIN-MAP §4).
import type { CareItem, TodayView } from '../../care-tracking/index.ts';

/**
 * Below this many answers the app shows the count but not the average (FR4).
 *
 * A display guard, not a statistical claim: one answer rendered as "média 5,0 de 5" reads like a
 * pattern when it is a single data point. It is deliberately documented as arbitrary.
 */
export const MIN_CHECKINS_FOR_AVERAGE = 3;

export type Progress = {
  /** Cares whose day has already been decided: done + skipped + overdue (BR1). */
  readonly elapsed: number;
  readonly done: number;
  readonly skipped: number;
  readonly overdue: number;
  /**
   * Ainda por vir. SPEC-021: o futuro não é acerto nem falha, e é justamente por isso que ele fica
   * numa contagem própria em vez de somar com "em aberto" — atrasado e planejado são estados
   * diferentes, e juntá-los faria um cronograma novo parecer um cronograma abandonado.
   */
  readonly planned: number;
  /**
   * Quantos cuidados o plano tem, do ponto de vista dela: `elapsed + planned`. **Reagendado fica
   * fora**, porque a linha que o substituiu é a que conta — somar as duas contaria um cuidado duas
   * vezes (BR2).
   */
  readonly total: number;
  readonly checkInCount: number;
  /**
   * Effective executions across every plan, superseded ones included (SPEC-014 BR5).
   *
   * Without this, the first reassessment would make everything she had done disappear from view:
   * the board only reads the active plan, so a brand-new plan reads as a brand-new user.
   */
  readonly lifetimeDone: number;
  /** Mean of her own answers, one decimal. `null` below the minimum (FR4). */
  readonly averageFeel: number | null;
};

/**
 * The plan summary, derived from the same read model the screen already built (SPEC-009 §9).
 *
 * Taking `TodayView` rather than raw rows is the point, not a convenience: outcome, "rescheduled
 * does not count" and "a voided execution takes its check-in with it" are already decided there.
 * Recomputing them here would be a second source of truth for the same fact (D-69) — and the two
 * copies would drift the first time either rule changed.
 *
 * Everything below is a count or an arithmetic mean of something she recorded herself. Nothing is
 * inferred, projected or compared across periods (BR5).
 */
export const buildProgress = (view: TodayView, lifetimeDone: number): Progress => {
  const all: readonly CareItem[] = [...view.overdue, ...view.today, ...view.upcoming, ...view.history];

  let done = 0;
  let skipped = 0;
  let overdue = 0;
  let planned = 0;
  const feels: number[] = [];

  for (const item of all) {
    switch (item.outcome) {
      case 'done':
        done += 1;
        break;
      case 'skipped':
        skipped += 1;
        break;
      case 'overdue':
        overdue += 1;
        break;
      // SPEC-021: contado, nunca julgado. O futuro entra no total do ciclo e em lugar nenhum que
      // se pareça com desempenho.
      case 'planned':
        planned += 1;
        break;
      // `rescheduled` is deliberately absent: the row that replaced it is the one that counts, and
      // counting both would double-count a single care (BR2).
      default:
        break;
    }
    // Reading the check-in off the item is what keeps a check-in whose execution was undone out of
    // the summary, by construction rather than by a parallel filter (BR3/BR4).
    if (item.checkIn) feels.push(item.checkIn.overallFeel);
  }

  const averageFeel =
    feels.length >= MIN_CHECKINS_FOR_AVERAGE
      ? Math.round((feels.reduce((sum, f) => sum + f, 0) / feels.length) * 10) / 10
      : null;

  return {
    elapsed: done + skipped + overdue,
    done,
    skipped,
    overdue,
    planned,
    total: done + skipped + overdue + planned,
    checkInCount: feels.length,
    averageFeel,
    lifetimeDone,
  };
};
