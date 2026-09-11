#!/usr/bin/env node
/**
 * SPEC-072 FR4 — **o estado de acessibilidade tem de chegar à plataforma.**
 *
 * `accessibilityState` é a API **legada** do React Native. No iOS e no Android ela funciona; no
 * `react-native-web` 0.21 ela é **descartada**, e o atributo nunca chega ao DOM. A SPEC-051 mediu
 * isso ao vivo — `aria-checked` voltava nulo na página inteira, inclusive nos chips já validados —
 * e o custo registrado foi grande: **a 390px o estado de um controle deixou de ser aferível por
 * ARIA**, e a validação teve de inferir seleção pela cor.
 *
 * Como o preview web é o ambiente de validação do projeto (D-80/D-90), isso não é um detalhe de
 * acessibilidade: é a **perda do instrumento** que prova acessibilidade.
 *
 * A regra, portanto: fora do design system, `accessibilityState` é sempre defeito. Quem precisa
 * declarar estado usa `aria-*` (o RN 0.86 funde `aria-X ?? accessibilityState?.X`, então o nativo
 * não muda); quem usa o `Button` do design system passa `a11y={{ expanded, busy }}`, e a primitiva
 * traduz — a tradução tem **um** lugar.
 *
 * ⚠️ **É um check ESTÁTICO porque a ausência de um atributo não aparece em teste de render nem no
 * olho a 390px.** Foi exatamente assim que o defeito atravessou nove arquivos sem ninguém notar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = 'apps/mobile/src';
/** A única pasta autorizada: é onde a tradução para `aria-*` acontece. */
const DESIGN = join('apps', 'mobile', 'src', 'design');

const arquivos = [];
const varrer = (dir) => {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) varrer(caminho);
    else if (/\.tsx?$/.test(nome)) arquivos.push(caminho);
  }
};
varrer(RAIZ);

const infratores = [];
for (const caminho of arquivos) {
  if (caminho.startsWith(DESIGN)) continue;
  const linhas = readFileSync(caminho, 'utf8').split(/\r?\n/);
  linhas.forEach((linha, i) => {
    // Só a PROP conta: `accessibilityState={...}`. Menções em comentário são registro, não código.
    if (/accessibilityState\s*=/.test(linha)) {
      infratores.push(`${relative('.', caminho).replace(/\\/g, '/')}:${i + 1}`);
    }
  });
}

if (infratores.length > 0) {
  console.error('[check-a11y-state] `accessibilityState` fora do design system:');
  for (const onde of infratores) console.error(`  - ${onde}`);
  console.error('');
  console.error('  O `react-native-web` descarta essa prop: o estado não chega ao DOM e deixa de ser');
  console.error('  aferível a 390px (SPEC-051 OQ4 / SPEC-072). Use `aria-checked`, `aria-selected`,');
  console.error('  `aria-expanded`, `aria-disabled` ou `aria-busy` — o RN 0.86 os funde no mesmo');
  console.error('  estado nativo. Com o `Button` do design system, use `a11y={{ expanded, busy }}`.');
  process.exit(1);
}

console.log(
  `[check-a11y-state] OK — ${arquivos.length} arquivos, nenhum \`accessibilityState\` fora do design system`,
);
