import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(repo, 'supabase/migrations');
// Fora do repositório por padrão: o bundle é derivado e descartável, e versioná-lo criaria uma
// segunda fonte de verdade que envelhece em silêncio — o problema que D-87 já custou uma tarde.
const out = process.argv[2] ?? join(tmpdir(), 'hair-care-bootstrap-dev.sql');

// Timestamp-prefixed filenames sort into the canonical apply order, which is also a valid
// topological order: every `references public.<table>` in a file points at a table created in an
// earlier one (verified before generating this).
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const header = `-- =====================================================================
-- BOOTSTRAP DEV — hair-care-dev (ayecidupmxmirwfzwtea)
-- Gerado em ${new Date().toISOString()} a partir de supabase/migrations.
--
-- NÃO É UM ARQUIVO DO REPOSITÓRIO. É a concatenação literal das ${files.length} migrations,
-- na ordem canônica, sem uma linha inventada ou alterada. As migrations continuam
-- sendo a fonte da verdade; isto é só o transporte para o SQL Editor.
--
-- Tudo roda numa única transação: ou o banco fica exatamente com o schema das
-- migrations, ou fica exatamente como estava. Nenhuma migration usa
-- CREATE INDEX CONCURRENTLY, então a transação é segura.
--
-- NÃO inclui supabase/seed/ (helpers de teste e allowlists do pgTAP são
-- estritamente locais e não têm o que fazer num projeto remoto).
--
-- DEPOIS DE RODAR: a migration history remota fica VAZIA enquanto o schema já
-- existe. Antes do próximo \`db push\`, reconcilie com o mecanismo oficial ou o
-- CLI tentará reaplicar tudo. Ver docs/runbooks/DEV-DATABASE-PROVISION.md §4.
-- =====================================================================

begin;
`;

const body = files
  .map((f) => {
    const sql = readFileSync(join(dir, f), 'utf8').trimEnd();
    return `\n\n-- ==================================================================\n-- ${f}\n-- ==================================================================\n${sql}`;
  })
  .join('\n');

const footer = `\n\ncommit;\n\n-- Conferência rápida (rode depois do commit, numa query separada):\n--   select table_name from information_schema.tables\n--    where table_schema = 'public' order by table_name;\n-- Esperado: 10 tabelas.\n`;

writeFileSync(out, header + body + footer);
console.log(`ok — ${files.length} migrations, ${(header + body + footer).split('\n').length} linhas`);
