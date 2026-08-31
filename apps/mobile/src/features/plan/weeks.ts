import type { LocalDate } from '@app/core';
import { diffDays } from '@app/core';

/**
 * SPEC-016 slice 3 — the plan preview, grouped the way it is actually lived.
 *
 * A flat list of twelve dates is accurate and says nothing. The one thing the preview has to
 * communicate is **rhythm** — "this is what my weeks look like now" — and a week is the unit the
 * schedule engine already thinks in (the plan is four of them, D-67). Grouping is the difference
 * between reading a table and recognising a routine.
 *
 * Pure, and `startsOn` is an argument rather than a clock (ADR-008). Like `buildWeek` on the daily
 * screen, this decides nothing about care: it only buckets by elapsed days, and the engine has
 * already chosen every date. It stays in the app for the same reason (SPEC-016 AC6).
 */

export type PlanWeek<T> = {
  /** 1-based, for display. */
  readonly number: number;
  readonly items: readonly T[];
};

/**
 * Buckets items into consecutive 7-day windows from `startsOn`.
 *
 * Weeks with nothing in them are dropped rather than rendered empty: a card saying "Semana 3" over
 * blank space reads as something missing, and a plan simply may not place a care in every window.
 */
export const groupIntoWeeks = <T extends { readonly plannedDate: string }>(
  items: readonly T[],
  startsOn: LocalDate,
): readonly PlanWeek<T>[] => {
  const byWeek = new Map<number, T[]>();
  for (const item of items) {
    // A care before the start date would be a bug upstream, not something to hide: clamp to the
    // first week so it stays visible instead of vanishing into a negative bucket.
    const elapsed = Math.max(diffDays(startsOn, item.plannedDate as LocalDate), 0);
    const week = Math.floor(elapsed / 7);
    const bucket = byWeek.get(week) ?? [];
    bucket.push(item);
    byWeek.set(week, bucket);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, weekItems]) => ({ number: index + 1, items: weekItems }));
};
