import { describe, expect, it } from 'vitest';

import type { InsightsView, Observation } from '../insights/index.ts';
import { insightMoments } from './application/moments.ts';

/**
 * SPEC-073 (`P25`) — o que ela descobriu, em card.
 *
 * ⚠️ O que estes testes guardam é a fronteira que torna a capability possível: **contagem, primeira
 * pessoa, sem denominador e sem verbo de efeito**. O card sai da tela dela para o feed de outra
 * pessoa, e é lá que uma frase perde o contexto que a segurava.
 */

const obs = (over: Partial<Observation> = {}): Observation => ({
  key: 'product:p1',
  kind: 'product',
  subject: 'Máscara da feira',
  count: 4,
  detail: 'esteve em 4 dos 5 cuidados que você avaliou bem',
  ...over,
});

const view = (over: Partial<InsightsView> = {}): InsightsView => ({
  enoughData: true,
  ratedCares: 5,
  ratedCaresMissing: 0,
  ratedCaresWithRecord: 5,
  observations: [obs()],
  patterns: [],
  ...over,
});

describe('insightMoments (SPEC-073)', () => {
  it('sem dados suficientes não há o que compartilhar (EC1)', () => {
    expect(insightMoments(view({ enoughData: false }))).toEqual([]);
  });

  it('o assunto vai no headline e a CONTAGEM é o herói (FR2/FR3)', () => {
    const [m] = insightMoments(view());
    expect(m?.headline).toBe('Máscara da feira');
    expect(m?.value).toBe('4');
    expect(m?.valueLabel).toBe('cuidados que avaliei bem');
  });

  /**
   * ⚠️ **A decisão difícil da SPEC (§4): sem denominador.** *"4 de 5"* convida a calcular 80%, e num
   * feed de outra pessoa isso lê como *"esse produto funciona 80% das vezes"*. A SPEC-045 já recusou
   * denominador no card de ciclo pelo mesmo motivo.
   */
  it('nenhum card carrega denominador, fração ou porcentagem (§4)', () => {
    const ms = insightMoments(
      view({ patterns: [{ key: 'c1', subject: 'A + B', cares: 5, wellRated: 4, detail: 'x' }] }),
    );
    for (const m of ms) {
      const texto = `${m.headline} ${m.value} ${m.valueLabel} ${m.footnote ?? ''}`;
      expect(texto).not.toMatch(/\bde \d|\bdos \d|%/);
    }
  });

  /** ⚠️ **Primeira pessoa** (BR1): o card é dela, e quem lê não é ela. */
  it('fala na primeira pessoa, nunca com quem lê', () => {
    for (const m of insightMoments(view())) {
      const texto = `${m.headline} ${m.value} ${m.valueLabel} ${m.footnote ?? ''}`;
      expect(texto).not.toMatch(/\bvocê\b|\bseu\b|\bsua\b/i);
    }
  });

  /** ⛔ **Nenhum verbo de efeito, nenhuma recomendação** (D-26/D-70). */
  it('não afirma efeito, indicação nem ranking', () => {
    const ms = insightMoments(
      view({ patterns: [{ key: 'c1', subject: 'A + B', cares: 5, wellRated: 4, detail: 'x' }] }),
    );
    for (const m of ms) {
      const texto = `${m.headline} ${m.value} ${m.valueLabel} ${m.footnote ?? ''}`;
      expect(texto).not.toMatch(
        /funciona|melhor|melhora|ideal|recomend|indicad|eficaz|resulta|top |ranking|comprar/i,
      );
    }
  });

  /**
   * ⛔ **A marca do check-in não vira card.** *"Frizz — 4 cuidados"* num feed lê como queixa, e a
   * SPEC-051 misturou valências contando com o contexto da tela, que o card não tem.
   */
  it('a marca do check-in (`noticed`) nunca vira card (EC2)', () => {
    const so = view({ observations: [obs({ kind: 'noticed', subject: 'Frizz', key: 'noticed:frizz' })] });
    expect(insightMoments(so)).toEqual([]);
    const misto = view({
      observations: [obs(), obs({ kind: 'noticed', subject: 'Frizz', key: 'noticed:frizz' })],
    });
    expect(insightMoments(misto)).toHaveLength(1);
    expect(insightMoments(misto)[0]?.headline).toBe('Máscara da feira');
  });

  /** BR4 — o padrão conta `wellRated`, não `cares`: contar co-ocorrência sem resultado enganaria. */
  it('o padrão usa a contagem bem avaliada, não a de co-ocorrência', () => {
    const ms = insightMoments(
      view({
        observations: [],
        patterns: [{ key: 'c1', subject: 'Máscara + Plopping', cares: 9, wellRated: 4, detail: 'x' }],
      }),
    );
    expect(ms[0]?.value).toBe('4');
  });

  /** EC4 — uma vez só fala no singular. */
  it('no singular, diz "cuidado"', () => {
    const [m] = insightMoments(view({ observations: [obs({ count: 1 })] }));
    expect(m?.valueLabel).toBe('cuidado que avaliei bem');
  });

  /**
   * EC3 — ⚠️ o `headline` é 40px e comporta ~29 caracteres; **SVG não reflui texto** e o excesso sai
   * do quadro sem avisar (defeito medido na SPEC-045).
   */
  it('um nome de catálogo longo é truncado, nunca vaza do quadro', () => {
    const longo = 'Wella Professionals Invigo Nutri-Enrich Deep Mask';
    const [m] = insightMoments(view({ observations: [obs({ subject: longo })] }));
    expect(m?.headline.length).toBeLessThanOrEqual(29);
    expect(m?.headline.endsWith('…')).toBe(true);
  });
});

/**
 * SPEC-073 — **o chip do seletor é mais curto que o headline do card, e o número saiu de medição.**
 *
 * ⚠️ A SPEC-068 mediu que sete momentos faziam o seletor ocupar **quatro linhas** e consertou
 * encurtando o chip. Medido a 390px com os momentos de insight somados: **7 chips em 3 linhas**, o
 * mais largo em **166px** — no limite. ⛔ Um nome de catálogo truncado em 29 daria ~250px e
 * empurraria de volta para a quarta linha.
 */
describe('SPEC-073 — o chip não desfaz a correção da SPEC-068', () => {
  const longo = 'Wella Professionals Invigo Nutri-Enrich Deep Mask';

  it('o chip é mais curto que o headline — são slots diferentes', () => {
    const [m] = insightMoments(view({ observations: [obs({ subject: longo })] }));
    expect(m?.chip.length).toBeLessThanOrEqual(18);
    expect(m?.headline.length).toBeLessThanOrEqual(29);
    expect(m!.chip.length).toBeLessThan(m!.headline.length);
  });

  it('um nome curto passa inteiro nos dois', () => {
    const [m] = insightMoments(view());
    expect(m?.chip).toBe('Máscara da feira');
    expect(m?.headline).toBe('Máscara da feira');
  });
});
