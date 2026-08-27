import type { DomainRule } from '../../../shared/domain-rule.ts';

/**
 * Schedule rules V1 — declarative register (ADR-007 Amendment A1, DECISION-REGISTER D-67).
 *
 * Source of truth for the wording: docs/domain-rules/SPEC-004-domain-rules-worksheet.md.
 * `candidate` = human product decision, cosmetic heuristics. Implementable and usable in
 * development / internal beta; PUBLIC RELEASE requires a domain reviewer sign-off (`validated`).
 *
 * This directory is immutable once released: changing behaviour means a new version (v2).
 */
export const SCHEDULE_RULES_V1: readonly DomainRule[] = [
  {
    rule_id: 'schedule.sessions_per_week',
    version: 1,
    description:
      'Care sessions per week are derived from the observed wash frequency; the plan never recommends washing.',
    inputs: ['wash_frequency'],
    output: 'sessions_per_week',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §5',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.plan_window_28d',
    version: 1,
    description: 'A generated plan covers a fixed window of 28 days (four weeks).',
    inputs: ['starts_on'],
    output: 'plan_window_days',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §6',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.base_cycle',
    version: 1,
    description:
      'Cares alternate hydration/nutrition; the emphasis decides which of the two opens the cycle.',
    inputs: ['emphasis'],
    output: 'care_type_sequence',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §7',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.reconstruction_placement',
    version: 1,
    description:
      'When reconstruction applies, exactly one care in the window is replaced: the first one on or after day 14.',
    inputs: ['include_reconstruction', 'care_type_sequence'],
    output: 'care_type_sequence',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §8',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.date_offsets',
    version: 1,
    description:
      'Day offsets from starts_on are a deterministic table per sessions/week, spread over the 28-day window.',
    inputs: ['sessions_per_week', 'starts_on'],
    output: 'planned_dates',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §9',
    validation_status: 'candidate',
  },
];
