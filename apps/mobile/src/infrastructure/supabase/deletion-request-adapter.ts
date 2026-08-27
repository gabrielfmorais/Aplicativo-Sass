import type { DeletionRequestPort } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const TABLE = 'account_deletion_requests';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * Direct table access (SPEC-001 §8/§18): ownership, allowed operations and uniqueness are enforced
 * by RLS + grants + PK in Postgres — the client never decides authorization.
 */
export const createDeletionRequestAdapter = (
  client: SupabaseClient,
  userId: () => string,
): DeletionRequestPort => ({
  async current() {
    const { data, error } = await client.from(TABLE).select('requested_at').maybeSingle();
    if (error) throw fail('deletion.read_failed', error);
    return data ? { requestedAt: data.requested_at as string } : null;
  },
  async request() {
    const { error } = await client.from(TABLE).insert({ user_id: userId() });
    if (error && error.code !== '23505') throw fail('deletion.request_failed', error); // 23505 = already requested
  },
  async cancel() {
    const { error } = await client.from(TABLE).delete().eq('user_id', userId());
    if (error) throw fail('deletion.cancel_failed', error);
  },
});
