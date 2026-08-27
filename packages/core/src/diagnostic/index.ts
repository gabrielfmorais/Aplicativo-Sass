// diagnostic — public surface (SPEC-004, Assessment half of the vertical slice; ADR-007 A2/D-66).
import { ASSESSMENT_ALGORITHM_VERSION_V1, assessV1 } from './engine/v1/assess.ts';
import { ASSESSMENT_RULES_V1 } from './engine/v1/rules.ts';

export { EMPHASES, EVIDENCE_CODES } from './domain/assessment.ts';
export type { AssessmentOutput, Emphasis, EvidenceCode } from './domain/assessment.ts';

/** The version every new plan is generated with. Bump only when behaviour changes (ADR-007). */
export const CURRENT_ASSESSMENT_VERSION = ASSESSMENT_ALGORITHM_VERSION_V1;
export const assess = assessV1;
/** Governance register of the rules behind `CURRENT_ASSESSMENT_VERSION` (ADR-007 A1). */
export const CURRENT_ASSESSMENT_RULES = ASSESSMENT_RULES_V1;
