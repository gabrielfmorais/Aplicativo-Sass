import { buildTodayView, type CareExecution, type CheckIn } from '../care-tracking/index.ts';
import type { ScheduledCare } from '../schedule/index.ts';
import { localDateFromString } from '../shared/index.ts';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MAX_NOTIFICATIONS_PER_DAY,
  NOTIFICATION_HORIZON_DAYS,
  buildNotificationIntents,
  type NotificationPreferences,
} from './index.ts';

const TODAY = localDateFromString('2026-09-10');
const ON: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true };

const care = (over: Partial<ScheduledCare> & { id: string; plannedDate: string }): ScheduledCare => ({
  careTypeCode: 'hydration',
  status: 'planned',
  rescheduledToId: null,
  ...over,
});

const build = (
  cares: ScheduledCare[],
  preferences: NotificationPreferences = ON,
  nowLocalTime = '08:00',
  executions: CareExecution[] = [],
  checkIns: CheckIn[] = [],
) =>
  buildNotificationIntents({
    view: buildTodayView(cares, executions, TODAY, checkIns),
    preferences,
    today: TODAY,
    nowLocalTime,
  });

/**
 * The care reminders only. `reassessment_due` (D-82) is about the plan's calendar rather than about
 * any care, so it would otherwise show up in every assertion below and say nothing about what those
 * tests are for. It has its own block at the end of this file, which is where it is guarded.
 */
const careReminders = (...args: Parameters<typeof build>) =>
  build(...args).filter((i) => i.type !== 'reassessment_due');

describe('opt-in (BR1/AC6)', () => {
  it('produces nothing while reminders are off', () => {
    expect(build([care({ id: 'c1', plannedDate: '2026-09-10' })], DEFAULT_NOTIFICATION_PREFERENCES)).toEqual(
      [],
    );
  });

  it('ships off by default', () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.enabled).toBe(false);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.checkinReminderEnabled).toBe(false);
  });

  it('produces nothing when there is no plan at all', () => {
    expect(build([])).toEqual([]);
  });
});

describe('care reminders (AC7/AC8)', () => {
  it('reminds once per day, not once per care', () => {
    const intents = careReminders([
      care({ id: 'a', plannedDate: '2026-09-12' }),
      care({ id: 'b', plannedDate: '2026-09-12', careTypeCode: 'nutrition' }),
    ]);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ type: 'care_today', date: '2026-09-12', time: '19:00' });
    expect(intents[0]!.body).toContain('2 cuidados');
  });

  it('reminds about an overdue care today, without touching the schedule (D-28)', () => {
    const intents = build([care({ id: 'late', plannedDate: '2026-09-08' })]);
    const overdue = intents.find((i) => i.type === 'care_overdue');
    expect(overdue).toMatchObject({ date: TODAY, id: `care_overdue:${TODAY}` });
    // The overdue care itself is not also re-announced as a care planned for today.
    expect(intents.filter((i) => i.type === 'care_today')).toEqual([]);
  });

  it('covers the approved horizon and stops there', () => {
    const inside = '2026-09-24'; // today + 14
    const outside = '2026-09-25';
    expect(NOTIFICATION_HORIZON_DAYS).toBe(14);
    const intents = build([
      care({ id: 'in', plannedDate: inside }),
      care({ id: 'out', plannedDate: outside }),
    ]);
    expect(intents.map((i) => i.date)).toEqual([inside]);
  });
});

describe('never remind about what is already resolved (BR2/AC9)', () => {
  const cares = [care({ id: 'c1', plannedDate: '2026-09-10' })];

  it('says nothing about a completed care', () => {
    const done: CareExecution[] = [
      {
        id: 'e1',
        scheduledCareId: 'c1',
        executedAt: '2026-09-10T09:00:00.000Z',
        executedOn: '2026-09-10',
        voidedAt: null,
      },
    ];
    expect(careReminders(cares, ON, '08:00', done)).toEqual([]);
  });

  it('says nothing about a skipped or rescheduled care', () => {
    expect(careReminders([care({ id: 'c1', plannedDate: '2026-09-10', status: 'skipped' })])).toEqual([]);
    expect(
      careReminders([
        care({ id: 'c1', plannedDate: '2026-09-10', status: 'rescheduled', rescheduledToId: 'c2' }),
      ]),
    ).toEqual([]);
  });

  it('starts reminding again once an execution is undone', () => {
    const voided: CareExecution[] = [
      {
        id: 'e1',
        scheduledCareId: 'c1',
        executedAt: '2026-09-10T09:00:00.000Z',
        executedOn: '2026-09-10',
        voidedAt: '2026-09-10T09:05:00.000Z',
      },
    ];
    expect(careReminders(cares, ON, '08:00', voided).map((i) => i.type)).toEqual(['care_today']);
  });
});

describe('check-in reminder (AC10)', () => {
  const cares = [care({ id: 'c1', plannedDate: '2026-09-10' })];
  const done: CareExecution[] = [
    {
      id: 'e1',
      scheduledCareId: 'c1',
      executedAt: '2026-09-10T09:00:00.000Z',
      executedOn: '2026-09-10',
      voidedAt: null,
    },
  ];

  it('asks for the check-in only when that reminder is on', () => {
    expect(careReminders(cares, ON, '08:00', done)).toEqual([]);
    const intents = careReminders(cares, { ...ON, checkinReminderEnabled: true }, '08:00', done);
    expect(intents.map((i) => i.type)).toEqual(['checkin_pending']);
  });

  it('stops asking once she has answered', () => {
    const answered: CheckIn[] = [{ id: 'ck1', careExecutionId: 'e1', overallFeel: 4 }];
    expect(careReminders(cares, { ...ON, checkinReminderEnabled: true }, '08:00', done, answered)).toEqual(
      [],
    );
  });
});

describe('volume and priority (FR6/AC11)', () => {
  it('never schedules more than the cap on one day, dropping the least important', () => {
    const done: CareExecution[] = [
      {
        id: 'e1',
        scheduledCareId: 'today-done',
        executedAt: '2026-09-10T09:00:00.000Z',
        executedOn: '2026-09-10',
        voidedAt: null,
      },
    ];
    // Overdue + a care still due today + a pending check-in = three candidates for one day.
    const intents = build(
      [
        care({ id: 'late', plannedDate: '2026-09-08' }),
        care({ id: 'today-open', plannedDate: '2026-09-10' }),
        care({ id: 'today-done', plannedDate: '2026-09-10', careTypeCode: 'nutrition' }),
      ],
      { ...ON, checkinReminderEnabled: true },
      '08:00',
      done,
    );
    const forToday = intents.filter((i) => i.date === TODAY);
    expect(forToday).toHaveLength(MAX_NOTIFICATIONS_PER_DAY);
    expect(forToday.map((i) => i.type)).toEqual(['care_overdue', 'care_today']);
  });
});

describe('the past is never scheduled (FR7/AC12)', () => {
  it('drops today once the chosen time has gone by, and keeps the other days', () => {
    const cares = [
      care({ id: 'late', plannedDate: '2026-09-08' }),
      care({ id: 'now', plannedDate: '2026-09-10' }),
      care({ id: 'next', plannedDate: '2026-09-12' }),
    ];
    expect(careReminders(cares, ON, '19:00').map((i) => i.date)).toEqual(['2026-09-12']);
    expect(careReminders(cares, ON, '23:30').map((i) => i.date)).toEqual(['2026-09-12']);
    expect(careReminders(cares, ON, '18:59').map((i) => i.date)).toContain(TODAY);
  });
});

describe('reconciliation is idempotent (FR9/AC13)', () => {
  const cares = [
    care({ id: 'late', plannedDate: '2026-09-08' }),
    care({ id: 'next', plannedDate: '2026-09-12' }),
  ];

  it('gives the same ids for the same state', () => {
    expect(build(cares).map((i) => i.id)).toEqual(build(cares).map((i) => i.id));
  });

  it('keys an intent by type and day, so a day can never hold two of a kind', () => {
    const ids = build(cares).map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('care_overdue:2026-09-10');
    expect(ids).toContain('care_today:2026-09-12');
  });
});

/**
 * BR4/AC14 — a notification lands on a lock screen anyone can see. The text is a fixed catalogue
 * parameterised only by a count, so there is no path for a name, a note or a care type to leak.
 */
describe('no personal data can reach the text (BR4/AC14)', () => {
  it('never names the care type, and only ever varies by count', () => {
    const intents = build(
      [
        care({ id: 'late', plannedDate: '2026-09-08', careTypeCode: 'reconstruction' }),
        care({ id: 'next', plannedDate: '2026-09-12', careTypeCode: 'nutrition' }),
      ],
      { ...ON, checkinReminderEnabled: true },
    );
    expect(intents.length).toBeGreaterThan(0);
    for (const i of intents) {
      const text = `${i.title} ${i.body}`;
      expect(text).not.toMatch(/hydration|nutrition|reconstruction|hidrataç|nutriç|reconstruç/i);
      expect(text).not.toMatch(/@|\bhttps?:\/\//);
    }
  });
});

describe('the end of the cycle is announced, once (D-82)', () => {
  it('fires the day after the plan’s last day', () => {
    const intents = build([
      care({ id: 'c1', plannedDate: '2026-09-10' }),
      care({ id: 'c2', plannedDate: '2026-09-14' }),
    ]);
    const due = intents.find((i) => i.type === 'reassessment_due');
    expect(due?.date).toBe('2026-09-15');
    expect(due?.title).toBe('Seu cronograma chegou ao fim');
  });

  /**
   * The anchor is the plan's last day, not her progress through it. Anchoring on what is still
   * actionable would move the reminder every time she completed something — and delete it at the
   * exact moment she finished the last care, which is when she needs it most.
   */
  it('does not move when she completes or skips the last care', () => {
    const cares = [care({ id: 'c1', plannedDate: '2026-09-14' })];
    const dateOf = (intents: readonly { type: string; date: string }[]) =>
      intents.find((i) => i.type === 'reassessment_due')?.date;

    expect(dateOf(build(cares))).toBe('2026-09-15');
    expect(
      dateOf(
        build(cares, ON, '08:00', [
          {
            id: 'e1',
            scheduledCareId: 'c1',
            executedOn: '2026-09-14',
            executedAt: '2026-09-14T10:00:00Z',
            voidedAt: null,
          },
        ]),
      ),
    ).toBe('2026-09-15');
    expect(dateOf(build([care({ id: 'c1', plannedDate: '2026-09-14', status: 'skipped' })]))).toBe(
      '2026-09-15',
    );
  });

  /** Self-limiting: once that day is behind her the intent stops existing, so it never nags daily. */
  it('is not produced once the cycle end is already in the past', () => {
    const intents = build([care({ id: 'c1', plannedDate: '2026-09-01', status: 'skipped' })]);
    expect(intents.some((i) => i.type === 'reassessment_due')).toBe(false);
  });

  it('stays inside the scheduling horizon like every other intent', () => {
    const farOut = build([care({ id: 'c1', plannedDate: '2026-10-30' })]);
    expect(farOut.some((i) => i.type === 'reassessment_due')).toBe(false);
  });

  it('yields to today’s cares when a day is over the cap (lowest priority)', () => {
    // Cycle ends today: an overdue reminder, a care today and the cycle-end notice all want today.
    const intents = build([
      care({ id: 'c1', plannedDate: '2026-09-09' }),
      care({ id: 'c2', plannedDate: '2026-09-10' }),
    ]);
    const today = intents.filter((i) => i.date === '2026-09-10');
    expect(today).toHaveLength(MAX_NOTIFICATIONS_PER_DAY);
    expect(today.map((i) => i.type).sort()).toEqual(['care_overdue', 'care_today']);
  });

  it('carries no personal data — just the fact that the cycle ended', () => {
    const due = build([care({ id: 'c1', plannedDate: '2026-09-14' })]).find(
      (i) => i.type === 'reassessment_due',
    );
    expect(`${due?.title} ${due?.body}`).toBe(
      'Seu cronograma chegou ao fim Reavalie seu cabelo para montar as próximas semanas.',
    );
  });
});

/**
 * SPEC-022 FR2 — lembrar alguém de um compromisso que ela **suspendeu** é a forma mais direta de
 * transformar uma pausa em cobrança, e o Blueprint §5 pede o contrário.
 */
describe('pausa silencia os lembretes (SPEC-022 FR2)', () => {
  it('pausada, nenhum lembrete é agendado — mesmo com a preferência ligada', () => {
    const cares = [care({ id: 'a', plannedDate: TODAY })];
    const base = {
      view: buildTodayView(cares, [], TODAY),
      preferences: ON,
      today: TODAY,
      nowLocalTime: '07:00',
    };
    // Sem pausa, com a preferência ligada, há o que lembrar.
    expect(buildNotificationIntents(base).length).toBeGreaterThan(0);
    // Com pausa, nada — e não por a preferência estar desligada, que é o outro caminho para vazio.
    expect(buildNotificationIntents({ ...base, paused: true })).toEqual([]);
  });
});

/**
 * SPEC-040 FR8 (F39) — o **quinto** intent: a rotina de óleo.
 *
 * A data vem derivada de `buildOilRoutineView`, nunca recontada aqui: duas contagens da mesma coisa
 * divergem na primeira mudança de regra.
 */
describe('rotina de óleo (SPEC-040 FR8)', () => {
  const withOil = (oilDueOn: string | null, extra: Record<string, unknown> = {}) =>
    buildNotificationIntents({
      view: buildTodayView([], [], TODAY),
      preferences: ON,
      today: TODAY,
      nowLocalTime: '07:00',
      oilDueOn,
      ...extra,
    });

  it('sem rotina, o intent não existe (EC6)', () => {
    expect(withOil(null)).toEqual([]);
  });

  it('vencendo hoje, lembra hoje', () => {
    const intents = withOil(TODAY);
    expect(intents.map((i) => i.type)).toEqual(['oil_due']);
    expect(intents[0]?.date).toBe(TODAY);
  });

  /**
   * **Uma só, e no primeiro dia em que ela ainda pode agir.** Uma rotina vencida há uma semana não
   * vira sete notificações — a D-28 pede estado e ação, não cobrança acumulada.
   */
  it('vencida no passado, lembra hoje — uma vez, não uma por dia de atraso', () => {
    const intents = withOil('2026-09-01');
    expect(intents.length).toBe(1);
    expect(intents[0]?.date).toBe(TODAY);
  });

  it('fora do horizonte, não agenda nada', () => {
    expect(withOil('2027-01-01')).toEqual([]);
  });

  it('não agenda sem opt-in (NG5/BR1)', () => {
    expect(
      buildNotificationIntents({
        view: buildTodayView([], [], TODAY),
        preferences: DEFAULT_NOTIFICATION_PREFERENCES,
        today: TODAY,
        nowLocalTime: '07:00',
        oilDueOn: TODAY,
      }),
    ).toEqual([]);
  });

  /**
   * ⚠️ **EC5 — decisão deliberada.** A rotina de óleo não é o cronograma e continua contando; o
   * **lembrete**, porém, se cala com a pausa. "Pausada, nada toca" é garantia já validada da
   * SPEC-022, e um intent novo que passasse por cima dela a enfraqueceria.
   */
  it('pausada, o lembrete de óleo também se cala (EC5)', () => {
    expect(withOil(TODAY).length).toBe(1);
    expect(withOil(TODAY, { paused: true })).toEqual([]);
  });

  /** BR4/NG3 — o texto diz o que ela programou, e nada sobre o que o óleo faz. */
  it('o texto não afirma nada sobre cabelo e não promete resultado', () => {
    const [oil] = withOil(TODAY);
    expect(`${oil?.title} ${oil?.body}`).toBe('Hora do seu óleo Você programou o óleo para hoje.');
    expect(`${oil?.title} ${oil?.body}`).not.toMatch(/hidrat|nutri|sela|repara|fortalec|brilho|frizz/i);
  });

  /** ADR-009 — id determinístico: o mesmo estado produz o mesmo id, e reconciliar é idempotente. */
  it('o id é determinístico', () => {
    expect(withOil(TODAY)[0]?.id).toBe(`oil_due:${TODAY}`);
    expect(withOil(TODAY)[0]?.id).toBe(withOil(TODAY)[0]?.id);
  });
});
