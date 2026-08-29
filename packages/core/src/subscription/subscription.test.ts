import {
  ENTITLEMENT_CODES,
  EntitlementService,
  GRANTING_SUBSCRIPTION_STATUSES,
  SUBSCRIPTION_STATUSES,
} from './index.ts';

describe('the catalogue SQL mirrors (BR2/BR3/AC6)', () => {
  // These three lists are duplicated in SQL on purpose — the server has to decide without asking
  // the client (FR5). scripts/check-entitlement-catalog-parity.mjs fails the build if they drift,
  // and these assertions are what make a careless edit here loud instead of silent.
  it('keeps the status enum closed and in mirror order', () => {
    expect(SUBSCRIPTION_STATUSES).toEqual(['trial', 'active', 'grace', 'expired', 'cancelled', 'refunded']);
  });

  it('keeps the capability catalogue closed', () => {
    expect(ENTITLEMENT_CODES).toEqual(['advanced_insights', 'plan_customization', 'premium_content']);
  });

  it('grants access on trial, active and grace — and on nothing else', () => {
    expect(GRANTING_SUBSCRIPTION_STATUSES).toEqual(['trial', 'active', 'grace']);
    const denied = SUBSCRIPTION_STATUSES.filter(
      (s) => !(GRANTING_SUBSCRIPTION_STATUSES as readonly string[]).includes(s),
    );
    expect(denied).toEqual(['expired', 'cancelled', 'refunded']);
  });
});

describe('EntitlementService.can (BR5, fail closed)', () => {
  it('allows a capability the server granted', () => {
    expect(EntitlementService.can('plan_customization', ['plan_customization'])).toBe(true);
  });

  it('denies a capability the server did not grant', () => {
    expect(EntitlementService.can('premium_content', ['plan_customization'])).toBe(false);
    expect(EntitlementService.can('premium_content', [])).toBe(false);
  });

  it('denies when entitlements are unknown — loading, no row, or a failed request', () => {
    expect(EntitlementService.can('advanced_insights', null)).toBe(false);
    expect(EntitlementService.can('advanced_insights', undefined)).toBe(false);
  });

  it('answers from the given codes only — no clock, no cache, no hidden state', () => {
    const granted = ['premium_content'];
    expect(EntitlementService.can('premium_content', granted)).toBe(true);
    expect(EntitlementService.can('premium_content', granted)).toBe(true);
    expect(EntitlementService.can('premium_content', [])).toBe(false);
  });
});
