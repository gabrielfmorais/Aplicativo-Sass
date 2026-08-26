// Verifies that every repository path referenced in CLAUDE.md exists (SPEC-000 AC10).
// Paths are recognised as backtick-quoted tokens that look like relative repo paths.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8');

const candidates = new Set();
for (const m of text.matchAll(/`([^`\n]+)`/g)) {
  const token = m[1].trim();
  // Only tokens that look like repo paths: contain a slash or a known extension and no spaces/globs.
  if (/[\s*<>{}()|]/.test(token)) continue;
  if (!/^[A-Za-z0-9_.@/-]+$/.test(token)) continue;
  if (!(token.includes('/') || /\.(md|json|ts|tsx|mjs|cjs|js|yaml|yml|toml|sql|txt)$/.test(token))) continue;
  candidates.add(token.replace(/^\.\//, ''));
}

// Bare file names such as `DOMAIN-MAP.md` are resolved relative to the last directory mentioned before them.
const missing = [];
const knownDirs = [
  '',
  'docs/architecture',
  'docs/security',
  'docs/specs',
  'docs/adr',
  'docs/product',
  'docs/runbooks',
  '.github',
  'apps/mobile',
  'supabase',
];
for (const rel of candidates) {
  // Skip tokens that are clearly not files in this repo (package names, scoped imports).
  if (rel.startsWith('@') || rel.startsWith('node:')) continue;
  // Git branch name patterns (CLAUDE.md §6), not files.
  if (/^(feature|fix|chore|foundation)[/]/.test(rel)) continue;
  // Paths with <placeholders> or version globs are documentation patterns, not files.
  if (rel.includes('<') || rel.includes('version')) continue;
  const found = knownDirs.some((d) => existsSync(join(root, d, rel)));
  if (!found) missing.push(rel);
}

if (missing.length) {
  console.error('[check-docs-links] Paths referenced in CLAUDE.md that do not exist:');
  for (const m of missing) console.error('  - ' + m);
  process.exit(1);
}
console.log(`[check-docs-links] OK — ${candidates.size} path references in CLAUDE.md resolve`);
