import { describe, expect, it } from 'vitest';

import type { WashDayTechnique } from '../care-tracking/index.ts';
import { localDateFromString } from '../shared/time/index.ts';
import { buildInsights } from './application/build-insights.ts';
import { HIGH_FEEL, MIN_OCCURRENCES, MIN_RATED_CARES, type InsightFact } from './domain/insights.ts';

/**
 * SPEC-047 (P2) — **Hair Intelligence determinística.**
 *
 * ⚠️ O que estes testes guardam é a regra mais dura do produto: **observação nunca vira causa**, e
 * **nada é inventado para preencher a tela**.
 */

const P = {
  mascara: { id: 'p1', name: 'Máscara da Ana' },
  leave: { id: 'p2', name: 'Leave-in azul' },
  shampoo: { id: 'p3', name: 'Shampoo do mercado' },
};

let n = 0;
const fact = (
  feel: number | null,
  products: { id: string; name: string }[] = [],
  techniques: WashDayTechnique[] = [],
): InsightFact => ({
  careExecutionId: `e${(n += 1)}`,
  careTypeCode: 'hydration',
  executedOn: localDateFromString('2026-09-01'),
  feel,
  products,
  techniques,
});

describe('Insights — sem dados suficientes, a Huna diz isso (SPEC-047)', () => {
  it('abaixo do mínimo, não há observação nenhuma', () => {
    const v = buildInsights([fact(5, [P.mascara]), fact(5, [P.mascara])]);
    expect(v.enoughData).toBe(false);
    expect(v.observations).toEqual([]);
  });

  it('e diz quantos cuidados avaliados ainda faltam', () => {
    const v = buildInsights([fact(5), fact(4)]);
    expect(v.ratedCares).toBe(2);
    expect(v.ratedCaresMissing).toBe(MIN_RATED_CARES - 2);
  });

  /**
   * ⚠️ **Um cuidado sem check-in não diz nada sobre resultado.** Contá-lo no denominador faria a
   * Huna parecer ter mais evidência do que tem — e a frase "dos seus N melhores" mentiria.
   */
  it('cuidado sem avaliação não conta como evidência', () => {
    const v = buildInsights([fact(null), fact(null), fact(null), fact(null), fact(null), fact(null)]);
    expect(v.ratedCares).toBe(0);
    expect(v.enoughData).toBe(false);
  });

  it('sem fato nenhum, não quebra e não inventa', () => {
    const v = buildInsights([]);
    expect(v).toEqual({
      enoughData: false,
      ratedCares: 0,
      ratedCaresMissing: MIN_RATED_CARES,
      ratedCaresWithRecord: 0,
      observations: [],
    });
  });
});

describe('Insights — a repetição, contada nos fatos dela (SPEC-047)', () => {
  const cinco = (produtos: { id: string; name: string }[][]) => produtos.map((p) => fact(5, p));

  it('nomeia o produto que se repete nos melhores, com o número', () => {
    const v = buildInsights([...cinco([[P.mascara], [P.mascara], [P.mascara], [P.leave], [P.leave]])]);
    expect(v.enoughData).toBe(true);
    expect(v.observations).toHaveLength(1);
    expect(v.observations[0]?.subject).toBe('Máscara da Ana');
    expect(v.observations[0]?.detail).toBe('esteve em 3 dos 5 cuidados que você avaliou bem');
  });

  /** Duas vezes é coincidência: abaixo do mínimo de ocorrências, o produto não é nomeado. */
  it('aparecer duas vezes não vira padrão', () => {
    const v = buildInsights(cinco([[P.mascara], [P.mascara], [P.leave], [P.shampoo], [P.leave]]));
    expect(v.observations).toHaveLength(0);
    expect(MIN_OCCURRENCES).toBe(3);
  });

  /**
   * ⚠️ **Conta por cuidado, não por marcação.** O mesmo produto marcado duas vezes no mesmo
   * registro continua sendo **um** cuidado — contar marcações inflaria a repetição sem nenhum fato
   * novo por trás.
   */
  it('o mesmo produto repetido dentro de um registro conta uma vez', () => {
    const v = buildInsights([
      fact(5, [P.mascara, P.mascara, P.mascara]),
      fact(5, [P.mascara, P.mascara]),
      fact(5, [P.leave]),
      fact(5, [P.leave]),
      fact(5, [P.leave]),
    ]);
    const mascara = v.observations.find((o) => o.subject === 'Máscara da Ana');
    expect(mascara).toBeUndefined();
    expect(v.observations.find((o) => o.subject === 'Leave-in azul')?.detail).toContain('3 dos 5');
  });

  /** Só os bem avaliados entram no numerador — é o que a frase promete. */
  it('cuidado mal avaliado não entra na contagem dos melhores', () => {
    const v = buildInsights([
      fact(5, [P.mascara]),
      fact(5, [P.mascara]),
      fact(5, [P.mascara]),
      fact(1, [P.mascara]),
      fact(2, [P.mascara]),
    ]);
    expect(v.observations[0]?.detail).toBe('esteve em 3 dos 3 cuidados que você avaliou bem');
    expect(HIGH_FEEL).toBe(4);
  });

  it('mais presente primeiro, e o empate não depende da ordem do banco', () => {
    const v = buildInsights([
      fact(5, [P.leave, P.mascara]),
      fact(5, [P.leave, P.mascara]),
      fact(5, [P.leave, P.mascara]),
      fact(4, [P.leave]),
      fact(4, [P.mascara]),
    ]);
    expect(v.observations.map((o) => o.subject)).toEqual(['Leave-in azul', 'Máscara da Ana']);
  });
});

describe('Insights — o que NENHUMA observação pode dizer (Blueprint §12 / D-26)', () => {
  const v = buildInsights([
    fact(5, [P.mascara]),
    fact(5, [P.mascara]),
    fact(5, [P.mascara]),
    fact(4, [P.leave, P.mascara]),
    fact(4, [P.leave]),
    fact(2, [P.shampoo]),
  ]);

  /**
   * ⚠️ **A regra mais dura do produto.** "Esteve em 4 dos seus 6 melhores" é contagem; "melhorou
   * seu cabelo" é causa — e nenhuma quantidade de dado dela transforma co-ocorrência em causa.
   */
  it('nenhum verbo de efeito, nenhuma causa', () => {
    for (const o of v.observations) {
      const frase = `${o.subject} ${o.detail}`;
      expect(frase).not.toMatch(
        /melhor(a|ou|ando)|piora|caus|caused|funciona|caus[ae]|caiu|recuper|deixa|deixou|por causa|graças|resultado de|ajud/i,
      );
    }
  });

  it('nenhuma afirmação sobre o cabelo dela, nenhum diagnóstico', () => {
    for (const o of v.observations) {
      expect(`${o.subject} ${o.detail}`).not.toMatch(
        /seu cabelo|dano|danificad|saud[áa]vel|hidratad|nutrid|poroso|quebrad|fraco|forte/i,
      );
    }
  });

  /** Sem nota, sem porcentagem, sem comparação com outras pessoas. */
  it('nenhuma nota, porcentagem ou comparação com terceiros', () => {
    for (const o of v.observations) {
      const frase = `${o.subject} ${o.detail}`;
      expect(frase).not.toMatch(/\d+\s?%/);
      expect(frase).not.toMatch(/nota|score|ranking|m[ée]dia|melhor que|outras usu|a maioria/i);
    }
  });

  /**
   * ⚠️ **Toda observação é rastreável aos registros dela**: o número que ela vê é o número de
   * cuidados que ela mesma avaliou e marcou. Se não desse para mostrar de onde veio, não se
   * mostraria.
   */
  it('todo número na frase é um número dos registros dela', () => {
    const melhores = 5; // os cinco com feel >= 4 no fixture
    for (const o of v.observations) {
      const [, n1, n2] = /esteve em (\d+) dos (\d+)/.exec(o.detail) ?? [];
      expect(Number(n2)).toBe(melhores);
      expect(Number(n1)).toBeLessThanOrEqual(Number(n2));
    }
  });
});

/**
 * SPEC-047 fatia 2 — **a técnica também se repete**, e o vocabulário é o **já aprovado** da
 * SPEC-024.
 *
 * ⚠️ Seis das catorze são movimentos de finalização, então esta dimensão já cobre parte do que o
 * `F38` promete — **sem nomear finalização nova**, que continua sendo conteúdo capilar substantivo
 * atrás do gate D-26/D-70 (barreira viva na SPEC-039 §8).
 */
describe('Insights — a dimensão de técnica (SPEC-047 fatia 2)', () => {
  const rotulos: Partial<Record<WashDayTechnique, string>> = {
    air_dried: 'Secou naturalmente',
    diffuser: 'Difusor',
  };
  const rotulo = (t: WashDayTechnique) => rotulos[t] ?? t;

  it('nomeia a técnica que se repete, com o verbo dela', () => {
    const v = buildInsights(
      [
        fact(5, [], ['air_dried']),
        fact(5, [], ['air_dried']),
        fact(5, [], ['air_dried']),
        fact(5, [], ['diffuser']),
        fact(4, [], []),
      ],
      rotulo,
    );
    const tecnica = v.observations.find((o) => o.kind === 'technique');
    expect(tecnica?.subject).toBe('Secou naturalmente');
    expect(tecnica?.detail).toBe('você fez em 3 dos 5 cuidados que você avaliou bem');
  });

  it('produto e técnica convivem, cada um com a sua chave', () => {
    const v = buildInsights(
      [
        fact(5, [P.mascara], ['air_dried']),
        fact(5, [P.mascara], ['air_dried']),
        fact(5, [P.mascara], ['air_dried']),
        fact(5, [], []),
        fact(4, [], []),
      ],
      rotulo,
    );
    expect(v.observations.map((o) => o.kind)).toEqual(['product', 'technique']);
    expect(new Set(v.observations.map((o) => o.key)).size).toBe(2);
  });

  /** Sem rótulo, o código cru nunca chega à tela como se fosse nome. */
  it('o rótulo vem de fora — o core não inventa vocabulário de exibição', () => {
    const v = buildInsights([
      fact(5, [], ['scrunched']),
      fact(5, [], ['scrunched']),
      fact(5, [], ['scrunched']),
      fact(5, [], []),
      fact(4, [], []),
    ]);
    // Sem resolvedor, o padrão é o próprio código: explícito, e nunca um nome inventado.
    expect(v.observations.find((o) => o.kind === 'technique')?.subject).toBe('scrunched');
  });

  /**
   * ⚠️ **A barreira que separa esta fatia do `F38`.** Observar as catorze aprovadas é fato dela;
   * nomear uma finalização nova é conteúdo capilar. Se alguém acrescentar "fitagem" ao vocabulário
   * sem passar pelo gate, a SPEC-039 §8 cai — e este teste lembra por quê.
   */
  it('nenhuma finalização nova entrou pelo caminho dos insights', () => {
    for (const inventada of ['fitagem', 'dedoliss', 'day_after', 'plopping']) {
      const v = buildInsights([
        fact(5, [], [inventada as WashDayTechnique]),
        fact(5, [], [inventada as WashDayTechnique]),
        fact(5, [], [inventada as WashDayTechnique]),
        fact(5, [], []),
        fact(4, [], []),
      ]);
      // O core não valida o vocabulário — quem valida é o CHECK do banco e o schema da SPEC-024.
      // O que este teste fixa é que **nada aqui cria** o vocabulário: o rótulo cru passa direto.
      expect(v.observations.find((o) => o.kind === 'technique')?.subject).toBe(inventada);
    }
  });
});

/**
 * SPEC-047 fatia 3 — **avaliar e registrar são coisas diferentes.**
 *
 * ⚠️ O defeito que isto fixa: com doze cuidados avaliados e nenhum produto marcado, a tela dizia
 * *"a partir de 5 a Huna começa a comparar"* — apontando para um volume que ela **já tinha** e
 * escondendo o motivo real. `ratedCaresWithRecord` é o número que separa os dois silêncios.
 */
describe('Insights — cobertura do registro (SPEC-047 fatia 3)', () => {
  it('conta quantos cuidados avaliados têm algum registro', () => {
    const v = buildInsights([fact(5, [P.mascara]), fact(5, [], ['air_dried']), fact(5), fact(4), fact(4)]);
    expect(v.ratedCares).toBe(5);
    expect(v.ratedCaresWithRecord).toBe(2);
  });

  it('avaliado sem nada marcado não conta como registro', () => {
    const v = buildInsights([fact(5), fact(5), fact(5), fact(5), fact(5)]);
    expect(v.enoughData).toBe(true);
    expect(v.ratedCaresWithRecord).toBe(0);
    expect(v.observations).toEqual([]);
  });

  it('cuidado não avaliado não entra na cobertura, mesmo com produto marcado', () => {
    const v = buildInsights([fact(null, [P.mascara]), fact(5), fact(5), fact(5), fact(5), fact(4)]);
    expect(v.ratedCares).toBe(5);
    expect(v.ratedCaresWithRecord).toBe(0);
  });
});
