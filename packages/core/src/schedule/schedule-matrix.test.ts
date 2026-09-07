import { describe, expect, it } from 'vitest';

import { assess, CURRENT_ASSESSMENT_VERSION } from '../diagnostic/index.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../hair-profile/index.ts';
import { localDateFromString } from '../shared/index.ts';
import { buildPlan, type ScheduleVersion } from './application/build-plan.ts';
import { __testing, generateScheduleV2 } from './engine/v2/generate-schedule.ts';
import { CARE_TYPE_CODES, type CareTypeCode } from './index.ts';

/**
 * ⚠️ **A matriz de cenários — a auditoria vertical do motor, virada barreira.**
 *
 * Os testes vizinhos verificam o motor **caso a caso**: este perfil recebe reconstrução, aquele não.
 * Nenhum deles responde a pergunta que a auditoria de 2026-09-07 fez, e que é a pergunta do produto:
 * *"quantos cronogramas diferentes a Huna realmente sabe montar?"*.
 *
 * A resposta só aparece varrendo o espaço de respostas inteiro e **contando o output**. O que este
 * arquivo mede — e passa a segurar — é o comportamento agregado das duas engines sobre
 * **57.600 perfis distintos**, o produto cartesiano das respostas que o motor lê.
 *
 * ⚠️ **Ele não decide nenhuma regra capilar.** Cada número aqui é uma **medição** do que o motor faz
 * hoje; nenhum deles diz o que ele deveria fazer. Mudar um número é legítimo — desde que seja uma
 * escolha, e não uma surpresa, que é exatamente o que um golden existe para garantir (ADR-007).
 */

const STARTS_ON = localDateFromString('2026-09-07');

/**
 * ⚠️ **Orçamento de relógio, não asserção** — a mesma razão do `testTimeout` do `jest.config.js`.
 *
 * As varreduras aqui percorrem 57.600 perfis e levam ~4s numa máquina livre; num runner carregado,
 * o teto padrão de 5s do vitest transforma um teste **correto** em vermelho. Um teste que reprova
 * por relógio é pior que nenhum: ele ensina a ignorar a cor. Nada espera este tempo quando as coisas
 * funcionam, e um laço infinito continua falhando.
 */
const BUDGET = 30_000;

const PATTERNS = ['straight', 'wavy', 'curly', 'coily', 'transitioning_or_mixed', 'unknown'] as const;
const WASH = [
  'once_or_less_weekly',
  'twice_weekly',
  'three_to_four_weekly',
  'five_or_more_weekly',
  'varies',
] as const;
const HEAT = ['almost_never', 'one_to_two_weekly', 'three_to_four_weekly', 'almost_daily'] as const;
const CONCERNS = ['dryness', 'breakage', 'tangling', 'dullness', 'frizz'] as const;
const GOALS = [
  'softness_and_hydration',
  'reduce_breakage_and_strengthen',
  'recover_chemical_or_heat_damage',
  'definition_and_frizz_control',
  'maintain_healthy_hair',
] as const;

/**
 * ⚠️ **Três conjuntos de química bastam, e isso é medido, não economizado.** As duas engines leem
 * `chemicalTreatments.length > 0` e nada mais — os 16 subconjuntos possíveis colapsam em "tem" e
 * "não tem". Varrer os 16 multiplicaria o teste por cinco e produziria os mesmos números.
 */
const CHEMICALS: readonly HairProfileInput['chemicalTreatments'][] = [
  [],
  ['coloring'],
  ['coloring', 'bleaching_or_highlights'],
];

/** Toda combinação de queixas que o onboarding aceita: as 31 não vazias mais a exclusiva. */
const CONCERN_SETS: readonly HairProfileInput['currentConcerns'][] = [
  ...CONCERNS.reduce<(typeof CONCERNS)[number][][]>(
    (acc, c) => [...acc, ...acc.map((s) => [...s, c])],
    [[]],
  ).filter((s) => s.length > 0),
  ['no_major_concern'],
];

const base: HairProfileInput = {
  hairPattern: 'wavy',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['dryness'],
  primaryGoal: 'maintain_healthy_hair',
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
};

const snapshot = (over: Partial<HairProfileInput> = {}): HairProfileSnapshot => ({
  ...base,
  ...over,
  hairProfileId: 'hp-matrix',
  createdAt: '2026-09-01T00:00:00.000Z',
});

/** O produto cartesiano das seis respostas que alguma das engines lê. */
const MATRIX: readonly HairProfileSnapshot[] = (() => {
  let rows: HairProfileSnapshot[] = [snapshot()];
  const axes = {
    hairPattern: PATTERNS,
    washFrequency: WASH,
    chemicalTreatments: CHEMICALS,
    heatUsage: HEAT,
    currentConcerns: CONCERN_SETS,
    primaryGoal: GOALS,
  } as const;
  for (const [field, values] of Object.entries(axes)) {
    rows = rows.flatMap((row) => (values as readonly unknown[]).map((value) => ({ ...row, [field]: value })));
  }
  return rows;
})();

const planOf = (profile: HairProfileSnapshot, version: ScheduleVersion): readonly CareTypeCode[] =>
  buildPlan(profile, STARTS_ON, undefined, version).cares.map((c) => c.careTypeCode);

/**
 * ⚠️ **As duas varreduras acontecem UMA vez, e não uma por asserção.**
 *
 * Cada teste abaixo percorre a matriz inteira; recalculando o plano em cada um, o arquivo fazia
 * ~oito varreduras completas e passou a **encostar no timeout** do vitest numa máquina carregada —
 * um teste correto que reprova por relógio é pior que nenhum, porque ensina a ignorar a cor.
 *
 * Calcular na carga do módulo mantém exatamente as mesmas asserções e tira o relógio da conta.
 */
const V1 = MATRIX.map((p) => planOf(p, 'v1'));
const V2 = MATRIX.map((p) => planOf(p, 'v2'));
const typesAt = (i: number, version: ScheduleVersion) => (version === 'v1' ? V1[i] : V2[i]) ?? [];

const countOf = (types: readonly CareTypeCode[]): Record<CareTypeCode, number> => {
  const counts = Object.fromEntries(CARE_TYPE_CODES.map((t) => [t, 0])) as Record<CareTypeCode, number>;
  for (const t of types) counts[t] += 1;
  return counts;
};

/** Os três sinais de dano, como as duas engines os contam (worksheet §4 / SPEC-038). */
const damageCount = (p: HairProfileSnapshot): number =>
  [
    p.chemicalTreatments.length > 0,
    (['three_to_four_weekly', 'almost_daily'] as readonly string[]).includes(p.heatUsage),
    (['reduce_breakage_and_strengthen', 'recover_chemical_or_heat_damage'] as readonly string[]).includes(
      p.primaryGoal,
    ) || (p.currentConcerns as readonly string[]).includes('breakage'),
  ].filter(Boolean).length;

describe('matriz de cenários — o que o motor produz sobre o espaço de respostas inteiro', () => {
  it('a matriz é o produto cartesiano esperado', () => {
    expect(MATRIX.length).toBe(6 * 5 * 3 * 4 * 32 * 5);
    expect(new Set(MATRIX.map((p) => JSON.stringify(p))).size).toBe(MATRIX.length);
  });

  /**
   * ⚠️ **O número que a auditoria foi buscar.**
   *
   * 57.600 perfis distintos entram; **12 cronogramas distintos** saem do v1. A personalização do v1
   * é a **cadência** (a frequência de lavagem decide 4, 8 ou 12 cuidados), mais **uma** vaga que
   * pode virar reconstrução, mais qual eixo abre o ciclo — a proporção hidratação:nutrição é sempre
   * meio a meio. O v2 sobe para **19** porque a proporção passa a depender do perfil.
   *
   * ⚠️ **Isto não é um defeito com conserto de engenharia.** Aumentar a variedade é afirmar *"este
   * perfil deve receber tal proporção"*, que é regra capilar e precisa de revisor (D-26/D-70). O que
   * o teste faz é impedir que o número mude sem ninguém ver.
   */
  it('o v1 monta 12 cronogramas distintos, o v2 monta 19', () => {
    expect(new Set(V1.map((t) => t.join(','))).size).toBe(12);
    expect(new Set(V2.map((t) => t.join(','))).size).toBe(19);
  });

  /**
   * ⚠️ **A medição que derrubou uma frase da tela.**
   *
   * A avaliação tem uma regra de prioridade 3 — *"padrão com curvatura puxa para hidratação"* — e o
   * v1 **não consegue expressá-la**: a ênfase só escolhe qual eixo abre o ciclo, e `hydration` e
   * `balanced` abrem os dois por hidratação. O plano de um cabelo cacheado é **idêntico** ao de um
   * cabelo liso com as mesmas outras respostas, em 100% da matriz.
   *
   * Enquanto isso, o "Por que este cronograma?" exibia *"Cabelos com curvatura costumam pedir mais
   * hidratação."* — explicação para uma diferença que não existe (SPEC-017 FR4). O v1 é imutável
   * (ADR-001 §2), então quem estava errado era a frase, e ela virou uma observação.
   *
   * A barreira mora aqui porque o fato é do motor; a frase tem a dela em `plan-rationale.test.tsx`.
   */
  it(
    'o v1 é invariante ao padrão de curvatura — a ênfase só escolhe quem abre o ciclo',
    () => {
      for (const p of MATRIX) {
        if (p.hairPattern === 'straight') continue;
        expect(planOf(p, 'v1')).toEqual(planOf({ ...p, hairPattern: 'straight' }, 'v1'));
      }
    },
    BUDGET,
  );

  /** E no v2 a curvatura passa a mudar o plano — senão a regra de prioridade 3 seria decorativa. */
  it(
    'o v2 deixa de ser invariante ao padrão de curvatura',
    () => {
      const muda = MATRIX.filter(
        (p) =>
          p.hairPattern !== 'straight' &&
          planOf(p, 'v2').join() !== planOf({ ...p, hairPattern: 'straight' }, 'v2').join(),
      );
      expect(muda.length).toBeGreaterThan(0);
    },
    BUDGET,
  );

  /**
   * ⚠️ **"O sistema sempre coloca reconstrução" seria defeito de produto — e não é o caso, medido.**
   *
   * A reconstrução tem condição, ela é conservadora (dois dos três sinais) e existem perfis dos dois
   * lados. O teste prende as duas pontas: nenhum caminho força, e nenhum caminho esquece.
   */
  it(
    'a reconstrução entra pelos sinais e por mais nada — nos dois sentidos',
    () => {
      const semSinal = MATRIX.map((p, i) => (damageCount(p) < 2 ? i : -1)).filter((i) => i >= 0);
      const comSinal = MATRIX.map((p, i) => (damageCount(p) >= 2 ? i : -1)).filter((i) => i >= 0);
      expect(semSinal.length).toBeGreaterThan(0);
      expect(comSinal.length).toBeGreaterThan(0);

      for (const i of semSinal) expect(countOf(typesAt(i, 'v1')).reconstruction).toBe(0);
      for (const i of comSinal) expect(countOf(typesAt(i, 'v1')).reconstruction).toBe(1);
    },
    BUDGET,
  );

  /** No v1 ela é sempre **uma**; o v2 é quem transforma a contagem de sinais em quantidade. */
  it('o v1 nunca passa de uma reconstrução; o v2 chega a duas', () => {
    const v1 = [...new Set(V1.map((t) => countOf(t).reconstruction))].sort();
    const v2 = [...new Set(V2.map((t) => countOf(t).reconstruction))].sort();
    expect(v1).toEqual([0, 1]);
    expect(v2).toEqual([0, 1, 2]);
  });

  /**
   * ⚠️ **A restauração não é alcançável por nenhuma usuária real, e isto mede exatamente por quê.**
   *
   * Ela existe no vocabulário (D-102), no banco e no v2 — e o v2 não é a versão corrente. Sobre a
   * matriz inteira o v1 produz **zero** restaurações; no v2 os três sinais são condição
   * **necessária**, e o teto por ciclo é um.
   */
  it(
    'restauração: zero no v1, e no v2 os três sinais são condição necessária',
    () => {
      for (const t of V1) expect(countOf(t).restoration).toBe(0);
      MATRIX.forEach((p, i) => {
        const quantas = countOf(typesAt(i, 'v2')).restoration;
        expect(quantas).toBeLessThanOrEqual(1);
        if (damageCount(p) < 3) expect(quantas).toBe(0);
      });
      expect(V2.some((t) => countOf(t).restoration === 1)).toBe(true);
    },
    BUDGET,
  );

  /**
   * ⚠️ **Mas necessária não é suficiente, e a exceção é do MECANISMO, não de regra capilar.**
   *
   * Num ciclo de quatro vagas (lava uma vez por semana ou menos) o peso 1 da restauração vira
   * `1/10 × 4 = 0,4` e o arredondamento por maior resto a zera. Quem tem **todos** os sinais de dano
   * e lava pouco recebe reconstrução e **nunca** restauração — não porque alguma regra diga isso,
   * mas porque não sobra vaga. Está medido para que a decisão de aceitar ou mudar seja de quem
   * revisa o domínio, e não um efeito colateral que ninguém viu.
   */
  it('num ciclo de quatro vagas a restauração é arredondada para fora, mesmo com os três sinais', () => {
    const todosOsSinais = {
      chemicalTreatments: ['coloring'],
      heatUsage: 'almost_daily',
      currentConcerns: ['breakage'],
    } as const satisfies Partial<HairProfileInput>;

    const curto = planOf(snapshot({ ...todosOsSinais, washFrequency: 'once_or_less_weekly' }), 'v2');
    const longo = planOf(snapshot({ ...todosOsSinais, washFrequency: 'twice_weekly' }), 'v2');

    expect(curto).toHaveLength(4);
    expect(countOf(curto).restoration).toBe(0);
    expect(countOf(curto).reconstruction).toBe(1);
    expect(countOf(longo).restoration).toBe(1);
  });

  /**
   * ⚠️ **A barreira que faltava no v2: a quota calculada e a quota entregue têm de ser a mesma.**
   *
   * O v2 decide quantos cuidados de cada tipo o ciclo leva e **depois** procura onde os fortes
   * cabem — nunca abrindo o ciclo, nunca colados. Se um dia a busca não achar posição para todos, o
   * que sobrar some **em silêncio**: a quota diz uma coisa e o cronograma entrega outra, sem erro
   * nenhum. Hoje isso não acontece em nenhum dos 57.600 perfis, e o teste é o que garante que a
   * primeira vez que acontecer seja em CI, e não na tela dela.
   */
  it(
    'o v2 entrega exatamente a quota que calculou',
    () => {
      for (const p of MATRIX) {
        const assessment = assess(p);
        const result = generateScheduleV2(assessment, {
          snapshot: p,
          startsOn: STARTS_ON,
          assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
        });
        const { weights } = __testing.needWeights(p, assessment);
        const quota = __testing.quotaFromWeights(weights, result.cares.length);
        expect(countOf(result.cares.map((c) => c.careTypeCode))).toEqual(quota);
      }
    },
    BUDGET,
  );
});
