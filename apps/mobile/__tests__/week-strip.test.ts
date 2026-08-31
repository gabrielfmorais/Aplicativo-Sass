import type { CareItem, CareOutcome, CareTypeCode, LocalDate } from '@app/core';

import { buildWeek } from '@/features/care/week';

/**
 * SPEC-016 slice 2 — the week strip's only logic, tested where it lives.
 *
 * The screen test asserts that the strip says the right things out loud; this one pins the calendar
 * arithmetic underneath, which is where a week strip actually goes wrong: on the boundaries, and on
 * the care that was moved somewhere else.
 */

const care = (
  id: string,
  plannedDate: string,
  outcome: CareOutcome,
  careTypeCode: CareTypeCode = 'hydration',
): CareItem => ({
  id,
  careTypeCode,
  plannedDate,
  outcome,
  execution: null,
  checkIn: null,
  daysLate: outcome === 'overdue' ? 2 : 0,
});

describe('buildWeek', () => {
  it('returns the seven days of the Sunday-first week containing today', () => {
    // 2026-09-10 is a Thursday.
    const week = buildWeek([], '2026-09-10' as LocalDate);
    expect(week.map((d) => d.date)).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
    expect(week.map((d) => d.initial)).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S']);
  });

  it('keeps today first when today is a Sunday, and last when it is a Saturday', () => {
    expect(buildWeek([], '2026-09-06' as LocalDate)[0]?.isToday).toBe(true);
    expect(buildWeek([], '2026-09-12' as LocalDate)[6]?.isToday).toBe(true);
  });

  it('crosses a month boundary without inventing a day', () => {
    // 2026-10-01 is a Thursday, so its week starts in September.
    const week = buildWeek([], '2026-10-01' as LocalDate);
    expect(week[0]?.date).toBe('2026-09-27');
    expect(week[6]?.date).toBe('2026-10-03');
    expect(week).toHaveLength(7);
  });

  it('marks exactly one day as today, and only earlier days as past', () => {
    const week = buildWeek([], '2026-09-10' as LocalDate);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
    expect(week.map((d) => d.isPast)).toEqual([true, true, true, true, false, false, false]);
  });

  it('places each care on its planned day and ignores cares outside the week', () => {
    const week = buildWeek(
      [
        care('a', '2026-09-08', 'overdue'),
        care('b', '2026-09-10', 'planned', 'nutrition'),
        care('c', '2026-09-14', 'planned'), // next week
      ],
      '2026-09-10' as LocalDate,
    );
    expect(week[2]?.cares).toEqual([{ careTypeCode: 'hydration', outcome: 'overdue' }]);
    expect(week[4]?.cares).toEqual([{ careTypeCode: 'nutrition', outcome: 'planned' }]);
    expect(week.flatMap((d) => d.cares)).toHaveLength(2);
  });

  it('keeps several cares on the same day, in the order they arrived', () => {
    const week = buildWeek(
      [care('a', '2026-09-10', 'done'), care('b', '2026-09-10', 'planned', 'reconstruction')],
      '2026-09-10' as LocalDate,
    );
    expect(week[4]?.cares).toEqual([
      { careTypeCode: 'hydration', outcome: 'done' },
      { careTypeCode: 'reconstruction', outcome: 'planned' },
    ]);
  });

  /**
   * A rescheduled care is not happening on its original day any more — the successor row carries it.
   * Drawing it there would tell the user something false about her week, and the replacement is
   * already in the list under its new date.
   */
  it('does not draw a care on the day it was moved away from', () => {
    const week = buildWeek([care('a', '2026-09-08', 'rescheduled')], '2026-09-10' as LocalDate);
    expect(week.flatMap((d) => d.cares)).toEqual([]);
    expect(week[2]?.label).toBe('Terça, 8 de setembro. sem cuidados');
  });

  it('reads a day as a sentence, so colour is never the only carrier of state', () => {
    const week = buildWeek(
      [care('a', '2026-09-10', 'done'), care('b', '2026-09-10', 'skipped', 'nutrition')],
      '2026-09-10' as LocalDate,
    );
    expect(week[4]?.label).toBe('Quinta, 10 de setembro. hoje. Hidratação: feita. Nutrição: pulada');
    expect(week[6]?.label).toBe('Sábado, 12 de setembro. sem cuidados');
  });
});
