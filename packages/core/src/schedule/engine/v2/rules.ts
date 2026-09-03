import type { DomainRule } from '../../../shared/domain-rule.ts';

/**
 * Schedule rules V2 — registro declarativo (ADR-007 A1, D-26), para o motor por necessidade (F36).
 *
 * ⚠️ **Toda regra aqui é hipótese de engenharia sobre FREQUÊNCIA, e frequência é conteúdo capilar.**
 * "De quanto em quanto tempo este cabelo precisa de reconstrução" é exatamente a pergunta que a D-26
 * reserva a um revisor de domínio. O que a engenharia fez foi o **mecanismo**: contar sinais que já
 * eram coletados e aprovados (D-62), transformar contagem em peso, e distribuir vagas. Nenhum número
 * daqui é fato clínico, e nenhum tem fonte além da hipótese.
 *
 * `candidate` por instrução explícita do dono (sessão de 2026-09-03) — o padrão do CLAUDE.md §2 para
 * regra inventada por agente é `draft`. A diferença não afrouxa nada: **só `validated` vai a PUBLIC
 * RELEASE**, e `assertProductionRules` lança para as duas. A procedência fica escrita para o revisor
 * saber o que está lendo.
 */
const HYPOTHESIS = 'hipótese de engenharia — requer revisão especializada (D-26/D-70, OQ-REL)';

export const SCHEDULE_RULES_V2: readonly DomainRule[] = [
  {
    rule_id: 'schedule.sessions_per_week',
    version: 2,
    description:
      'Care sessions per week are derived from the observed wash frequency; the plan never recommends washing. Unchanged from v1.',
    inputs: ['wash_frequency'],
    output: 'sessions_per_week',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §5',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.plan_window_28d',
    version: 2,
    description: 'A generated plan covers a fixed window of 28 days (four weeks). Unchanged from v1.',
    inputs: ['starts_on'],
    output: 'plan_window_days',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §6',
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.need_weight_conditioning',
    version: 2,
    description:
      'Hydration and nutrition each start from an equal conditioning weight; the assessment emphasis adds one to the leaning axis. Balanced emphasis adds to neither.',
    inputs: ['emphasis'],
    output: 'need_weight_by_care_type',
    rationale_source: HYPOTHESIS,
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.need_weight_reconstruction',
    version: 2,
    description:
      'Reconstruction weight counts the damage signals present (chemical treatments, frequent heat, damage goal or breakage concern): fewer than two signals is weight zero, two is one, three or more is two.',
    inputs: ['chemical_treatments', 'heat_usage', 'primary_goal', 'current_concerns'],
    output: 'need_weight_by_care_type',
    rationale_source: HYPOTHESIS,
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.need_weight_restoration',
    version: 2,
    description:
      'Restoration weight is one only when every damage signal is present at once; otherwise zero. It is the most conservative branch of the engine and never repeats within a window.',
    inputs: ['chemical_treatments', 'heat_usage', 'primary_goal', 'current_concerns'],
    output: 'need_weight_by_care_type',
    rationale_source: HYPOTHESIS,
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.quota_from_need',
    version: 2,
    description:
      'The window slots are distributed across care types in proportion to their need weights, using largest-remainder so the total always equals the number of slots.',
    inputs: ['need_weight_by_care_type', 'sessions_per_week'],
    output: 'care_quota_by_type',
    rationale_source: HYPOTHESIS,
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.strong_care_spacing',
    version: 2,
    description:
      'Strong cares (reconstruction, restoration) never open the cycle and are never scheduled next to another strong care; they are placed on the most separated remaining slots.',
    inputs: ['care_quota_by_type', 'sessions_per_week'],
    output: 'care_type_sequence',
    rationale_source: HYPOTHESIS,
    validation_status: 'candidate',
  },
  {
    rule_id: 'schedule.date_offsets',
    version: 2,
    description:
      'Day offsets from starts_on are a deterministic table per sessions/week, spread over the 28-day window. Unchanged from v1.',
    inputs: ['sessions_per_week', 'starts_on'],
    output: 'planned_dates',
    rationale_source: 'D-67 (human product decision) — domain-rules worksheet §9',
    validation_status: 'candidate',
  },
];
