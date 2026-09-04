import type { InsightFact, InsightsView, Observation } from '../domain/insights.ts';
import { HIGH_FEEL, MIN_OCCURRENCES, MIN_RATED_CARES } from '../domain/insights.ts';

/**
 * SPEC-047 (P2) — as repetições, derivadas **só do que ela registrou**.
 *
 * ⚠️ **Determinística e sem IA.** Nenhuma etapa aqui precisa de modelo: são contagens sobre os
 * fatos dela. Construir IA antes disto seria construir o sistema em torno da IA em vez do contrário
 * (§0.4 §3.1) — e é esta camada que a IA vai **consultar**, um dia.
 *
 * ⚠️ **Co-ocorrência, e a frase diz isso.** "Esteve em 4 dos seus 6 melhores" é contagem;
 * "melhorou seu cabelo" seria causa. A distância entre as duas é a capability inteira.
 */
export const buildInsights = (facts: readonly InsightFact[]): InsightsView => {
  /**
   * ⚠️ **O denominador é o que ela AVALIOU, não o que ela fez.** Um cuidado sem check-in não diz
   * nada sobre resultado, e contá-lo no total faria a Huna parecer ter mais evidência do que tem.
   */
  const rated = facts.filter((f) => f.feel !== null);
  const ratedCares = rated.length;

  if (ratedCares < MIN_RATED_CARES) {
    return {
      enoughData: false,
      ratedCares,
      ratedCaresMissing: MIN_RATED_CARES - ratedCares,
      // ⚠️ Nada é inventado para preencher a tela: sem volume, a lista é **vazia**, não estimada.
      observations: [],
    };
  }

  const best = rated.filter((f) => (f.feel ?? 0) >= HIGH_FEEL);

  /**
   * Quantas vezes cada produto apareceu nos cuidados que **ela** melhor avaliou.
   *
   * Conta por **cuidado**, não por marcação: o mesmo produto marcado duas vezes no mesmo registro
   * continua sendo um cuidado, e contar marcações inflaria a repetição sem nenhum fato novo.
   */
  const seen = new Map<string, { name: string; count: number }>();
  for (const fact of best) {
    for (const id of new Set(fact.products.map((p) => p.id))) {
      const name = fact.products.find((p) => p.id === id)?.name ?? '';
      const current = seen.get(id);
      seen.set(id, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
    }
  }

  const observations: Observation[] = [...seen.entries()]
    .filter(([, v]) => v.count >= MIN_OCCURRENCES)
    // Mais presente primeiro; empate desempata pelo nome, para a ordem não depender do banco.
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
    .map(([id, v]) => ({
      key: `product:${id}`,
      subject: v.name,
      /**
       * ⚠️ **A frase é toda a diferença.** "Esteve em" é co-ocorrência e é verificável nos
       * registros dela; qualquer verbo de efeito ("melhorou", "ajudou", "funcionou") seria alegação
       * capilar, num lugar em que ela ainda por cima acreditaria.
       *
       * ⚠️ **"que você avaliou bem", e não "os mais bem avaliados".** O conjunto é *todo* cuidado
       * com nota igual ou acima de `HIGH_FEEL` — não um top-N. Com vinte cuidados bem avaliados, a
       * outra frase viraria "os seus 20 mais bem avaliados", que sugere um ranking que não existe.
       */
      detail: `esteve em ${v.count} dos ${best.length} cuidados que você avaliou bem`,
    }));

  return { enoughData: true, ratedCares, ratedCaresMissing: 0, observations };
};
