// CORS for the one function a browser actually calls.
//
// Found by running the app, not by reading it (CLAUDE.md §0.1). `functions.invoke` sends
// `Authorization` and `Content-Type: application/json`, which makes the request non-simple, so the
// browser sends a `OPTIONS` preflight first. The handler answered `405` with no CORS headers, the
// browser refused to send the POST, and supabase-js surfaced `FunctionsFetchError` — "Failed to
// send a request to the Edge Function", which reads like a flaky network and is not one. In the
// web dev preview (D-80) that is the difference between the journey completing and not.
//
// **Why `*` does not weaken anything.** The function still requires and validates a JWT on every
// request; CORS decides what a *browser* will let a page read, never what the server accepts. There
// is deliberately no `Access-Control-Allow-Credentials`: without it the browser attaches no
// ambient credential, so a third-party page gets nothing it did not already have. The token lives
// in the app's own origin storage and is put on the header explicitly by our client — a site that
// cannot read it cannot forge a call, with or without these headers.
//
// Native has no preflight at all, so this changes nothing there.

export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-origin': '*',
  // Exactly what supabase-js sends, and nothing else.
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
};

/**
 * The preflight answer, or `null` when the request is not one.
 *
 * Returning `null` rather than handling the method here keeps the decision in one place: the
 * handler still answers 405 for every method that is neither POST nor OPTIONS.
 */
export const preflight = (req: Request): Response | null =>
  req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null;
