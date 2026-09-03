// O prefixo numérico de uma migration é a CHAVE PRIMÁRIA de `supabase_migrations.schema_migrations`.
//
// ⚠️ Dois arquivos com o mesmo número não são um detalhe de nomenclatura: o segundo falha com
// `23505 duplicate key value violates unique constraint "schema_migrations_pkey"`, e a falha
// acontece **no meio** de um `db reset` — depois de aplicar parte do schema. Aconteceu de verdade
// (SPEC-037 colidiu com `plan_preferences`), e o único aviso foi o CI, depois de subir o Postgres,
// baixar a imagem e gastar um minuto. Aqui custa milissegundos.
//
// Também confere a forma do nome, porque um arquivo fora do padrão não é ordenado como se espera —
// e a ordem das migrations é o que faz uma depender da anterior.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase/migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql'));

const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;
const malformed = files.filter((f) => !NAME.test(f));

const byVersion = new Map();
for (const file of files) {
  const version = NAME.exec(file)?.[1];
  if (!version) continue;
  byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
}
const duplicated = [...byVersion.entries()].filter(([, group]) => group.length > 1);

if (malformed.length > 0 || duplicated.length > 0) {
  for (const file of malformed) {
    console.error(`[check-migration-versions] nome fora do padrão <14 dígitos>_<snake_case>.sql: ${file}`);
  }
  for (const [version, group] of duplicated) {
    console.error(`[check-migration-versions] versão ${version} usada por ${group.length} arquivos:`);
    for (const file of group) console.error(`  - ${file}`);
  }
  console.error(
    '\n[check-migration-versions] A versão é a chave primária de schema_migrations: duas iguais\n' +
      '[check-migration-versions] fazem o reset falhar no meio da aplicação. Renomeie para um número livre.\n',
  );
  process.exit(1);
}

console.log(`[check-migration-versions] OK — ${files.length} migrations, versões únicas e bem formadas`);
