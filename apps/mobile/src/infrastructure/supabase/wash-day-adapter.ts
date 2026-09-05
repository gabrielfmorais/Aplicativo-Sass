import type {
  FinishStatus,
  FinishTechnique,
  Product,
  ProductCategory,
  ScalpFeel,
  WashDayPort,
  WashDayRecord,
  WashDayTechnique,
} from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const HUB = 'wash_days';
const PRODUCTS = 'wash_day_products';
const TECHNIQUES = 'wash_day_techniques';
const SCALP = 'wash_day_scalp';
const FINISH = 'wash_day_finish';

/** Quantas execuções recentes daquele tipo olhar para trás. Limitado de propósito: o painel é uma
 * conveniência, e uma varredura sem teto no histórico dela não é. */
const RECENT_EXECUTIONS = 10;

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
      if (!washDayId)
        return {
          washDayId: null,
          products: [],
          techniques: [],
          scalpFeel: null,
          finishStatus: null,
          finishTechnique: null,
        };
      hubs.set(careExecutionId, washDayId);

      const [marks, techniques, scalp, finish] = await Promise.all([
        client.from(PRODUCTS).select('product_id').eq('wash_day_id', washDayId),
        client.from(TECHNIQUES).select('technique').eq('wash_day_id', washDayId),
        client.from(SCALP).select('scalp_feel').eq('wash_day_id', washDayId).maybeSingle(),
        client
          .from(FINISH)
          .select('finish_status, finish_technique')
          .eq('wash_day_id', washDayId)
          .maybeSingle(),
      ]);
      if (marks.error) throw fail('care.wash_day_read_failed', marks.error);
      if (techniques.error) throw fail('care.wash_day_read_failed', techniques.error);
      if (scalp.error) throw fail('care.wash_day_read_failed', scalp.error);
      if (finish.error) throw fail('care.wash_day_read_failed', finish.error);
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
        scalpFeel: (scalp.data as { scalp_feel: ScalpFeel } | null)?.scalp_feel ?? null,
        // SPEC-039 BR1 — linha ausente é "ainda não disse", que não é `skipped`.
        finishStatus: (finish.data as { finish_status: FinishStatus } | null)?.finish_status ?? null,
        finishTechnique:
          (finish.data as { finish_technique: FinishTechnique | null } | null)?.finish_technique ?? null,
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

    async setScalpFeel({ careExecutionId, scalpFeel }): Promise<void> {
      const washDayId = await hubFor(careExecutionId);
      if (scalpFeel === null) {
        const { error } = await client.from(SCALP).delete().eq('wash_day_id', washDayId);
        if (error) throw fail('care.wash_day_scalp_failed', error);
        return;
      }
      /**
       * **Uma escrita, e não apaga-e-escreve.** `upsert` traduz para `on conflict do update`, então
       * trocar de resposta nunca passa por um instante sem resposta — que é exatamente o que um
       * `delete` seguido de `insert` deixaria acontecer se a segunda metade falhasse. É a razão de
       * o `UPDATE` estar na allowlist desta tabela (SPEC-025 §10).
       */
      const { error } = await client
        .from(SCALP)
        .upsert(
          { wash_day_id: washDayId, scalp_feel: scalpFeel, user_id: userId() },
          { onConflict: 'wash_day_id' },
        );
      if (error) throw fail('care.wash_day_scalp_failed', error);
    },

    /**
     * SPEC-039 (F37) — a etapa de finalização. Mesma forma do couro, pela mesma razão: uma escrita
     * só, `on conflict do update`, e `null` remove a linha porque voltar a "ainda não disse" é um
     * estado válido e é dela (FR8).
     *
     * ⚠️ **A tabela é outra, e isso é a SPEC.** Escrever isto em `wash_day_techniques` seria
     * afirmar que finalizar é uma maneira de fazer o cuidado, quando é uma parte do processo (BR3).
     */
    /**
     * SPEC-041 (F48) — o que ela usou **da última vez** num cuidado deste tipo.
     *
     * ⚠️ **Sem nenhum filtro por categoria.** Escolher "máscara para hidratação" seria associar
     * produto a tipo de cuidado por indicação — conteúdo capilar substantivo, gate D-26/D-70. O que
     * volta daqui é o registro que **ela** fez, e nada mais.
     *
     * Quatro leituras curtas em vez de um `join` embutido: a FK de `wash_days` para
     * `care_executions` é composta, e o PostgREST não promete embedding por FK composta — um
     * `select` aninhado que o servidor não reconhecesse falharia em runtime, não em compilação.
     * Só roda quando ela abre o painel, e as listas são limitadas.
     */
    async lastUsedFor(careTypeCode): Promise<readonly Product[]> {
      const { data: executionRows, error: executionsError } = await client
        .from('care_executions')
        .select('id')
        .eq('care_type_code', careTypeCode)
        .is('voided_at', null)
        .order('executed_on', { ascending: false })
        .limit(RECENT_EXECUTIONS);
      if (executionsError) throw fail('care.wash_day_read_failed', executionsError);
      const executionIds = (executionRows as { id: string }[]).map((r) => r.id);
      if (executionIds.length === 0) return [];

      // O hub mais recente entre essas execuções: a ordem da consulta acima é a ordem da verdade,
      // então a primeira execução que **tem** registro é a última vez que ela contou o que usou.
      const { data: hubRows, error: hubsError } = await client
        .from(HUB)
        .select('id, care_execution_id')
        .in('care_execution_id', executionIds);
      if (hubsError) throw fail('care.wash_day_read_failed', hubsError);
      const hubOf = new Map(
        (hubRows as { id: string; care_execution_id: string }[]).map((r) => [r.care_execution_id, r.id]),
      );
      const washDayId = executionIds.map((id) => hubOf.get(id)).find((id) => id !== undefined);
      if (!washDayId) return [];

      const { data: markRows, error: marksError } = await client
        .from(PRODUCTS)
        .select('product_id')
        .eq('wash_day_id', washDayId);
      if (marksError) throw fail('care.wash_day_read_failed', marksError);
      const productIds = (markRows as { product_id: string }[]).map((r) => r.product_id);
      if (productIds.length === 0) return [];

      // Sem filtro de arquivado, como em `getFor` (SPEC-024 BR3): ela usou aquilo, e o passado não
      // muda porque o vidro acabou.
      const { data, error } = await client.from('products').select('id, name, category').in('id', productIds);
      if (error) throw fail('care.wash_day_read_failed', error);
      return (data as { id: string; name: string; category: ProductCategory }[]).map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
      }));
    },

    async setFinishStatus({ careExecutionId, finishStatus }): Promise<void> {
      const washDayId = await hubFor(careExecutionId);
      if (finishStatus === null) {
        const { error } = await client.from(FINISH).delete().eq('wash_day_id', washDayId);
        if (error) throw fail('care.wash_day_finish_failed', error);
        return;
      }
      /**
       * ⚠️ **Trocar a etapa para `skipped` limpa a técnica junto.** "Pulei, e a técnica foi
       * fitagem" é a combinação impossível que o `CHECK` recusa (SPEC-048): sem limpar aqui, a
       * escrita falharia e ela veria um erro por uma incoerência que o app é que deveria resolver.
       */
      const { error } = await client.from(FINISH).upsert(
        {
          wash_day_id: washDayId,
          finish_status: finishStatus,
          user_id: userId(),
          ...(finishStatus === 'done' ? {} : { finish_technique: null }),
        },
        { onConflict: 'wash_day_id' },
      );
      if (error) throw fail('care.wash_day_finish_failed', error);
    },

    async setFinishTechnique({ careExecutionId, finishTechnique }): Promise<void> {
      const washDayId = await hubFor(careExecutionId);
      /**
       * Uma escrita só, e não um par apaga-e-escreve: a mesma disciplina da etapa e do couro. O
       * `upsert` garante a etapa em `done` junto da técnica — quem escolhe *qual* já finalizou, e
       * deixar as duas colunas para escritas separadas abriria um instante em que o `CHECK` da
       * coerência estaria violado.
       */
      const { error } = await client.from(FINISH).upsert(
        {
          wash_day_id: washDayId,
          user_id: userId(),
          finish_status: 'done',
          finish_technique: finishTechnique,
        },
        { onConflict: 'wash_day_id' },
      );
      if (error) throw fail('care.wash_day_finish_failed', error);
    },
  };
};
