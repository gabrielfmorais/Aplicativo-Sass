/**
 * SPEC-004 §6/§8 — what the assessment infers from a HairProfileSnapshot.
 *
 * Only inferences that enable a Schedule decision live here: observed profile values are read
 * straight from the snapshot by the Schedule engine and are never repackaged (§7b).
 * No score, no confidence, no percentage — false precision is forbidden (D-66).
 *
 * Product wording is "avaliação capilar" (hair assessment). This is a cosmetic product heuristic,
 * never a medical or dermatological diagnosis (D-26 / domain-rules worksheet §12).
 */

/** Which conditioning axis the schedule should lean on. */
export const EMPHASES = ['hydration', 'nutrition', 'balanced'] as const;
export type Emphasis = (typeof EMPHASES)[number];

/**
 * Codes for the rule branches that actually fired (worksheet §11). The core emits codes only;
 * pt-BR copy belongs to the UI, and content to SPEC-007.
 */
export const EVIDENCE_CODES = [
  'goal_hydration',
  'goal_frizz_definition',
  'goal_breakage_strength',
  'goal_damage_recovery',
  'concern_dryness',
  'concern_tangling',
  'concern_dullness',
  'concern_breakage',
  'concern_frizz',
  'chemical_exposure',
  'frequent_heat',
  'textured_hair_moisture_support',
  'wash_frequency_baseline',
  'balanced_default',
] as const;
export type EvidenceCode = (typeof EVIDENCE_CODES)[number];

export type AssessmentOutput = {
  readonly emphasis: Emphasis;
  readonly includeReconstruction: boolean;
  readonly evidenceCodes: readonly EvidenceCode[];
};
