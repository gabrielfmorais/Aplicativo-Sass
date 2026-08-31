import type { CareItem, CareOutcome, CareTypeCode, LocalDate } from '@app/core';
import { addDays } from '@app/core';

import { CARE_TYPE_LABEL } from '@/features/plan/copy';

/**
 * SPEC-016 slice 2 — the week strip: seven days, and what the plan puts on each of them.
 *
 * **Why this lives in the app and not in `packages/core`.** It decides nothing about care. Every
 * semantic judgement it renders — done, overdue, skipped — was already made by `buildTodayView`,
 * and this function only asks *which calendar cell* each item falls into. The two things it does
 * decide are locale choices, which is exactly what the UI layer owns: that a pt-BR week starts on
 * Sunday, and how a day is read aloud. Moving it into the domain would put a locale convention in
 * the engine and would also break SPEC-016 AC6, which keeps this whole SPEC out of the core.
 *
 * It is pure and takes `today` as an argument, never from a clock (ADR-008): the same call feeds the
 * screen and the tests.
 */

/** Sunday-first, matching the pt-BR calendar convention and `formatPlannedDate`. */
const WEEKDAY_INITIAL = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;

const WEEKDAY_NAME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

const MONTH_NAME = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/**
 * The states the strip can show, in words. `rescheduled` is absent on purpose: a care that was moved
 * away is no longer happening on its original day, and drawing it there would tell the user
 * something false about her week.
 */
const OUTCOME_WORD: Record<Exclude<CareOutcome, 'rescheduled'>, string> = {
  planned: 'planejada',
  overdue: 'atrasada',
  done: 'feita',
  skipped: 'pulada',
};

export type WeekCare = {
  readonly careTypeCode: CareTypeCode;
  readonly outcome: Exclude<CareOutcome, 'rescheduled'>;
};

export type WeekDay = {
  /** ISO `YYYY-MM-DD`. */
  readonly date: string;
  /** The single letter under which the dots sit. Ambiguous by design — the label below carries it. */
  readonly initial: string;
  readonly dayOfMonth: number;
  readonly isToday: boolean;
  readonly isPast: boolean;
  readonly cares: readonly WeekCare[];
  /**
   * The whole cell as a sentence, for assistive tech. A row of coloured dots is unreadable without
   * it, and "state explained by text, never by colour alone" is a rule here, not a nicety.
   */
  readonly label: string;
};

/** Parses an ISO civil date as plain numbers — never through a Date-with-offset (ADR-008). */
const partsOf = (isoDate: string): { y: number; m: number; d: number } => {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return { y, m, d };
};

const weekdayIndexOf = (isoDate: string): number => {
  const { y, m, d } = partsOf(isoDate);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/**
 * The seven days of the week containing `today`, each carrying the cares planned for it.
 *
 * `items` is every care on the board — the four buckets of `TodayView` concatenated — so the strip
 * and the sections below it can never disagree about what happened on a day.
 */
export const buildWeek = (items: readonly CareItem[], today: LocalDate): readonly WeekDay[] => {
  const start = addDays(today, -weekdayIndexOf(today));

  const byDate = new Map<string, WeekCare[]>();
  for (const item of items) {
    if (item.outcome === 'rescheduled') continue;
    const bucket = byDate.get(item.plannedDate) ?? [];
    bucket.push({ careTypeCode: item.careTypeCode, outcome: item.outcome });
    byDate.set(item.plannedDate, bucket);
  }

  return Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(start, offset) as string;
    const { m, d } = partsOf(date);
    const cares = byDate.get(date) ?? [];
    const isToday = date === today;

    const spoken = cares.map((c) => `${CARE_TYPE_LABEL[c.careTypeCode]}: ${OUTCOME_WORD[c.outcome]}`);
    const label = [
      `${WEEKDAY_NAME[offset]}, ${d} de ${MONTH_NAME[m - 1]}`,
      isToday ? 'hoje' : null,
      spoken.length > 0 ? spoken.join('. ') : 'sem cuidados',
    ]
      .filter((part): part is string => part !== null)
      .join('. ');

    return {
      date,
      initial: WEEKDAY_INITIAL[offset] ?? '',
      dayOfMonth: d,
      isToday,
      isPast: date < today,
      cares,
      label,
    };
  });
};
