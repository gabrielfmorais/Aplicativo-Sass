import { DomainRuleSchema, assertProductionRules, localDateFromString } from '../shared/index.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../hair-profile/index.ts';
import {
  CURRENT_SCHEDULE_RULES,
  CURRENT_SCHEDULE_VERSION,
  PLAN_WINDOW_DAYS,
  CARE_TYPE_CODES,
  buildPlan,
  isKnownScheduleVersion,
  scheduleRulesOf,
  type CareTypeCode,
} from './index.ts';

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
  // SPEC-037: presentes porque uma avaliacao nova sempre responde; o motor v1 nao os le.
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
};

const snapshot = (overrides: Partial<HairProfileInput> = {}): HairProfileSnapshot => ({
  ...base,
  ...overrides,
  hairProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-27T10:00:00.000Z',
});

const types = (s: HairProfileSnapshot): CareTypeCode[] =>
  buildPlan(s, STARTS_ON, undefined, 'v1').cares.map((c) => c.careTypeCode);
const dates = (s: HairProfileSnapshot): string[] =>
  buildPlan(s, STARTS_ON, undefined, 'v1').cares.map((c) => c.plannedDate);

describe('schedule engine v1 — golden fixtures (SPEC-004 AC1/AC12, D-67)', () => {
  it('sessions/week come from wash frequency and drive the offsets (§5/§9)', () => {
    expect(dates(snapshot({ washFrequency: 'once_or_less_weekly' }))).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
      '2026-09-22',
    ]);
    expect(dates(snapshot({ washFrequency: 'twice_weekly' }))).toEqual([
      '2026-09-01',
      '2026-09-05',
      '2026-09-08',
      '2026-09-12',
      '2026-09-15',
      '2026-09-19',
      '2026-09-22',
      '2026-09-26',
    ]);
    expect(dates(snapshot({ washFrequency: 'three_to_four_weekly' }))).toEqual([
      '2026-09-01',
      '2026-09-03',
      '2026-09-06',
      '2026-09-08',
      '2026-09-10',
      '2026-09-13',
      '2026-09-15',
      '2026-09-17',
      '2026-09-20',
      '2026-09-22',
      '2026-09-24',
      '2026-09-27',
    ]);
  });

  it('five_or_more_weekly caps at 3 sessions/week and `varies` never escalates (§5/§10)', () => {
    expect(dates(snapshot({ washFrequency: 'five_or_more_weekly' }))).toEqual(
      dates(snapshot({ washFrequency: 'three_to_four_weekly' })),
    );
    expect(dates(snapshot({ washFrequency: 'varies' }))).toEqual(
      dates(snapshot({ washFrequency: 'twice_weekly' })),
    );
  });

  it('every planned date falls inside the 28-day window (§6)', () => {
    for (const washFrequency of ['once_or_less_weekly', 'twice_weekly', 'five_or_more_weekly'] as const) {
      for (const date of dates(snapshot({ washFrequency }))) {
        expect(date >= '2026-09-01' && date < '2026-09-29').toBe(true);
      }
    }
    expect(PLAN_WINDOW_DAYS).toBe(28);
  });

  it('the emphasis opens the alternating cycle (§7)', () => {
    // hydration emphasis
    expect(types(snapshot({ primaryGoal: 'softness_and_hydration' }))).toEqual([
      'hydration',
      'nutrition',
      'hydration',
      'nutrition',
      'hydration',
      'nutrition',
      'hydration',
      'nutrition',
    ]);
    // nutrition emphasis
    expect(types(snapshot({ primaryGoal: 'definition_and_frizz_control' }))[0]).toBe('nutrition');
    expect(types(snapshot({ primaryGoal: 'definition_and_frizz_control' }))[1]).toBe('hydration');
    // balanced opens with hydration too
    expect(types(snapshot())[0]).toBe('hydration');
  });

  it('reconstruction replaces exactly one care, the first on/after day 14 (§8)', () => {
    const s = snapshot({ chemicalTreatments: ['bleaching_or_highlights'], heatUsage: 'almost_daily' });
    const plan = buildPlan(s, STARTS_ON, undefined, 'v1');
    expect(plan.assessment.includeReconstruction).toBe(true);

    const reconstructions = plan.cares.filter((c) => c.careTypeCode === 'reconstruction');
    expect(reconstructions).toHaveLength(1);
    // 2 sessions/week → offsets [0,4,7,11,14,...]; the first on/after day 14 is 2026-09-15.
    expect(reconstructions[0]?.plannedDate).toBe('2026-09-15');
  });

  it('no reconstruction when the assessment did not ask for one', () => {
    expect(types(snapshot())).not.toContain('reconstruction');
  });

  it('is deterministic and reads no clock: same input + version ⇒ same plan (AC1/AC3)', () => {
    const s = snapshot({ washFrequency: 'three_to_four_weekly', primaryGoal: 'softness_and_hydration' });
    expect(buildPlan(s, STARTS_ON, undefined, 'v1')).toEqual(buildPlan(s, STARTS_ON, undefined, 'v1'));
    // startsOn is an input: a different day only shifts the dates.
    expect(buildPlan(s, localDateFromString('2026-09-02'), undefined, 'v1').cares[0]?.plannedDate).toBe(
      '2026-09-02',
    );
  });

  it('stamps both algorithm versions and the profile id as the plan provenance (AC8/§11)', () => {
    const { plan } = buildPlan(snapshot(), STARTS_ON, undefined, 'v1');
    expect(plan).toEqual({
      hairProfileId: '11111111-1111-4111-8111-111111111111',
      startsOn: '2026-09-01',
      assessmentAlgorithmVersion: 'v1',
      scheduleAlgorithmVersion: 'v1',
    });
  });

  it('exposes the schedule rationale next to the assessment one, deduplicated (§11)', () => {
    const { evidenceCodes } = buildPlan(
      snapshot({ primaryGoal: 'softness_and_hydration' }),
      STARTS_ON,
      undefined,
      'v1',
    );
    expect(evidenceCodes).toEqual(['goal_hydration', 'wash_frequency_baseline']);
  });
});

describe('schedule rules governance (ADR-007 A1 / D-26 / D-67)', () => {
  it('every rule matches the governance schema', () => {
    for (const rule of CURRENT_SCHEDULE_RULES) {
      expect(DomainRuleSchema.safeParse(rule).success).toBe(true);
    }
  });

  /**
   * ⚠️ **A autorização do dono para ligar a v2 é de ATIVAÇÃO, não de sign-off** (2026-09-07). As
   * regras da versão corrente continuam `candidate`, e tratar o motor como pronto para produção
   * continua **lançando**. Se algum dia isto passar a não lançar sem um revisor ter assinado, o gate
   * de PUBLIC RELEASE caiu por acidente.
   */
  it('as regras da versão corrente são candidate — PUBLIC RELEASE segue bloqueado (AC12)', () => {
    expect(CURRENT_SCHEDULE_RULES.every((r) => r.validation_status === 'candidate')).toBe(true);
    expect(() => assertProductionRules(CURRENT_SCHEDULE_RULES)).toThrow(/non-validated domain rules/);
  });

  /**
   * ⚠️ **O registro de governança tem de ser o da versão que EXECUTA.**
   *
   * `CURRENT_SCHEDULE_RULES` era `SCHEDULE_RULES_V1` escrito à mão no barril, com o comentário
   * dizendo que eram as regras da versão corrente. Ligar a v2 sem tocar nele faria o registro que o
   * revisor de domínio lê descrever **um motor que ninguém executa** — e nada quebraria. Agora ele é
   * derivado, e este teste é o que garante que continue sendo.
   */
  it('o registro de regras é o da versão corrente, e não uma cópia ao lado', () => {
    expect(CURRENT_SCHEDULE_RULES).toBe(scheduleRulesOf(CURRENT_SCHEDULE_VERSION));
    expect(scheduleRulesOf('v1')).not.toBe(scheduleRulesOf('v2'));
    // E toda versão que o despacho conhece tem registro: uma engine sem regras é uma engine que o
    // revisor não consegue ler.
    for (const v of ['v1', 'v2'] as const) {
      expect(isKnownScheduleVersion(v)).toBe(true);
      expect(scheduleRulesOf(v).length).toBeGreaterThan(0);
    }
  });

  it('a versão corrente é a v2 (ligada por autorização do dono, SPEC-038 OQ2)', () => {
    // Os goldens acima continuam sendo sobre o v1 e por isso nomeiam 'v1' explicitamente, em vez de
    // depender do padrão — foi essa disciplina que permitiu trocar a corrente sem reescrevê-los.
    expect(CURRENT_SCHEDULE_VERSION).toBe('v2');
  });
});

/**
 * SPEC-038 (F36) fatia 1 — ⚠️ **o vocabulário cresceu; o comportamento do v1 não.**
 *
 * `restoration` entrou em `CARE_TYPE_CODES`, e o motor v1 é **imutável** (ADR-001 §2): mudar o que
 * ele produz seria uma versão nova, não uma edição. Sem esta barreira, alguém acrescentaria o quarto
 * tipo ao v1 "porque agora existe" e todo plano histórico passaria a ser reproduzido de um jeito que
 * não foi o jeito como ele nasceu — e a SPEC-017 depende exatamente dessa reprodutibilidade.
 *
 * A barreira é sobre o v1, não sobre o produto: o v2 vai poder emitir `restoration`, e é para isso
 * que ele será uma versão nova.
 */
describe('schedule engine v1 — imutável mesmo com o vocabulário maior (SPEC-038)', () => {
  it('conhece quatro tipos e continua produzindo só três', () => {
    expect(CARE_TYPE_CODES).toContain('restoration');

    const combos: Partial<HairProfileInput>[] = [
      {},
      { washFrequency: 'once_or_less_weekly' },
      { washFrequency: 'five_or_more_weekly' },
      { washFrequency: 'varies' },
      { primaryGoal: 'recover_chemical_or_heat_damage', chemicalTreatments: ['bleaching_or_highlights'] },
      { heatUsage: 'almost_daily', currentConcerns: ['breakage'] },
      // Os três sinais de uma vez: é o perfil em que o v2 emite restauração, e é justamente por
      // isso que ele precisa estar aqui — a barreira só vale se testar o caso que a violaria.
      {
        chemicalTreatments: ['bleaching_or_highlights'],
        heatUsage: 'almost_daily',
        currentConcerns: ['breakage'],
      },
      { hairPattern: 'coily', currentConcerns: ['dryness', 'frizz'] },
      { perceivedPorosity: 'wets_and_dries_fast', routineAvailability: 'minimal' },
      { perceivedPorosity: 'slow_to_wet', routineAvailability: 'generous' },
    ];

    for (const over of combos) {
      const types = new Set(
        buildPlan(snapshot(over), STARTS_ON, undefined, 'v1').cares.map((c) => c.careTypeCode),
      );
      expect([...types].sort()).not.toContain('restoration');
    }
  });

  /**
   * E as duas entradas da SPEC-037 continuam **sem efeito nenhum** no v1 — o que é a razão de elas
   * não aparecerem em "Por que este cronograma?". Se um dia mudarem o plano aqui, esta expectativa
   * quebra antes de a tela mentir.
   */
  it('porosidade e disponibilidade não mexem no plano do v1', () => {
    const plain = buildPlan(snapshot({}), STARTS_ON, undefined, 'v1');
    for (const perceivedPorosity of ['slow_to_wet', 'wets_and_dries_fast', 'unknown'] as const) {
      for (const routineAvailability of ['minimal', 'generous', 'varies'] as const) {
        const other = buildPlan(
          snapshot({ perceivedPorosity, routineAvailability }),
          STARTS_ON,
          undefined,
          'v1',
        );
        expect(other.cares).toEqual(plain.cares);
        expect(other.evidenceCodes).toEqual(plain.evidenceCodes);
      }
    }
  });
});

/**
 * SPEC-046 — **o rascunho diz com que motor ele foi feito** (SPEC-038 OQ4).
 *
 * ⚠️ A tela manda ao servidor a versão que está **neste** rascunho, e não uma constante lida à
 * parte. Escolha e despacho em módulos diferentes já produziram, uma vez, um plano da versão que
 * ninguém tinha escolhido — a versão sair de dentro da mesma chamada que produziu os cuidados é o
 * que torna aquilo impossível de repetir.
 */
describe('a versão do motor viaja com o rascunho (SPEC-046)', () => {
  const s = snapshot();

  it('o rascunho nomeia a versão que ele mesmo usou', () => {
    expect(buildPlan(s, STARTS_ON, undefined, 'v1').scheduleVersion).toBe('v1');
    expect(buildPlan(s, STARTS_ON, undefined, 'v2').scheduleVersion).toBe('v2');
  });

  it('sem versão explícita, é a corrente — e o plano gravado registra a mesma', () => {
    const draft = buildPlan(s, STARTS_ON);
    expect(draft.scheduleVersion).toBe(CURRENT_SCHEDULE_VERSION);
    // ⚠️ O que a tela manda e o que fica no banco têm de ser a mesma coisa: é o par que o
    // servidor valida, e o par que impede prever um cronograma e receber outro.
    expect(draft.plan.scheduleAlgorithmVersion).toBe(draft.scheduleVersion);
  });

  it('a versão do rascunho é sempre uma versão que o despacho conhece', () => {
    for (const v of ['v1', 'v2'] as const) {
      expect(isKnownScheduleVersion(buildPlan(s, STARTS_ON, undefined, v).scheduleVersion)).toBe(true);
    }
  });

  /**
   * ⚠️ **A OQ2 foi respondida pelo dono em 2026-09-07: a corrente é a v2.**
   *
   * O contrato acima é o que torna a troca segura — o rascunho nomeia a versão que ele mesmo usou, e
   * o servidor honra aquela. Um app antigo que não manda versão continua recebendo a corrente **do
   * servidor**, que é o comportamento de sempre.
   */
  it('a versão corrente é a v2 (OQ2 respondida pelo dono)', () => {
    expect(CURRENT_SCHEDULE_VERSION).toBe('v2');
    expect(buildPlan(s, STARTS_ON).plan.scheduleAlgorithmVersion).toBe('v2');
  });
});
