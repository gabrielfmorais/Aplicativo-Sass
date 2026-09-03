// Compares the tables the migrations create against what a Supabase project actually exposes.
//
// D-87: the DEV project had ZERO of them. Every migration had only ever run locally and in CI, so
// `pnpm verify` was green, pgTAP was green, and the app still could not load a profile — the one
// thing no test covered was whether the remote database had ever been provisioned.
//
// Read-only: one unauthenticated GET per table against PostgREST. A missing table answers
// `PGRST205` ("not found in the schema cache") whatever the caller's privileges are, so this needs
// no credential beyond the publishable anon key the app already ships with.
//
// Usage (reads apps/mobile/.env.local by default):
//   node scripts/check-remote-schema.mjs
//   node scripts/check-remote-schema.mjs --url <project-url> --key <anon-key>
//
// NOT part of `pnpm verify`: it talks to the network and to a specific project, so it is a
// deliberate check you run when pointing the app at an environment — not a gate on every commit.
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

const env = readEnvFile(join(root, 'apps/mobile/.env.local'));
const url = argOf('url') ?? env.EXPO_PUBLIC_SUPABASE_URL;
const key = argOf('key') ?? env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    '[check-remote-schema] No project to check. Set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
      '[check-remote-schema] in apps/mobile/.env.local, or pass --url and --key.',
  );
  process.exit(2);
}

/** Every table the migrations create, read from the migrations themselves so it cannot drift. */
const expectedTables = () => {
  const dir = join(root, 'supabase/migrations');
  const found = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const m of sql.matchAll(/create table(?:\s+if not exists)?\s+public\.([a-z_]+)/gi)) {
      found.add(m[1]);
    }
  }
  return [...found].sort();
};

const tables = expectedTables();
if (tables.length === 0) {
  console.error('[check-remote-schema] Found no CREATE TABLE in supabase/migrations — refusing to pass.');
  process.exit(2);
}

const missing = [];
const present = [];

for (const table of tables) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: { apikey: key } });
  // 404 + PGRST205 means the schema cache has no such relation. 401/403 means it exists and is
  // (correctly) protected — that is a pass, not a failure.
  if (response.status === 404) {
    const body = await response.text();
    if (body.includes('PGRST205')) {
      missing.push(table);
      continue;
    }
  }
  present.push(table);
}

const host = new URL(url).host;
if (missing.length > 0) {
  console.error(`\n[check-remote-schema] ${missing.length} of ${tables.length} tables missing on ${host}:`);
  for (const table of missing) console.error(`  - public.${table}`);
  console.error(
    '\n[check-remote-schema] The migrations have not been applied to this project.\n' +
      '[check-remote-schema] See docs/runbooks/DEV-DATABASE-PROVISION.md.\n',
  );
  process.exit(1);
}

/**
 * Uma tabela presente não quer dizer atualizada.
 *
 * ⚠️ **SPEC-037 achou o buraco que faltava.** As 18 tabelas estavam lá e o check passava, mas duas
 * colunas de uma migration nova não existiam no DEV — e o app que consulta uma coluna inexistente
 * não degrada: ele **quebra inteiro**, porque a lista de colunas é uma só. Tabela presente respondia
 * "provisionado"; a pergunta certa é "provisionado **até onde**".
 *
 * PostgREST valida a lista de colunas antes de aplicar a RLS, então `42703` ("column does not
 * exist") chega mesmo sem credencial, e `42501` ("no privilege") prova que a coluna existe e está
 * protegida. Os dois códigos separam ausência de proibição, que é exatamente a distinção que um
 * check sem credencial precisa fazer.
 */
const expectedColumns = () => {
  const dir = join(root, 'supabase/migrations');
  const byTable = new Map();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8');
    // Um `alter table` pode acrescentar VÁRIAS colunas separadas por vírgula, e só a primeira vem
    // depois do nome da tabela. Casar statement por statement é o que enxerga as outras.
    for (const stmt of sql.matchAll(/alter table\s+public\.([a-z_]+)([^;]*);/gi)) {
      const [, table, body] = stmt;
      for (const m of body.matchAll(/add column(?:\s+if not exists)?\s+([a-z_]+)/gi)) {
        byTable.set(table, [...(byTable.get(table) ?? []), m[1]]);
      }
    }
  }
  return byTable;
};

const staleColumns = [];
for (const [table, columns] of expectedColumns()) {
  for (const column of columns) {
    const r = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=0`, {
      headers: { apikey: key },
    });
    if (r.status === 400 && (await r.text()).includes('42703')) {
      staleColumns.push(`${table}.${column}`);
    }
  }
}

if (staleColumns.length > 0) {
  console.error(`\n[check-remote-schema] ${staleColumns.length} column(s) missing on ${host}:`);
  for (const c of staleColumns) console.error(`  - public.${c}`);
  console.error(
    '\n[check-remote-schema] As tabelas existem, mas uma migration posterior não foi aplicada.\n' +
      '[check-remote-schema] O app quebra ao selecionar uma coluna que não existe — aplique antes de subir.\n',
  );
  process.exit(1);
}

console.log(
  `[check-remote-schema] OK — all ${present.length} tables present on ${host}, and every added column exists`,
);
