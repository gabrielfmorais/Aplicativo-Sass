import type { NotificationIntent, NotificationPreferences } from '../domain/intent.ts';

/** Her preference, stored server-side so it survives a reinstall and can cohort H3 (SPEC-008 §8.1). */
export interface NotificationPreferencesPort {
  /** Null when she has no row yet — the caller treats that as "everything off" (§16, fail closed). */
  get(): Promise<NotificationPreferences | null>;
  save(preferences: NotificationPreferences): Promise<void>;
}

/**
 * The OS side of ADR-009. The domain never knows `expo-notifications` (D-22/BR6); this port is the
 * only thing between the pure intents and the device.
 */
export interface NotificationSchedulerPort {
  /** Asks the OS. False when the user or the system refuses — nothing is scheduled then (FR2). */
  ensurePermission(): Promise<boolean>;
  /**
   * Replaces everything this app has scheduled with exactly `intents` (FR8). Idempotent by
   * construction: the same intents produce the same schedule, so reopening never duplicates.
   */
  reconcile(intents: readonly NotificationIntent[]): Promise<void>;
}
