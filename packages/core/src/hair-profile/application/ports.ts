import type { HairEvent, HairEventType } from '../domain/hair-event.ts';
import type { CatalogProduct, CatalogSearch } from '../domain/catalog-product.ts';
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
  add(input: {
    name: string;
    category: ProductCategory;
    /**
     * SPEC-054 FR4 — de onde ela adicionou. Ausente = digitou, que continua sendo o caminho
     * completo. ⚠️ O `name` e a `category` acima continuam mandando na linha dela mesmo quando o
     * vínculo existe: é o catálogo que preenche o formulário, não que assume a prateleira (FR5).
     */
    catalogProductId?: string;
  }): Promise<Product>;
  rename(input: { id: string; name: string }): Promise<void>;
  /** Tira da prateleira. A linha continua no banco — o uso registrado precisa dela (BR4). */
  archive(id: string): Promise<void>;
}

/**
 * SPEC-054 (F32) — a leitura do catálogo. ⚠️ **Só leitura, e não é omissão:** a ingestão de produtos
 * reais depende de contrato, feed e direito de imagem (**TRUE HUMAN GATE**, OQ1) e acontece fora de
 * banda. O cliente não tem grant de escrita, então não existe superfície para escrever.
 */
export interface ProductCatalogPort {
  /**
   * Busca por texto (marca, linha, nome) ou por EAN exato, com teto.
   *
   * ⚠️ **Devolve vazio quando o catálogo está vazio, e isso é o estado permanente até a ingestão
   * acontecer** — a tela é quem decide não se oferecer nesse caso (FR8), porque uma busca que sempre
   * volta vazia é pior que uma busca que não existe.
   *
   * ⛔ **A ordem é por correspondência e nome, nunca por patrocínio, popularidade ou adequação**
   * (NG3): o primeiro é o `T2`, o último é a `P18`, e os dois têm gate próprio.
   */
  search(input: CatalogSearch): Promise<readonly CatalogProduct[]>;

  /**
   * ⚠️ **Existe alguma coisa publicada no catálogo?** — a pergunta que decide se a busca aparece.
   *
   * A tela precisa saber isso **antes** de se oferecer (FR8), porque uma busca que sempre volta
   * vazia promete um caminho e entrega um beco, toda vez. Uma linha lida, e a resposta é a policy
   * quem dá: `published_at is null` não existe para o cliente.
   */
  isAvailable(): Promise<boolean>;
}
