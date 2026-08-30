import type { EntitlementsPort } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * SPEC-010 G2/G3 — the client's read-only view of what the server granted her. Calls
 * `get_my_entitlements()` (SECURITY INVOKER, RLS-scoped to her own subscription): the server decides,
 * the app only reflects it. The client can never write an entitlement — that path is `service_role`
 * (the billing webhook) only.
 *
 * Contract (EntitlementsPort): resolve with the granted codes ([] for free), reject on failure. The
 * caller treats a rejection as free (fail closed, §16) — an error must never unlock a paid capability.
 */
export const createEntitlementsAdapter = (client: SupabaseClient): EntitlementsPort => ({
  async get(): Promise<readonly string[]> {
    const { data, error } = await client.rpc('get_my_entitlements');
    if (error) throw new InfrastructureError('entitlements.read_failed', error.message);
    // The RPC returns `setof text`; supabase-js gives back string[] (or null if empty).
    return (data as string[] | null) ?? [];
  },
});
