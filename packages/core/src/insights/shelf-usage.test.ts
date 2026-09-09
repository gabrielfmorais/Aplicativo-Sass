import { describe, expect, it } from 'vitest';

import type { Product } from '../hair-profile/index.ts';
import { buildShelfUsage } from './application/build-shelf-usage.ts';
import type { InsightFact } from './domain/insights.ts';

/**
 * SPEC-049 (P6) — **Smart Shelf**, a prateleira contada pelo uso.
 *
 * ⚠️ O que estes testes guardam: **contagem, nunca julgamento**. Nada aqui ordena por mérito, tira
 * média ou sugere trocar de produto — isso é `P7`/`P18`, e cada um tem o seu gate.
 */

const prod = (id: string, name: string): Product => ({ id, name, category: 'mask', catalog: null });

let n = 0;
/** SPEC-066 — a data é parâmetro porque agora ela é lida; o padrão mantém os testes antigos legíveis. */
const fact = (
  products: Product[],
  executedOn = `2026-09-${String((n % 28) + 1).padStart(2, '0')}`,
): InsightFact => ({
  careExecutionId: `e${(n += 1)}`,
  executedOn,
  feel: 5,
  products: products.map((p) => ({ id: p.id, name: p.name })),
  techniques: [],
  finishTechnique: null,
  marks: [],
});

const MASCARA = prod('p1', 'Máscara da feira');
const LEAVE = prod('p2', 'Leave-in azul');
const NOVO = prod('p3', 'Creme novo');

describe('Smart Shelf — o uso, em contagem (SPEC-049)', () => {
  it('conta em quantos cuidados cada produto apareceu, do mais usado ao menos', () => {
    const v = buildShelfUsage(
      [MASCARA, LEAVE, NOVO],
      [fact([MASCARA]), fact([MASCARA, LEAVE]), fact([MASCARA])],
    );
    expect(v.used.map((u) => [u.product.name, u.cares])).toEqual([
      ['Máscara da feira', 3],
      ['Leave-in azul', 1],
    ]);
  });

  /** O problema que o Blueprint §10 abre: doze produtos no banheiro e nenhum uso registrado. */
  it('diz o que está na prateleira e nunca apareceu em registro nenhum', () => {
    const v = buildShelfUsage([MASCARA, LEAVE, NOVO], [fact([MASCARA])]);
    expect(v.neverUsed.map((p) => p.name)).toEqual(['Creme novo', 'Leave-in azul']);
    expect(v.totalProducts).toBe(3);
  });

  it('o mesmo produto repetido no mesmo registro conta uma vez', () => {
    const v = buildShelfUsage([MASCARA], [fact([MASCARA, MASCARA, MASCARA])]);
    expect(v.used[0]?.cares).toBe(1);
  });

  it('o denominador é o número de registros com produto marcado', () => {
    const v = buildShelfUsage([MASCARA], [fact([MASCARA]), fact([]), fact([MASCARA])]);
    expect(v.recordedCares).toBe(2);
  });

  it('prateleira vazia não quebra e não inventa', () => {
    expect(buildShelfUsage([], [])).toEqual({
      totalProducts: 0,
      recordedCares: 0,
      used: [],
      neverUsed: [],
    });
  });

  /** Empate não pode depender da ordem em que o banco devolveu as linhas. */
  it('empate desempata pelo nome', () => {
    const a = prod('pa', 'Abacate');
    const z = prod('pz', 'Zero');
    const v = buildShelfUsage([z, a], [fact([a]), fact([z])]);
    expect(v.used.map((u) => u.product.name)).toEqual(['Abacate', 'Zero']);
  });

  /**
   * ⚠️ **Todo produto está em exatamente um balde.** Um produto que sumisse dos dois (ou aparecesse
   * nos dois) seria um produto que a tela deixa de contar sem dizer — e a soma é a única coisa que
   * torna isso observável.
   */
  it('usado e sem registro somam a prateleira inteira, sem sobreposição', () => {
    const v = buildShelfUsage([MASCARA, LEAVE, NOVO], [fact([MASCARA]), fact([LEAVE])]);
    expect(v.used.length + v.neverUsed.length).toBe(v.totalProducts);
    const ids = [...v.used.map((u) => u.product.id), ...v.neverUsed.map((u) => u.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * ⚠️ **Nenhum campo de julgamento.** Se um dia alguém acrescentar `score`, `rating` ou `melhor`
   * aqui, é `P7` entrando pela porta dos fundos — e `P7` é decisão à parte.
   */
  it('a leitura não tem nota, média nem ordem de mérito', () => {
    const v = buildShelfUsage([MASCARA], [fact([MASCARA])]);
    const texto = JSON.stringify(v);
    expect(texto).not.toMatch(/score|rating|nota|media|média|melhor|pior|rank/i);
    /**
     * ⚠️ **A lista de chaves cresceu numa SPEC (066), e o guarda continua sendo exato.** Afrouxar
     * para "contém" na primeira vez que ele reclama é como uma barreira morre: ela passaria a
     * aceitar `score` no dia em que alguém o acrescentasse. `lastUsedOn` é **data**, e `product` é
     * **identidade** — nenhum dos dois é julgamento.
     */
    expect(Object.keys(v.used[0] ?? {}).sort()).toEqual(['cares', 'lastUsedOn', 'product']);
  });
});

/**
 * SPEC-066 (`P6`) — **quando foi a última vez.**
 *
 * ⚠️ A contagem responde *quantas vezes*; ela não distingue o produto que ela usou ontem do que ela
 * largou em julho, e essa é a metade da pergunta do Blueprint §10 que faltava.
 *
 * ⛔ **A fronteira com o `P17` foi auditada:** um padrão é afirmação sobre uma **série**; isto é a
 * data de **um registro**, o mesmo tipo de fato que o cartão de óleo mostra desde a SPEC-040.
 */
describe('Smart Shelf — a última vez (SPEC-066)', () => {
  it('devolve a data do registro mais recente em que o produto apareceu', () => {
    const v = buildShelfUsage(
      [MASCARA],
      [fact([MASCARA], '2026-09-03'), fact([MASCARA], '2026-09-07'), fact([MASCARA], '2026-08-30')],
    );
    expect(v.used[0]?.lastUsedOn).toBe('2026-09-07');
  });

  /**
   * ⚠️ **A data não pode depender da ordem em que os fatos chegam.** Confiar no "primeiro que
   * aparecer" acoplaria o domínio a uma promessa do adapter — a mesma classe de defeito que a
   * SPEC-063 mediu no `lastUsedFor`, que pegava o registro mais recente que **existisse**.
   */
  it('acha a mais recente mesmo com os fatos fora de ordem', () => {
    const v = buildShelfUsage(
      [MASCARA],
      [fact([MASCARA], '2026-08-01'), fact([MASCARA], '2026-09-09'), fact([MASCARA], '2026-08-15')],
    );
    expect(v.used[0]?.lastUsedOn).toBe('2026-09-09');
  });

  /**
   * ⛔ **A recência entrou como DADO, não como critério** (BR2). Ordenar por ela seria escolher um
   * critério de importância, e critério de importância é o `P7`.
   */
  it('a ordem continua sendo a contagem, não a data', () => {
    const antigo = prod('pv', 'Velho de guerra');
    const recente = prod('pn', 'Novo da semana');
    const v = buildShelfUsage(
      [antigo, recente],
      [
        fact([antigo], '2026-08-01'),
        fact([antigo], '2026-08-02'),
        fact([antigo], '2026-08-03'),
        fact([recente], '2026-09-09'),
      ],
    );
    expect(v.used.map((u) => u.product.name)).toEqual(['Velho de guerra', 'Novo da semana']);
  });

  /**
   * ⛔ **Nenhum `Date` é criado, e nenhum fuso entra** (BR1/ADR-008). A string já **é** o dia civil
   * dela; a comparação é lexicográfica, e em `YYYY-MM-DD` isso é cronológico por construção.
   */
  it('compara viradas de mês e de ano sem conversão nenhuma', () => {
    const v = buildShelfUsage([MASCARA], [fact([MASCARA], '2026-12-31'), fact([MASCARA], '2027-01-01')]);
    expect(v.used[0]?.lastUsedOn).toBe('2027-01-01');
  });

  /** A identidade vem inteira: é ela que a tela usa para mostrar a foto e a marca (FR1). */
  it('carrega o produto inteiro, e não uma cópia reduzida', () => {
    const v = buildShelfUsage([MASCARA, LEAVE], [fact([MASCARA])]);
    expect(v.used[0]?.product).toBe(MASCARA);
    expect(v.neverUsed[0]).toBe(LEAVE);
  });
});
