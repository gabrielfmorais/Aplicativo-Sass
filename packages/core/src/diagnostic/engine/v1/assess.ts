import type { HairProfileSnapshot } from '../../../hair-profile/index.ts';
import type { AssessmentOutput, Emphasis, EvidenceCode } from '../../domain/assessment.ts';

/**
 * Assessment engine v1 — pure and deterministic (ADR-007, D-06): no clock, no network, no random.
 * Rules are the V1 CANDIDATE product heuristics registered in `./rules.ts` (D-67). Cosmetic only.
 */
export const ASSESSMENT_ALGORITHM_VERSION_V1 = 'v1' as const;

/** Concerns that point at the hydration axis, in worksheet §3 P2 order. */
const HYDRATION_CONCERNS = ['dryness', 'tangling', 'dullness', 'breakage'] as const;
const CONCERN_EVIDENCE = {
  dryness: 'concern_dryness',
  tangling: 'concern_tangling',
  dullness: 'concern_dullness',
  breakage: 'concern_breakage',
} as const satisfies Record<(typeof HYDRATION_CONCERNS)[number], EvidenceCode>;

const GOAL_EMPHASIS = {
  softness_and_hydration: { emphasis: 'hydration', evidence: 'goal_hydration' },
  definition_and_frizz_control: { emphasis: 'nutrition', evidence: 'goal_frizz_definition' },
  reduce_breakage_and_strengthen: { emphasis: 'hydration', evidence: 'goal_breakage_strength' },
  recover_chemical_or_heat_damage: { emphasis: 'hydration', evidence: 'goal_damage_recovery' },
  // maintain_healthy_hair carries no direction: the assessment continues with §3 P2/P3.
} as const satisfies Partial<
  Record<HairProfileSnapshot['primaryGoal'], { emphasis: Emphasis; evidence: EvidenceCode }>
>;

const TEXTURED_PATTERNS = ['curly', 'coily', 'transitioning_or_mixed'] as const;
const HIGH_HEAT_USAGES = ['three_to_four_weekly', 'almost_daily'] as const;
const DAMAGE_GOALS = ['reduce_breakage_and_strengthen', 'recover_chemical_or_heat_damage'] as const;

const includes = <T extends string>(haystack: readonly T[], needle: string): boolean =>
  (haystack as readonly string[]).includes(needle);

/** Emphasis, following the deterministic priority goal → concerns → pattern (worksheet §3). */
const decideEmphasis = (
  profile: HairProfileSnapshot,
): { emphasis: Emphasis; evidence: readonly EvidenceCode[] } => {
  const byGoal = GOAL_EMPHASIS[profile.primaryGoal as keyof typeof GOAL_EMPHASIS] as
    { emphasis: Emphasis; evidence: EvidenceCode } | undefined;
  if (byGoal) return { emphasis: byGoal.emphasis, evidence: [byGoal.evidence] };

  const hydrationHits = HYDRATION_CONCERNS.filter((c) => includes(profile.currentConcerns, c));
  if (hydrationHits.length > 0) {
    return { emphasis: 'hydration', evidence: hydrationHits.map((c) => CONCERN_EVIDENCE[c]) };
  }
  if (includes(profile.currentConcerns, 'frizz')) {
    return { emphasis: 'nutrition', evidence: ['concern_frizz'] };
  }

  if (includes(TEXTURED_PATTERNS, profile.hairPattern)) {
    return { emphasis: 'hydration', evidence: ['textured_hair_moisture_support'] };
  }
  // Unknown / no signal never escalates intensity (worksheet §10).
  return { emphasis: 'balanced', evidence: ['balanced_default'] };
};

/**
 * Reconstruction is conservative: at least two of {chemical, high heat, damage} (worksheet §4).
 * Evidence for it is emitted only when the rule actually fires (worksheet §11).
 */
const decideReconstruction = (
  profile: HairProfileSnapshot,
): { include: boolean; evidence: readonly EvidenceCode[] } => {
  const chemical = profile.chemicalTreatments.length > 0;
  const highHeat = includes(HIGH_HEAT_USAGES, profile.heatUsage);
  const damageFromGoal = includes(DAMAGE_GOALS, profile.primaryGoal);
  const damageFromConcern = includes(profile.currentConcerns, 'breakage');
  const damage = damageFromGoal || damageFromConcern;

  if ([chemical, highHeat, damage].filter(Boolean).length < 2) return { include: false, evidence: [] };

  const evidence: EvidenceCode[] = [];
  if (chemical) evidence.push('chemical_exposure');
  if (highHeat) evidence.push('frequent_heat');
  if (damageFromGoal) {
    evidence.push(
      profile.primaryGoal === 'reduce_breakage_and_strengthen'
        ? 'goal_breakage_strength'
        : 'goal_damage_recovery',
    );
  }
  if (damageFromConcern) evidence.push('concern_breakage');
  return { include: true, evidence };
};

/** `assess(HairProfileSnapshot) → AssessmentOutput` (SPEC-004 G1). Same input ⇒ same output. */
export const assessV1 = (profile: HairProfileSnapshot): AssessmentOutput => {
  const emphasis = decideEmphasis(profile);
  const reconstruction = decideReconstruction(profile);
  return {
    emphasis: emphasis.emphasis,
    includeReconstruction: reconstruction.include,
    // Stable order, no duplicates: a code may be produced by both branches (e.g. goal_breakage_strength).
    evidenceCodes: [...new Set([...emphasis.evidence, ...reconstruction.evidence])],
  };
};
