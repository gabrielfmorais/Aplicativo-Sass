import type { ProfilePort } from '@app/core';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text as RNText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Moment } from '@/design/Moment';
import { Screen } from '@/design/primitives';
import { BottomInsetOwnedByChrome } from '@/design/safe-area';
import { TabBar } from '@/design/TabBar';
import { space } from '@/design/tokens';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';
import { NameScreen } from '@/features/onboarding/NameScreen';

/**
 * ⚠️ **SPEC-060 — a área segura do iPhone, e por que ela não existia.**
 *
 * `react-native-safe-area-context` era dependência do app **desde sempre** e tinha **zero
 * importações**. O `Screen` fixava `paddingTop: 32` contra um topo seguro que num iPhone com Dynamic
 * Island começa em 59pt, e a `TabBar` fixava `paddingBottom: 16` contra um indicador de home de
 * 34pt — o conteúdo ficava debaixo do hardware.
 *
 * **E nada disso apareceria no preview web**, que é o único ambiente em que o produto foi olhado até
 * hoje: o navegador reporta inset 0 (EC2). É por isso que a prova mora aqui, com o inset injetado,
 * e não numa captura a 390px.
 */

/** Um iPhone com Dynamic Island e indicador de home. */
const IPHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, bottom: 34, left: 0, right: 0 },
} as const;

/** Um aparelho sem entalhe — e também o preview web. */
const FLAT = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
} as const;

const onDevice = (metrics: typeof IPHONE | typeof FLAT, node: ReactNode) => (
  <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>
);

/** O estilo resolvido de uma `View` marcada por `testID`, já achatado. */
const styleOf = (element: { props: { style?: unknown } }): Record<string, unknown> => {
  const flat = (value: unknown): Record<string, unknown> =>
    Array.isArray(value)
      ? value.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flat(item) }), {})
      : value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
  return flat(element.props.style);
};

type Rendered = Awaited<ReturnType<typeof render>>;

const contentOf = (tree: Rendered) => styleOf(tree.getByTestId('spec060-content').parent as never);

/**
 * Esta build do RNTL não expõe as queries `UNSAFE_`, então a busca por prop percorre a árvore
 * serializada — que é estável entre versões e já traz `props` resolvidas.
 */
type Node = { props?: Record<string, unknown>; children?: unknown };
const firstWith = (tree: Rendered, has: (props: Record<string, unknown>) => boolean) => {
  const walk = (node: unknown): Node[] => {
    if (!node || typeof node !== 'object') return [];
    const self = node as Node;
    const kids = Array.isArray(self.children) ? self.children : [];
    return [self, ...kids.flatMap(walk)];
  };
  const found = walk(tree.toJSON()).filter((node) => has(node.props ?? {}));
  expect(found.length).toBeGreaterThan(0);
  return found[0] as { props: Record<string, unknown> };
};

describe('SPEC-060 — o inset soma, nunca substitui (BR1)', () => {
  /** AC1 — o topo do iPhone entra somado, não no lugar do espaçamento de design. */
  it('o topo do Screen é o espaçamento de design MAIS o inset', async () => {
    const tree = await render(
      onDevice(
        IPHONE,
        <Screen>
          <View testID="spec060-content" />
        </Screen>,
      ),
    );
    const style = contentOf(tree);
    expect(style.paddingTop).toBe(space.xxl + 59);
    // ⚠️ As duas alternativas erradas, nomeadas: substituir perderia o respiro de leitura, e
    // ignorar poria o título debaixo da Dynamic Island.
    expect(style.paddingTop).not.toBe(59);
    expect(style.paddingTop).not.toBe(space.xxl);
  });

  /** AC5 — num aparelho sem entalhe (e no preview web) nada se move. */
  it('inset zerado devolve exatamente o espaçamento de hoje', async () => {
    const tree = await render(
      onDevice(
        FLAT,
        <Screen>
          <View testID="spec060-content" />
        </Screen>,
      ),
    );
    const style = contentOf(tree);
    expect(style.paddingTop).toBe(space.xxl);
    expect(style.paddingBottom).toBe(space.xl);
  });

  /** AC2 — a barra é a dona do pé, e soma o indicador de home ao respiro de leitura. */
  it('o pé da TabBar é o espaçamento de design MAIS o inset', async () => {
    const tree = await render(onDevice(IPHONE, <TabBar active="today" onChange={jest.fn()} />));
    const bar = styleOf(firstWith(tree, (props) => props.accessibilityRole === 'tablist') as never);
    expect(bar.paddingBottom).toBe(space.lg + 34);
  });
});

describe('SPEC-060 — um só dono do pé por janela (BR2)', () => {
  /**
   * AC3 — ⚠️ **o erro que esta regra evita é somar duas vezes.** Dentro da casca a `TabBar` já
   * afastou o conteúdo do indicador de home; um `Screen` que somasse de novo empurraria a tela 34pt
   * para cima da barra, sem nada na tela explicando o buraco.
   */
  it('dentro da casca, o Screen NÃO soma o inset inferior', async () => {
    const tree = await render(
      onDevice(
        IPHONE,
        <BottomInsetOwnedByChrome>
          <Screen>
            <View testID="spec060-content" />
          </Screen>
        </BottomInsetOwnedByChrome>,
      ),
    );
    expect(contentOf(tree).paddingBottom).toBe(space.xl);
  });

  /** AC4 — fora da casca (login, onboarding, momentos), o rodapé fixo é quem escapa do indicador. */
  it('fora da casca, o rodapé fixo soma o inset inferior', async () => {
    const tree = await render(
      onDevice(
        IPHONE,
        <Screen footer={<RNText testID="spec060-footer">Continuar</RNText>}>
          <View testID="spec060-content" />
        </Screen>,
      ),
    );
    expect(styleOf(tree.getByTestId('spec060-footer').parent as never).paddingBottom).toBe(space.xl + 34);
    // E o corpo do scroll não soma junto: quem toca a borda do aparelho é o rodapé.
    expect(contentOf(tree).paddingBottom).toBe(space.xl);
  });
});

describe('SPEC-060 — o teclado do iPhone tem saída (FR5/FR6)', () => {
  /**
   * AC7 — ⚠️ **o campo do código de 6 dígitos não tinha saída nenhuma no iPhone.** `number-pad` no
   * iOS **não tem tecla de retorno**, e sem isto o teclado cobria "Confirmar código" para sempre.
   * No Android o botão de voltar do sistema resolvia sozinho — daí o defeito ser iPhone-only.
   */
  it('a ScrollView do Screen descarta o teclado por arrasto', async () => {
    const tree = await render(
      onDevice(
        FLAT,
        <Screen>
          <View testID="spec060-content" />
        </Screen>,
      ),
    );
    const scroll = firstWith(tree, (props) => props.keyboardDismissMode !== undefined);
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
  });
});

describe('SPEC-060 — o `style` da tela não apaga o inset do topo', () => {
  /**
   * ⚠️ **Este é o defeito que a auditoria achou, e ele é o mesmo padrão da SPEC de novo.** O `style`
   * que a tela passa é o **último** do array, então redeclarar `paddingTop` ali **vence o frame**.
   * `Moment` e `NameScreen` traziam `paddingTop: space.xxl` — o **mesmo valor** que o `Screen` já
   * aplicava, ou seja, duplicação inofensiva enquanto o topo era uma constante. No instante em que o
   * topo virou *espaçamento + inset*, ela passou a **apagar a Dynamic Island** exatamente nas telas
   * de primeira experiência: o cumprimento pelo nome, a espera e a revelação do cronograma.
   *
   * O mecanismo existia e a tela o contornava em silêncio — a forma de falha que abriu esta SPEC.
   */
  it('as telas que passam `style` ao Screen continuam recebendo o inset', async () => {
    for (const [nome, node] of [
      ['Moment', <Moment key="m" title="Um instante" />],
      [
        'NameScreen',
        <NameScreen
          key="n"
          profile={
            {
              get: async () => null,
              save: async () => undefined,
              saveAvatar: async () => undefined,
            } satisfies ProfilePort
          }
          onDone={jest.fn()}
        />,
      ],
    ] as const) {
      const tree = await render(onDevice(IPHONE, node));
      const content = firstWith(tree, (props) => {
        const s = styleOf({ props } as never);
        return s.paddingHorizontal === space.xl && s.gap === space.xl;
      });
      expect([nome, styleOf(content as never).paddingTop]).toEqual([nome, space.xxl + 59]);
    }
  });

  /**
   * ⚠️ **A exceção é deliberada e fica registrada aqui.** A abertura sangra o hero até a borda de
   * cima — `paddingTop: 0` é decisão de composição (SPEC-018/036), não esquecimento —, e um teste
   * que exigisse inset de toda tela transformaria essa decisão em defeito.
   */
  it('a abertura mantém o hero sangrando até o topo, de propósito', async () => {
    const tree = await render(onDevice(IPHONE, <WelcomeScreen onStart={jest.fn()} />));
    const content = firstWith(tree, (props) => {
      const s = styleOf({ props } as never);
      return s.paddingHorizontal === 0 && s.gap === 0;
    });
    expect(styleOf(content as never).paddingTop).toBe(0);
  });
});

/**
 * ⚠️ **A barreira do AC9 mora em `scripts/check-safe-area.mjs`, não aqui.** O defeito era a
 * **ausência de ligação no app inteiro** — a dependência instalada e importada por ninguém —, e um
 * teste de render mede a tela que ele renderiza, nunca o que ninguém ligou. É invariante estático,
 * então segue o padrão de `check-entitlement-catalog-parity.mjs` e roda no CI.
 */
