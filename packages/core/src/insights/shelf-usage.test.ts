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

const prod = (id: string, name: string): Product => ({ id, name, category: 'mask' });

let n = 0;
const fact = (products: Product[]): InsightFact => ({
  careExecutionId: `e${(n += 1)}`,
  feel: 5,
  products: products.map((p) => ({ id: p.id, name: p.name })),
  techniques: [],
  finishTechnique: null,
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
    expect(v.used.map((u) => [u.name, u.cares])).toEqual([
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
    expect(v.used.map((u) => u.name)).toEqual(['Abacate', 'Zero']);
  });

  /**
   * ⚠️ **Todo produto está em exatamente um balde.** Um produto que sumisse dos dois (ou aparecesse
   * nos dois) seria um produto que a tela deixa de contar sem dizer — e a soma é a única coisa que
   * torna isso observável.
   */
  it('usado e sem registro somam a prateleira inteira, sem sobreposição', () => {
    const v = buildShelfUsage([MASCARA, LEAVE, NOVO], [fact([MASCARA]), fact([LEAVE])]);
    expect(v.used.length + v.neverUsed.length).toBe(v.totalProducts);
    const ids = [...v.used.map((u) => u.id), ...v.neverUsed.map((u) => u.id)];
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
    expect(Object.keys(v.used[0] ?? {}).sort()).toEqual(['cares', 'id', 'name']);
  });
});
