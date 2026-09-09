/**
 * ⚠️ **Uma tabela de rótulos, um dono.**
 *
 * Este projeto já pagou **três vezes** pela mesma forma de defeito: o mesmo vocabulário declarado em
 * duas telas, divergindo na primeira renomeação — `FINISH_TECHNIQUE_LABEL` (SPEC-048),
 * `CATEGORY_LABEL` (SPEC-063) e `FINISH_LABEL` (auditoria `--full` de 2026-09-09). As três só
 * apareceram porque alguém leu os arquivos lado a lado: **nenhum teste via**, porque cada tela era
 * testada contra a própria expectativa, e as duas cópias concordavam **no dia em que foram escritas**.
 *
 * ⛔ O modo de falha é silencioso e é sobre **o mesmo registro dela**: renomear "Pulei dessa vez" numa
 * tela deixa a outra dizendo a palavra antiga sobre o mesmo fato — e nada quebra.
 *
 * É estático porque duplicação **não aparece** em teste de render nem no preview a 390px.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['apps/mobile/src', 'packages/core/src'];
/** `const NOME_LABEL` / `NOME_LABELS`, exportado ou não. */
const DECL = /^\s*(?:export\s+)?const\s+([A-Z][A-Z0-9_]*_LABELS?)\b/gm;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
};

const owners = new Map();
for (const file of ROOTS.flatMap((r) => walk(r))) {
  const source = readFileSync(file, 'utf8');
  for (const [, name] of source.matchAll(DECL)) {
    if (!owners.has(name)) owners.set(name, []);
    owners.get(name).push(file.split(String.fromCharCode(92)).join(String.fromCharCode(47)));
  }
}

const duplicated = [...owners].filter(([, files]) => files.length > 1);
if (duplicated.length > 0) {
  console.error('[check-label-owners] FALHOU — tabela de rótulos com mais de um dono:\n');
  for (const [name, files] of duplicated) {
    console.error(`  ${name}`);
    for (const f of files) console.error(`    · ${f}`);
  }
  console.error(
    '\n  Uma tabela, um dono: exporte a do arquivo que é dono do vocabulário e importe nas outras.',
  );
  console.error('  Duas cópias discordam na primeira renomeação, e nenhum teste vê.');
  process.exit(1);
}

console.log(`[check-label-owners] OK — ${owners.size} tabelas de rótulo, cada uma com um dono só`);
