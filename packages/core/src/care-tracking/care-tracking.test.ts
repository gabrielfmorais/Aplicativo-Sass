import type { ScheduledCare } from '../schedule/index.ts';
import { instantFromString, localDateFromString } from '../shared/index.ts';
import {
  RESCHEDULE_HORIZON_DAYS,
  UNDO_WINDOW_MINUTES,
  buildTodayView,
  canUndo,
  rescheduleRange,
  type CareExecution,
} from './index.ts';

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
  executedAt: '2026-09-10T12:00:00.000Z',
  executedOn: '2026-09-10',
  voidedAt: null,
  ...over,
});

describe('buildTodayView (SPEC-005 G7/AC1)', () => {
  const cares = [
    care({ id: 'c-past-planned', plannedDate: '2026-09-06' }),
    care({ id: 'c-past-done', plannedDate: '2026-09-07' }),
    care({ id: 'c-past-skipped', plannedDate: '2026-09-08', status: 'skipped' }),
    care({ id: 'c-today', plannedDate: '2026-09-10' }),
    care({ id: 'c-today-done', plannedDate: '2026-09-10' }),
    care({ id: 'c-future', plannedDate: '2026-09-13' }),
  ];
  const executions = [
    execution({ id: 'e1', scheduledCareId: 'c-past-done', executedOn: '2026-09-07' }),
    execution({ id: 'e2', scheduledCareId: 'c-today-done' }),
  ];
  const view = buildTodayView(cares, executions, TODAY);

  it('puts a planned care whose day has passed in overdue, with the day count', () => {
    expect(view.overdue.map((i) => i.id)).toEqual(['c-past-planned']);
    expect(view.overdue[0]?.daysLate).toBe(4);
  });

  it("keeps today's cares in today, done or not, so undo stays reachable", () => {
    expect(view.today.map((i) => i.id).sort()).toEqual(['c-today', 'c-today-done']);
    expect(view.today.find((i) => i.id === 'c-today-done')?.outcome).toBe('done');
  });

  it('lists only future planned cares as upcoming', () => {
    expect(view.upcoming.map((i) => i.id)).toEqual(['c-future']);
  });

  it('sends resolved past cares to history, most recent first', () => {
    expect(view.history.map((i) => i.id)).toEqual(['c-past-skipped', 'c-past-done']);
  });

  it('never reports a care in two buckets', () => {
    const all = [...view.overdue, ...view.today, ...view.upcoming, ...view.history].map((i) => i.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(cares.length);
  });

  it('is deterministic and reads no clock: today is an input', () => {
    expect(buildTodayView(cares, executions, TODAY)).toEqual(buildTodayView(cares, executions, TODAY));
    const earlier = buildTodayView(cares, executions, localDateFromString('2026-09-06'));
    expect(earlier.overdue).toHaveLength(0);
    expect(earlier.today.map((i) => i.id)).toEqual(['c-past-planned']);
  });
});

describe('done is derived from an effective execution (BR4, D-69/D-35)', () => {
  const one = [care({ id: 'c1', plannedDate: '2026-09-10' })];

  it('a voided execution does not make a care done — it goes back to actionable', () => {
    const view = buildTodayView(
      one,
      [execution({ id: 'e1', scheduledCareId: 'c1', voidedAt: '2026-09-10T12:05:00.000Z' })],
      TODAY,
    );
    expect(view.today[0]?.outcome).toBe('planned');
    expect(view.today[0]?.execution).toBeNull();
  });

  it('after undo a new effective execution makes it done again', () => {
    const view = buildTodayView(
      one,
      [
        execution({ id: 'e1', scheduledCareId: 'c1', voidedAt: '2026-09-10T12:05:00.000Z' }),
        execution({ id: 'e2', scheduledCareId: 'c1' }),
      ],
      TODAY,
    );
    expect(view.today[0]?.outcome).toBe('done');
    expect(view.today[0]?.execution?.id).toBe('e2');
  });

  it('an execution beats an overdue planned date — completing never rewrites the intention', () => {
    const view = buildTodayView(
      [care({ id: 'c1', plannedDate: '2026-09-01' })],
      [execution({ id: 'e1', scheduledCareId: 'c1' })],
      TODAY,
    );
    expect(view.overdue).toHaveLength(0);
    expect(view.history[0]?.outcome).toBe('done');
    // The planned date is untouched: history shows when it was meant to happen.
    expect(view.history[0]?.plannedDate).toBe('2026-09-01');
  });

  it('a rescheduled care leaves the board and keeps its original date', () => {
    const view = buildTodayView(
      [
        care({ id: 'old', plannedDate: '2026-09-08', status: 'rescheduled', rescheduledToId: 'new' }),
        care({ id: 'new', plannedDate: '2026-09-13' }),
      ],
      [],
      TODAY,
    );
    expect(view.overdue).toHaveLength(0);
    expect(view.history.map((i) => i.id)).toEqual(['old']);
    expect(view.history[0]?.plannedDate).toBe('2026-09-08');
    expect(view.upcoming.map((i) => i.id)).toEqual(['new']);
  });
});

describe('empty and degenerate boards (AC15)', () => {
  it('an empty plan yields four empty buckets', () => {
    expect(buildTodayView([], [], TODAY)).toEqual({ overdue: [], today: [], upcoming: [], history: [] });
  });

  it('a plan entirely in the past leaves today empty without breaking anything', () => {
    const view = buildTodayView([care({ id: 'c1', plannedDate: '2026-09-01' })], [], TODAY);
    expect(view.today).toHaveLength(0);
    expect(view.overdue.map((i) => i.id)).toEqual(['c1']);
  });

  it('ignores an execution pointing at a care that is not on this board', () => {
    const view = buildTodayView(
      [care({ id: 'c1', plannedDate: '2026-09-10' })],
      [execution({ id: 'e1', scheduledCareId: 'other-plan-care' })],
      TODAY,
    );
    expect(view.today[0]?.outcome).toBe('planned');
  });
});

describe('undo window (D-69/D-12)', () => {
  const e = execution({ id: 'e1', scheduledCareId: 'c1', executedAt: '2026-09-10T12:00:00.000Z' });

  it('is open inside 15 minutes', () => {
    expect(canUndo(e, instantFromString('2026-09-10T12:00:00.000Z'))).toBe(true);
    expect(canUndo(e, instantFromString('2026-09-10T12:14:59.000Z'))).toBe(true);
    expect(canUndo(e, instantFromString('2026-09-10T12:15:00.000Z'))).toBe(true);
  });

  it('is closed after 15 minutes', () => {
    expect(canUndo(e, instantFromString('2026-09-10T12:15:01.000Z'))).toBe(false);
    expect(canUndo(e, instantFromString('2026-09-11T12:00:00.000Z'))).toBe(false);
  });

  it('is closed for an already voided execution', () => {
    expect(
      canUndo({ ...e, voidedAt: '2026-09-10T12:01:00.000Z' }, instantFromString('2026-09-10T12:02:00.000Z')),
    ).toBe(false);
  });

  it('matches the approved window', () => {
    expect(UNDO_WINDOW_MINUTES).toBe(15);
  });
});

describe('reschedule range (BR8)', () => {
  it('spans from today to today + the approved plan window', () => {
    expect(rescheduleRange(TODAY)).toEqual({ from: '2026-09-10', to: '2026-10-08' });
    expect(RESCHEDULE_HORIZON_DAYS).toBe(28);
  });
});
