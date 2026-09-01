// hair-profile — public surface (SPEC-002, SPEC-020).
export {
  HairProfileInputSchema,
  HAIR_PATTERNS,
  STRAND_THICKNESSES,
  SCALP_TENDENCIES,
  WASH_FREQUENCIES,
  CHEMICAL_TREATMENTS,
  HEAT_USAGES,
  CURRENT_CONCERNS,
  PRIMARY_GOALS,
  HAIR_PROFILE_COLUMNS,
  HairProfileRowSchema,
  hairProfileFromRow,
  type HairProfileInput,
  type HairProfileSnapshot,
} from './domain/hair-profile.ts';
export {
  HAIR_EVENT_TYPES,
  HairEventTypeSchema,
  type HairEvent,
  type HairEventType,
} from './domain/hair-event.ts';
export type { HairEventPort, HairProfilePort } from './application/ports.ts';
