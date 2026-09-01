import type { Instant, Product, ProductCategory, ProductPort } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

type Row = { id: string; name: string; category: ProductCategory };

const TABLE = 'products';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/** Violação de unicidade no Postgres. Aqui não é falha: é "você já tem esse produto" (EC2). */
const UNIQUE_VIOLATION = '23505';

/**
 * SPEC-023 §10 — tabela direta, sem RPC.
 *
 * Ao contrário de `hair_events` e `plan_pauses`, esta linha não guarda invariante de servidor: não
 * há dia civil a decidir nem idempotência a garantir. A posse é RLS mais `with check`, e o duplo
 * toque cai no índice único parcial — que é o servidor decidindo, sem precisar de função.
 *
 * `user_id` só aparece no `insert`, onde o `with check` o valida. Nas leituras e nos updates ele
 * nunca vai como filtro: `auth.uid()` decide, e um cliente adulterado que peça a prateleira inteira
 * recebe a dela.
 */
export const createProductAdapter = (
  client: SupabaseClient,
  userId: () => string,
  /**
   * ADR-008 — o instante vem injetado, nunca de `new Date()` aqui dentro. O lint recusa, e recusa
   * com razão: um adapter que lê o relógio ambiente é um adapter que os testes não conseguem fixar.
   */
  now: () => Instant,
): ProductPort => ({
  async list(): Promise<readonly Product[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('id, name, category')
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) throw fail('hair_profile.product_list_failed', error);
    return (data as Row[]).map((row) => ({ id: row.id, name: row.name, category: row.category }));
  },

  async add({ name, category }): Promise<void> {
    const { error } = await client.from(TABLE).insert({ user_id: userId(), name, category });
    if (!error) return;
    /**
     * Um código de erro do Postgres não é uma mensagem para ela. Traduzido aqui, na fronteira, para
     * a tela poder dizer "você já tem esse produto" em vez de mostrar a falha crua — e para o
     * caminho de duplicata não se parecer com o de rede.
     */
    throw fail(
      error.code === UNIQUE_VIOLATION ? 'hair_profile.product_duplicate' : 'hair_profile.product_add_failed',
      error,
    );
  },

  async rename({ id, name }): Promise<void> {
    const { error } = await client.from(TABLE).update({ name }).eq('id', id);
    if (!error) return;
    throw fail(
      error.code === UNIQUE_VIOLATION
        ? 'hair_profile.product_duplicate'
        : 'hair_profile.product_rename_failed',
      error,
    );
  },

  async archive(id: string): Promise<void> {
    // Nunca `delete`: a linha precisa continuar existindo para o uso registrado continuar fazendo
    // sentido quando o Wash Day (`F25`) chegar — e o cliente nem tem o privilégio.
    const { error } = await client.from(TABLE).update({ archived_at: now() }).eq('id', id);
    if (error) throw fail('hair_profile.product_archive_failed', error);
  },
});
