import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { HIT_TARGET_MIN } from '@/design/tokens';
import { DataSourcesScreen } from '@/features/account/DataSourcesScreen';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import { CareGuideLibrary } from '@/features/care/CareGuideLibrary';

/**
 * ⚠️ **SPEC-060 fatia 2 — o piso de 44pt do iPhone, medido em vez de assumido.**
 *
 * A auditoria iPhone-first varreu os onze `Pressable` do app e achou **um só** lugar abaixo do piso:
 * os três links de atribuição de `DataSourcesScreen`, com `paddingVertical: 4` sobre uma linha de
 * 22 — **30pt**. Todo o resto já estava em 44 ou 48, porque vem das primitivas; estes escapavam por
 * serem `Pressable` próprio.
 *
 * ⚠️ **E são links de conformidade**, não decoração: ODbL e CC BY-SA **exigem** a atribuição
 * (SPEC-057). Difícil de acertar com o polegar é o pior lugar para economizar 14pt.
 *
 * O teste mede o alvo **resolvido**, não a intenção — é a única forma de ele valer para a próxima
 * tela que alguém escrever com um `Pressable` cru.
 */

const INTERACTIVE = ['button', 'link', 'tab', 'radio', 'checkbox', 'switch'];

const flat = (v: unknown): Record<string, unknown> =>
  Array.isArray(v)
    ? v.reduce<Record<string, unknown>>((a, i) => ({ ...a, ...flat(i) }), {})
    : v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : {};

type Node = { props?: Record<string, unknown>; children?: unknown };
const walk = (n: unknown): Node[] => {
  if (!n || typeof n !== 'object') return [];
  const self = n as Node;
  const kids = Array.isArray(self.children) ? self.children : [];
  return [self, ...kids.flatMap(walk)];
};

/**
 * As telas que renderizam sem porta nem estado de servidor. Não é o app inteiro — é o conjunto que
 * um teste consegue montar honestamente, e é onde o defeito estava.
 */
const SCREENS: readonly [string, ReactElement][] = [
  ['Fontes de dados', <DataSourcesScreen key="d" onBack={jest.fn()} />],
  ['Abertura', <WelcomeScreen key="w" onStart={jest.fn()} />],
  ['Como fazer cada cuidado', <CareGuideLibrary key="c" />],
];

describe('SPEC-060 fatia 2 — nenhum alvo abaixo do piso do iOS', () => {
  it.each(SCREENS)('%s: todo controle mede ao menos 44pt', async (nome, node) => {
    const tree = await render(node);
    const pequenos: string[] = [];

    for (const el of walk(tree.toJSON())) {
      const props = el.props ?? {};
      const role = props.accessibilityRole;
      if (typeof role !== 'string' || !INTERACTIVE.includes(role)) continue;

      const style = flat(props.style);
      const altura = (style.minHeight ?? style.height) as number | undefined;
      // `hitSlop` estende a área tocável para além do desenho, e é uma resposta válida ao piso.
      if (props.hitSlop !== undefined) continue;
      if (altura === undefined || altura < HIT_TARGET_MIN) {
        pequenos.push(
          `${role} "${String(props.accessibilityLabel ?? '').slice(0, 40)}" → ${altura ?? 'sem altura'}`,
        );
      }
    }

    expect([nome, pequenos]).toEqual([nome, []]);
  });
});
