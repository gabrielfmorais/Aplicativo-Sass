// hair-profile — public surface (SPEC-002).
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
  type HairProfileInput,
  type HairProfileSnapshot,
} from './domain/hair-profile.ts';
export type { HairProfilePort } from './application/ports.ts';
