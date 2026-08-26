// Ensures supabase/functions/deno.json maps every runtime dependency of packages/core to the
// same version (CORE-RUNTIME-SPIKE.md). Prevents Deno and Node drifting apart silently.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = JSON.parse(readFileSync(join(root, 'packages/core/package.json'), 'utf8'));
const deno = JSON.parse(readFileSync(join(root, 'supabase/functions/deno.json'), 'utf8'));
const lock = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8');

const problems = [];
for (const [name, range] of Object.entries(core.dependencies ?? {})) {
  const mapped = deno.imports?.[name];
  if (!mapped) {
    problems.push(
      `${name} (${range}) is a core dependency but is not mapped in supabase/functions/deno.json`,
    );
    continue;
  }
  const m = /^npm:(.+?)@(.+)$/.exec(mapped);
  if (!m || m[1] !== name) {
    problems.push(`${name}: import map entry "${mapped}" must be "npm:${name}@<exact version>"`);
    continue;
  }
  const pinned = m[2];
  // The exact version pinned for Deno must be the version resolved in pnpm-lock.yaml.
  const inLock = new RegExp(`^\\s{2}${name.replace('/', '\\/')}@${pinned.replace(/\./g, '\\.')}:`, 'm').test(
    lock,
  );
  if (!inLock) problems.push(`${name}@${pinned} (deno.json) is not the version resolved in pnpm-lock.yaml`);
}

if (problems.length) {
  console.error('[check-deno-import-map] FAIL');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('[check-deno-import-map] OK — deno.json mirrors packages/core dependencies');
