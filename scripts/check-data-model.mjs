// Toda tabela que as migrations criam tem de estar descrita no DATA-MODEL.
//
// ⚠️ **Esta barreira nasceu de uma medição, não de zelo.** A auditoria `--full` de 2026-09-07
// encontrou **sete tabelas** vivas no banco e ausentes do `DATA-MODEL.md` — `plan_pauses`,
// `wash_day_finish`, `checkin_marks`, `oil_routines`, `oil_events`, `oil_routine_times` e
// `catalog_products`. Seis SPECs diferentes, de sessões diferentes, escreveram *"Ver
// DATA-MODEL.md"* na própria seção de Data Model Impact — e **nenhuma delas o atualizou**.
//
// Não é descuido de uma pessoa: é uma lacuna de processo que só aparece quando alguém conta. O
// `DATA-MODEL` é o arquivo que o ENGINEERING-WORKFLOW manda ler antes de mexer no banco; um que
// esteja sete tabelas atrás manda o leitor para uma foto do passado — que é exatamente o modo de
// falha que o §0 do CLAUDE.md existe para impedir ("estado medido vence documentação histórica").
//
// Barato por construção: lê os `create table public.X` das migrations e procura o nome no
// documento. Não valida colunas — validar coluna a coluna transformaria cada `alter table` numa
// briga com o texto, e o que se perde quando a documentação some é a **tabela inteira**.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrations = join(root, 'supabase/migrations');
const dataModel = join(root, 'docs/architecture/DATA-MODEL.md');

const tables = new Set();
for (const file of readdirSync(migrations).filter((f) => f.endsWith('.sql'))) {
  const sql = readFileSync(join(migrations, file), 'utf8');
  for (const m of sql.matchAll(/create table(?:\s+if not exists)?\s+public\.([a-z_]+)/gi)) {
    tables.add(m[1]);
  }
}

if (tables.size === 0) {
  console.error(
    '[check-data-model] Nenhum CREATE TABLE encontrado em supabase/migrations — recusando passar.',
  );
  process.exit(2);
}

const doc = readFileSync(dataModel, 'utf8');
const missing = [...tables].filter((t) => !doc.includes(t)).sort();

if (missing.length > 0) {
  console.error(
    `[check-data-model] ${missing.length} tabela(s) existem nas migrations e NÃO estão no DATA-MODEL:`,
  );
  for (const t of missing) console.error(`  · public.${t}`);
  console.error(
    '\nO DATA-MODEL é onde toda SPEC manda o leitor procurar o impacto no banco. Uma tabela que ' +
      'existe e não está lá manda o leitor para uma foto do passado.',
  );
  process.exit(1);
}

console.log(`[check-data-model] OK — as ${tables.size} tabelas das migrations estão descritas no DATA-MODEL`);
