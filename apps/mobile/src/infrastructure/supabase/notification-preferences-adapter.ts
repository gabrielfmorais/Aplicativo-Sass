import type { NotificationPreferences, NotificationPreferencesPort } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const COLUMNS = 'enabled, reminder_time_local, checkin_reminder_enabled';

type Row = { enabled: boolean; reminder_time_local: string; checkin_reminder_enabled: boolean };

/** Postgres `time` comes back as `HH:MM:SS`; the domain works in `HH:MM` (SPEC-008 §9.1). */
const toHhMm = (time: string): string => time.slice(0, 5);

/**
 * SPEC-008 §10 — no RPC: this row guards no server-side invariant, so RLS plus `with check` is the
 * whole authorisation story. The user is never sent; `auth.uid()` decides which row is hers, which
 * is why an upsert here cannot touch anybody else's preference.
 */
export const createNotificationPreferencesAdapter = (
  client: SupabaseClient,
  currentUserId: () => string,
): NotificationPreferencesPort => ({
  async get(): Promise<NotificationPreferences | null> {
    const { data, error } = await client.from('notification_preferences').select(COLUMNS).maybeSingle();
    if (error) throw new InfrastructureError('notifications.preferences_read_failed', error.message);
    if (!data) return null; // no row yet — the caller treats that as everything off (§16)
    const row = data as Row;
    return {
      enabled: row.enabled,
      reminderTimeLocal: toHhMm(row.reminder_time_local),
      checkinReminderEnabled: row.checkin_reminder_enabled,
    };
  },

  async save(preferences: NotificationPreferences): Promise<void> {
    const { error } = await client.from('notification_preferences').upsert(
      {
        user_id: currentUserId(),
        enabled: preferences.enabled,
        reminder_time_local: preferences.reminderTimeLocal,
        checkin_reminder_enabled: preferences.checkinReminderEnabled,
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new InfrastructureError('notifications.preferences_write_failed', error.message);
  },
});
