import type { SupabaseClient } from '@supabase/supabase-js';

import { createEntitlementsAdapter } from '@/infrastructure/supabase/entitlements-adapter';

const clientWith = (result: { data: unknown; error: unknown }) =>
  ({ rpc: jest.fn(async () => result) }) as unknown as SupabaseClient;

describe('entitlements adapter (SPEC-010)', () => {
  it('returns the granted codes from get_my_entitlements', async () => {
    const client = clientWith({ data: ['plan_customization'], error: null });
    await expect(createEntitlementsAdapter(client).get()).resolves.toEqual(['plan_customization']);
    expect(client.rpc as jest.Mock).toHaveBeenCalledWith('get_my_entitlements');
  });

  it('treats a null result as free (empty codes)', async () => {
    const client = clientWith({ data: null, error: null });
    await expect(createEntitlementsAdapter(client).get()).resolves.toEqual([]);
  });

  it('rejects on error so the caller can fail closed to free', async () => {
    const client = clientWith({ data: null, error: { message: 'boom' } });
    await expect(createEntitlementsAdapter(client).get()).rejects.toMatchObject({
      code: 'entitlements.read_failed',
    });
  });
});
