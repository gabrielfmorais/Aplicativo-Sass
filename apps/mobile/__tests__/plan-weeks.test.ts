import type { LocalDate } from '@app/core';

import { groupIntoWeeks } from '@/features/plan/weeks';

/**
 * SPEC-016 slice 3 — the preview's only logic. The screen test asserts what she reads; this pins
 * the bucketing underneath, which is where week grouping goes wrong: on the boundary days.
 */

const care = (plannedDate: string) => ({ plannedDate });

describe('groupIntoWeeks', () => {
  const start = '2026-08-31' as LocalDate; // a Monday

  it('puts days 0 through 6 in week 1 and day 7 in week 2', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-06'), care('2026-09-07')], start);
    expect(weeks.map((w) => w.number)).toEqual([1, 2]);
    expect(weeks[0]?.items.map((i) => i.plannedDate)).toEqual(['2026-08-31', '2026-09-06']);
    expect(weeks[1]?.items.map((i) => i.plannedDate)).toEqual(['2026-09-07']);
  });

  it('numbers four weeks of a full plan in order', () => {
    const weeks = groupIntoWeeks(
      [care('2026-08-31'), care('2026-09-07'), care('2026-09-14'), care('2026-09-21')],
      start,
    );
    expect(weeks.map((w) => w.number)).toEqual([1, 2, 3, 4]);
    expect(weeks.every((w) => w.items.length === 1)).toBe(true);
  });

  /** A card saying "Semana 3" over blank space reads as something missing. */
  it('drops weeks with nothing in them instead of rendering them empty', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-14')], start);
    expect(weeks.map((w) => w.number)).toEqual([1, 3]);
  });

  it('keeps the order the engine placed them in, within a week', () => {
    const weeks = groupIntoWeeks([care('2026-09-02'), care('2026-08-31')], start);
    expect(weeks[0]?.items.map((i) => i.plannedDate)).toEqual(['2026-09-02', '2026-08-31']);
  });

  it('crosses a month boundary without renumbering', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-01')], start);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.number).toBe(1);
  });

  /**
   * A care before the start date would be a bug upstream. Clamping keeps it on screen; dropping it
   * or letting it fall into a negative bucket would hide the very thing worth noticing.
   */
  it('clamps a care dated before the start into the first week rather than hiding it', () => {
    const weeks = groupIntoWeeks([care('2026-08-24'), care('2026-08-31')], start);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.items).toHaveLength(2);
  });

  it('returns nothing for an empty plan', () => {
    expect(groupIntoWeeks([], start)).toEqual([]);
  });
});
