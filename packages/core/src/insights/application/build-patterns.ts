import type { FinishTechnique, WashDayTechnique } from '../../care-tracking/index.ts';
import type { InsightFact, Pattern } from '../domain/insights.ts';
import {
  FINISH_TECHNIQUES_NOT_OBSERVABLE,
  HIGH_FEEL,
  MAX_PATTERNS,
  MIN_PATTERN_CARES,
  MIN_PATTERN_WELL_RATED,
} from '../domain/insights.ts';

/**
 * SPEC-050 (`P8`) — **os padrões de combinação, contados nos registros dela.**
 *
 * ⚠️ **Extensão da SPEC-047, não capability nova.** Mesmos fatos, mesma porta, mesma tela, mesmo
 * gate. **Zero migration e zero mudança de adapter** — a fatia de registro do `F38` e as três
 * fatias da SPEC-047 já trouxeram tudo o que este cálculo precisa.
 *
 * ⚠️ **Co-ocorrência com resultado, nunca efeito.** A SPEC-047 conta **uma dimensão de cada vez**;
 * aqui a pergunta é se duas delas **andaram juntas**, e como ela avaliou aqueles cuidados. A
 * diferença entre *"apareceram juntos em 5, e em 4 deles você avaliou bem"* e *"essa combinação é
 * ideal para você"* é a capability inteira (D-26/D-70).
 */

/** Um item registrado num cuidado, já com o tipo — é o tipo que define o que pode parear. */
type Item = {
  /** Prefixado pelo tipo: um produto chamado "Plopping" não pode colidir com a finalização. */
  readonly id: string;
  readonly name: string;
  readonly kind: 'product' | 'technique' | 'finish';
};

const itemsOf = (
  fact: InsightFact,
  techniqueLabel: (technique: WashDayTechnique) => string,
  finishLabel: (technique: FinishTechnique) => string,
): readonly Item[] => {
  const items: Item[] = [
    ...fact.products.map((p) => ({ id: `product:${p.id}`, name: p.name, kind: 'product' as const })),
    ...fact.techniques.map((t) => ({
      id: `technique:${t}`,
      name: techniqueLabel(t),
      kind: 'technique' as const,
    })),
  ];
  /**
   * ⚠️ **`other` e `unknown` nunca são membros** (SPEC-047 §14): a primeira agregaria técnicas
   * **diferentes** sob um rótulo só, a segunda é ausência de identificação. Nenhuma das duas é uma
   * repetição, e parear com elas propagaria a mesma invenção para dentro do padrão.
   *
   * ⚠️ **Mas o cuidado continua inteiro.** Ele não é descartado: segue no denominador de qualquer
   * padrão de que participe pelos outros itens. Excluí-lo encolheria a amostra e **inflaria** o
   * padrão — o oposto do que a prudência pediria (BR4).
   */
  if (
    fact.finishTechnique !== null &&
    !(FINISH_TECHNIQUES_NOT_OBSERVABLE as readonly string[]).includes(fact.finishTechnique)
  ) {
    items.push({
      id: `finish:${fact.finishTechnique}`,
      name: finishLabel(fact.finishTechnique),
      kind: 'finish',
    });
  }
  // O mesmo item marcado duas vezes no mesmo cuidado conta uma (a mesma regra de `countByCare`).
  return [...new Map(items.map((i) => [i.id, i])).values()].sort((a, b) => a.id.localeCompare(b.id));
};

export const buildPatterns = (
  /** Só cuidados **avaliados** — quem chama já filtrou (SPEC-047 BR1). */
  rated: readonly InsightFact[],
  techniqueLabel: (technique: WashDayTechnique) => string = (t) => t,
  finishLabel: (technique: FinishTechnique) => string = (t) => t,
): readonly Pattern[] => {
  /** Em quantos cuidados avaliados cada item apareceu — o que permite descartar o par redundante. */
  const alone = new Map<string, number>();
  const pairs = new Map<
    string,
    { name: string; cares: number; wellRated: number; of: readonly [string, string] }
  >();

  for (const fact of rated) {
    const items = itemsOf(fact, techniqueLabel, finishLabel);
    const well = (fact.feel ?? 0) >= HIGH_FEEL;
    for (const item of items) alone.set(item.id, (alone.get(item.id) ?? 0) + 1);

    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        if (!a || !b) continue;
        /**
         * ⚠️ **Só pares de tipos DIFERENTES** (BR3). Produto com produto já é o `combo` da SPEC-049
         * OQ1, com outra frase e outro denominador — repeti-lo aqui seria a mesma coisa dita duas
         * vezes, na mesma tela.
         *
         * ⚠️ **E só pares.** Trios explodem em combinações e produzem coincidência com cara de
         * padrão, que é exatamente o que a amostra mínima existe para evitar.
         */
        if (a.kind === b.kind) continue;
        const key = `${a.id}|${b.id}`;
        const current = pairs.get(key);
        pairs.set(key, {
          name: current?.name ?? [a.name, b.name].sort((x, y) => x.localeCompare(y)).join(' + '),
          cares: (current?.cares ?? 0) + 1,
          wellRated: (current?.wellRated ?? 0) + (well ? 1 : 0),
          of: [a.id, b.id],
        });
      }
    }
  }

  return (
    [...pairs.entries()]
      .filter(([, v]) => v.cares >= MIN_PATTERN_CARES)
      /**
       * ⚠️ **O par sem nenhum cuidado bem avaliado é uma acusação, não uma observação.** *"…e em 0
       * deles você avaliou bem"* lê como *"essa combinação não funciona"* — o espelho de *"é ideal
       * para você"*, e igualmente alegação capilar (D-26/D-70). A direção negativa é `P18`, atrás
       * do próprio gate.
       */
      .filter(([, v]) => v.wellRated >= MIN_PATTERN_WELL_RATED)
      /**
       * ⚠️ **O par que nunca aparece separado é descartado** (BR5). Se os dois membros apareceram
       * exatamente nos mesmos cuidados, o padrão não separa nada: as duas contagens seriam as de
       * qualquer um deles sozinho, e nomear os dois sugeriria uma interação que o dado não distingue.
       * É a **mesma regra** da SPEC-047 §15.1, com o denominador desta fatia — uma regra, dois
       * lugares.
       */
      .filter(([, v]) => {
        const [x, y] = v.of;
        return v.cares !== (alone.get(x) ?? 0) || v.cares !== (alone.get(y) ?? 0);
      })
      /**
       * ⚠️ **Ordem por contagem ABSOLUTA, nunca por proporção** (BR7). Ordenar por *"qual proporção
       * foi melhor avaliada"* é construir um ranking — a `P7` entrando pela porta dos fundos, e com
       * amostra de três. Desempate pelo nome, para a ordem não depender do banco.
       */
      .sort(
        (a, b) =>
          b[1].wellRated - a[1].wellRated || b[1].cares - a[1].cares || a[1].name.localeCompare(b[1].name),
      )
      .slice(0, MAX_PATTERNS)
      .map(([key, v]) => ({
        key: `pattern:${key}`,
        subject: v.name,
        cares: v.cares,
        wellRated: v.wellRated,
        /**
         * ⚠️ **"e em 4 deles", não "4 de 5".** A forma `N de M` convida a calcular a porcentagem — é a
         * razão registrada pela qual a SPEC-045 recusou *"10 de 14"* no card de ciclo. Os dois números
         * aparecem, porque a rastreabilidade exige, mas a frase os separa em vez de os oferecer como
         * fração.
         *
         * ⚠️ **"você avaliou bem"** é o vocabulário que a camada inteira usa para `feel >= HIGH_FEEL`,
         * e devolve a avaliação a quem a deu. Nenhum verbo de efeito entra aqui, nunca.
         */
        detail: `apareceram juntos em ${v.cares} ${
          v.cares === 1 ? 'cuidado que você avaliou' : 'cuidados que você avaliou'
        }, e em ${v.wellRated} ${v.wellRated === 1 ? 'dele' : 'deles'} você avaliou bem`,
      }))
  );
};
