/**
 * Subscription status → premium capabilities (SPEC-010 BR2/BR3).
 *
 * MIRRORED IN SQL by `public.has_entitlement` / `public.get_my_entitlements`
 * (supabase/migrations/*_subscriptions.sql). The two are kept in step by
 * `scripts/check-entitlement-catalog-parity.mjs`, which fails the build on drift — the same guard
 * shape already used for the Deno import map. Change one side and the other must move in the same
 * PR (AC6).
 *
 * The decision itself is the server's (FR5): these lists exist so the SQL that decides has a
 * declared, testable counterpart, not so the client can decide on its own.
 *
 * Capabilities are named by capability, never by plan (ADR-011): nothing here says "premium",
 * because the day a second plan exists the mapping changes and the capability names do not.
 */

/** Closed enum, mirrored by the CHECK constraint on `subscriptions.status`. */
export const SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'grace',
  'expired',
  'cancelled',
  'refunded',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** The capability catalogue (DOMAIN-MAP §3.9). */
export const ENTITLEMENT_CODES = ['advanced_insights', 'plan_customization', 'premium_content'] as const;

export type EntitlementCode = (typeof ENTITLEMENT_CODES)[number];

/**
 * Status that grant access (BR3). `grace` is included on purpose: the provider is retrying her
 * payment, and cutting access mid-retry punishes a card problem she may not know about yet.
 *
 * The MVP has exactly one paid plan (NG2), so a granting status grants every capability in
 * `ENTITLEMENT_CODES`. Splitting the catalogue per tier is the change the second plan pays for.
 */
export const GRANTING_SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'grace',
] as const satisfies readonly SubscriptionStatus[];
