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
    const intents = build([
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
    expect(build(cares, ON, '08:00', done)).toEqual([]);
  });

  it('says nothing about a skipped or rescheduled care', () => {
    expect(build([care({ id: 'c1', plannedDate: '2026-09-10', status: 'skipped' })])).toEqual([]);
    expect(
      build([care({ id: 'c1', plannedDate: '2026-09-10', status: 'rescheduled', rescheduledToId: 'c2' })]),
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
    expect(build(cares, ON, '08:00', voided).map((i) => i.type)).toEqual(['care_today']);
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
    expect(build(cares, ON, '08:00', done)).toEqual([]);
    const intents = build(cares, { ...ON, checkinReminderEnabled: true }, '08:00', done);
    expect(intents.map((i) => i.type)).toEqual(['checkin_pending']);
  });

  it('stops asking once she has answered', () => {
    const answered: CheckIn[] = [{ id: 'ck1', careExecutionId: 'e1', overallFeel: 4 }];
    expect(build(cares, { ...ON, checkinReminderEnabled: true }, '08:00', done, answered)).toEqual([]);
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
    expect(build(cares, ON, '19:00').map((i) => i.date)).toEqual(['2026-09-12']);
    expect(build(cares, ON, '23:30').map((i) => i.date)).toEqual(['2026-09-12']);
    expect(build(cares, ON, '18:59').map((i) => i.date)).toContain(TODAY);
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
