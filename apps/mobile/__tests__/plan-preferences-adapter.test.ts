import type { SupabaseClient } from '@supabase/supabase-js';

import { createPlanPreferencesAdapter } from '@/infrastructure/supabase/plan-preferences-adapter';

const USER = 'user-1';

const readClient = (result: { data: unknown; error: unknown }) =>
  ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({ maybeSingle: jest.fn(async () => result) })),
    })),
  }) as unknown as SupabaseClient;

const writeClient = (upsert: jest.Mock) =>
  ({ from: jest.fn(() => ({ upsert })) }) as unknown as SupabaseClient;

describe('plan preferences adapter (SPEC-015)', () => {
  it('reads her weekdays, normalised (sorted, deduplicated)', async () => {
    const client = readClient({ data: { preferred_weekdays: [4, 1, 4] }, error: null });
    await expect(createPlanPreferencesAdapter(client, () => USER).get()).resolves.toEqual({
      preferredWeekdays: [1, 4],
    });
  });

  it('treats a missing row as no preference — the caller then gets the engine default', async () => {
    const client = readClient({ data: null, error: null });
    await expect(createPlanPreferencesAdapter(client, () => USER).get()).resolves.toBeNull();
  });

  /** The CHECK constraint bounds the column, but a column is not a contract. */
  it('drops a value outside 0..6 instead of handing it to the placement layer', async () => {
    const client = readClient({ data: { preferred_weekdays: [1, 9, -2, 6.5, 6] }, error: null });
    await expect(createPlanPreferencesAdapter(client, () => USER).get()).resolves.toEqual({
      preferredWeekdays: [1, 6],
    });
  });

  it('rejects on a read error so the caller can fail closed to the engine default', async () => {
    const client = readClient({ data: null, error: { message: 'boom' } });
    await expect(createPlanPreferencesAdapter(client, () => USER).get()).rejects.toMatchObject({
      code: 'schedule.plan_preferences_read_failed',
    });
  });

  it('upserts her own row, normalised, keyed by user_id', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    const adapter = createPlanPreferencesAdapter(writeClient(upsert), () => USER);
    await adapter.save({ preferredWeekdays: [6, 1, 1] });
    expect(upsert).toHaveBeenCalledWith(
      { user_id: USER, preferred_weekdays: [1, 6] },
      { onConflict: 'user_id' },
    );
  });

  it('rejects on a write error rather than reporting a save that did not happen', async () => {
    const upsert = jest.fn(async () => ({ error: { message: 'boom' } }));
    const adapter = createPlanPreferencesAdapter(writeClient(upsert), () => USER);
    await expect(adapter.save({ preferredWeekdays: [1] })).rejects.toMatchObject({
      code: 'schedule.plan_preferences_write_failed',
    });
  });
});
