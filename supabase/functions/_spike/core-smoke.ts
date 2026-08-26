// Runtime smoke for the core ↔ Deno spike (SPEC-000 AC8). Run:
//   deno run supabase/functions/_spike/core-smoke.ts   (from supabase/functions, using deno.json)
// Exits non-zero if any core primitive misbehaves under Deno.
import {
  CORE_VERSION,
  DomainRuleSchema,
  addDays,
  cryptoIdGenerator,
  fixedClock,
  instantFromString,
  isUuid,
  toLocalDate,
  todayFor,
} from '@app/core';

const assert = (cond: boolean, msg: string): void => {
  if (!cond) {
    console.error('FAIL: ' + msg);
    Deno.exit(1);
  }
};

const clock = fixedClock(instantFromString('2026-08-27T02:30:00Z'));
assert(todayFor(clock, 'America/Sao_Paulo') === '2026-08-26', 'timezone day rollover (Sao Paulo)');
assert(todayFor(clock, 'UTC') === '2026-08-27', 'timezone day rollover (UTC)');
assert(
  toLocalDate(instantFromString('2018-12-15T02:30:00Z'), 'America/Sao_Paulo') === '2018-12-15',
  'historical DST',
);
assert(addDays(todayFor(clock, 'UTC'), 56) === '2026-10-22', 'addDays');
assert(isUuid(cryptoIdGenerator.next()), 'Web Crypto randomUUID available in Deno');
assert(
  DomainRuleSchema.safeParse({
    rule_id: 'diagnostic.example.placeholder',
    version: 1,
    description: 'Placeholder rule used only to test the governance schema.',
    inputs: ['porosity'],
    output: 'needs.hydration',
    rationale_source: 'engineering hypothesis — requires domain review',
    validation_status: 'draft',
  }).success,
  'zod (npm: specifier) works under Deno',
);

console.log(
  JSON.stringify({ ok: true, runtime: 'deno', denoVersion: Deno.version.deno, coreVersion: CORE_VERSION }),
);
