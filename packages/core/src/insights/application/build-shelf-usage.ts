import type { Product } from '../../hair-profile/index.ts';
import type { InsightFact } from '../domain/insights.ts';
import type { ShelfUsage } from '../domain/insights.ts';
import { countByCare } from './count-by-care.ts';

/**
 * SPEC-049 (P6) — **Smart Shelf: a prateleira dela, contada pelo uso.**
 *
 * > Ela tem doze produtos no banheiro e não sabe quais está usando. — Blueprint §10
 *
 * ⚠️ **Contagem, nunca julgamento.** *"Você usou em 8 dos seus 14 registros"* é fato dela;
 * *"este produto funciona para você"* seria alegação capilar (D-26/D-70), e *"seus produtos melhor
 * avaliados"* seria o **ranking pessoal**, que é o `P7` e depende de decisão à parte. Aqui não há
 * média, nota nem ordem de mérito: há **quantas vezes**, que é uma pergunta que os registros dela
 * respondem sozinhos.
 *
 * ⚠️ **"Nunca apareceu" não é acusação.** Um produto sem registro pode ser novo, sazonal, ou
 * simplesmente não ter sido marcado — a tela diz o fato e para por aí. Sugerir descarte, compra ou
 * substituição é `P18`, atrás do próprio gate.
 */
export const buildShelfUsage = (
  /** A prateleira **ativa** dela. Arquivado sai da lista, mas continua no histórico (SPEC-023 BR4). */
  products: readonly Product[],
  facts: readonly InsightFact[],
): ShelfUsage => {
  // A regra de "conta por cuidado" mora num lugar só (`countByCare`): duplicá-la aqui deixaria
  // duas telas Premium darem números diferentes sobre o mesmo produto e o mesmo histórico.
  const contagem = countByCare(facts, (f) => f.products);
  const uses = new Map([...contagem].map(([id, v]) => [id, v.count]));

  const used = products
    .filter((p) => (uses.get(p.id) ?? 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, cares: uses.get(p.id) ?? 0 }))
    // Mais usado primeiro; empate pelo nome, para a ordem não depender do banco.
    .sort((a, b) => b.cares - a.cares || a.name.localeCompare(b.name));

  const neverUsed = products
    .filter((p) => (uses.get(p.id) ?? 0) === 0)
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    totalProducts: products.length,
    /** Cuidados atendidos que ela abriu registro — o denominador honesto de "em N registros". */
    recordedCares: facts.filter((f) => f.products.length > 0).length,
    used,
    neverUsed,
  };
};
