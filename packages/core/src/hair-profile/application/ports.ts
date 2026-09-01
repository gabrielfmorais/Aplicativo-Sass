import type { HairEvent, HairEventType } from '../domain/hair-event.ts';
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

/**
 * SPEC-020 — o registro de que o cabelo dela mudou.
 *
 * Toda escrita passa por RPC (§10): o dia civil e a idempotência são invariantes de servidor, e o
 * `user_id` nunca é parâmetro. `list` devolve só os não anulados, do mais recente para o mais antigo.
 *
 * Registrar **não** muda cronograma. O app oferece reavaliar depois; a decisão é dela (BR5/NG3).
 */
export interface HairEventPort {
  list(): Promise<readonly HairEvent[]>;
  /**
   * Idempotente por `clientEventId`: dois toques no mesmo botão, ou um retry depois de resposta
   * perdida, registram **um** evento.
   */
  record(input: {
    eventType: HairEventType;
    occurredOn: string;
    clientEventId: string;
    timeZone: string;
  }): Promise<void>;
  /** Anula um evento registrado por engano. A linha continua no banco. */
  void(eventId: string): Promise<void>;
}
