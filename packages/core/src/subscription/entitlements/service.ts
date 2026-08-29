import { type EntitlementCode } from './catalog.ts';

/**
 * The single place the app is allowed to ask "may she use this?" (ADR-011, BR5).
 *
 * This answer is for the UI only — show, hide, or send her to the paywall. It is NOT authorisation:
 * every premium capability is also checked server-side by `has_entitlement` (FR5), because anything
 * decided on the device is decided by whoever holds the device.
 *
 * Pure by construction: it reads the codes it is given and nothing else — no clock, no network, no
 * cache. Freshness is the adapter's problem (cache ≤ 5 min + refresh after purchase, FR4).
 */
export const EntitlementService = {
  /**
   * `granted` is what the server returned from `get_my_entitlements()`. `null`/`undefined` means we
   * do not know — no row yet, request failed, still loading — and unknown means **free** (§16 fail
   * closed). Never invert this: an error must not open a paid capability.
   */
  can(code: EntitlementCode, granted: readonly string[] | null | undefined): boolean {
    return granted?.includes(code) ?? false;
  },
} as const;
