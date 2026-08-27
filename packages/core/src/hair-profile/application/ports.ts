import type { HairProfileInput, HairProfileSnapshot } from '../domain/hair-profile.ts';

/**
 * Implemented by apps/mobile infrastructure over PostgREST (SPEC-002 §11).
 * Direct table access under RLS — ownership and immutability are enforced in Postgres.
 */
export interface HairProfilePort {
  /** The user's current (most recent) snapshot, or null when she has none yet. */
  getCurrent(): Promise<HairProfileSnapshot | null>;
  /** Persists a new immutable snapshot and returns it. */
  save(input: HairProfileInput): Promise<HairProfileSnapshot>;
}
