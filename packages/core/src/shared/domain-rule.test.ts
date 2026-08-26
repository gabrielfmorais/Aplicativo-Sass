import {
  DomainRuleSchema,
  assertProductionRules,
  isProductionReadyRule,
  type DomainRule,
} from './domain-rule.js';

const base: DomainRule = {
  rule_id: 'diagnostic.example.placeholder',
  version: 1,
  description: 'Placeholder rule used only to test the governance schema.',
  inputs: ['porosity'],
  output: 'needs.hydration',
  rationale_source: 'engineering hypothesis — requires domain review',
  validation_status: 'draft',
};

describe('DomainRule governance schema (D-26)', () => {
  it('accepts a well-formed rule', () => {
    expect(DomainRuleSchema.safeParse(base).success).toBe(true);
  });
  it('rejects invalid validation_status', () => {
    expect(DomainRuleSchema.safeParse({ ...base, validation_status: 'approved' }).success).toBe(false);
  });
  it('rejects unknown keys and bad ids', () => {
    expect(DomainRuleSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(DomainRuleSchema.safeParse({ ...base, rule_id: 'Bad Id' }).success).toBe(false);
  });
  it('only validated rules are production-ready', () => {
    expect(isProductionReadyRule(base)).toBe(false);
    expect(isProductionReadyRule({ ...base, validation_status: 'validated' })).toBe(true);
    expect(() => assertProductionRules([base])).toThrow(/diagnostic\.example\.placeholder@1/);
    expect(() => assertProductionRules([{ ...base, validation_status: 'validated' }])).not.toThrow();
  });
});
