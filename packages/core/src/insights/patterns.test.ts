import { describe, expect, it } from 'vitest';

import type { CheckInMark, FinishTechnique, WashDayTechnique } from '../care-tracking/index.ts';
import { buildInsights } from './application/build-insights.ts';
import { buildPatterns } from './application/build-patterns.ts';
import type { InsightFact } from './domain/insights.ts';
import { MAX_PATTERNS, MIN_PATTERN_CARES } from './domain/insights.ts';

/**
 * SPEC-050 (`P8`) — **padrões de combinação.**
 *
 * ⚠️ O que estes testes guardam é a fronteira que a capability inteira depende de não cruzar:
 * *"apareceram juntos em 5 cuidados que você avaliou, e em 4 deles você avaliou bem"* é **contagem**;
 * *"Máscara X funciona melhor com Fitagem"*, *"Plopping melhorou seu cabelo"* e *"essa combinação é
 * ideal para você"* são **alegação capilar** (D-26/D-70) e não podem existir em caminho de código
 * nenhum.
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
  finishTechnique: FinishTechnique | null = null,
  marks: CheckInMark[] = [],
): InsightFact => ({
  careExecutionId: `e${(n += 1)}`,
  feel,
  products,
  techniques,
  finishTechnique,
  marks,
});

const rotulos = {
  tecnica: (t: WashDayTechnique) =>
    t === 'diffuser' ? 'Difusor' : t === 'air_dried' ? 'Secou naturalmente' : t,
  finalizacao: (t: FinishTechnique) =>
    t === 'plopping' ? 'Plopping' : t === 'dedoliss' ? 'Dedoliss' : t === 'other' ? 'Outra finalização' : t,
};

const padroes = (facts: InsightFact[]) => buildPatterns(facts, rotulos.tecnica, rotulos.finalizacao);

describe('Padrões — a combinação contada, nunca explicada (SPEC-050)', () => {
  it('conta em quantos cuidados os dois apareceram, e em quantos deles ela avaliou bem', () => {
    const v = padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      // O quinto tem o par e foi mal avaliado: entra no denominador, não no numerador.
      fact(2, [P.mascara], [], 'plopping'),
      // E este quebra a redundância — a Máscara aparece sem o Plopping.
      fact(5, [P.mascara]),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.subject).toBe('Máscara da Ana + Plopping');
    expect(v[0]?.cares).toBe(5);
    expect(v[0]?.wellRated).toBe(4);
    expect(v[0]?.detail).toBe(
      'apareceram juntos em 5 cuidados que você avaliou, e em 4 deles você avaliou bem',
    );
  });

  /** ⚠️ **Amostra mínima**: com dois cuidados, "padrão" é coincidência com cara de descoberta. */
  it(`abaixo de ${MIN_PATTERN_CARES} cuidados juntos, não existe padrão`, () => {
    const v = padroes([
      fact(5, [P.mascara], ['diffuser']),
      fact(5, [P.mascara], ['diffuser']),
      fact(5, [P.mascara]),
      fact(5, [], ['diffuser']),
    ]);
    expect(v).toEqual([]);
  });

  /**
   * ⚠️ **Cuidado sem check-in não diz nada sobre resultado** (SPEC-047 BR1). Quem chama já filtra,
   * e este teste garante que o cálculo não passa a contá-lo por conta própria pela porta da view.
   */
  it('cuidado não avaliado não entra no padrão', () => {
    const v = buildInsights(
      [
        fact(null, [P.mascara], [], 'plopping'),
        fact(null, [P.mascara], [], 'plopping'),
        fact(null, [P.mascara], [], 'plopping'),
        fact(5, [P.mascara], [], 'plopping'),
        fact(5, [P.mascara]),
        fact(5),
        fact(5),
        fact(4),
      ],
      rotulos.tecnica,
      rotulos.finalizacao,
    );
    expect(v.patterns).toEqual([]);
  });
});

describe('Padrões — os pares que NÃO existem (SPEC-050)', () => {
  /**
   * ⚠️ **Produto com produto já é o `combo` da SPEC-049 OQ1**, com outra frase e outro denominador.
   * Repeti-lo aqui seria a mesma coisa dita duas vezes na mesma tela.
   */
  it('par do MESMO tipo não é padrão', () => {
    const juntos = [P.mascara, P.leave];
    const v = padroes([
      fact(5, juntos),
      fact(5, juntos),
      fact(5, juntos),
      fact(5, [P.mascara]),
      fact(4, [P.leave]),
    ]);
    expect(v).toEqual([]);
  });

  it('duas técnicas no mesmo cuidado também não', () => {
    const v = padroes([
      fact(5, [], ['diffuser', 'air_dried']),
      fact(5, [], ['diffuser', 'air_dried']),
      fact(5, [], ['diffuser', 'air_dried']),
      fact(5, [], ['diffuser']),
      fact(4, [], ['air_dried']),
    ]);
    expect(v).toEqual([]);
  });

  /** ⚠️ **Só pares.** Trios explodem em combinações e produzem coincidência com cara de padrão. */
  it('produto + técnica + finalização viram pares, nunca um trio', () => {
    const tres = () => fact(5, [P.mascara], ['diffuser'], 'plopping');
    const v = padroes([
      tres(),
      tres(),
      tres(),
      fact(5, [P.mascara]),
      fact(5, [], ['diffuser']),
      fact(5, [], [], 'plopping'),
    ]);
    expect(v.length).toBeGreaterThan(0);
    for (const p of v) expect(p.subject.split(' + ')).toHaveLength(2);
  });

  /**
   * ⚠️ **`other` e `unknown` nunca são membros** (SPEC-047 §14) — mas o cuidado que os carrega
   * **continua no denominador**. Excluir o cuidado encolheria a amostra e **inflaria** o padrão.
   */
  it('"Outra finalização" não vira membro, e o cuidado dela continua contando', () => {
    const v = padroes([
      fact(5, [P.mascara], ['diffuser'], 'other'),
      fact(5, [P.mascara], ['diffuser'], 'unknown'),
      fact(4, [P.mascara], ['diffuser'], 'other'),
      fact(5, [P.mascara]),
    ]);
    const par = v.find((p) => p.subject === 'Difusor + Máscara da Ana');
    // Os três cuidados entraram inteiros, apesar de `other`/`unknown`.
    expect(par?.cares).toBe(3);
    expect(par?.wellRated).toBe(3);
    // E nenhum dos dois virou padrão.
    for (const p of v) {
      expect(p.subject).not.toMatch(/Outra finalização|Não sei o nome|unknown/);
    }
  });

  /**
   * ⚠️ **O par que nunca aparece separado não separa nada** (BR5, a mesma regra da SPEC-047 §15.1):
   * as duas contagens seriam as de qualquer um deles sozinho, e nomear os dois sugeriria uma
   * interação que o dado não distingue.
   */
  it('o par que empata com OS DOIS membros é descartado', () => {
    const v = padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(4, [P.mascara], [], 'plopping'),
    ]);
    expect(v).toEqual([]);
  });

  it('mas empatar com UM só dos membros informa, e o padrão fica', () => {
    const v = padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      // A Máscara aparece sem o Plopping: o Plopping nunca apareceu sem a Máscara, e isso é um fato.
      fact(3, [P.mascara]),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.subject).toBe('Máscara da Ana + Plopping');
  });
});

describe('Padrões — poucos, e nenhum ranking (SPEC-050)', () => {
  /** ⚠️ Teto de **exibição**: uma tela cheia de combinações é uma tela estatística (NG6). */
  it(`mostra no máximo ${MAX_PATTERNS} padrões`, () => {
    const cheio = () => fact(5, [P.mascara, P.leave, P.shampoo], ['diffuser', 'air_dried'], 'plopping');
    const v = padroes([
      cheio(),
      cheio(),
      cheio(),
      cheio(),
      fact(5, [P.mascara]),
      fact(5, [], ['diffuser']),
      fact(5, [], [], 'plopping'),
      fact(4, [P.leave]),
    ]);
    expect(v.length).toBeLessThanOrEqual(MAX_PATTERNS);
  });

  /**
   * ⚠️ **A ordem é por contagem ABSOLUTA, nunca por proporção** (BR7). Ordenar por *"qual proporção
   * foi melhor avaliada"* seria construir um ranking — a `P7` entrando pela porta dos fundos, e com
   * amostra de três.
   */
  it('o par com proporção melhor NÃO passa na frente do par com mais cuidados bem avaliados', () => {
    const v = padroes([
      // Máscara + Plopping: 5 juntos, 4 bem avaliados (proporção 4/5).
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(2, [P.mascara], [], 'plopping'),
      // Leave-in + Difusor: 3 juntos, 3 bem avaliados (proporção 3/3, melhor).
      fact(5, [P.leave], ['diffuser']),
      fact(5, [P.leave], ['diffuser']),
      fact(5, [P.leave], ['diffuser']),
      // Quebra as redundâncias dos dois pares.
      fact(3, [P.mascara]),
      fact(3, [P.leave]),
      fact(3, [], ['diffuser']),
      fact(3, [], [], 'plopping'),
    ]);
    expect(v[0]?.subject).toBe('Máscara da Ana + Plopping');
    expect(v[0]?.wellRated).toBe(4);
  });

  it('empate resolve pelo nome, e não pela ordem em que os fatos vieram', () => {
    const a = padroes([
      fact(5, [P.mascara], ['diffuser']),
      fact(5, [P.mascara], ['diffuser']),
      fact(5, [P.mascara], ['diffuser']),
      fact(5, [P.leave], ['air_dried']),
      fact(5, [P.leave], ['air_dried']),
      fact(5, [P.leave], ['air_dried']),
      fact(3, [P.mascara]),
      fact(3, [P.leave]),
      fact(3, [], ['diffuser']),
      fact(3, [], ['air_dried']),
    ]);
    expect(a.map((p) => p.subject)).toEqual([
      'Difusor + Máscara da Ana',
      'Leave-in azul + Secou naturalmente',
    ]);
  });
});

describe('Padrões — o que NENHUM padrão pode dizer (D-26/D-70)', () => {
  const comPadrao = () =>
    padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara], [], 'plopping'),
      fact(2, [P.mascara], [], 'plopping'),
      fact(5, [P.mascara]),
    ]);

  it('nenhum verbo de efeito, nenhuma indicação, nenhuma promessa', () => {
    for (const p of comPadrao()) {
      const frase = `${p.subject} ${p.detail}`;
      expect(frase).not.toMatch(
        /funciona|melhor(es)? com|melhorou|piorou|ajud|recomend|indicad|ideal|combina(ç|c)ão ideal|receita|f[óo]rmula|por causa|gra(ç|c)as/i,
      );
      expect(frase).not.toMatch(/seu cabelo (est[áa]|ficou)|danificad|saud[áa]vel|frizz|defini(ç|c)/i);
    }
  });

  it('nenhuma porcentagem, nota ou comparação com outras pessoas', () => {
    for (const p of comPadrao()) {
      expect(p.detail).not.toMatch(/\d+\s?%|nota|score|ranking|m[ée]dia|outras usu[áa]rias|a maioria/i);
    }
  });

  /** A frase é sempre a mesma forma: duas contagens, e nada além delas. */
  it('o detalhe é sempre duas contagens, e nada além', () => {
    for (const p of comPadrao()) {
      expect(p.detail).toMatch(
        /^apareceram juntos em \d+ cuidados? que você avaliou, e em \d+ (dele|deles) você avaliou bem$/,
      );
    }
  });

  /** ⚠️ O numerador nunca pode passar o denominador — seria um número que não existe. */
  it('nunca há mais cuidados bem avaliados do que cuidados com o par', () => {
    for (const p of comPadrao()) expect(p.wellRated).toBeLessThanOrEqual(p.cares);
  });
});

/**
 * SPEC-050 — **a recusa que a auditoria encontrou.**
 *
 * ⚠️ Um par que apareceu em vários cuidados e em **nenhum** deles ela avaliou bem produziria
 * *"apareceram juntos em 4 cuidados que você avaliou, e em 0 deles você avaliou bem"* — que não é
 * observação, é **acusação**: a leitura inevitável é *"essa combinação não funciona"*, o espelho
 * exato de *"essa combinação é ideal para você"* e igualmente alegação capilar (D-26/D-70).
 */
describe('Padrões — a direção negativa não existe (SPEC-050)', () => {
  it('o par sem NENHUM cuidado bem avaliado não vira padrão', () => {
    const v = padroes([
      fact(2, [P.mascara], [], 'plopping'),
      fact(3, [P.mascara], [], 'plopping'),
      fact(1, [P.mascara], [], 'plopping'),
      fact(3, [P.mascara], [], 'plopping'),
      // A Máscara aparece sem o Plopping: a redundância não é o motivo do descarte.
      fact(5, [P.mascara]),
    ]);
    expect(v).toEqual([]);
  });

  /** ⚠️ **O corte é só no zero.** Um único cuidado bem avaliado já é fato, e o número vai honesto. */
  it('com um só cuidado bem avaliado, o padrão existe e o número é o verdadeiro', () => {
    const v = padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(2, [P.mascara], [], 'plopping'),
      fact(1, [P.mascara], [], 'plopping'),
      fact(3, [P.mascara]),
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]?.detail).toBe(
      'apareceram juntos em 3 cuidados que você avaliou, e em 1 dele você avaliou bem',
    );
  });

  /** E nenhuma frase sugere que a combinação seja ruim — a direção negativa é `P18`. */
  it('nenhuma frase diz que uma combinação não funciona', () => {
    const v = padroes([
      fact(5, [P.mascara], [], 'plopping'),
      fact(2, [P.mascara], [], 'plopping'),
      fact(1, [P.mascara], [], 'plopping'),
      fact(3, [P.mascara]),
    ]);
    for (const p of v) {
      expect(p.detail).not.toMatch(/em 0 |evite|não funciona|pior|deixe de|troque|substitua/i);
    }
  });
});
