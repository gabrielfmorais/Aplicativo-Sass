import type { PlanPreferences, PlanPreferencesPort, Weekday } from '@app/core';
import { InfrastructureError, isWeekday, normalizePreferredWeekdays } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const COLUMNS = 'preferred_weekdays';

type Row = { preferred_weekdays: readonly number[] | null };

/**
 * SPEC-015 §10 — no RPC: this row guards no server-side invariant, so RLS plus `with check` is the
 * whole authorisation story (same shape as notification preferences). The user is never sent as a
 * filter; `auth.uid()` decides which row is hers, so an upsert here cannot touch anybody else's.
 *
 * Writing here grants nothing. The premium gate lives where the preference is *applied*:
 * `generate-plan` revalidates `has_entitlement('plan_customization')` and generates the engine
 * default without it (FR3, fail closed).
 */
export const createPlanPreferencesAdapter = (
  client: SupabaseClient,
  currentUserId: () => string,
): PlanPreferencesPort => ({
  async get(): Promise<PlanPreferences | null> {
    const { data, error } = await client.from('plan_preferences').select(COLUMNS).maybeSingle();
    if (error) throw new InfrastructureError('schedule.plan_preferences_read_failed', error.message);
    if (!data) return null; // no row yet — the caller treats that as "no preference"
    const row = data as Row;
    // The CHECK constraint already bounds the column, but a column is not a contract: filter to the
    // domain type so a value that somehow drifted cannot reach the placement layer.
    const weekdays = (row.preferred_weekdays ?? []).filter((d): d is Weekday => isWeekday(d));
    return { preferredWeekdays: normalizePreferredWeekdays(weekdays) };
  },

  async save(preferences: PlanPreferences): Promise<void> {
    const { error } = await client.from('plan_preferences').upsert(
      {
        user_id: currentUserId(),
        preferred_weekdays: normalizePreferredWeekdays(preferences.preferredWeekdays),
      },
      { onConflict: 'user_id' },
    );
    if (error) throw new InfrastructureError('schedule.plan_preferences_write_failed', error.message);
  },
});
