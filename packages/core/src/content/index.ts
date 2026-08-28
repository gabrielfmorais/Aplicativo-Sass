// content — public surface (SPEC-007).
import { CARE_GUIDES_V1 } from './v1/guides.ts';

export { CareGuideSchema } from './domain/care-guide.ts';
export type { CareGuide, CareGuides } from './domain/care-guide.ts';

/** The guides the app renders today. Replaced wholesale when a reviewed version lands (D-70). */
export const CARE_GUIDES = CARE_GUIDES_V1;
