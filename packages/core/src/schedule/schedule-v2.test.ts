import { DomainRuleSchema, assertProductionRules, localDateFromString } from '../shared/index.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../hair-profile/index.ts';
import { assess, CURRENT_ASSESSMENT_VERSION } from '../diagnostic/index.ts';
import { CARE_TYPE_CODES, type CareTypeCode } from './index.ts';
import { SCHEDULE_ALGORITHM_VERSION_V2, generateScheduleV2 } from './engine/v2/generate-schedule.ts';
import { SCHEDULE_RULES_V2 } from './engine/v2/rules.ts';

const STARTS_ON = localDateFromString('2026-09-01');

const base: HairProfileInput = {
  hairPattern: 'straight',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['no_major_concern'],
  primaryGoal: 'maintain_healthy_hair',
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
};

const snapshot = (over: Partial<HairProfileInput> = {}): HairProfileSnapshot => ({
  ...base,
  ...over,
  hairProfileId: 'hp-v2',
  createdAt: '2026-09-01T00:00:00.000Z',
});

const plan = (over: Partial<HairProfileInput> = {}) => {
  const profile = snapshot(over);
  return generateScheduleV2(assess(profile), {
    snapshot: profile,
    startsOn: STARTS_ON,
    assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
  });
};

const countOf = (over: Partial<HairProfileInput> = {}): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const care of plan(over).cares) {
    counts[care.careTypeCode] = (counts[care.careTypeCode] ?? 0) + 1;
  }
  return counts;
};

/** Todos os três sinais de dano de uma vez: química + calor alto + quebra. */
const ALL_DAMAGE: Partial<HairProfileInput> = {
  chemicalTreatments: ['bleaching_or_highlights'],
  heatUsage: 'almost_daily',
  currentConcerns: ['breakage'],
};

describe('schedule engine v2 — a frequência depende do perfil (SPEC-038 FR8)', () => {
  /**
   * O ponto inteiro do F36. No v1 estes dois perfis recebem a **mesma** proporção de tipos; aqui não.
   */
  it('perfil sem sinal de dano não recebe cuidado forte nenhum', () => {
    const counts = countOf();
    expect(counts.reconstruction ?? 0).toBe(0);
    expect(counts.restoration ?? 0).toBe(0);
    expect((counts.hydration ?? 0) + (counts.nutrition ?? 0)).toBe(8);
  });

  it('dois sinais trazem reconstrução; três trazem mais reconstrução e a restauração', () => {
    const two = countOf({ chemicalTreatments: ['coloring'], heatUsage: 'almost_daily' });
    expect(two.reconstruction ?? 0).toBeGreaterThan(0);
    expect(two.restoration ?? 0).toBe(0);

    const three = countOf(ALL_DAMAGE);
    expect(three.restoration ?? 0).toBe(1);
    expect(three.reconstruction ?? 0).toBeGreaterThanOrEqual(two.reconstruction ?? 0);
  });

  /** BR2, herdada do v1: sem sinal, nada escala. E o total de cuidados nunca muda por causa disso. */
  it('o ciclo tem sempre o número de vagas da cadência, qualquer que seja a necessidade', () => {
    for (const washFrequency of ['once_or_less_weekly', 'twice_weekly', 'three_to_four_weekly'] as const) {
      const slots = plan({ washFrequency }).cares.length;
      expect(plan({ washFrequency, ...ALL_DAMAGE }).cares.length).toBe(slots);
    }
  });

  /**
   * ⚠️ **O defeito que os testes não pegaram e olhar o plano pegou.**
   *
   * A primeira versão calculava a quota de condicionamento e depois a ignorava: as vagas leves
   * alternavam hidratação/nutrição sempre, então dois perfis com objetivos opostos recebiam
   * exatamente o mesmo ciclo. Tudo passava — as asserções olhavam cuidado forte, e o defeito estava
   * no leve. Esta é a barreira que faltava.
   */
  it('a ênfase muda a PROPORÇÃO entre hidratação e nutrição, não só a ordem', () => {
    const neutral = countOf();
    const towardsHydration = countOf({ primaryGoal: 'softness_and_hydration' });
    const towardsNutrition = countOf({ primaryGoal: 'definition_and_frizz_control' });

    expect(towardsHydration.hydration ?? 0).toBeGreaterThan(neutral.hydration ?? 0);
    expect(towardsNutrition.nutrition ?? 0).toBeGreaterThan(neutral.nutrition ?? 0);
    // E o ciclo continua fechando: mais de um lado é menos do outro, nunca uma vaga a mais.
    for (const counts of [neutral, towardsHydration, towardsNutrition]) {
      expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(8);
    }
  });
  it('as datas são as do ciclo de 28 dias e saem de startsOn, sem relógio', () => {
    const dates = plan().cares.map((c) => String(c.plannedDate));
    expect(dates[0]).toBe('2026-09-01');
    expect(dates.at(-1)).toBe('2026-09-26');
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('é determinístico: a mesma entrada dá exatamente o mesmo plano', () => {
    expect(plan(ALL_DAMAGE).cares).toEqual(plan(ALL_DAMAGE).cares);
  });
});

describe('schedule engine v2 — o cuidado forte tem lugar (FR9)', () => {
  it('nunca abre o ciclo e nunca fica colado em outro forte', () => {
    const strong = new Set<CareTypeCode>(['reconstruction', 'restoration']);
    for (const washFrequency of ['once_or_less_weekly', 'twice_weekly', 'three_to_four_weekly'] as const) {
      const types = plan({ washFrequency, ...ALL_DAMAGE }).cares.map((c) => c.careTypeCode);
      expect(strong.has(types[0] as CareTypeCode)).toBe(false);
      for (let i = 1; i < types.length; i += 1) {
        const pair = [types[i - 1], types[i]] as CareTypeCode[];
        expect(pair.every((t) => strong.has(t))).toBe(false);
      }
    }
  });

  /** EC3 — com quatro vagas e necessidade alta, o forte não pode tomar o ciclo inteiro. */
  it('num ciclo curto ainda sobra condicionamento', () => {
    const counts = countOf({ washFrequency: 'once_or_less_weekly', ...ALL_DAMAGE });
    expect((counts.hydration ?? 0) + (counts.nutrition ?? 0)).toBeGreaterThan(0);
  });
});

/**
 * ⚠️ **A barreira do NG1/NG2 — e é a mais importante deste arquivo.**
 *
 * O dono vetou explicitamente cruzar `routine_availability` com a duração do cuidado ("este cuidado
 * cabe no seu tempo") e a engenharia recusou traduzir `perceived_porosity` em frequência: as duas
 * são alegações capilares que precisam de revisor (D-26).
 *
 * Um veto que existe só em prosa é um veto que a próxima sessão atravessa sem perceber. Aqui ele é
 * executável: se alguém ligar qualquer um dos dois fios ao motor, o plano deixa de ser invariante e
 * este teste cai — **antes** de a tela afirmar qualquer coisa.
 */
describe('schedule engine v2 — o que o motor NÃO lê (SPEC-038 NG1/NG2)', () => {
  it('o plano é invariante à disponibilidade de tempo', () => {
    const reference = plan().cares;
    for (const routineAvailability of ['minimal', 'moderate', 'generous', 'varies'] as const) {
      expect(plan({ routineAvailability }).cares).toEqual(reference);
    }
  });

  it('o plano é invariante à porosidade percebida', () => {
    const reference = plan().cares;
    for (const perceivedPorosity of [
      'slow_to_wet',
      'absorbs_normally',
      'wets_and_dries_fast',
      'unknown',
    ] as const) {
      expect(plan({ perceivedPorosity }).cares).toEqual(reference);
    }
  });

  /** E uma avaliação anterior à SPEC-037 (`null` nas duas) produz o mesmo plano (EC4). */
  it('uma avaliação anterior à pergunta gera o mesmo plano', () => {
    const old: HairProfileSnapshot = {
      ...snapshot(),
      perceivedPorosity: null,
      routineAvailability: null,
    };
    const fromOld = generateScheduleV2(assess(old), {
      snapshot: old,
      startsOn: STARTS_ON,
      assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
    });
    expect(fromOld.cares).toEqual(plan().cares);
  });
});

describe('schedule engine v2 — evidência só do que disparou (FR10)', () => {
  it('um perfil sem dano não recebe evidência de dano', () => {
    expect(plan().evidenceCodes).toEqual(['wash_frequency_baseline']);
  });

  it('com dano, a evidência nomeia os sinais que existem — e só eles', () => {
    const codes = plan(ALL_DAMAGE).evidenceCodes;
    expect(codes).toContain('chemical_exposure');
    expect(codes).toContain('frequent_heat');
    expect(codes).toContain('concern_breakage');

    const noHeat = plan({ chemicalTreatments: ['coloring'], currentConcerns: ['breakage'] }).evidenceCodes;
    expect(noHeat).not.toContain('frequent_heat');
  });
});

describe('schedule rules governance v2 (ADR-007 A1 / D-26)', () => {
  it('toda regra do v2 cabe no schema de governança', () => {
    for (const rule of SCHEDULE_RULES_V2) {
      expect(DomainRuleSchema.safeParse(rule).success).toBe(true);
    }
  });

  /**
   * ⚠️ **O gate de release, executável.** Enquanto as regras forem `candidate`, uma tentativa de
   * tratar o v2 como pronto para produção **lança**. É a mesma barreira do v1 (AC12).
   */
  it('as regras do v2 são candidate — PUBLIC RELEASE segue bloqueado', () => {
    expect(SCHEDULE_RULES_V2.every((r) => r.validation_status === 'candidate')).toBe(true);
    expect(() => assertProductionRules(SCHEDULE_RULES_V2)).toThrow(/non-validated domain rules/);
  });

  /** Toda regra inventada aqui tem de dizer que é hipótese: é o que o revisor procura primeiro. */
  it('as regras novas do v2 se declaram hipótese de engenharia', () => {
    const invented = SCHEDULE_RULES_V2.filter((r) => !r.description.endsWith('Unchanged from v1.'));
    expect(invented.length).toBeGreaterThan(0);
    for (const rule of invented) {
      expect(rule.rationale_source).toMatch(/hipótese de engenharia/);
    }
  });

  it('carimba a sua própria versão no plano', () => {
    expect(SCHEDULE_ALGORITHM_VERSION_V2).toBe('v2');
    expect(plan().plan.scheduleAlgorithmVersion).toBe('v2');
  });

  /** O v2 conhece os quatro tipos; o v1 continua com três (barreira em schedule.test.ts). */
  it('o vocabulário do v2 é o do core', () => {
    expect(CARE_TYPE_CODES).toContain('restoration');
  });
});
