// Foundation-only Edge Function (SPEC-000 §9). Proves that @app/core is consumable from Deno.
// Accesses NO data, uses NO service role. Removable once product functions exist.
import { CORE_VERSION, systemClock, toLocalDate, cryptoIdGenerator } from '@app/core';

Deno.serve((_req: Request): Response => {
  const now = systemClock.now();
  const body = {
    ok: true,
    coreVersion: CORE_VERSION,
    now,
    todayInSaoPaulo: toLocalDate(now, 'America/Sao_Paulo'),
    requestId: cryptoIdGenerator.next(),
  };
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
});
