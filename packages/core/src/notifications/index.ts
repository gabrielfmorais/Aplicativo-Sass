// notifications — public surface (SPEC-008; ADR-009).
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MAX_NOTIFICATIONS_PER_DAY,
  NOTIFICATION_HORIZON_DAYS,
  NOTIFICATION_INTENT_TYPES,
  buildNotificationIntents,
} from './domain/intent.ts';
export type { NotificationIntent, NotificationIntentType, NotificationPreferences } from './domain/intent.ts';
export type { NotificationPreferencesPort, NotificationSchedulerPort } from './application/ports.ts';
