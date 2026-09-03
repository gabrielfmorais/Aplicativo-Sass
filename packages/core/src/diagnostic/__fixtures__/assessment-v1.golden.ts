import type { HairProfileInput } from '../../hair-profile/index.ts';
import type { AssessmentOutput } from '../domain/assessment.ts';

/**
 * Golden fixtures for assessment engine v1 (ADR-007: any behaviour change fails CI).
 * They encode the V1 CANDIDATE rules of docs/domain-rules/SPEC-004-domain-rules-worksheet.md (D-67).
 */
export type AssessmentGolden = {
  readonly name: string;
  readonly profile: HairProfileInput;
  readonly expected: AssessmentOutput;
};

const base: HairProfileInput = {
  hairPattern: 'straight',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['no_major_concern'],
  primaryGoal: 'maintain_healthy_hair',
  // SPEC-037: presentes porque uma avaliacao nova sempre responde; o motor v1 nao os le.
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
};

export const ASSESSMENT_GOLDEN: readonly AssessmentGolden[] = [
  {
    name: 'goal decides: softness_and_hydration → hydration (§3 P1)',
    profile: { ...base, primaryGoal: 'softness_and_hydration' },
    expected: { emphasis: 'hydration', includeReconstruction: false, evidenceCodes: ['goal_hydration'] },
  },
  {
    name: 'goal decides: definition_and_frizz_control → nutrition (§3 P1)',
    profile: { ...base, primaryGoal: 'definition_and_frizz_control' },
    expected: {
      emphasis: 'nutrition',
      includeReconstruction: false,
      evidenceCodes: ['goal_frizz_definition'],
    },
  },
  {
    name: 'goal decides: reduce_breakage_and_strengthen → hydration, one damage signal only',
    profile: { ...base, primaryGoal: 'reduce_breakage_and_strengthen' },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: false,
      evidenceCodes: ['goal_breakage_strength'],
    },
  },
  {
    name: 'maintain + concerns decide: dryness family → hydration, codes in worksheet order (§3 P2)',
    profile: { ...base, currentConcerns: ['dullness', 'dryness'] },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: false,
      evidenceCodes: ['concern_dryness', 'concern_dullness'],
    },
  },
  {
    name: 'maintain + only frizz → nutrition (§3 P2 fallback)',
    profile: { ...base, currentConcerns: ['frizz'] },
    expected: { emphasis: 'nutrition', includeReconstruction: false, evidenceCodes: ['concern_frizz'] },
  },
  {
    name: 'maintain + no concern + textured pattern → hydration (§3 P3)',
    profile: { ...base, hairPattern: 'coily' },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: false,
      evidenceCodes: ['textured_hair_moisture_support'],
    },
  },
  {
    name: 'unknown answers never escalate: balanced default (§10)',
    profile: {
      ...base,
      hairPattern: 'unknown',
      strandThickness: 'unknown',
      scalpTendency: 'unknown',
      washFrequency: 'varies',
    },
    expected: { emphasis: 'balanced', includeReconstruction: false, evidenceCodes: ['balanced_default'] },
  },
  {
    name: 'reconstruction: chemical + high heat = 2 of 3 (§4)',
    profile: { ...base, chemicalTreatments: ['bleaching_or_highlights'], heatUsage: 'almost_daily' },
    expected: {
      emphasis: 'balanced',
      includeReconstruction: true,
      evidenceCodes: ['balanced_default', 'chemical_exposure', 'frequent_heat'],
    },
  },
  {
    name: 'reconstruction: chemical + damage goal, shared code is not duplicated (§4/§11)',
    profile: {
      ...base,
      chemicalTreatments: ['coloring'],
      primaryGoal: 'reduce_breakage_and_strengthen',
    },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: true,
      evidenceCodes: ['goal_breakage_strength', 'chemical_exposure'],
    },
  },
  {
    name: 'reconstruction: high heat + breakage concern (§4)',
    profile: { ...base, heatUsage: 'three_to_four_weekly', currentConcerns: ['breakage'] },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: true,
      evidenceCodes: ['concern_breakage', 'frequent_heat'],
    },
  },
  {
    name: 'one signal only (chemical) does not trigger reconstruction (§4, conservative)',
    profile: { ...base, chemicalTreatments: ['perm_or_chemical_texturizing'] },
    expected: { emphasis: 'balanced', includeReconstruction: false, evidenceCodes: ['balanced_default'] },
  },
  {
    name: 'damage recovery goal + chemical → reconstruction with the recovery code',
    profile: {
      ...base,
      primaryGoal: 'recover_chemical_or_heat_damage',
      chemicalTreatments: ['straightening_relaxing_or_progressive'],
    },
    expected: {
      emphasis: 'hydration',
      includeReconstruction: true,
      evidenceCodes: ['goal_damage_recovery', 'chemical_exposure'],
    },
  },
];
