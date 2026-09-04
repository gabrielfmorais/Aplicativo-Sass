import type { InsightFact } from '../domain/insights.ts';

/**
 * SPEC-047/SPEC-049 — **conta por CUIDADO, nunca por marcação.**
 *
 * ⚠️ **Mora num lugar só de propósito.** A regra vivia duplicada em `buildInsights` e
 * `buildShelfUsage`, e as duas alimentam telas Premium que leem **os mesmos fatos**: se uma passasse
 * a contar marcações, a Huna diria *"em 4 registros"* numa tela e outro número na outra, sobre o
 * mesmo produto e o mesmo histórico. Duas verdades sobre o mesmo fato é exatamente o que a D-103
 * proíbe, e aqui elas nem precisariam de má-fé para aparecer.
 *
 * O mesmo item marcado duas vezes no mesmo registro continua sendo **um** cuidado: contar marcações
 * inflaria a repetição sem nenhum fato novo por trás.
 */
export const countByCare = (
  facts: readonly InsightFact[],
  pick: (fact: InsightFact) => readonly { id: string; name: string }[],
): Map<string, { name: string; count: number }> => {
  const seen = new Map<string, { name: string; count: number }>();
  for (const fact of facts) {
    const items = pick(fact);
    for (const id of new Set(items.map((i) => i.id))) {
      const name = items.find((i) => i.id === id)?.name ?? '';
      const current = seen.get(id);
      seen.set(id, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
    }
  }
  return seen;
};
