import { DomainRuleSchema, assertProductionRules, localDateFromString } from '../shared/index.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../hair-profile/index.ts';
import {
  CURRENT_SCHEDULE_RULES,
  CURRENT_SCHEDULE_VERSION,
  PLAN_WINDOW_DAYS,
  buildPlan,
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
  buildPlan(s, STARTS_ON).cares.map((c) => c.careTypeCode);
const dates = (s: HairProfileSnapshot): string[] => buildPlan(s, STARTS_ON).cares.map((c) => c.plannedDate);

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
    const plan = buildPlan(s, STARTS_ON);
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
    expect(buildPlan(s, STARTS_ON)).toEqual(buildPlan(s, STARTS_ON));
    // startsOn is an input: a different day only shifts the dates.
    expect(buildPlan(s, localDateFromString('2026-09-02')).cares[0]?.plannedDate).toBe('2026-09-02');
  });

  it('stamps both algorithm versions and the profile id as the plan provenance (AC8/§11)', () => {
    const { plan } = buildPlan(snapshot(), STARTS_ON);
    expect(plan).toEqual({
      hairProfileId: '11111111-1111-4111-8111-111111111111',
      startsOn: '2026-09-01',
      assessmentAlgorithmVersion: 'v1',
      scheduleAlgorithmVersion: 'v1',
    });
  });

  it('exposes the schedule rationale next to the assessment one, deduplicated (§11)', () => {
    const { evidenceCodes } = buildPlan(snapshot({ primaryGoal: 'softness_and_hydration' }), STARTS_ON);
    expect(evidenceCodes).toEqual(['goal_hydration', 'wash_frequency_baseline']);
  });
});

describe('schedule rules governance (ADR-007 A1 / D-26 / D-67)', () => {
  it('every rule matches the governance schema', () => {
    for (const rule of CURRENT_SCHEDULE_RULES) {
      expect(DomainRuleSchema.safeParse(rule).success).toBe(true);
    }
  });

  it('V1 rules are candidate — PUBLIC RELEASE stays gated on validated (AC12)', () => {
    expect(CURRENT_SCHEDULE_RULES.every((r) => r.validation_status === 'candidate')).toBe(true);
    expect(() => assertProductionRules(CURRENT_SCHEDULE_RULES)).toThrow(/non-validated domain rules/);
  });

  it('exposes the version stamped on every plan', () => {
    expect(CURRENT_SCHEDULE_VERSION).toBe('v1');
  });
});
