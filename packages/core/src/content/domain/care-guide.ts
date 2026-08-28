import { z } from 'zod';

// ADR-006 / dependency-cruiser rule `core-context-isolation`: another context is entered
// only through its public index.
import { CARE_TYPE_CODES, type CareTypeCode } from '../../schedule/index.ts';
import { DomainRuleValidationStatus } from '../../shared/index.ts';

/**
 * What the user needs in order to actually perform a care (SPEC-007 §9.1).
 *
 * Structured on purpose: the screen renders these fields with plain `<Text>`, so the app needs
 * no markdown renderer — one less dependency and no injection surface (SPEC-007 §11).
 *
 * Governance (D-26 / ADR-007 A1, applied to text by **D-70**): instructional hair-care content is
 * domain material. Engineering may author it as `candidate` — usable in development and internal
 * beta — and it joins OQ-REL, the same domain sign-off that already gates the V1 engine rules.
 * Only `validated` content may be part of a PUBLIC RELEASE.
 */
export const CareGuideSchema = z
  .object({
    careTypeCode: z.enum(CARE_TYPE_CODES),
    /** One sentence: what this care does for the hair. Never a health claim (BR3). */
    whatItIs: z.string().min(10),
    /** Ordered steps. Fewer than 3 is not a procedure; more than 6 is not memorable. */
    steps: z.array(z.string().min(3)).min(3).max(6),
    /** Rough duration, so the user can decide between doing it now and rescheduling (US2). */
    durationMin: z.number().int().positive(),
    commonMistakes: z.array(z.string().min(3)).min(2).max(3),
    validationStatus: DomainRuleValidationStatus,
    /** Agent-authored content MUST say "hipótese de engenharia — requer revisão especializada". */
    rationaleSource: z.string().min(10),
  })
  .strict();

export type CareGuide = z.infer<typeof CareGuideSchema>;

/**
 * Every care type has exactly one guide, checked by the compiler rather than at runtime
 * (SPEC-007 FR1/AC1): a new `CareTypeCode` breaks the build until it gets a guide.
 */
export type CareGuides = Record<CareTypeCode, CareGuide>;
