import { DomainRuleSchema, assertProductionRules } from '../shared/index.ts';
import { ASSESSMENT_GOLDEN } from './__fixtures__/assessment-v1.golden.ts';
import { CURRENT_ASSESSMENT_RULES, CURRENT_ASSESSMENT_VERSION, assess } from './index.ts';

const snapshot = (profile: (typeof ASSESSMENT_GOLDEN)[number]['profile']) => ({
  ...profile,
  hairProfileId: '11111111-1111-4111-8111-111111111111',
  createdAt: '2026-08-27T10:00:00.000Z',
});

describe('assessment engine v1 — golden fixtures (SPEC-004 AC1/AC12, D-67)', () => {
  it.each(ASSESSMENT_GOLDEN.map((g) => [g.name, g] as const))('%s', (_name, golden) => {
    expect(assess(snapshot(golden.profile))).toEqual(golden.expected);
  });

  it('is deterministic: the same input always produces the same output (AC1)', () => {
    for (const golden of ASSESSMENT_GOLDEN) {
      const input = snapshot(golden.profile);
      expect(assess(input)).toEqual(assess(input));
    }
  });

  it('never emits a score, confidence or severity (AC11 / D-66)', () => {
    for (const golden of ASSESSMENT_GOLDEN) {
      expect(Object.keys(assess(snapshot(golden.profile))).sort()).toEqual([
        'emphasis',
        'evidenceCodes',
        'includeReconstruction',
      ]);
    }
  });

  it('emits no duplicate evidence code', () => {
    for (const golden of ASSESSMENT_GOLDEN) {
      const codes = assess(snapshot(golden.profile)).evidenceCodes;
      expect(new Set(codes).size).toBe(codes.length);
    }
  });
});

describe('assessment rules governance (ADR-007 A1 / D-26 / D-67)', () => {
  it('every rule matches the governance schema', () => {
    for (const rule of CURRENT_ASSESSMENT_RULES) {
      expect(DomainRuleSchema.safeParse(rule).success).toBe(true);
    }
  });

  it('V1 rules are candidate — implementable now, PUBLIC RELEASE still gated (AC12)', () => {
    expect(CURRENT_ASSESSMENT_RULES.map((r) => r.validation_status)).toEqual(
      CURRENT_ASSESSMENT_RULES.map(() => 'candidate'),
    );
    // A public-release build referencing non-validated rules must fail loudly.
    expect(() => assertProductionRules(CURRENT_ASSESSMENT_RULES)).toThrow(/non-validated domain rules/);
  });

  it('exposes the version stamped on every plan', () => {
    expect(CURRENT_ASSESSMENT_VERSION).toBe('v1');
  });
});
