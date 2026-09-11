#!/usr/bin/env node
/**
 * SPEC-072 FR4 — **o estado de acessibilidade tem de chegar à plataforma.**
 *
 * Algumas props de acessibilidade do React Native são **legadas**: no iOS e no Android elas
 * funcionam, mas o `react-native-web` 0.21 **as descarta**, e o atributo nunca chega ao DOM. A
 * SPEC-051 mediu isso ao vivo — `aria-checked` voltava nulo na página inteira, inclusive nos chips
 * já validados — e o custo registrado foi grande: **a 390px o estado de um controle deixou de ser
 * aferível por ARIA**, e a validação teve de inferir seleção pela cor.
 *
 * Como o preview web é o ambiente de validação do projeto (D-80/D-90), isso não é um detalhe de
 * acessibilidade: é a **perda do instrumento** que prova acessibilidade.
 *
 * A regra, portanto: fora do design system, a prop legada é sempre defeito. Quem precisa declarar
 * estado usa `aria-*` (o RN 0.86 funde `aria-X ?? accessibilityState?.X`, então o nativo não muda);
 * quem usa o `Button` do design system passa `a11y={{ expanded, busy }}`, e a primitiva traduz — a
 * tradução tem **um** lugar.
 *
 * ⚠️ **É um check ESTÁTICO porque a ausência de um atributo não aparece em teste de render nem no
 * olho a 390px.** Foi exatamente assim que o defeito atravessou nove arquivos sem ninguém notar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = 'apps/mobile/src';
/** A única pasta autorizada: é onde a tradução para `aria-*` acontece. */
const DESIGN = join('apps', 'mobile', 'src', 'design');

/**
 * As props que o `react-native-web` **descarta** — medido em `createDOMProps`, não assumido. Cada
 * uma tem um `aria-*` equivalente que o RN funde no mesmo estado nativo, então a troca não muda nada
 * no iPhone e devolve o atributo no DOM.
 *
 * ⚠️ `accessibilityLabel`, `accessibilityRole`, `accessibilityLiveRegion` e `accessibilityValue`
 * **continuam sendo tratados** pelo RNW, e por isso **não** estão aqui — proibi-los seria churn.
 *
 * ⚠️ `accessibilityHint` também é descartado e **não** entra na lista: não existe `aria-*`
 * equivalente, então não há para onde migrar. É diferença de plataforma, não defeito nosso.
 */
const LEGADOS = ['accessibilityState', 'accessibilityElementsHidden', 'importantForAccessibility'];

const arquivos = [];
const varrer = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho);
    else if (/\.tsx?$/.test(nome)) arquivos.push(caminho);
  }
};
varrer(RAIZ);

/**
 * Menção em PROSA é registro, não código — e neste repositório toda menção em comentário vem entre
 * crases, porque é o estilo da casa. Tirar os trechos entre crases antes de procurar é o que separa
 * *"o `accessibilityState` legado é descartado"* (explicação, e das boas) de uma prop de verdade.
 *
 * ⚠️ **A primeira versão olhava só o começo da linha** (`*`, `//`, `/*`) e reprovou dois comentários
 * JSX cujas linhas de continuação são texto indentado, sem asterisco. Medido, não suposto.
 */
const semProsa = (linha) => linha.replace(/`[^`]*`/g, '');

const infratores = [];
for (const caminho of arquivos) {
  if (caminho.startsWith(DESIGN)) continue;
  readFileSync(caminho, 'utf8')
    .split(/\r?\n/)
    .forEach((linha, i) => {
      const codigo = semProsa(linha);
      for (const legado of LEGADOS) {
        if (new RegExp(`\\b${legado}\\b`).test(codigo)) {
          infratores.push(`${relative('.', caminho).replace(/\\/g, '/')}:${i + 1} (${legado})`);
        }
      }
    });
}

if (infratores.length > 0) {
  console.error('[check-a11y-state] prop de acessibilidade legada fora do design system:');
  for (const onde of infratores) console.error(`  - ${onde}`);
  console.error('');
  console.error('  O `react-native-web` descarta essas props: o estado não chega ao DOM e deixa de');
  console.error('  ser aferível a 390px (SPEC-051 OQ4 / SPEC-072). Use `aria-checked`,');
  console.error('  `aria-selected`, `aria-expanded`, `aria-disabled`, `aria-busy` ou `aria-hidden` —');
  console.error('  o RN 0.86 os funde no mesmo estado nativo, e `aria-hidden` cobre as DUAS metades');
  console.error('  (iOS e Android). Com o `Button` do design system, use `a11y={{ expanded, busy }}`.');
  process.exit(1);
}

console.log(
  `[check-a11y-state] OK — ${arquivos.length} arquivos, nenhuma prop de acessibilidade legada fora do design system`,
);
