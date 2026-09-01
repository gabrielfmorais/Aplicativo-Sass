import type { ScheduledCare } from '../schedule/index.ts';
import type { LocalDate } from '../shared/index.ts';
import { instantFromString, localDateFromString } from '../shared/index.ts';
import {
  RESCHEDULE_HORIZON_DAYS,
  UNDO_WINDOW_MINUTES,
  buildTodayView,
  CHECKIN_SCALE,
  canCheckIn,
  canUndo,
  rescheduleRange,
  type CareExecution,
  type CheckIn,
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

describe('check-ins (SPEC-006 AC11)', () => {
  const c = care({ id: 'c1', plannedDate: '2026-09-10' });
  const done = execution({ id: 'e1', scheduledCareId: 'c1' });
  const checkIn: CheckIn = { id: 'ck1', careExecutionId: 'e1', overallFeel: 4 };

  const itemFor = (executions: CareExecution[], checkIns: CheckIn[]) =>
    buildTodayView([c], executions, TODAY, checkIns).today[0]!;

  it('attaches the check-in to the care whose execution it belongs to', () => {
    expect(itemFor([done], [checkIn]).checkIn).toEqual(checkIn);
  });

  it('leaves a done care without a check-in when none was made', () => {
    const item = itemFor([done], []);
    expect(item.checkIn).toBeNull();
    expect(canCheckIn(item)).toBe(true);
  });

  it('never attaches a check-in belonging to another execution', () => {
    expect(itemFor([done], [{ ...checkIn, careExecutionId: 'other' }]).checkIn).toBeNull();
  });

  /**
   * BR3: undoing an execution leaves its check-in on the voided row. The care becomes actionable
   * again and must not inherit the answer that described the execution the user threw away.
   */
  it('does not carry a check-in over when its execution was voided', () => {
    const voided = execution({ id: 'e1', scheduledCareId: 'c1', voidedAt: '2026-09-10T12:05:00.000Z' });
    const item = itemFor([voided], [checkIn]);
    expect(item.outcome).toBe('planned');
    expect(item.checkIn).toBeNull();
    expect(canCheckIn(item)).toBe(false);
  });

  it('offers no check-in on a care that is not done', () => {
    const planned = buildTodayView([c], [], TODAY, []).today[0]!;
    expect(canCheckIn(planned)).toBe(false);
    const skipped = buildTodayView(
      [care({ id: 'c2', plannedDate: '2026-09-09', status: 'skipped' })],
      [],
      TODAY,
      [],
    ).history[0]!;
    expect(canCheckIn(skipped)).toBe(false);
  });

  it('offers no second check-in once one exists', () => {
    expect(canCheckIn(itemFor([done], [checkIn]))).toBe(false);
  });

  it('offers the approved 1..5 scale', () => {
    expect(CHECKIN_SCALE).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps the board readable when check-ins are omitted entirely', () => {
    expect(buildTodayView([c], [done], TODAY).today[0]!.checkIn).toBeNull();
  });
});

/**
 * SPEC-022 (F22) — o estado pausado é **real, não simulado**: atraso, lembretes e progresso têm de
 * enxergar a mesma diferença, ou duas partes do app discordam sobre o mesmo plano (BR2).
 */
describe('pausa: atraso pressupõe compromisso vigente (SPEC-022 BR1)', () => {
  const TODAY = '2026-09-10' as LocalDate;
  const care = (id: string, plannedDate: string): ScheduledCare =>
    ({
      id,
      careTypeCode: 'hydration',
      plannedDate,
      status: 'planned',
      rescheduledToId: null,
    }) as ScheduledCare;

  it('sem pausa, o que passou está atrasado', () => {
    const view = buildTodayView([care('a', '2026-09-05')], [], TODAY);
    expect(view.overdue.map((i) => i.id)).toEqual(['a']);
  });

  /** Pausada, ela não combinou nada com ninguém. O cuidado volta a ser o que sempre foi: intenção. */
  it('pausada, nada atrasa — o cuidado volta a ser planejado', () => {
    const view = buildTodayView([care('a', '2026-09-05')], [], TODAY, [], '2026-09-04');
    expect(view.overdue).toEqual([]);
    expect(view.upcoming.map((i) => i.id)).toEqual(['a']);
    // E sem contagem de dias de atraso: não há atraso a contar.
    expect(view.upcoming[0]?.daysLate).toBe(0);
  });

  it('a pausa não inventa nem apaga o que já aconteceu', () => {
    const cares = [care('feito', '2026-09-05'), care('pulado', '2026-09-06')];
    const skipped = { ...cares[1]!, status: 'skipped' as const };
    const view = buildTodayView(
      [cares[0]!, skipped],
      [
        {
          id: 'e1',
          scheduledCareId: 'feito',
          executedAt: '2026-09-05T10:00:00Z',
          executedOn: '2026-09-05',
          voidedAt: null,
        },
      ],
      TODAY,
      [],
      '2026-09-04',
    );
    const outcomes = Object.fromEntries(view.history.map((i) => [i.id, i.outcome]));
    expect(outcomes).toEqual({ feito: 'done', pulado: 'skipped' });
  });

  /**
   * G4/FR6 — "o período pausado não conta contra ela em nenhum número que ela veja". Não é uma
   * regra à parte: cai de graça porque `buildProgress` conta `overdue`, e pausada não há nenhum.
   */
  it('o período pausado não vira número contra ela', () => {
    const cares = [care('a', '2026-09-05'), care('b', '2026-09-08')];
    const andando = buildTodayView(cares, [], TODAY);
    const pausada = buildTodayView(cares, [], TODAY, [], '2026-09-04');
    expect(andando.overdue).toHaveLength(2);
    expect(pausada.overdue).toHaveLength(0);
  });
});
