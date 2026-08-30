// SPEC-010 PR-C §9 — `billing-webhook`: the provider tells the backend that a subscription changed.
//
// Auth here is the HMAC, not a JWT: this is a public endpoint the provider calls (T18). Flow: read the
// raw body → verify HMAC (invalid ⇒ 401, nothing written) → zod-validate the provider contract →
// translate to domain args (ACL, BR6) → one call to `apply_billing_event` (idempotency, ordering and
// upsert are atomic in the RPC). An internal error returns 5xx so the provider redelivers; the
// event_id idempotency makes the retry a no-op (FR8). No PII/secret is ever logged.
import { createClient } from '@supabase/supabase-js';
import { sha256Hex, toApplyArgs, verifyHmac, WebhookEventSchema } from './webhook.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// Shared secret from the provider; injected at deploy (Fase 10, HUMAN GATE). Absent ⇒ every request
// fails the signature check (fail closed).
const SIGNING_SECRET = Deno.env.get('BILLING_WEBHOOK_SECRET') ?? '';

// Provider-agnostic header; finalised with the provider (OQ1).
const SIGNATURE_HEADER = 'x-webhook-signature';

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const rawBody = await req.text();

  if (!(await verifyHmac(SIGNING_SECRET, rawBody, req.headers.get(SIGNATURE_HEADER)))) {
    return json(401, { error: 'invalid_signature' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const result = WebhookEventSchema.safeParse(parsed);
  if (!result.success) return json(400, { error: 'invalid_event' });

  const args = toApplyArgs(result.data, await sha256Hex(rawBody));

  const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await service.rpc('apply_billing_event', args);
  if (error) {
    // Never echo the database message back. 5xx ⇒ provider retries; idempotency covers it (FR8).
    console.error('apply_billing_event failed', { code: error.code });
    return json(503, { error: 'apply_failed' });
  }

  // The RPC boolean: true = newly processed, false = duplicate delivery. Either way we ack with 200.
  return json(200, { applied: data === true });
});
