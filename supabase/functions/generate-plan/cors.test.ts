// D-90 — the preflight, which is the thing that actually broke the web dev preview.
// Run: `deno test` in supabase/functions.
import { CORS_HEADERS, preflight } from './cors.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

Deno.test('answers the browser preflight, so the POST is allowed to happen at all', () => {
  const response = preflight(new Request('https://x/functions/v1/generate-plan', { method: 'OPTIONS' }));
  assert(response !== null, 'OPTIONS must be answered here, not fall through to 405');
  assert(response.status === 204, `expected 204, got ${response.status}`);
  assert(
    response.headers.get('access-control-allow-origin') === '*',
    'without an allow-origin the browser discards the answer and the POST never leaves',
  );
});

Deno.test('allows exactly the headers supabase-js sends', () => {
  const allowed = (
    preflight(new Request('https://x', { method: 'OPTIONS' }))!.headers.get('access-control-allow-headers') ??
    ''
  ).toLowerCase();
  // Omitting any one of these makes the preflight fail with the same opaque client-side error.
  for (const header of ['authorization', 'content-type', 'apikey', 'x-client-info']) {
    assert(allowed.includes(header), `preflight does not allow ${header}`);
  }
});

Deno.test('lets every other method fall through to the handler', () => {
  for (const method of ['POST', 'GET', 'DELETE', 'PUT']) {
    assert(
      preflight(new Request('https://x', { method })) === null,
      `${method} must not be swallowed by the preflight branch`,
    );
  }
});

/**
 * The one combination that would actually be dangerous: `*` together with allow-credentials tells a
 * browser to attach ambient credentials to a cross-origin call. It is invalid per spec, browsers
 * reject it, and asserting it here means nobody can "fix" a CORS problem by adding it later.
 */
Deno.test('never allows credentials alongside the wildcard origin', () => {
  const keys = Object.keys(CORS_HEADERS).map((k) => k.toLowerCase());
  assert(
    !keys.includes('access-control-allow-credentials'),
    'wildcard origin + allow-credentials would let a third-party page ride the browser’s credentials',
  );
});
