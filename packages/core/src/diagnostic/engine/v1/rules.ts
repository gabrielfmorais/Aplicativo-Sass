import type { DomainRule } from '../../../shared/domain-rule.ts';

/**
 * Assessment rules V1 — declarative register (ADR-007 Amendment A1, DECISION-REGISTER D-67).
 *
 * Source of truth for the wording: docs/domain-rules/SPEC-004-domain-rules-worksheet.md.
 * `candidate` = human product decision, cosmetic heuristics. Implementable and usable in
 * development / internal beta; PUBLIC RELEASE requires a domain reviewer sign-off (`validated`).
 *
 * This directory is immutable once released: changing behaviour means a new version (v2).
 */
export const ASSESSMENT_RULES_V1: readonly DomainRule[] = [
  {
    rule_id: 'assess.emphasis_by_goal',
    version: 1,
    description: "The user's primary goal decides the conditioning emphasis when it is not 'maintain'.",
    inputs: ['primary_goal'],
    output: 'emphasis',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §3 priority 1',
    validation_status: 'candidate',
  },
  {
    rule_id: 'assess.emphasis_by_concern',
    version: 1,
    description: 'Current concerns decide the emphasis when the goal did not (dryness family, then frizz).',
    inputs: ['current_concerns'],
    output: 'emphasis',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §3 priority 2',
    validation_status: 'candidate',
  },
  {
    rule_id: 'assess.emphasis_by_pattern',
    version: 1,
    description: 'Textured patterns lean to hydration when nothing else decided; otherwise balanced.',
    inputs: ['hair_pattern'],
    output: 'emphasis',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §3 priority 3',
    validation_status: 'candidate',
  },
  {
    rule_id: 'assess.include_reconstruction_2of3',
    version: 1,
    description:
      'Reconstruction is included only when at least two of chemical, high heat and damage signals are present (conservative).',
    inputs: ['chemical_treatments', 'heat_usage', 'current_concerns', 'primary_goal'],
    output: 'include_reconstruction',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §4',
    validation_status: 'candidate',
  },
  {
    rule_id: 'assess.unknown_no_escalation',
    version: 1,
    description: 'Unknown or varying answers never escalate care intensity; they fall back to neutral.',
    inputs: ['hair_pattern', 'strand_thickness', 'scalp_tendency', 'current_concerns'],
    output: 'emphasis',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §10',
    validation_status: 'candidate',
  },
];
