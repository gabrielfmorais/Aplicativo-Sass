import { z } from 'zod';

/**
 * SPEC-002 §6 (D-62) — approved product inputs for a hair-profile snapshot.
 * Enum values are the domain vocabulary (snake_case) and are mirrored by CHECK constraints in
 * supabase/migrations/20260828000000_hair_profiles.sql. These are inputs for personalisation,
 * NOT a diagnosis (D-26): no rules, weights or scores live here.
 */
export const HAIR_PATTERNS = [
  'straight',
  'wavy',
  'curly',
  'coily',
  'transitioning_or_mixed',
  'unknown',
] as const;
export const STRAND_THICKNESSES = ['fine', 'medium', 'coarse', 'unknown'] as const;
export const SCALP_TENDENCIES = ['oily_quickly', 'balanced', 'dry_tendency', 'unknown'] as const;
export const WASH_FREQUENCIES = [
  'once_or_less_weekly',
  'twice_weekly',
  'three_to_four_weekly',
  'five_or_more_weekly',
  'varies',
] as const;
export const CHEMICAL_TREATMENTS = [
  'coloring',
  'bleaching_or_highlights',
  'straightening_relaxing_or_progressive',
  'perm_or_chemical_texturizing',
] as const;
export const HEAT_USAGES = [
  'almost_never',
  'one_to_two_weekly',
  'three_to_four_weekly',
  'almost_daily',
] as const;
export const CURRENT_CONCERNS = [
  'dryness',
  'breakage',
  'tangling',
  'dullness',
  'frizz',
  'no_major_concern',
] as const;
export const PRIMARY_GOALS = [
  'softness_and_hydration',
  'reduce_breakage_and_strengthen',
  'recover_chemical_or_heat_damage',
  'definition_and_frizz_control',
  'maintain_healthy_hair',
] as const;

const unique = <T>(a: readonly T[]) => new Set(a).size === a.length;

/** Trust-boundary validation for the onboarding answers (SPEC-002 FR5/BR6). Mirrors the DB CHECKs. */
export const HairProfileInputSchema = z.strictObject({
  hairPattern: z.enum(HAIR_PATTERNS),
  strandThickness: z.enum(STRAND_THICKNESSES),
  scalpTendency: z.enum(SCALP_TENDENCIES),
  washFrequency: z.enum(WASH_FREQUENCIES),
  // [] = no chemical treatments (no 'none' value).
  chemicalTreatments: z.array(z.enum(CHEMICAL_TREATMENTS)).refine(unique, 'no duplicates'),
  heatUsage: z.enum(HEAT_USAGES),
  currentConcerns: z
    .array(z.enum(CURRENT_CONCERNS))
    .min(1, 'choose at least one')
    .refine(unique, 'no duplicates')
    .refine((a) => !a.includes('no_major_concern') || a.length === 1, 'no_major_concern is exclusive'),
  primaryGoal: z.enum(PRIMARY_GOALS),
});

export type HairProfileInput = z.infer<typeof HairProfileInputSchema>;

/**
 * An immutable snapshot as stored, identified by a stable id (SPEC-002 §9).
 * Downstream contract for SPEC-003 (Diagnostic): referenced by `hairProfileId`, never by an ordinal.
 */
export type HairProfileSnapshot = HairProfileInput & {
  readonly hairProfileId: string;
  readonly createdAt: string;
};
