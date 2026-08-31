// Makes an Edge Function's dependency graph self-contained, so it can actually be deployed.
//
// **The problem this exists for (D-91).** SPEC-000 §20 / D-49 chose Strategy A: Edge Functions
// consume `packages/core` straight from the workspace sources, with no build step, mapped in
// `supabase/functions/deno.json` as `@app/core → ../../packages/core/src/index.ts`. That works
// everywhere it had ever been exercised — `deno check`, `deno test`, `deno lint`, the core smoke —
// because all of those run on the repository. It does not survive a deploy: the bundler only sees
// what lives under `supabase/functions`, and `../../packages/core` is outside it. The first real
// deploy failed with `Module not found ".../packages/core/src/index.ts"`, three PRs into a day
// whose whole lesson was that green checks say nothing about environments.
//
// **What this does.** Copies `packages/core/src` to `supabase/functions/_core/` and writes an
// import map that points `@app/core` at that copy, keeping every other mapping from `deno.json`
// byte for byte. Both outputs are derived, gitignored and disposable.
//
// **Why derived rather than committed.** A vendored copy in git is a second source of truth that
// ages in silence — exactly the failure mode the generated DEV bootstrap SQL (#53) exists to avoid,
// and the one D-87 already charged for once. `deno.json` stays the only place the mapping is
// written by hand; this file only re-expresses it against a location the bundler can reach, and
// `check-deno-import-map.mjs` keeps guarding the real one.
//
// `_core` is underscore-prefixed so neither the Supabase CLI nor `check-remote-functions.mjs`
// mistakes it for a deployable function.
//
// Usage:
//   node scripts/stage-edge-bundle.mjs          # stage
//   node scripts/stage-edge-bundle.mjs --clean  # remove what it staged
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = join(root, 'supabase/functions');
const vendorDir = join(functionsDir, '_core');
const importMapPath = join(functionsDir, 'import_map.deploy.json');

if (process.argv.includes('--clean')) {
  rmSync(vendorDir, { recursive: true, force: true });
  rmSync(importMapPath, { force: true });
  console.log('[stage-edge-bundle] cleaned');
  process.exit(0);
}

const coreSrc = join(root, 'packages/core/src');
if (!existsSync(join(coreSrc, 'index.ts'))) {
  console.error(`[stage-edge-bundle] packages/core/src/index.ts not found — refusing to stage.`);
  process.exit(2);
}

const denoConfig = JSON.parse(readFileSync(join(functionsDir, 'deno.json'), 'utf8'));
const imports = denoConfig.imports ?? {};
if (!imports['@app/core'] || !imports['@app/core/']) {
  console.error('[stage-edge-bundle] deno.json no longer maps @app/core — refusing to guess.');
  process.exit(2);
}

// Start over every time: a stale file left from an earlier core is worse than no file at all.
rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });
// Sources only. Tests do not belong in a deployed bundle, and `.test.ts` files import test helpers
// the runtime has no reason to carry.
cpSync(coreSrc, vendorDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.test.ts') && !src.includes('__tests__'),
});

// Every other mapping is carried over untouched — zod and supabase-js still resolve exactly as the
// checked-in config says, so the deployed graph differs from the local one only in where core lives.
const deployImports = { ...imports, '@app/core': './_core/index.ts', '@app/core/': './_core/' };
writeFileSync(importMapPath, `${JSON.stringify({ imports: deployImports }, null, 2)}\n`);

console.log(`[stage-edge-bundle] staged supabase/functions/_core and import_map.deploy.json`);
