import type { HairEvent, HairEventType } from '../domain/hair-event.ts';
import type { Product, ProductCategory } from '../domain/product.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../domain/hair-profile.ts';

/**
 * Implemented by apps/mobile infrastructure over PostgREST (SPEC-002 §11).
 * Direct table access under RLS — ownership and immutability are enforced in Postgres.
 */
export interface HairProfilePort {
  /**
   * SPEC-017 — um snapshot específico, pelo id que o plano registrou. `null` quando não existe.
   *
   * Sob a mesma RLS de `getCurrent`: um id de outra pessoa devolve zero linhas, não o perfil dela.
   */
  getById(hairProfileId: string): Promise<HairProfileSnapshot | null>;
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

/**
 * SPEC-023 — a prateleira. Sem RPC: a linha não guarda invariante de servidor, e a posse é RLS mais
 * `with check`. O duplo toque cai no índice único parcial, não numa chave de idempotência.
 */
export interface ProductPort {
  /** Os ativos, mais recente primeiro. Arquivados não voltam por aqui. */
  list(): Promise<readonly Product[]>;
  /**
   * Rejeita com `hair_profile.product_duplicate` quando ela já tem esse nome ativo (EC2).
   *
   * Devolve o produto criado porque quem cadastra do **Wash Day** acabou de usá-lo (SPEC-024 FR6):
   * sem o id de volta, marcar o que ela acabou de adicionar custaria um toque a mais, e o toque a
   * mais é exatamente o que faz um registro não ser preenchido.
   */
  add(input: { name: string; category: ProductCategory }): Promise<Product>;
  rename(input: { id: string; name: string }): Promise<void>;
  /** Tira da prateleira. A linha continua no banco — o uso registrado precisa dela (BR4). */
  archive(id: string): Promise<void>;
}
