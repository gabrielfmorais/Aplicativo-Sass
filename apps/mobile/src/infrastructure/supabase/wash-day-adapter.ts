import type { Product, ProductCategory, WashDayPort, WashDayRecord, WashDayTechnique } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const HUB = 'wash_days';
const PRODUCTS = 'wash_day_products';
const TECHNIQUES = 'wash_day_techniques';

const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/** A marcação já existe. Não é falha: é o estado que ela pediu (EC5). */
const UNIQUE_VIOLATION = '23505';

/**
 * SPEC-024 §9/§10 — tabelas diretas, sem RPC.
 *
 * Nada aqui é invariante de servidor: não há dia civil a decidir nem idempotência a guardar. A
 * `unique (care_execution_id)` cria o hub uma vez só, a PK das junções absorve o toque repetido, e
 * a posse é validada **nas duas pontas** pelo banco — `with check` olha o dono da linha nova, e a FK
 * composta olha o dono do hub. Um cliente adulterado que troque o `wash_day_id` recebe `23503`.
 *
 * `user_id` só aparece nos `insert`, onde o `with check` o valida. Nas leituras e nos deletes ele
 * nunca vai como filtro: `auth.uid()` decide.
 */
export const createWashDayAdapter = (client: SupabaseClient, userId: () => string): WashDayPort => {
  /**
   * Execução → hub. O vínculo é imutável (a `unique` garante um hub por execução, e o hub morre com
   * ela por cascade), então guardá-lo dispensa duas viagens por toque de chip — que é a diferença
   * entre "marcar em segundos" e uma tela que trava a cada marcação.
   */
  const hubs = new Map<string, string>();

  /** O hub, criado se ainda não existir. Só é chamado ao **marcar**: abrir e não marcar não é registro. */
  const hubFor = async (careExecutionId: string): Promise<string> => {
    const known = hubs.get(careExecutionId);
    if (known) return known;

    // `ignoreDuplicates` traduz para ON CONFLICT DO NOTHING: dois toques simultâneos no primeiro
    // chip não brigam, e o segundo simplesmente não devolve linha.
    const { data: created, error: createError } = await client
      .from(HUB)
      .upsert(
        { user_id: userId(), care_execution_id: careExecutionId },
        { onConflict: 'care_execution_id', ignoreDuplicates: true },
      )
      .select('id');
    if (createError) throw fail('care.wash_day_open_failed', createError);

    const inserted = (created as { id: string }[] | null)?.[0]?.id;
    if (inserted) {
      hubs.set(careExecutionId, inserted);
      return inserted;
    }

    const { data: existing, error: readError } = await client
      .from(HUB)
      .select('id')
      .eq('care_execution_id', careExecutionId)
      .maybeSingle();
    if (readError) throw fail('care.wash_day_open_failed', readError);
    const id = (existing as { id: string } | null)?.id;
    if (!id) throw fail('care.wash_day_open_failed', { message: 'wash day not found after upsert' });
    hubs.set(careExecutionId, id);
    return id;
  };

  return {
    async getFor(careExecutionId: string): Promise<WashDayRecord> {
      const { data: hub, error } = await client
        .from(HUB)
        .select('id')
        .eq('care_execution_id', careExecutionId)
        .maybeSingle();
      if (error) throw fail('care.wash_day_read_failed', error);
      const washDayId = (hub as { id: string } | null)?.id ?? null;
      // Nunca aberto: nada a buscar, e o vazio aqui é ausência, não resposta.
      if (!washDayId) return { washDayId: null, products: [], techniques: [] };
      hubs.set(careExecutionId, washDayId);

      const [marks, techniques] = await Promise.all([
        client.from(PRODUCTS).select('product_id').eq('wash_day_id', washDayId),
        client.from(TECHNIQUES).select('technique').eq('wash_day_id', washDayId),
      ]);
      if (marks.error) throw fail('care.wash_day_read_failed', marks.error);
      if (techniques.error) throw fail('care.wash_day_read_failed', techniques.error);
      const markedIds = (marks.data as { product_id: string }[]).map((r) => r.product_id);

      /**
       * **Sem filtro de arquivado**, ao contrário de `ProductPort.list` (BR3/AC4): o registro é do
       * passado, e o vidro que ela usou e depois tirou de casa continua tendo sido usado. Ler os
       * marcados pela prateleira de hoje faria ele sumir do próprio registro dela — a linha na
       * junção ficaria no banco e a tela diria "não marcado".
       */
      let products: Product[] = [];
      if (markedIds.length > 0) {
        const { data, error: productsError } = await client
          .from('products')
          .select('id, name, category')
          .in('id', markedIds);
        if (productsError) throw fail('care.wash_day_read_failed', productsError);
        products = (data as { id: string; name: string; category: ProductCategory }[]).map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
        }));
      }

      return {
        washDayId,
        products,
        techniques: (techniques.data as { technique: WashDayTechnique }[]).map((r) => r.technique),
      };
    },

    async markProduct({ careExecutionId, productId, used }): Promise<void> {
      const washDayId = await hubFor(careExecutionId);
      if (!used) {
        const { error } = await client
          .from(PRODUCTS)
          .delete()
          .eq('wash_day_id', washDayId)
          .eq('product_id', productId);
        if (error) throw fail('care.wash_day_mark_failed', error);
        return;
      }
      const { error } = await client
        .from(PRODUCTS)
        .insert({ wash_day_id: washDayId, product_id: productId, user_id: userId() });
      // Já marcado é o estado pedido, não um erro: um retry depois de resposta perdida não pode
      // devolver falha para uma marcação que entrou.
      if (error && error.code !== UNIQUE_VIOLATION) throw fail('care.wash_day_mark_failed', error);
    },

    async markTechnique({ careExecutionId, technique, used }): Promise<void> {
      const washDayId = await hubFor(careExecutionId);
      if (!used) {
        const { error } = await client
          .from(TECHNIQUES)
          .delete()
          .eq('wash_day_id', washDayId)
          .eq('technique', technique);
        if (error) throw fail('care.wash_day_mark_failed', error);
        return;
      }
      const { error } = await client
        .from(TECHNIQUES)
        .insert({ wash_day_id: washDayId, technique, user_id: userId() });
      if (error && error.code !== UNIQUE_VIOLATION) throw fail('care.wash_day_mark_failed', error);
    },
  };
};
