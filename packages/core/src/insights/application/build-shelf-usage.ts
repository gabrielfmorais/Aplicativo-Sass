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

  /**
   * SPEC-066 — **a última vez, por produto.**
   *
   * ⚠️ **Máximo de datas, e não "o primeiro que aparecer".** Os fatos chegam ordenados por
   * `executed_on` desc, e confiar nessa ordem faria a data depender de uma promessa do adapter —
   * a mesma classe de acoplamento que já produziu defeito neste projeto (`lastUsedFor` escolhendo
   * o registro mais recente que **existisse**, SPEC-063). O máximo é verdade em qualquer ordem.
   *
   * ⛔ **Lexicográfico é cronológico aqui**, e só porque `YYYY-MM-DD` é assim por construção
   * (ADR-008): nenhum `Date` é criado, e nenhum fuso entra.
   */
  const ultimoUso = new Map<string, string>();
  for (const fact of facts) {
    for (const { id } of fact.products) {
      const atual = ultimoUso.get(id);
      if (atual === undefined || fact.executedOn > atual) ultimoUso.set(id, fact.executedOn);
    }
  }

  const used = products
    .filter((p) => (uses.get(p.id) ?? 0) > 0)
    .map((p) => ({
      product: p,
      cares: uses.get(p.id) ?? 0,
      // Um produto contado tem, por definição, ao menos um fato — o `??` é o tipo, não um caso.
      lastUsedOn: ultimoUso.get(p.id) ?? '',
    }))
    // Mais usado primeiro; empate pelo nome, para a ordem não depender do banco.
    // ⛔ A recência entrou como **dado**, não como critério: ordenar por ela seria o `P7` (BR2).
    .sort((a, b) => b.cares - a.cares || a.product.name.localeCompare(b.product.name));

  const neverUsed = products
    .filter((p) => (uses.get(p.id) ?? 0) === 0)
    // Cópia antes de ordenar: `filter` já devolve um array novo, então o `sort` não toca a lista da
    // chamadora — mas dizer isso aqui é mais barato que alguém redescobrir daqui a um ano.
    .sort((a: Product, b: Product) => a.name.localeCompare(b.name));

  return {
    totalProducts: products.length,
    /** Cuidados atendidos que ela abriu registro — o denominador honesto de "em N registros". */
    recordedCares: facts.filter((f) => f.products.length > 0).length,
    used,
    neverUsed,
  };
};
