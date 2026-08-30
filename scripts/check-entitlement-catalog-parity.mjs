// SPEC-010 AC6: the core catalogue and the SQL that decides entitlements server-side must name the
// same subscription statuses and the same capability codes. Same guard shape as
// check-deno-import-map.mjs — a fast, static fail on drift; the pgTAP truth table
// (supabase/tests/security/070_spec010_subscriptions.sql) is the behavioural counterpart in CI.
//
// Change catalog.ts or the has_entitlement/get_my_entitlements SQL and the other must move in the
// same PR, or this fails.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ts = readFileSync(join(root, 'packages/core/src/subscription/entitlements/catalog.ts'), 'utf8');
// The migration that defines the tables and the two entitlement functions (SPEC-010 PR-B).
const sql = readFileSync(join(root, 'supabase/migrations/20260902000000_subscriptions.sql'), 'utf8');

const quoted = (s) => [...s.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const norm = (a) => [...a].sort().join(',');
const eq = (a, b) => norm(a) === norm(b);

function tsArray(name) {
  const m = new RegExp(`export const ${name}\\b[^[]*\\[([\\s\\S]*?)]`).exec(ts);
  if (!m) throw new Error(`catalog.ts: could not find "export const ${name} = [ ... ]"`);
  return quoted(m[1]);
}
const sqlLists = (re) => [...sql.matchAll(re)].map((m) => quoted(m[1]));

const STATUSES = tsArray('SUBSCRIPTION_STATUSES');
const GRANTING = tsArray('GRANTING_SUBSCRIPTION_STATUSES');
const CODES = tsArray('ENTITLEMENT_CODES');

const statusLists = sqlLists(/status\s+in\s*\(([^)]*)\)/gi); // CHECK enum + has_entitlement granting set
const codeLists = [
  ...sqlLists(/p_code\s+in\s*\(([^)]*)\)/gi), // has_entitlement membership
  ...sqlLists(/unnest\s*\(\s*array\[([^\]]*)]/gi), // get_my_entitlements enumeration
];

const problems = [];

// Every `status in (...)` in the SQL is either the full enum or the granting subset — nothing else.
if (!statusLists.some((l) => eq(l, STATUSES)))
  problems.push(`no SQL "status in (...)" matches SUBSCRIPTION_STATUSES [${STATUSES}]`);
if (!statusLists.some((l) => eq(l, GRANTING)))
  problems.push(`no SQL "status in (...)" matches GRANTING_SUBSCRIPTION_STATUSES [${GRANTING}]`);
for (const l of statusLists)
  if (!eq(l, STATUSES) && !eq(l, GRANTING))
    problems.push(`SQL "status in (${l})" is neither the full enum nor the granting subset`);

// Every code list must be exactly the catalogue.
if (!codeLists.length) problems.push('no entitlement-code list found in the SQL');
for (const l of codeLists)
  if (!eq(l, CODES)) problems.push(`SQL code list [${l}] does not match ENTITLEMENT_CODES [${CODES}]`);

if (problems.length) {
  console.error('[check-entitlement-catalog-parity] FAIL — catalog.ts and the SQL disagree (SPEC-010 AC6):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('[check-entitlement-catalog-parity] OK — catalog.ts mirrors has_entitlement/get_my_entitlements');
