// SPEC-010 PR-C — the ACL under test: HMAC verification (AC5), the event contract (zod), and the
// provider→domain translation. Pure functions, no network, no env. Run: `deno test` in
// supabase/functions. Uses independent published test vectors so the crypto is checked against
// something other than itself.
import {
  EVENT_TYPE_TO_STATUS,
  sha256Hex,
  toApplyArgs,
  verifyHmac,
  WebhookEventSchema,
  type ProviderEventType,
} from './webhook.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const validEvent = {
  event_id: 'evt_1',
  type: 'initial_purchase',
  app_user_id: '00000000-0000-4000-8000-0000000000a6',
  occurred_at: '2026-08-30T12:00:00.000Z',
  product_code: 'prod_monthly',
  provider: 'revenuecat',
  current_period_ends_at: '2026-09-30T12:00:00.000Z',
};

// ---------------------------------------------------------------------------- crypto vectors
Deno.test('verifyHmac accepts a known-good HMAC-SHA256 vector', async () => {
  // Published vector: HMAC-SHA256(key="key", "The quick brown fox jumps over the lazy dog").
  assert(
    await verifyHmac(
      'key',
      'The quick brown fox jumps over the lazy dog',
      'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8',
    ),
    'known vector must verify',
  );
});

Deno.test(
  'verifyHmac rejects a tampered body, wrong secret, empty secret, and missing signature',
  async () => {
    const secret = 'shhh';
    const body = JSON.stringify(validEvent);
    // Sign correctly, then confirm each perturbation fails.
    const good = await sign(secret, body);
    assert(await verifyHmac(secret, body, good), 'correct signature verifies');
    assert(!(await verifyHmac(secret, body + ' ', good)), 'tampered body rejected');
    assert(!(await verifyHmac('other', body, good)), 'wrong secret rejected');
    assert(!(await verifyHmac('', body, good)), 'empty secret rejected (fail closed)');
    assert(!(await verifyHmac(secret, body, null)), 'missing signature rejected');
    assert(!(await verifyHmac(secret, body, 'deadbeef')), 'malformed signature rejected');
  },
);

Deno.test('sha256Hex matches the published SHA-256("abc") vector', async () => {
  assert(
    (await sha256Hex('abc')) === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'sha256("abc")',
  );
});

// -------------------------------------------------------------------------------- zod contract
Deno.test('WebhookEventSchema accepts a valid event and rejects malformed ones', () => {
  assert(WebhookEventSchema.safeParse(validEvent).success, 'valid event parses');
  assert(!WebhookEventSchema.safeParse({ ...validEvent, event_id: '' }).success, 'empty event_id rejected');
  assert(!WebhookEventSchema.safeParse({ ...validEvent, type: 'nope' }).success, 'unknown type rejected');
  assert(
    !WebhookEventSchema.safeParse({ ...validEvent, provider: 'stripe' }).success,
    'unknown provider rejected',
  );
  assert(
    !WebhookEventSchema.safeParse({ ...validEvent, occurred_at: 'not-a-date' }).success,
    'bad date rejected',
  );
  assert(!WebhookEventSchema.safeParse({ event_id: 'x' }).success, 'missing fields rejected');
  // current_period_ends_at is optional/nullable.
  const { current_period_ends_at: _omit, ...noEnd } = validEvent;
  assert(WebhookEventSchema.safeParse(noEnd).success, 'missing current_period_ends_at is allowed');
  assert(
    WebhookEventSchema.safeParse({ ...validEvent, current_period_ends_at: null }).success,
    'null end allowed',
  );
});

// ---------------------------------------------------------------------------- translation (ACL)
Deno.test('toApplyArgs maps every provider type to its domain status', () => {
  for (const [type, status] of Object.entries(EVENT_TYPE_TO_STATUS)) {
    const event = WebhookEventSchema.parse({ ...validEvent, type });
    const args = toApplyArgs(event, 'hash');
    assert(args.p_status === status, `${type} → ${status}`);
    assert(args.p_type === type, 'p_type carries the provider type verbatim for audit');
  }
});

Deno.test('toApplyArgs resolves a uuid app_user_id and nulls a non-uuid one (EC4)', () => {
  const mapped = toApplyArgs(WebhookEventSchema.parse(validEvent), 'h');
  assert(mapped.p_user_id === '00000000-0000-4000-8000-0000000000a6', 'uuid maps through');

  const orphan = toApplyArgs(
    WebhookEventSchema.parse({ ...validEvent, app_user_id: 'someone@provider' }),
    'h',
  );
  assert(orphan.p_user_id === null, 'a non-uuid app_user_id becomes null (unmapped, audited only)');
});

Deno.test('toApplyArgs normalises dates and passes the hash through', () => {
  const args = toApplyArgs(
    WebhookEventSchema.parse({ ...validEvent, occurred_at: '2026-08-30T12:00:00Z' }),
    'the-hash',
  );
  assert(args.p_occurred_at === '2026-08-30T12:00:00.000Z', 'occurred_at normalised to ISO');
  assert(args.p_current_period_ends_at === '2026-09-30T12:00:00.000Z', 'period end normalised');
  assert(args.p_payload_hash === 'the-hash', 'payload hash carried');

  const { current_period_ends_at: _omit, ...noEnd } = validEvent;
  const argsNoEnd = toApplyArgs(WebhookEventSchema.parse(noEnd), 'h');
  assert(argsNoEnd.p_current_period_ends_at === null, 'absent period end → null');
});

// Local helper: sign exactly as the provider would (independent of verifyHmac's internals is not
// possible with Web Crypto, but the known-vector test above pins the algorithm).
async function sign(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return Array.from(new Uint8Array(mac), (x) => x.toString(16).padStart(2, '0')).join('');
}

// keep the type import used (documents the exported type surface)
export const _typecheck: ProviderEventType = 'renewal';
