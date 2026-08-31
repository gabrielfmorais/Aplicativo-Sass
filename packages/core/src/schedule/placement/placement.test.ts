import { localDateFromString, type Weekday } from '../../shared/index.ts';
import type { HairProfileInput, HairProfileSnapshot } from '../../hair-profile/index.ts';
import { PLAN_WINDOW_DAYS, applyPreferredWeekdays, buildPlan, type CareTypeCode } from '../index.ts';

/** 2026-09-01 is a Tuesday, so weekday 2 is the engine's own starting day. */
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
};

const snapshot = (overrides: Partial<HairProfileInput> = {}): HairProfileSnapshot => ({
  ...base,
  ...overrides,
  hairProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-27T10:00:00.000Z',
});

const weekdayOfIso = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();
const customized = (s: HairProfileSnapshot, preferredWeekdays: readonly Weekday[]) =>
  buildPlan(s, STARTS_ON, { preferredWeekdays });

describe('SPEC-015 — preferred-weekday placement (premium plan_customization)', () => {
  describe('AC4 — the domain is untouched: only dates move', () => {
    const cases: readonly HairProfileInput['washFrequency'][] = [
      'once_or_less_weekly',
      'twice_weekly',
      'three_to_four_weekly',
      'five_or_more_weekly',
      'varies',
    ];
    const preferences: readonly (readonly Weekday[])[] = [[6], [1, 4], [0, 3, 5], [2], [1, 2, 3, 4, 5]];

    it.each(cases)('keeps care types, count and order for washFrequency=%s', (washFrequency) => {
      const s = snapshot({ washFrequency });
      const engine = buildPlan(s, STARTS_ON);
      for (const preferredWeekdays of preferences) {
        const custom = customized(s, preferredWeekdays);
        expect(custom.cares.map((c) => c.careTypeCode)).toEqual(
          engine.cares.map((c: { careTypeCode: CareTypeCode }) => c.careTypeCode),
        );
        expect(custom.assessment).toEqual(engine.assessment);
        expect(custom.evidenceCodes).toEqual(engine.evidenceCodes);
        expect(custom.plan).toEqual(engine.plan);
      }
    });

    it.each(cases)('keeps dates distinct, ascending and inside the window for %s', (washFrequency) => {
      const s = snapshot({ washFrequency });
      const last = localDateFromString('2026-09-28'); // startsOn + PLAN_WINDOW_DAYS - 1
      for (const preferredWeekdays of preferences) {
        const dates = customized(s, preferredWeekdays).cares.map((c) => c.plannedDate);
        expect(new Set(dates).size).toBe(dates.length);
        expect([...dates].sort()).toEqual(dates);
        expect(dates.every((d) => d >= STARTS_ON && d <= last)).toBe(true);
      }
    });
  });

  it('AC1 — a satisfiable routine puts every care on a preferred weekday', () => {
    // Two sessions/week from a Tuesday start: the engine uses Tue and Sat. She wants Mon and Thu.
    // The first care cannot reach the Monday before the start, so it takes the Thursday after.
    const result = customized(snapshot({ washFrequency: 'twice_weekly' }), [1, 4]);
    expect(result.weekdayPlacement).toEqual({ fullyHonoured: true });
    expect(result.cares.map((c) => c.plannedDate)).toEqual([
      '2026-09-03',
      '2026-09-07',
      '2026-09-10',
      '2026-09-14',
      '2026-09-17',
      '2026-09-21',
      '2026-09-24',
      '2026-09-28',
    ]);
    expect(result.cares.every((c) => [1, 4].includes(weekdayOfIso(c.plannedDate)))).toBe(true);
  });

  it('never moves a care before the plan starts', () => {
    // Monday is one day *before* the Tuesday start, so the first care cannot take it.
    const result = customized(snapshot({ washFrequency: 'once_or_less_weekly' }), [1]);
    expect(result.cares[0]?.plannedDate).toBe('2026-09-01');
    expect(result.weekdayPlacement).toEqual({ fullyHonoured: false });
    expect(result.cares.slice(1).every((c) => weekdayOfIso(c.plannedDate) === 1)).toBe(true);
  });

  it('EC1 — an unsatisfiable routine degrades honestly instead of thinning the plan', () => {
    // Three cares a week cannot all fall on one weekday. Nothing is dropped; the rest keep their
    // engine day and the caller is told the preference was only partly honoured.
    const engine = buildPlan(snapshot({ washFrequency: 'three_to_four_weekly' }), STARTS_ON);
    const result = customized(snapshot({ washFrequency: 'three_to_four_weekly' }), [3]);
    expect(result.cares).toHaveLength(engine.cares.length);
    expect(result.weekdayPlacement).toEqual({ fullyHonoured: false });
    expect(result.cares.filter((c) => weekdayOfIso(c.plannedDate) === 3).length).toBeGreaterThan(0);
  });

  it('a preference that says nothing leaves the engine plan exactly as it is', () => {
    const s = snapshot();
    const engine = buildPlan(s, STARTS_ON);
    for (const preferredWeekdays of [[], [0, 1, 2, 3, 4, 5, 6]] as const) {
      const result = customized(s, [...preferredWeekdays]);
      expect(result.cares).toEqual(engine.cares);
      expect(result.weekdayPlacement).toEqual({ fullyHonoured: true });
    }
  });

  it('is deterministic and ignores the order and duplicates of the chosen weekdays', () => {
    const s = snapshot();
    expect(customized(s, [4, 1, 4, 1]).cares).toEqual(customized(s, [1, 4]).cares);
  });

  it('no preference at all keeps `weekdayPlacement` null — free plans are unmarked', () => {
    expect(buildPlan(snapshot(), STARTS_ON).weekdayPlacement).toBeNull();
  });

  it('applyPreferredWeekdays is pure — it does not mutate the cares it is given', () => {
    const cares = buildPlan(snapshot(), STARTS_ON).cares;
    const before = JSON.stringify(cares);
    applyPreferredWeekdays(cares, STARTS_ON, PLAN_WINDOW_DAYS, { preferredWeekdays: [0, 6] });
    expect(JSON.stringify(cares)).toBe(before);
  });
});
