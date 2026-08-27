import { z } from 'zod';

/**
 * Governance schema for hair-care domain rules (ADR-007 Amendment A1, DECISION-REGISTER D-26).
 *
 * Engineering designs the engine mechanism; it does NOT invent production rules.
 * Every rule used by an engine version must be described by this schema.
 * `candidate` (ADR-007 A1, clarified by D-67) = human product decision, implementable and usable in
 * development / internal beta. Only `validated` rules may be part of a PUBLIC RELEASE engine version.
 */
export const DomainRuleValidationStatus = z.enum([
  'draft',
  'awaiting_domain_review',
  'candidate',
  'validated',
  'deprecated',
]);
export type DomainRuleValidationStatus = z.infer<typeof DomainRuleValidationStatus>;

export const DomainRuleSchema = z
  .object({
    rule_id: z
      .string()
      .regex(/^[a-z]+(?:\.[a-z0-9_]+)+$/, 'rule_id must be dotted lowercase, e.g. diagnostic.porosity.high'),
    version: z.number().int().positive(),
    description: z.string().min(10),
    inputs: z.array(z.string().min(1)).min(1),
    output: z.string().min(1),
    /** Where the rule comes from. Agent-authored rules MUST state "engineering hypothesis — requires domain review". */
    rationale_source: z.string().min(10),
    validation_status: DomainRuleValidationStatus,
  })
  .strict();

export type DomainRule = z.infer<typeof DomainRuleSchema>;

export const isProductionReadyRule = (rule: DomainRule): boolean => rule.validation_status === 'validated';

/**
 * Asserts that a set of rules can back a production engine version.
 * Throws with the offending rule ids so a build/test fails loudly.
 */
export const assertProductionRules = (rules: ReadonlyArray<DomainRule>): void => {
  const offending = rules.filter((r) => !isProductionReadyRule(r)).map((r) => `${r.rule_id}@${r.version}`);
  if (offending.length > 0) {
    throw new Error(`Production engine references non-validated domain rules: ${offending.join(', ')}`);
  }
};
