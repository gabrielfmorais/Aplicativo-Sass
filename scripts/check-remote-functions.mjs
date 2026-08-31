// Compares the Edge Functions this repository ships against what a Supabase project actually serves.
//
// The sibling of `check-remote-schema.mjs`, and it exists for the same reason one layer up. D-87 was
// "the migrations never ran against the remote project"; D-90 was "the functions never deployed to
// it". Both were invisible to `pnpm verify`, to pgTAP and to `deno test`, because every one of those
// checks the repository — none of them asks whether the environment the app is pointed at has the
// thing the app calls. The DEV database was provisioned and every table was present, and creating a
// plan still failed, because `generate-plan` was not there. `create_plan_tx` is service_role only
// (SPEC-004 §12/G2/P10), so without the function deployed there is no path to a plan at all — and
// the app said "Não foi possível criar seu cronograma. Tente novamente."
//
// Read-only and credential-free: one unauthenticated POST per function. The edge gateway answers
// `404 NOT_FOUND` for a function it does not host, whatever the caller's privileges are. Anything
// else — 401 for a missing JWT, 400 for a body the handler rejected — means the function is there
// and answered, which is exactly what this asks. Same conservative shape as the PGRST205 probe:
// only an explicit "not found" counts as missing.
//
// Usage (reads apps/mobile/.env.local by default):
//   node scripts/check-remote-functions.mjs
//   node scripts/check-remote-functions.mjs --url <project-url>
//   node scripts/check-remote-functions.mjs --ref <project-ref>
//   node scripts/check-remote-functions.mjs --list        # just the names, one per line
//
// **No credential is required.** The anon key is sent when one is available, but the 404 probe does
// not depend on it — which is what lets CI run this straight after a deploy without the repository
// having to learn a new secret. `--list` exists so the deploy workflow and this check read the same
// list from the same place: two implementations of "which functions exist" would drift, and the
// first sign of the drift would be a deploy that silently skips one.
//
// NOT part of `pnpm verify`, for the same reason as its sibling: it talks to the network and to one
// specific project. It is what you run when you point the app at an environment.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const readEnvFile = (path) => {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const at = line.indexOf('=');
        return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
      }),
  );
};

const argOf = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? undefined : process.argv[at + 1];
};

/**
 * Every function this repo deploys, read from the directory itself so it cannot drift from what is
 * on disk. Names starting with `_` are scaffolding, not deployables (`_spike`).
 */
const expectedFunctions = () =>
  readdirSync(join(root, 'supabase/functions'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort();

const functions = expectedFunctions();
if (functions.length === 0) {
  console.error(
    '[check-remote-functions] Found no function directory in supabase/functions — refusing to pass.',
  );
  process.exit(2);
}

// `--list` answers only "what should exist", with no network and no environment. The deploy
// workflow consumes exactly this, so what gets deployed and what gets checked cannot disagree.
if (process.argv.includes('--list')) {
  for (const name of functions) console.log(name);
  process.exit(0);
}

const env = readEnvFile(join(root, 'apps/mobile/.env.local'));
const ref = argOf('ref');
const url = argOf('url') ?? (ref ? `https://${ref}.supabase.co` : env.EXPO_PUBLIC_SUPABASE_URL);
// Optional on purpose: a function the project does not host answers 404 to *any* caller, so this
// probe needs no privilege. Sent when present only because a real client would send it.
const key = argOf('key') ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url) {
  console.error(
    '[check-remote-functions] No project to check. Set EXPO_PUBLIC_SUPABASE_URL in\n' +
      '[check-remote-functions] apps/mobile/.env.local, or pass --url / --ref.',
  );
  process.exit(2);
}

const missing = [];
const present = [];

for (const name of functions) {
  let response;
  try {
    response = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { apikey: key } : {}) },
      body: '{}',
    });
  } catch (error) {
    // A network failure is not evidence that the function is absent, and saying so would be a lie
    // in the one direction that matters. Refuse to answer instead of answering wrongly.
    console.error(`\n[check-remote-functions] Could not reach ${url}: ${error.message}\n`);
    process.exit(2);
  }
  if (response.status === 404) {
    const body = await response.text();
    if (body.includes('NOT_FOUND')) {
      missing.push(name);
      continue;
    }
  }
  present.push(name);
}

const host = new URL(url).host;
if (missing.length > 0) {
  console.error(
    `\n[check-remote-functions] ${missing.length} of ${functions.length} functions not deployed on ${host}:`,
  );
  for (const name of missing) console.error(`  - ${name}`);
  console.error(
    '\n[check-remote-functions] The app calls these; the project does not host them.\n' +
      '[check-remote-functions] See docs/runbooks/DEV-EDGE-FUNCTIONS-DEPLOY.md.\n',
  );
  process.exit(1);
}

console.log(`[check-remote-functions] OK — all ${present.length} functions deployed on ${host}`);
