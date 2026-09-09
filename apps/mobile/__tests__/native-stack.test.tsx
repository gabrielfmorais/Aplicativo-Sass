import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { NativeStack } from '@/design/NativeStack';
import { NativeStack as WebNativeStack } from '@/design/NativeStack.web';

/**
 * ⚠️ **SPEC-061 / ADR-012 — o gesto de voltar do iPhone, e por que ele não existia.**
 *
 * O app navegava por **estado**: um enum de oito destinos num `useState`, e o `expo-router` montado
 * com **uma rota só**. Do ponto de vista do iOS o app inteiro era uma tela — **não havia o que
 * reconhecer** quando o polegar arrastava da borda. E um app que não volta ao arrasto não lê como
 * *"sem esse gesto"*: lê como **travado**.
 *
 * ⛔ Não há meio-termo: o gesto do iOS é interrompível e segue o dedo. Ou é pilha nativa, ou é
 * imitação. Estes testes provam a fiação da pilha; **a existência do gesto só se prova num aparelho**
 * (gate G7), como já vale para notificações e para a folha de compartilhamento.
 */

type Node = { type?: unknown; props?: Record<string, unknown>; children?: unknown };
const walk = (n: unknown): Node[] => {
  if (!n || typeof n !== 'object') return [];
  const self = n as Node;
  const kids = Array.isArray(self.children) ? self.children : [];
  return [self, ...kids.flatMap(walk)];
};

const layers = [
  { id: 'root', content: <Text>aba</Text> },
  { id: 'you', content: <Text>conta</Text> },
  { id: 'dataSources', content: <Text>fontes</Text> },
];

/** Os nós de tela, na ordem — cada `ScreenStackItem` vira um `Screen` com `screenId`. */
const screensOf = (tree: ReturnType<typeof render> extends Promise<infer R> ? R : never) =>
  walk(tree.toJSON()).filter((n) => (n.props ?? {}).screenId !== undefined);

describe('SPEC-061 — a raiz não se fecha, as de cima sim', () => {
  /**
   * ⚠️ **Sem isto, arrastar na aba Hoje tentaria desempilhar o app inteiro** — e no Android o botão
   * físico sairia do app a partir de qualquer aba, que é pior do que não ter gesto nenhum.
   */
  it('só as camadas acima da raiz têm gesto e botão físico', async () => {
    const tree = await render(<NativeStack layers={layers} onDismiss={jest.fn()} />);
    const telas = screensOf(tree);

    expect(telas.map((t) => t.props?.screenId)).toEqual(['root', 'you', 'dataSources']);
    expect(telas.map((t) => t.props?.gestureEnabled)).toEqual([false, true, true]);
    expect(telas.map((t) => t.props?.nativeBackButtonDismissalEnabled)).toEqual([false, true, true]);
  });

  /** A raiz não anima: ela não entra, ela já está lá. */
  it('a raiz não tem animação de entrada; as empilhadas deslizam', async () => {
    const tree = await render(<NativeStack layers={layers} onDismiss={jest.fn()} />);
    expect(screensOf(tree).map((t) => t.props?.stackAnimation)).toEqual([
      'none',
      'slide_from_right',
      'slide_from_right',
    ]);
  });
});

describe('SPEC-061 — o gesto e o botão "Voltar" são a MESMA saída', () => {
  /**
   * ⚠️ **A garantia central da SPEC.** Se o gesto tivesse um caminho de saída próprio, ele poderia
   * divergir do botão — e é exatamente essa forma de defeito (a peça existe, a ligação não) que este
   * projeto já mediu três vezes. `onDismissed` chama o mesmo `pop` que o botão chama.
   */
  it('fechar a camada do topo chama o onDismiss recebido', async () => {
    const onDismiss = jest.fn();
    const tree = await render(<NativeStack layers={layers} onDismiss={onDismiss} />);
    const telas = screensOf(tree);

    // A raiz não dispensa nada — não há para onde voltar.
    expect(telas[0]?.props?.onDismissed).toBeUndefined();

    (telas[2]?.props?.onDismissed as () => void)();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('SPEC-061 — a build web é degradação honesta, não simulação', () => {
  /**
   * ⚠️ **No web, `ScreenStack` do `react-native-screens` é literalmente um `View`** — as camadas
   * renderizariam **empilhadas e visíveis ao mesmo tempo**. Não seria uma versão pior: seria uma tela
   * quebrada, e quebraria a validação a 390px que a D-101 protege.
   *
   * A build web mostra **só o topo**, que é exatamente o comportamento anterior a esta SPEC.
   */
  it('mostra só a camada do topo', async () => {
    const tree = await render(<WebNativeStack layers={layers} onDismiss={jest.fn()} />);
    tree.getByText('fontes');
    expect(tree.queryByText('conta')).toBeNull();
    expect(tree.queryByText('aba')).toBeNull();
  });

  /** Sem camada empilhada, o topo é a própria aba — o preview continua idêntico ao de sempre. */
  it('sem empilhada, mostra a aba', async () => {
    const tree = await render(<WebNativeStack layers={[layers[0]!]} onDismiss={jest.fn()} />);
    tree.getByText('aba');
  });
});
