import { buildTodayView, type CareExecution, type CheckIn } from '../care-tracking/index.ts';
import type { ScheduledCare } from '../schedule/index.ts';
import { localDateFromString } from '../shared/index.ts';
import { MIN_CHECKINS_FOR_AVERAGE, buildProgress } from './index.ts';

const TODAY = localDateFromString('2026-09-10');

const care = (over: Partial<ScheduledCare> & { id: string; plannedDate: string }): ScheduledCare => ({
  careTypeCode: 'hydration',
  status: 'planned',
  rescheduledToId: null,
  ...over,
});

const execution = (
  over: Partial<CareExecution> & { id: string; scheduledCareId: string },
): CareExecution => ({
  executedAt: '2026-09-09T12:00:00.000Z',
  executedOn: '2026-09-09',
  voidedAt: null,
  ...over,
});

const progressOf = (cares: ScheduledCare[], executions: CareExecution[] = [], checkIns: CheckIn[] = []) =>
  buildProgress(buildTodayView(cares, executions, TODAY, checkIns));

describe('what counts as elapsed (BR1/AC1)', () => {
  it('counts done, skipped and overdue, and nothing else', () => {
    const p = progressOf(
      [
        care({ id: 'done', plannedDate: '2026-09-07' }),
        care({ id: 'skip', plannedDate: '2026-09-08', status: 'skipped' }),
        care({ id: 'late', plannedDate: '2026-09-09' }),
        care({ id: 'soon', plannedDate: '2026-09-14' }),
      ],
      [execution({ id: 'e1', scheduledCareId: 'done' })],
    );
    expect(p).toMatchObject({ done: 1, skipped: 1, overdue: 1, elapsed: 3 });
  });

  it('does not judge a care that has not happened yet', () => {
    const p = progressOf([care({ id: 'future', plannedDate: '2026-09-20' })]);
    expect(p).toMatchObject({ elapsed: 0, done: 0, overdue: 0 });
  });

  /** A care due today is not late until tomorrow — counting it now would invent a failure. */
  it('does not count today as elapsed while the day is still running', () => {
    expect(progressOf([care({ id: 'now', plannedDate: '2026-09-10' })]).elapsed).toBe(0);
  });
});

describe('a rescheduled care is never double-counted (BR2/AC2)', () => {
  it('counts only the row that replaced it', () => {
    const p = progressOf(
      [
        care({ id: 'moved', plannedDate: '2026-09-07', status: 'rescheduled', rescheduledToId: 'new' }),
        care({ id: 'new', plannedDate: '2026-09-09' }),
      ],
      [],
    );
    // The replacement is overdue; the original contributes nothing on either side.
    expect(p).toMatchObject({ elapsed: 1, overdue: 1, done: 0, skipped: 0 });
  });
});

describe('an undone execution takes its check-in with it (BR3/BR4/AC3)', () => {
  const cares = [care({ id: 'c1', plannedDate: '2026-09-09' })];
  const checkIns: CheckIn[] = [{ id: 'ck1', careExecutionId: 'e1', overallFeel: 5 }];

  it('counts the care as done and the check-in as hers while the execution stands', () => {
    const p = progressOf(cares, [execution({ id: 'e1', scheduledCareId: 'c1' })], checkIns);
    expect(p).toMatchObject({ done: 1, overdue: 0, checkInCount: 1 });
  });

  it('drops both once the execution is voided', () => {
    const voided = [execution({ id: 'e1', scheduledCareId: 'c1', voidedAt: '2026-09-09T12:05:00.000Z' })];
    const p = progressOf(cares, voided, checkIns);
    expect(p).toMatchObject({ done: 0, overdue: 1, checkInCount: 0, averageFeel: null });
  });
});

describe('the average is her own answer, guarded (FR4/AC4/AC5)', () => {
  const withCheckIns = (feels: number[]) => {
    const cares = feels.map((_, i) => care({ id: `c${i}`, plannedDate: '2026-09-09' }));
    const executions = feels.map((_, i) => execution({ id: `e${i}`, scheduledCareId: `c${i}` }));
    const checkIns: CheckIn[] = feels.map((feel, i) => ({
      id: `ck${i}`,
      careExecutionId: `e${i}`,
      overallFeel: feel,
    }));
    return progressOf(cares, executions, checkIns);
  };

  it('withholds the average below the minimum but still reports the count', () => {
    expect(MIN_CHECKINS_FOR_AVERAGE).toBe(3);
    expect(withCheckIns([5])).toMatchObject({ checkInCount: 1, averageFeel: null });
    expect(withCheckIns([5, 4])).toMatchObject({ checkInCount: 2, averageFeel: null });
  });

  it('reports the exact mean from the minimum onwards', () => {
    expect(withCheckIns([5, 4, 3])).toMatchObject({ checkInCount: 3, averageFeel: 4 });
  });

  it('never shows more than one decimal', () => {
    // 4 + 4 + 3 = 11 / 3 = 3.666… — a raw mean here would print false precision.
    expect(withCheckIns([4, 4, 3]).averageFeel).toBe(3.7);
    expect(withCheckIns([5, 4, 4, 4]).averageFeel).toBe(4.3);
  });

  it('handles every answer being identical without inventing a comment', () => {
    expect(withCheckIns([4, 4, 4]).averageFeel).toBe(4);
  });
});

describe('honest at the extremes (EC1/EC7/EC9)', () => {
  it('reports nothing elapsed for a plan that just started', () => {
    const p = progressOf([care({ id: 'a', plannedDate: '2026-09-11' })]);
    expect(p).toEqual({
      elapsed: 0,
      done: 0,
      skipped: 0,
      overdue: 0,
      checkInCount: 0,
      averageFeel: null,
    });
  });

  it('reports a fully completed plan as exactly that', () => {
    const cares = [
      care({ id: 'a', plannedDate: '2026-09-08' }),
      care({ id: 'b', plannedDate: '2026-09-09' }),
    ];
    const executions = [
      execution({ id: 'e1', scheduledCareId: 'a' }),
      execution({ id: 'e2', scheduledCareId: 'b' }),
    ];
    expect(progressOf(cares, executions)).toMatchObject({ elapsed: 2, done: 2, skipped: 0, overdue: 0 });
  });

  it('reports an entirely skipped plan without softening it', () => {
    const cares = [
      care({ id: 'a', plannedDate: '2026-09-08', status: 'skipped' }),
      care({ id: 'b', plannedDate: '2026-09-09', status: 'skipped' }),
    ];
    expect(progressOf(cares)).toMatchObject({ elapsed: 2, done: 0, skipped: 2 });
  });

  it('cannot divide by zero: elapsed is only ever a sum of counts', () => {
    const p = progressOf([]);
    expect(p.elapsed).toBe(0);
    expect(p.averageFeel).toBeNull();
  });
});
