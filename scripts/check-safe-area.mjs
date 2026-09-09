// SPEC-060 AC9 — a barreira contra o defeito exato que abriu a SPEC.
//
// ⚠️ `react-native-safe-area-context` era **dependência do app desde sempre e não era importada por
// ninguém** — zero consumidores, medido. Enquanto isso o comentário da `TabBar` afirmava por
// escrito: *"a área segura de verdade é do `Screen`, que já a trata"*. O `Screen` não tratava. No
// iPhone o conteúdo ficava debaixo da Dynamic Island e a barra de abas debaixo do indicador de home,
// e **nada nesse defeito é visível no preview web**, que reporta inset 0 — o único ambiente em que o
// produto foi olhado em 59 SPECs.
//
// É a mesma forma de falha que a SPEC-041 mediu na `Section` que declarava `shelf` e não repassava, e
// que a SPEC-053 mediu no `oilDueOn` que o app nunca passava: a peça existe, a ligação não, e a prosa
// diz que sim. Um teste de render não pega isso — ele mede a tela que **é** renderizada, não a
// ausência de ligação no app inteiro. Por isso a barreira é estática, como
// `check-entitlement-catalog-parity.mjs`.
//
// Falha se: (a) ninguém mais consome área segura; (b) o consumo escapa do design system; (c) a raiz
// deixa de montar o provider.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'apps/mobile/src');
const PKG = 'react-native-safe-area-context';

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(entry) ? [full] : [];
  });

const files = walk(src);
const consumers = files.filter((f) => readFileSync(f, 'utf8').includes(PKG));
const problems = [];

if (consumers.length === 0)
  problems.push(`nenhum arquivo em apps/mobile/src importa "${PKG}" — o app voltou a não ter área segura`);

// G5 — a mecânica é UMA só, no design system. Espalhada por tela, uma tela nova nasceria sem ela e
// ninguém veria: é exatamente assim que a ligação se perde.
for (const f of consumers) {
  const rel = relative(root, f);
  if (!rel.split(sep).includes('design')) problems.push(`"${PKG}" consumido fora do design system: ${rel}`);
}

// FR1 — sem o provider na raiz, `useSafeAreaInsets` lança na primeira tela.
const layout = readFileSync(join(src, 'app/_layout.tsx'), 'utf8');
if (!layout.includes('SafeAreaRoot'))
  problems.push('apps/mobile/src/app/_layout.tsx não monta o SafeAreaRoot (SPEC-060 FR1)');

// FR4/BR2 — a casca autenticada declara que a TabBar é a dona do pé; sem isso o Screen somaria o
// inset de novo, empurrando toda tela 34pt acima da barra.
const shell = readFileSync(join(src, 'app/index.tsx'), 'utf8');
if (!shell.includes('BottomInsetOwnedByChrome'))
  problems.push('apps/mobile/src/app/index.tsx não declara o dono do pé (SPEC-060 FR4/BR2)');

if (problems.length) {
  console.error('check-safe-area: FAIL\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}

console.log(`check-safe-area: ok (${consumers.length} consumidor(es) no design system)`);
