// ADR-006 / `core-context-isolation`: another context is entered only through its public index.
// Care Tracking → Notifications is a published-language read model (DOMAIN-MAP §4).
import { canCheckIn, type CareItem, type TodayView } from '../../care-tracking/index.ts';
import { addDays, type LocalDate } from '../../shared/index.ts';

/**
 * How far ahead local notifications are scheduled (ADR-009).
 * With the 2/day cap that is at most 28 pending notifications — well under the iOS limit of 64.
 */
export const NOTIFICATION_HORIZON_DAYS = 14;

/** Central volume policy (ADR-009). A constant, not a column: no UI changes it (SPEC-008 §8.2). */
export const MAX_NOTIFICATIONS_PER_DAY = 2;

/** Highest priority first — this order is what FR6 drops by when a day is over the cap. */
export const NOTIFICATION_INTENT_TYPES = ['care_overdue', 'care_today', 'checkin_pending'] as const;
export type NotificationIntentType = (typeof NOTIFICATION_INTENT_TYPES)[number];

export type NotificationPreferences = {
  readonly enabled: boolean;
  /** Local wall-clock time, `HH:MM`. */
  readonly reminderTimeLocal: string;
  readonly checkinReminderEnabled: boolean;
};

/** Nothing is scheduled until she asks for it (BR1). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  reminderTimeLocal: '19:00',
  checkinReminderEnabled: false,
};

export type NotificationIntent = {
  /** Deterministic (FR9/ADR-009): the same state always yields the same id, so reconciling is idempotent. */
  readonly id: string;
  readonly type: NotificationIntentType;
  /** The user's civil day the notification fires on. */
  readonly date: string;
  /** Local wall-clock time, `HH:MM`. */
  readonly time: string;
  readonly title: string;
  readonly body: string;
};

/**
 * Fixed catalogue (BR4). The only variable is a count — never a name, a note, a product or
 * anything else the user typed, so a notification cannot leak her data onto a lock screen.
 */
const copyFor = (type: NotificationIntentType, careCount: number): { title: string; body: string } => {
  switch (type) {
    case 'care_overdue':
      return {
        title: 'Cuidado atrasado',
        body:
          careCount > 1
            ? `Você tem ${careCount} cuidados atrasados. Dá para fazer hoje, reagendar ou pular.`
            : 'Você tem um cuidado atrasado. Dá para fazer hoje, reagendar ou pular.',
      };
    case 'care_today':
      return {
        title: 'Cuidado de hoje',
        body:
          careCount > 1
            ? `Você tem ${careCount} cuidados no cronograma hoje.`
            : 'Você tem um cuidado no cronograma hoje.',
      };
    case 'checkin_pending':
      return { title: 'Como ficou?', body: 'Conta rapidinho como o cabelo ficou depois do cuidado.' };
  }
};

const intent = (
  type: NotificationIntentType,
  date: string,
  time: string,
  careCount: number,
): NotificationIntent => ({ id: `${type}:${date}`, type, date, time, ...copyFor(type, careCount) });

/** A care still worth reminding about: planned or overdue, never one already resolved (BR2). */
const isActionable = (item: CareItem): boolean => item.outcome === 'planned' || item.outcome === 'overdue';

/**
 * The complete set of local notifications that should exist right now (SPEC-008 §9.1).
 *
 * Pure and total: it never reads a clock. `today` and `nowLocalTime` are inputs (ADR-008), which is
 * what lets "do not schedule something already past" be a tested rule rather than a runtime accident.
 *
 * The caller replaces everything it has scheduled with this exact set, so correctness here is the
 * whole feature: a stale intent means reminding her about a care she already did (G4).
 */
export const buildNotificationIntents = (input: {
  view: TodayView;
  preferences: NotificationPreferences;
  today: LocalDate;
  /** Local wall-clock time now, `HH:MM` — used only to skip today's slot once it has passed (FR7). */
  nowLocalTime: string;
}): readonly NotificationIntent[] => {
  const { view, preferences, today, nowLocalTime } = input;
  if (!preferences.enabled) return []; // BR1: opt-in, and the only way to get an empty set for free

  const time = preferences.reminderTimeLocal;
  const horizonEnd = addDays(today, NOTIFICATION_HORIZON_DAYS);
  const todaySlotPassed = nowLocalTime >= time; // 'HH:MM' compares correctly as a string
  const usableToday = (date: string): boolean => date !== today || !todaySlotPassed;

  const intents: NotificationIntent[] = [];

  if (view.overdue.length > 0 && usableToday(today)) {
    intents.push(intent('care_overdue', today, time, view.overdue.length));
  }

  // One reminder per day, not one per care (EC6): grouped by the day it is planned for.
  const byDate = new Map<string, number>();
  for (const item of [...view.today, ...view.upcoming]) {
    if (!isActionable(item)) continue;
    if (item.plannedDate < today || item.plannedDate > horizonEnd) continue;
    if (!usableToday(item.plannedDate)) continue;
    byDate.set(item.plannedDate, (byDate.get(item.plannedDate) ?? 0) + 1);
  }
  for (const [date, count] of byDate) intents.push(intent('care_today', date, time, count));

  if (
    preferences.checkinReminderEnabled &&
    usableToday(today) &&
    view.today.some((item) => item.outcome === 'done' && canCheckIn(item))
  ) {
    intents.push(intent('checkin_pending', today, time, 0));
  }

  // FR6: at most MAX_NOTIFICATIONS_PER_DAY on any day, dropping the least important first.
  const rank = (type: NotificationIntentType): number => NOTIFICATION_INTENT_TYPES.indexOf(type);
  const kept = new Map<string, NotificationIntent[]>();
  for (const candidate of [...intents].sort(
    (a, b) => a.date.localeCompare(b.date) || rank(a.type) - rank(b.type),
  )) {
    const sameDay = kept.get(candidate.date) ?? [];
    if (sameDay.length < MAX_NOTIFICATIONS_PER_DAY) {
      sameDay.push(candidate);
      kept.set(candidate.date, sameDay);
    }
  }
  return [...kept.values()].flat();
};
