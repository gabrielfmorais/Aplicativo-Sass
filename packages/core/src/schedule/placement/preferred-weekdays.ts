import { addDays, weekdayOf, type LocalDate, type Weekday } from '../../shared/time/index.ts';
import type { ScheduledCareDraft } from '../domain/plan.ts';

/**
 * SPEC-015 — the premium `plan_customization` capability, as a **placement layer**.
 *
 * This is deliberately NOT part of the rules engine (`../engine/v1/`), which stays byte-identical
 * and `candidate` (D-26/D-67, ADR-007): moving a care to a weekday she prefers is scheduling
 * convenience, not hair-care science. The engine decides **which** cares and **how often**; this
 * only decides **when** each one lands, and it is forbidden from changing anything else:
 *
 *   INVARIANT — the result has the same length and the same care types in the same order as the
 *   list it was given; the dates are distinct, ascending, and inside the plan window. Only dates
 *   move.
 *
 * That invariant is what makes the capability sellable without touching the domain gate (G3/AC4).
 */

/** Her routine, expressed as the weekdays she wants her cares on (`0` = Sunday … `6` = Saturday). */
export type PlanPreferences = {
  readonly preferredWeekdays: readonly Weekday[];
};

export type WeekdayPlacementResult = {
  readonly cares: readonly ScheduledCareDraft[];
  /**
   * False when at least one care could not land on a preferred weekday — her cadence needs more
   * days per week than she chose (EC1). Nothing is dropped or thinned when that happens: the care
   * keeps the day the engine picked, and the app says so rather than pretending (OQ4).
   */
  readonly fullyHonoured: boolean;
};

/**
 * Candidate day-shifts, nearest first; on a tie the earlier day wins so a plan never drifts later
 * than the engine intended. Three days reaches any weekday from any weekday, so this is exhaustive.
 */
const SHIFTS: readonly number[] = [0, -1, 1, -2, 2, -3, 3];

export const normalizePreferredWeekdays = (weekdays: readonly Weekday[]): readonly Weekday[] =>
  [...new Set(weekdays)].sort((a, b) => a - b);

/**
 * Moves each care to the preferred weekday nearest the day the engine chose.
 *
 * Two rules keep the result well-formed. A day already used is never reused, so no two cares
 * collapse onto one day. And a care may never be shifted onto **another** care's engine day, which
 * is what guarantees the fallback below is always available: when no preferred day is free, inside
 * the window and on/after the start, the care simply keeps its engine date. The layer degrades
 * into the default plan, never into a broken one (FR5/EC1).
 *
 * Pure and deterministic: no clock, no randomness (ADR-007/D-06).
 */
export const applyPreferredWeekdays = (
  cares: readonly ScheduledCareDraft[],
  startsOn: LocalDate,
  windowDays: number,
  preferences: PlanPreferences,
): WeekdayPlacementResult => {
  const allowed = normalizePreferredWeekdays(preferences.preferredWeekdays);
  // Nothing chosen, or every day chosen: the preference says nothing, so the engine's plan stands.
  if (allowed.length === 0 || allowed.length === 7) return { cares, fullyHonoured: true };

  const lastDay = addDays(startsOn, windowDays - 1);
  const engineDates = new Set<string>(cares.map((c) => c.plannedDate));
  const taken = new Set<string>();
  let fullyHonoured = true;

  const placed = cares.map((care) => {
    const preferred = SHIFTS.map((shift) => addDays(care.plannedDate, shift)).find(
      (candidate) =>
        allowed.includes(weekdayOf(candidate)) &&
        !taken.has(candidate) &&
        candidate >= startsOn &&
        candidate <= lastDay &&
        // Never squat on a day another care is entitled to fall back to.
        (candidate === care.plannedDate || !engineDates.has(candidate)),
    );

    if (preferred === undefined) fullyHonoured = false;
    const date = preferred ?? care.plannedDate;
    taken.add(date);
    return date;
  });

  // Placement must never reorder her plan: a later care landing before an earlier one would make
  // "your next care" lie. Sorting the chosen days and handing them back out in order keeps the
  // timeline ascending while the care types keep the sequence the cycle rule gave them.
  const ascending = [...placed].sort();
  return {
    cares: cares.map((care, i) => ({
      careTypeCode: care.careTypeCode,
      plannedDate: ascending[i] as LocalDate,
    })),
    fullyHonoured,
  };
};
