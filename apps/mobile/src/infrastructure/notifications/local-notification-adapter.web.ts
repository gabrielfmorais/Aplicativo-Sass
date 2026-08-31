import type { NotificationSchedulerPort } from '@app/core';

/**
 * Web build of the notification scheduler — **development preview only**. A browser tab cannot
 * schedule the local, date-triggered reminders SPEC-008 is built on, so this reports "no
 * permission" instead of pretending: the opt-in UI then shows exactly the state it shows on a
 * device where the user declined (EC2), which is a real path worth looking at, and no reminder is
 * ever silently dropped.
 *
 * Fail closed (§16): never claim a permission the platform cannot honour.
 */
export const createLocalNotificationAdapter = (): NotificationSchedulerPort => ({
  async ensurePermission(): Promise<boolean> {
    return false;
  },
  async reconcile(): Promise<void> {},
});
