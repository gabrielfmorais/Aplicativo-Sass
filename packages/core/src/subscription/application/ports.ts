/**
 * Server truth for entitlements (SPEC-010 G2). Implemented by the mobile adapter calling the
 * `get_my_entitlements()` RPC; the domain never learns that Supabase — or any billing provider —
 * exists (BR6).
 */
export interface EntitlementsPort {
  /** Codes granted to the current user; empty array for free. Rejects on failure — the caller treats a failure as free (§16). */
  get(): Promise<readonly string[]>;
}
