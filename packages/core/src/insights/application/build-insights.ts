import type { FinishTechnique, WashDayTechnique } from '../../care-tracking/index.ts';
import { countByCare } from './count-by-care.ts';
import type { InsightFact, InsightsView, Observation } from '../domain/insights.ts';
import {
  FINISH_TECHNIQUES_NOT_OBSERVABLE,
  HIGH_FEEL,
  MIN_OCCURRENCES,
  MIN_RATED_CARES,
} from '../domain/insights.ts';

/**
 * SPEC-047 (P2) — as repetições, derivadas **só do que ela registrou**.
 *
 * ⚠️ **Determinística e sem IA.** Nenhuma etapa aqui precisa de modelo: são contagens sobre os
 * fatos dela. Construir IA antes disto seria construir o sistema em torno da IA em vez do contrário
 * (§0.4 §3.1) — e é esta camada que a IA vai **consultar**, um dia.
 *
 * ⚠️ **Co-ocorrência, e a frase diz isso.** "Esteve em 4 dos 5" é contagem; "melhorou seu cabelo"
 * seria causa. A distância entre as duas é a capability inteira.
 */
export const buildInsights = (
  facts: readonly InsightFact[],
  /**
   * Como cada técnica se chama na tela. Vem de fora porque o rótulo é **cópia de interface**, e o
   * vocabulário de exibição já mora no app desde a SPEC-024 — duplicá-lo aqui criaria duas listas
   * que divergem na primeira mudança.
   */
  techniqueLabel: (technique: WashDayTechnique) => string = (t) => t,
  /**
   * SPEC-048 — como cada finalização se chama na tela, pela mesma razão de `techniqueLabel`: o
   * rótulo é cópia de interface e já mora no app.
   */
  finishLabel: (technique: FinishTechnique) => string = (t) => t,
): InsightsView => {
  /**
   * ⚠️ **O denominador é o que ela AVALIOU, não o que ela fez.** Um cuidado sem check-in não diz
   * nada sobre resultado, e contá-lo no total faria a Huna parecer ter mais evidência do que tem.
   */
  const rated = facts.filter((f) => f.feel !== null);
  const ratedCares = rated.length;
  /**
   * ⚠️ **Avaliar e registrar são coisas diferentes**, e confundi-las produzia uma tela que se
   * contradizia: com doze cuidados avaliados e nenhum produto marcado, ela dizia *"a partir de 5 a
   * Huna começa a comparar"* — como se o problema fosse o volume que ela já tinha alcançado.
   */
  const ratedCaresWithRecord = rated.filter(
    (f) =>
      f.products.length > 0 ||
      f.techniques.length > 0 ||
      // SPEC-048 — dizer *qual* finalização já é registro. Sem esta ponta, a tela mandaria "marque o
      // que usou" para quem marcou a finalização e nada mais.
      f.finishTechnique !== null,
  ).length;

  if (ratedCares < MIN_RATED_CARES) {
    return {
      enoughData: false,
      ratedCares,
      ratedCaresMissing: MIN_RATED_CARES - ratedCares,
      ratedCaresWithRecord,
      // ⚠️ Nada é inventado para preencher a tela: sem volume, a lista é **vazia**, não estimada.
      observations: [],
    };
  }

  const best = rated.filter((f) => (f.feel ?? 0) >= HIGH_FEEL);

  const named = (
    seen: Map<string, { name: string; count: number }>,
    kind: Observation['kind'],
    verb: string,
  ): Observation[] =>
    [...seen.entries()]
      .filter(([, v]) => v.count >= MIN_OCCURRENCES)
      // Mais presente primeiro; empate desempata pelo nome, para a ordem não depender do banco.
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .map(([id, v]) => ({
        key: `${kind}:${id}`,
        kind,
        subject: v.name,
        /**
         * ⚠️ **A frase é toda a diferença.** "Esteve em" / "você fez em" são co-ocorrência e são
         * verificáveis nos registros dela; qualquer verbo de efeito ("melhorou", "ajudou",
         * "funcionou") seria alegação capilar, num lugar em que ela ainda por cima acreditaria.
         *
         * ⚠️ **"que você avaliou bem", e não "os mais bem avaliados".** O conjunto é *todo* cuidado
         * com nota igual ou acima de `HIGH_FEEL` — não um top-N. Com vinte cuidados bem avaliados,
         * a outra frase viraria "os seus 20 mais bem avaliados", que sugere um ranking inexistente.
         */
        detail: `${verb} ${v.count} dos ${best.length} cuidados que você avaliou bem`,
      }));

  /**
   * SPEC-049 OQ1 — **os produtos que aparecem JUNTOS** nos cuidados que ela avaliou bem.
   *
   * ⚠️ **Par, não receita.** "Apareceram juntos em 3 dos 5" é co-ocorrência contada nos registros
   * dela; "essa combinação funciona para você" seria alegação capilar (D-26/D-70) — e um par soa
   * mais causal que um item isolado justamente porque parece uma fórmula. A frase é escolhida para
   * não soar como uma.
   *
   * Só **pares**, e de propósito: trios e além explodem em combinações e produzem coincidência com
   * cara de padrão, que é exatamente o que o volume mínimo existe para evitar.
   */
  const pairs = new Map<string, { name: string; count: number }>();
  for (const fact of best) {
    const items = [...new Map(fact.products.map((p) => [p.id, p])).values()].sort((x, y) =>
      x.id.localeCompare(y.id),
    );
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b2 = items[j];
        if (!a || !b2) continue;
        const key = `${a.id}|${b2.id}`;
        const current = pairs.get(key);
        pairs.set(key, {
          // O nome sai em ordem alfabética para a frase não depender de qual id veio antes.
          name: current?.name ?? [a.name, b2.name].sort((x, y) => x.localeCompare(y)).join(' + '),
          count: (current?.count ?? 0) + 1,
        });
      }
    }
  }

  const observations = [
    ...named(
      countByCare(best, (f) => f.products),
      'product',
      'esteve em',
    ),
    ...named(pairs, 'combo', 'apareceram juntos em'),
    ...named(
      countByCare(best, (f) => f.techniques.map((t) => ({ id: t, name: techniqueLabel(t) }))),
      'technique',
      'você fez em',
    ),
    /**
     * SPEC-048 (`F38`) — **qual finalização**, estritamente observacional.
     *
     * ⚠️ **"Você finalizou assim em N dos M"**, e nada além. É contagem nos registros dela; *"essa
     * finalização é a melhor para o seu cabelo"* seria recomendação capilar (D-26/D-70) e continua
     * bloqueada — a distância entre as duas frases é a razão de a fatia de registro poder existir
     * antes do sign-off.
     *
     * ⚠️ **`other` e `unknown` ficam de fora** (`FINISH_TECHNIQUES_NOT_OBSERVABLE`): a primeira
     * agregaria técnicas **diferentes** sob um rótulo só, a segunda é ausência de identificação.
     * Nenhuma das duas é uma repetição, e chamá-las de padrão seria inventar insight.
     */
    ...named(
      countByCare(best, (f) =>
        f.finishTechnique === null ||
        (FINISH_TECHNIQUES_NOT_OBSERVABLE as readonly string[]).includes(f.finishTechnique)
          ? []
          : [{ id: f.finishTechnique, name: finishLabel(f.finishTechnique) }],
      ),
      'finish',
      'você finalizou assim em',
    ),
  ];

  return { enoughData: true, ratedCares, ratedCaresMissing: 0, ratedCaresWithRecord, observations };
};
