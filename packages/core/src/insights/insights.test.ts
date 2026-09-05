import { describe, expect, it } from 'vitest';

import type { FinishTechnique, WashDayTechnique } from '../care-tracking/index.ts';
import { buildInsights } from './application/build-insights.ts';
import {
  FINISH_TECHNIQUES_NOT_OBSERVABLE,
  HIGH_FEEL,
  MIN_OCCURRENCES,
  MIN_RATED_CARES,
  type InsightFact,
} from './domain/insights.ts';

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
  finishTechnique: FinishTechnique | null = null,
): InsightFact => ({
  careExecutionId: `e${(n += 1)}`,
  feel,
  products,
  techniques,
  finishTechnique,
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
      // SPEC-050 EC1 — abaixo do mínimo nem se chega a procurar padrão.
      patterns: [],
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
    // Escopo: a ordem **dos produtos**. Combinações têm o seu próprio bloco de testes.
    expect(v.observations.filter((o) => o.kind === 'product').map((o) => o.subject)).toEqual([
      'Leave-in azul',
      'Máscara da Ana',
    ]);
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

/**
 * SPEC-049 OQ1 — **os produtos que aparecem juntos** nos cuidados que ela avaliou bem.
 *
 * ⚠️ **Par, não receita.** Um par soa mais causal que um item isolado justamente porque parece uma
 * fórmula — e a frase é escolhida para não soar como uma.
 */
describe('Insights — combinações (SPEC-049 OQ1)', () => {
  it('nomeia o par que se repete, com o verbo no plural', () => {
    // ⚠️ A Máscara aparece **também sem** o Leave-in: é isso que faz o par dizer algo que os dois
    // cartões isolados não dizem — o Leave-in nunca apareceu sozinho.
    const v = buildInsights([
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara]),
      fact(4, [P.shampoo]),
    ]);
    const combo = v.observations.find((o) => o.kind === 'combo');
    expect(combo?.subject).toBe('Leave-in azul + Máscara da Ana');
    expect(combo?.detail).toBe('apareceram juntos em 3 dos 5 cuidados que você avaliou bem');
  });

  it('um par que apareceu duas vezes não vira padrão', () => {
    const v = buildInsights([
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, []),
      fact(5, []),
      fact(4, []),
    ]);
    expect(v.observations.filter((o) => o.kind === 'combo')).toHaveLength(0);
  });

  /** Só pares: trios explodem em combinações e produzem coincidência com cara de padrão. */
  it('três produtos juntos viram três pares, nunca um trio', () => {
    const tres = [P.mascara, P.leave, P.shampoo];
    // Cada um aparece **também sozinho**: sem isso os três pares empatariam com os três itens e
    // seriam descartados por redundância, que é outra regra e tem o teste dela.
    const v = buildInsights([
      fact(5, tres),
      fact(5, tres),
      fact(5, tres),
      fact(5, [P.mascara]),
      fact(5, [P.leave]),
      fact(5, [P.shampoo]),
    ]);
    const combos = v.observations.filter((o) => o.kind === 'combo');
    expect(combos).toHaveLength(3);
    for (const c of combos) expect(c.subject.split(' + ')).toHaveLength(2);
  });

  it('o nome do par não depende da ordem em que os produtos vieram', () => {
    const a = buildInsights([
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.leave, P.mascara]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara]),
      fact(4, []),
    ]);
    expect(a.observations.find((o) => o.kind === 'combo')?.subject).toBe('Leave-in azul + Máscara da Ana');
  });

  /**
   * ⚠️ **O par que não diz nada além dos dois itens sozinhos é o mesmo fato contado três vezes** — e
   * a tela ficava pior justamente para quem é mais consistente.
   *
   * Medido: rotina estável com **5 produtos marcados em todo cuidado** produzia **10 cartões de
   * combinação** ao lado dos 5 de produto, todos dizendo "juntos em 5 dos 5" sobre produtos que já
   * diziam "esteve em 5 dos 5". As observações de item ficavam soterradas pelos pares derivadas
   * delas.
   */
  it('o par que empata com OS DOIS itens é descartado: não diz nada novo', () => {
    const juntos = [P.mascara, P.leave];
    const v = buildInsights([
      fact(5, juntos),
      fact(5, juntos),
      fact(5, juntos),
      fact(5, juntos),
      fact(4, juntos),
    ]);
    // Os dois produtos continuam sendo observação — o fato é deles.
    expect(v.observations.filter((o) => o.kind === 'product')).toHaveLength(2);
    // O par, não: os dois nunca apareceram separados, e dizer isso de novo é ruído.
    expect(v.observations.filter((o) => o.kind === 'combo')).toEqual([]);
  });

  it('mas empatar com UM só dos itens informa, e o par fica', () => {
    const v = buildInsights([
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara]),
      fact(4, [P.mascara]),
    ]);
    // "O Leave-in nunca apareceu sem a Máscara" é um fato que nenhum cartão isolado carrega.
    const combo = v.observations.find((o) => o.kind === 'combo');
    expect(combo?.subject).toBe('Leave-in azul + Máscara da Ana');
    expect(combo?.detail).toBe('apareceram juntos em 3 dos 5 cuidados que você avaliou bem');
  });

  /**
   * ⚠️ **A medição que motivou a regra, como teste.** Cinco produtos sempre juntos davam dez
   * cartões de combinação; agora dão zero, e os cinco cartões de produto ficam legíveis.
   */
  it('rotina estável de cinco produtos não vira dez cartões de combinação', () => {
    const cinco = [
      P.mascara,
      P.leave,
      P.shampoo,
      { id: 'p4', name: 'Gelatina' },
      { id: 'p5', name: 'Óleo de coco' },
    ];
    const v = buildInsights([fact(5, cinco), fact(5, cinco), fact(5, cinco), fact(5, cinco), fact(4, cinco)]);
    expect(v.observations.filter((o) => o.kind === 'product')).toHaveLength(5);
    expect(v.observations.filter((o) => o.kind === 'combo')).toEqual([]);
  });

  /** ⚠️ A barreira de linguagem vale igual para o par. */
  it('nenhuma frase de combinação afirma efeito', () => {
    const v = buildInsights([
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara, P.leave]),
      fact(5, [P.mascara]),
      fact(4, [P.mascara]),
    ]);
    // Sem isto o laço abaixo ficaria vazio: com os dois produtos sempre juntos, o par é redundante
    // e nem chega a existir — um teste de linguagem sobre nenhuma frase não prova nada.
    expect(v.observations.some((o) => o.kind === 'combo')).toBe(true);
    for (const o of v.observations) {
      expect(`${o.subject} ${o.detail}`).not.toMatch(
        /funciona|melhor|receita|f[óo]rmula|combinação ideal|ajud/i,
      );
    }
  });
});

/**
 * SPEC-048 (`F38`) — **a dimensão de finalização, estritamente observacional.**
 *
 * ⚠️ O que estes testes guardam não é a contagem: é a **distância entre registrar e recomendar**.
 * *"Você finalizou assim em 3 dos 5"* é fato dela; *"fitagem é a melhor finalização para o seu
 * cabelo"* é recomendação capilar e continua bloqueada por D-26/D-70 (SPEC-048 §8).
 */
describe('Insights — a finalização registrada (SPEC-048)', () => {
  const comFinalizacao = (feel: number, finish: FinishTechnique | null) => fact(feel, [], [], finish);

  it('conta a finalização que se repete nos cuidados que ela avaliou bem', () => {
    const v = buildInsights(
      [
        comFinalizacao(5, 'plopping'),
        comFinalizacao(5, 'plopping'),
        comFinalizacao(4, 'plopping'),
        comFinalizacao(5, 'dedoliss'),
        comFinalizacao(4, null),
      ],
      undefined,
      (t) => (t === 'plopping' ? 'Plopping' : t),
    );
    const o = v.observations.find((x) => x.kind === 'finish');
    expect(o?.subject).toBe('Plopping');
    expect(o?.detail).toBe('você finalizou assim em 3 dos 5 cuidados que você avaliou bem');
  });

  it('abaixo do mínimo de ocorrências não vira observação', () => {
    const v = buildInsights([
      comFinalizacao(5, 'twist_out'),
      comFinalizacao(5, 'twist_out'),
      comFinalizacao(5, null),
      comFinalizacao(5, null),
      comFinalizacao(4, null),
    ]);
    expect(v.observations.filter((o) => o.kind === 'finish')).toEqual([]);
  });

  /**
   * ⚠️ **A decisão que mais importa desta fatia** (SPEC-048 OQ3), e os dois motivos são diferentes:
   *
   * - `other` é *"fiz uma finalização fora desta lista"*. Três cuidados com `other` podem ser
   *   **três técnicas diferentes** — dizer *"Outra finalização — você finalizou assim em 3 dos 5"*
   *   afirmaria uma repetição que talvez não exista.
   * - `unknown` é *"fiz, e não sei o nome"*: ausência de identificação, não identificação repetida.
   *
   * Chamar qualquer uma das duas de padrão seria **inventar insight**, que é a recusa que abre a
   * SPEC-047.
   */
  it('"Outra finalização" e "Não sei o nome" NUNCA viram padrão', () => {
    for (const naoObservavel of FINISH_TECHNIQUES_NOT_OBSERVABLE) {
      const v = buildInsights([
        comFinalizacao(5, naoObservavel),
        comFinalizacao(5, naoObservavel),
        comFinalizacao(5, naoObservavel),
        comFinalizacao(5, naoObservavel),
        comFinalizacao(4, naoObservavel),
      ]);
      expect(v.enoughData).toBe(true);
      expect(v.observations.filter((o) => o.kind === 'finish')).toEqual([]);
    }
  });

  /** E elas não atrapalham a contagem de uma finalização que É observável no mesmo histórico. */
  it('mas continuam sendo registro, e não apagam a observação das outras', () => {
    const v = buildInsights(
      [
        comFinalizacao(5, 'dedoliss'),
        comFinalizacao(5, 'dedoliss'),
        comFinalizacao(5, 'dedoliss'),
        comFinalizacao(5, 'other'),
        comFinalizacao(4, 'unknown'),
      ],
      undefined,
      (t) => (t === 'dedoliss' ? 'Dedoliss' : t),
    );
    const finish = v.observations.filter((o) => o.kind === 'finish');
    expect(finish).toHaveLength(1);
    expect(finish[0]?.subject).toBe('Dedoliss');
    // ⚠️ O denominador continua sendo **todos** os cuidados bem avaliados, `other` e `unknown`
    // inclusive: eles aconteceram, e encolher o denominador inflaria a repetição.
    expect(finish[0]?.detail).toBe('você finalizou assim em 3 dos 5 cuidados que você avaliou bem');
    // E as duas contam como registro — ela marcou alguma coisa.
    expect(v.ratedCaresWithRecord).toBe(5);
  });

  it('dizer qual finalização já é registro, mesmo sem produto nem técnica marcados', () => {
    const v = buildInsights([
      comFinalizacao(5, 'plopping'),
      comFinalizacao(5, null),
      comFinalizacao(5, null),
      comFinalizacao(5, null),
      comFinalizacao(4, null),
    ]);
    expect(v.ratedCaresWithRecord).toBe(1);
  });

  /**
   * ⚠️ **A barreira de linguagem, aplicada à dimensão nova.** É a mesma da SPEC-047, e ela precisa
   * valer aqui porque a finalização é a dimensão mais perto de virar conselho: "melhor finalização
   * para o seu cabelo" é literalmente o que o `F38` promete **depois** do sign-off.
   */
  it('nenhuma frase de finalização indica, promete ou ensina', () => {
    const v = buildInsights(
      [
        comFinalizacao(5, 'fitagem_tradicional'),
        comFinalizacao(5, 'fitagem_tradicional'),
        comFinalizacao(5, 'fitagem_tradicional'),
        comFinalizacao(5, null),
        comFinalizacao(4, null),
      ],
      undefined,
      () => 'Fitagem tradicional',
    );
    for (const o of v.observations.filter((x) => x.kind === 'finish')) {
      const frase = `${o.subject} ${o.detail}`;
      expect(frase).not.toMatch(
        /melhor|recomend|indicad|ideal|funciona|ajud|defini(ç|c)|frizz|volume|passo a passo|para o seu cabelo/i,
      );
      // Contagem, e nada além: o detalhe é sempre "N dos M".
      expect(o.detail).toMatch(/^você finalizou assim em \d+ dos \d+ cuidados que você avaliou bem$/);
    }
  });

  /**
   * ⚠️ **Os dois vocabulários seguem disjuntos também aqui.** Uma técnica da SPEC-024 e uma
   * finalização da SPEC-048 podem coexistir no mesmo cuidado, e cada uma vira a **sua** observação,
   * com o **seu** verbo — fundi-las é o que a D-102 proibiu.
   */
  it('técnica e finalização coexistem, cada uma com o seu verbo', () => {
    const v = buildInsights(
      [
        fact(5, [], ['diffuser'], 'plopping'),
        fact(5, [], ['diffuser'], 'plopping'),
        fact(5, [], ['diffuser'], 'plopping'),
        fact(5),
        fact(4),
      ],
      () => 'Difusor',
      () => 'Plopping',
    );
    expect(v.observations.find((o) => o.kind === 'technique')?.detail).toMatch(/^você fez em 3 dos 5/);
    expect(v.observations.find((o) => o.kind === 'finish')?.detail).toMatch(
      /^você finalizou assim em 3 dos 5/,
    );
  });
});
