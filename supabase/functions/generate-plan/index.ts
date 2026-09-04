// SPEC-004 §12 — `generate-plan`: the server-enforced creation of a hair plan.
//
// The client may compute an identical preview locally (same `buildPlan` from @app/core, AC3) but it
// can never persist one: it holds no write privilege on hair_plans/scheduled_cares, and
// `create_plan_tx` is executable by service_role only (G2/P10).
//
// Flow: verify the caller's JWT → read HER current hair profile under RLS → run the engines →
// persist atomically through create_plan_tx (supersede + plan + cares), idempotent per
// `clientRequestId`. No profile value and no token is ever logged (AC11).
import {
  HAIR_PROFILE_COLUMNS,
  buildPlan,
  hairProfileFromRow,
  isLocalDate,
  isUuid,
  type LocalDate,
} from '@app/core';
import { createClient } from '@supabase/supabase-js';

import { CORS_HEADERS, preflight } from './cors.ts';
import { premiumPreferences } from './preferences.ts';
import { resolveScheduleVersion } from './schedule-version.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Widest civil-date offset from UTC is −12h…+14h, so the caller's local day is within ±1 day. */
const MAX_START_DRIFT_DAYS = 2;

/**
 * Per-user rate limit (T07, SPEC-004 §14).
 * ponytail: in-memory, per isolate — it resets on cold start and does not span instances. It is a
 * throttle, not a quota; the real duplicate-plan protection is the idempotency key plus the
 * one-active-plan index. Move to a counter table if abuse is ever measured.
 */
const MIN_INTERVAL_MS = 3_000;
const lastCallAt = new Map<string, number>();

const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  });

const daysBetween = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

Deno.serve(async (req: Request): Promise<Response> => {
  // The browser asks before it calls. Answering this is what makes the web dev preview (D-80)
  // able to reach the function at all; native never sends it.
  const preflighted = preflight(req);
  if (preflighted) return preflighted;

  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'unauthorized' });

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const userId = userData?.user?.id;
  if (userError || !userId) return json(401, { error: 'unauthorized' });

  const now = Date.now();
  const previous = lastCallAt.get(userId);
  if (previous !== undefined && now - previous < MIN_INTERVAL_MS) {
    return json(429, { error: 'too_many_requests' });
  }
  lastCallAt.set(userId, now);

  // Trust boundary: validate the two client-supplied values (SECURITY-BASELINE, zod-equivalent).
  let body: { clientRequestId?: unknown; startsOn?: unknown; scheduleVersion?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_body' });
  }
  const { clientRequestId, startsOn, scheduleVersion } = body;
  if (typeof clientRequestId !== 'string' || !isUuid(clientRequestId)) {
    return json(400, { error: 'invalid_client_request_id' });
  }
  if (typeof startsOn !== 'string' || !isLocalDate(startsOn)) {
    return json(400, { error: 'invalid_starts_on' });
  }
  // `startsOn` is the caller's local day; anything further out is not a timezone, it is a forgery.
  const todayUtc = new Date().toISOString().slice(0, 10);
  if (daysBetween(startsOn, todayUtc) > MAX_START_DRIFT_DAYS) {
    return json(400, { error: 'invalid_starts_on' });
  }

  /**
   * SPEC-046 — a versão do motor com que ela viu o preview (SPEC-038 OQ4). A decisão inteira,
   * incluindo a recusa, mora em `resolveScheduleVersion` — e recusa **antes** de qualquer escrita.
   */
  const decided = resolveScheduleVersion(scheduleVersion);
  if (!decided.ok) return json(400, { error: 'unsupported_schedule_version' });
  const engineVersion = decided.version;

  // Her current snapshot, read under RLS with her own JWT — the client never supplies the profile.
  const { data: profileRow, error: profileError } = await userClient
    .from('hair_profiles')
    .select(HAIR_PROFILE_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (profileError) return json(503, { error: 'profile_read_failed' });
  if (!profileRow) return json(409, { error: 'no_hair_profile' });

  // Premium placement, decided server-side. Free (or unverifiable) callers get the engine default,
  // and either way the care types, their count and their cadence are the engine's alone (SPEC-015 G3).
  const preferences = await premiumPreferences(
    async () => await userClient.rpc('has_entitlement', { p_code: 'plan_customization' }),
    async () => await userClient.from('plan_preferences').select('preferred_weekdays').maybeSingle(),
  );
  const draft = buildPlan(hairProfileFromRow(profileRow), startsOn as LocalDate, preferences, engineVersion);

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: planId, error: rpcError } = await serviceClient.rpc('create_plan_tx', {
    p_user_id: userId,
    p_hair_profile_id: draft.plan.hairProfileId,
    p_starts_on: draft.plan.startsOn,
    p_assessment_algorithm_version: draft.plan.assessmentAlgorithmVersion,
    p_schedule_algorithm_version: draft.plan.scheduleAlgorithmVersion,
    p_client_request_id: clientRequestId,
    p_cares: draft.cares.map((c) => ({ care_type_code: c.careTypeCode, planned_date: c.plannedDate })),
  });
  if (rpcError || !planId) {
    // Never echo the database message back to the client.
    console.error('create_plan_tx failed', { code: rpcError?.code });
    return json(503, { error: 'plan_creation_failed' });
  }

  /**
   * ⚠️ **A versão vai na resposta lida DO PLANO, não da que acabamos de calcular.**
   *
   * Numa repetição idempotente, `create_plan_tx` devolve o plano que já existia e **preserva a
   * versão dele** — então responder com a versão recém-computada faria a resposta afirmar uma coisa
   * enquanto o banco guarda outra. Seria a divergência silenciosa de novo, agora na própria
   * superfície que existe para eliminá-la.
   *
   * A leitura falhar não invalida o plano, que está gravado: aí a resposta omite a versão em vez de
   * inventá-la, e quem chamou continua tendo o `planId` para reler.
   */
  const { data: storedRow } = await serviceClient
    .from('hair_plans')
    .select('schedule_algorithm_version')
    .eq('id', planId)
    .maybeSingle();
  const stored = (storedRow as { schedule_algorithm_version?: string } | null)?.schedule_algorithm_version;

  return json(200, { planId, ...(stored ? { scheduleVersion: stored } : {}) });
});
