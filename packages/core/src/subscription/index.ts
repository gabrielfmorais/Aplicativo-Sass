// subscription & entitlements — public surface (SPEC-010 Parte 1; ADR-011).
export {
  ENTITLEMENT_CODES,
  GRANTING_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUSES,
} from './entitlements/catalog.ts';
export type { EntitlementCode, SubscriptionStatus } from './entitlements/catalog.ts';
export { EntitlementService } from './entitlements/service.ts';
export type { EntitlementsPort } from './application/ports.ts';
