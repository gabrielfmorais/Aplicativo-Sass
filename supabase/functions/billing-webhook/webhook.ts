// SPEC-010 PR-C §9 — the provider anti-corruption layer (ACL, BR6). This is the ONLY place provider
// vocabulary lives; the domain (packages/core) and the schema never learn the provider exists.
//
// Pure and provider-agnostic on purpose: HMAC verification, the event contract (zod), and the
// provider→domain translation are proven end-to-end with generic fixtures (SPEC-010 §20). When the
// provider is chosen (OQ1) its concrete event names/header/scheme are aliased in here — one edit,
// never a change to the domain, the tables, or the RPC. The signing secret comes from function env at
// deploy (Fase 10), so no credential is needed to build or test this.
import { z } from 'zod';

/** Mirrors the `subscriptions.provider` CHECK (DATA-MODEL §3.12). */
export const PROVIDERS = ['revenuecat', 'apple', 'google', 'manual'] as const;

/**
 * Provider event vocabulary → domain subscription status. A status the domain does not accept can
 * never be emitted from here; even if it were, `apply_billing_event` audits and drops it (fail
 * closed). Candidate mapping — see the file header.
 */
export const EVENT_TYPE_TO_STATUS = {
  initial_purchase: 'active',
  renewal: 'active',
  uncancellation: 'active',
  trial_started: 'trial',
  billing_issue: 'grace',
  cancellation: 'cancelled',
  expiration: 'expired',
  refund: 'refunded',
} as const satisfies Record<string, 'trial' | 'active' | 'grace' | 'expired' | 'cancelled' | 'refunded'>;

export type ProviderEventType = keyof typeof EVENT_TYPE_TO_STATUS;

const EVENT_TYPES = Object.keys(EVENT_TYPE_TO_STATUS) as [ProviderEventType, ...ProviderEventType[]];

const isoDateTime = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO datetime');

/** The normalised provider event we accept. zod is the trust boundary on the provider contract. */
export const WebhookEventSchema = z.object({
  event_id: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  // The app_user_id we handed the provider (= auth.users.id). Anything that is not one of our uuids
  // cannot map to a user (EC4) — the event is still audited, applied to no one.
  app_user_id: z.string().min(1),
  occurred_at: isoDateTime,
  product_code: z.string().min(1),
  provider: z.enum(PROVIDERS),
  current_period_ends_at: isoDateTime.nullable().optional(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ApplyBillingEventArgs {
  p_event_id: string;
  p_user_id: string | null;
  p_type: string;
  p_occurred_at: string;
  p_provider: string;
  p_status: string;
  p_product_code: string;
  p_current_period_ends_at: string | null;
  p_payload_hash: string;
}

/** Translate a validated provider event into the domain RPC arguments (ACL, BR6). */
export function toApplyArgs(event: WebhookEvent, payloadHash: string): ApplyBillingEventArgs {
  return {
    p_event_id: event.event_id,
    p_user_id: UUID_RE.test(event.app_user_id) ? event.app_user_id.toLowerCase() : null,
    p_type: event.type,
    p_occurred_at: new Date(event.occurred_at).toISOString(),
    p_provider: event.provider,
    p_status: EVENT_TYPE_TO_STATUS[event.type],
    p_product_code: event.product_code,
    p_current_period_ends_at: event.current_period_ends_at
      ? new Date(event.current_period_ends_at).toISOString()
      : null,
    p_payload_hash: payloadHash,
  };
}

// --------------------------------------------------------- crypto (Web Crypto: Deno + Node)
const enc = new TextEncoder();
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** SHA-256 hex of the raw body — what we store in `billing_events.payload_hash` (no raw payload, §12). */
export async function sha256Hex(input: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(input))));
}

/** Constant-time hex compare; unequal lengths are never equal. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify an HMAC-SHA256 signature over the raw body (T18). Empty secret or missing signature ⇒ never
 * valid (fail closed). The header name and exact scheme are finalised with the provider (OQ1).
 */
export async function verifyHmac(
  secret: string,
  rawBody: string,
  signatureHex: string | null,
): Promise<boolean> {
  if (!secret || !signatureHex) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return timingSafeEqualHex(toHex(new Uint8Array(mac)), signatureHex.trim().toLowerCase());
}
