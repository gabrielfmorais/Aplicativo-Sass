import type { FinishTechnique, InsightFact, InsightsPort, WashDayTechnique } from '@app/core';
import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/**
 * Quantos cuidados atendidos entram na leitura, do mais recente para trás.
 *
 * ⚠️ **Existe por um limite real, não por precaução.** As leituras seguintes filtram por
 * `in (…ids)`, e cada uuid custa ~37 caracteres na URL: sem teto, uma usuária com dois anos de
 * histórico (~300 execuções) montaria uma query de mais de 11 mil caracteres e bateria no limite de
 * URI do PostgREST — a tela quebraria **justamente para quem mais tem dado**, que é o oposto do que
 * esta capability promete.
 *
 * 60 é ~6 a 15 meses no ritmo de 4 a 12 cuidados por mês, e a janela é honesta na tela: o número que
 * ela vê ("com base em N cuidados que você avaliou") é o que foi realmente lido.
 */
const HISTORY_WINDOW = 60;

/**
 * SPEC-047 (P2) — o histórico dela, lido sob RLS.
 *
 * ⚠️ **Só leitura, e só dela.** Nada é escrito, nada agrega com terceiros: a camada opera sobre o
 * histórico pessoal e nunca vira benchmark contra outras pessoas (Blueprint §12).
 *
 * ⚠️ **Leituras curtas em vez de um `join` embutido**, pela mesma razão medida na SPEC-041: a
 * FK de `wash_days` para `care_executions` é composta, e o PostgREST não promete embedding por FK
 * composta. Cada leitura é limitada ao histórico dela pela RLS.
 *
 * **Execução anulada fica de fora.** Ela desfez aquilo; contá-la como evidência seria observar um
 * fato que ela mesma retirou.
 */
export const createInsightsAdapter = (client: SupabaseClient): InsightsPort => ({
  async facts(): Promise<readonly InsightFact[]> {
    const executions = await client
      .from('care_executions')
      /**
       * ⚠️ **Só `id`.** `care_type_code` e `executed_on` eram lidos e não consumidos por ninguém —
       * a ordenação por `executed_on` é do servidor e não precisa da coluna no `select`. Voltam com
       * o consumidor delas (segmentação `P8`, recência `P17`), não antes.
       */
      .select('id')
      .is('voided_at', null)
      .order('executed_on', { ascending: false })
      .limit(HISTORY_WINDOW);
    if (executions.error) throw fail('insights.read_failed', executions.error);
    const rows = (executions.data ?? []) as { id: string }[];
    if (rows.length === 0) return [];
    const executionIds = rows.map((r) => r.id);

    const [checkIns, washDays] = await Promise.all([
      client.from('checkins').select('care_execution_id, overall_feel').in('care_execution_id', executionIds),
      client.from('wash_days').select('id, care_execution_id').in('care_execution_id', executionIds),
    ]);
    if (checkIns.error) throw fail('insights.read_failed', checkIns.error);
    if (washDays.error) throw fail('insights.read_failed', washDays.error);

    const feelOf = new Map(
      ((checkIns.data ?? []) as { care_execution_id: string; overall_feel: number }[]).map((c) => [
        c.care_execution_id,
        c.overall_feel,
      ]),
    );
    const hubs = (washDays.data ?? []) as { id: string; care_execution_id: string }[];

    /** Sem hub não há marcação nenhuma — e aí as leituras seguintes não têm o que perguntar. */
    let productsByExecution = new Map<string, { id: string; name: string }[]>();
    let techniquesByExecution = new Map<string, WashDayTechnique[]>();
    let finishByExecution = new Map<string, FinishTechnique>();
    if (hubs.length > 0) {
      const executionOfHub = new Map(hubs.map((h) => [h.id, h.care_execution_id]));
      const hubIds = hubs.map((h) => h.id);

      /**
       * As três leituras do hub são **independentes entre si**, e vão juntas: em série, cada uma
       * somaria uma viagem à rede na tela Premium que já é a mais cara do app.
       *
       * - técnicas: o vocabulário **já aprovado** da SPEC-024 — seis delas movimentos de
       *   finalização. Nomear finalizações novas é o `F38`, atrás do gate D-26/D-70.
       * - finalização: SPEC-048, **qual** ela registrou.
       * - produtos: as marcações do Wash Day.
       */
      const [techs, finishes, marks] = await Promise.all([
        client.from('wash_day_techniques').select('wash_day_id, technique').in('wash_day_id', hubIds),
        client.from('wash_day_finish').select('wash_day_id, finish_technique').in('wash_day_id', hubIds),
        client.from('wash_day_products').select('wash_day_id, product_id').in('wash_day_id', hubIds),
      ]);
      if (techs.error) throw fail('insights.read_failed', techs.error);
      if (finishes.error) throw fail('insights.read_failed', finishes.error);
      if (marks.error) throw fail('insights.read_failed', marks.error);
      techniquesByExecution = (
        (techs.data ?? []) as { wash_day_id: string; technique: WashDayTechnique }[]
      ).reduce((acc, t) => {
        const executionId = executionOfHub.get(t.wash_day_id);
        if (executionId) acc.set(executionId, [...(acc.get(executionId) ?? []), t.technique]);
        return acc;
      }, new Map<string, WashDayTechnique[]>());

      /**
       * SPEC-048 (`F38`) — `null` aqui é *"não disse qual"*, e a ausência da linha inteira é
       * *"não disse nem se finalizou"*. As duas chegam ao core como `null`, e é isso que ele
       * espera: nenhuma das duas é uma resposta.
       */
      finishByExecution = (
        (finishes.data ?? []) as { wash_day_id: string; finish_technique: FinishTechnique | null }[]
      ).reduce((acc, f) => {
        const executionId = executionOfHub.get(f.wash_day_id);
        if (executionId && f.finish_technique) acc.set(executionId, f.finish_technique);
        return acc;
      }, new Map<string, FinishTechnique>());

      const marked = (marks.data ?? []) as { wash_day_id: string; product_id: string }[];

      if (marked.length > 0) {
        // ⚠️ O nome vem de `products`, que é **o nome que ela deu** — o app não inventa rótulo, e
        // não há catálogo por trás disto (o `F32` é outra coisa).
        const names = await client
          .from('products')
          .select('id, name')
          .in('id', [...new Set(marked.map((m) => m.product_id))]);
        if (names.error) throw fail('insights.read_failed', names.error);
        const nameOf = new Map(
          ((names.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]),
        );
        const executionOf = executionOfHub;

        productsByExecution = marked.reduce((acc, m) => {
          const executionId = executionOf.get(m.wash_day_id);
          const name = nameOf.get(m.product_id);
          // Um produto sem nome legível não vira observação: nomear "" seria pior que omitir.
          if (!executionId || !name) return acc;
          acc.set(executionId, [...(acc.get(executionId) ?? []), { id: m.product_id, name }]);
          return acc;
        }, new Map<string, { id: string; name: string }[]>());
      }
    }

    return rows.map((r) => ({
      careExecutionId: r.id,
      feel: feelOf.get(r.id) ?? null,
      products: productsByExecution.get(r.id) ?? [],
      techniques: techniquesByExecution.get(r.id) ?? [],
      finishTechnique: finishByExecution.get(r.id) ?? null,
    }));
  },
});
