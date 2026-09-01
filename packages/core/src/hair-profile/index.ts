// hair-profile — public surface (SPEC-002, SPEC-020, SPEC-023).
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
export {
  PRODUCT_CATEGORIES,
  PRODUCT_NAME_MAX_LENGTH,
  ProductCategorySchema,
  ProductNameSchema,
  type Product,
  type ProductCategory,
} from './domain/product.ts';
export type { HairEventPort, HairProfilePort, ProductPort } from './application/ports.ts';
