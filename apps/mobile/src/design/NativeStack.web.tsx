import { View, StyleSheet } from 'react-native';

import type { StackLayer } from './NativeStack';

export type { StackLayer } from './NativeStack';

/**
 * ADR-012 / SPEC-061 — build web da pilha nativa. **Degradação honesta, não simulação.**
 *
 * ⚠️ **No web, `ScreenStack` do `react-native-screens` é literalmente um `View`** — as camadas
 * renderizariam **empilhadas e visíveis ao mesmo tempo**, o que não é uma versão pior do produto: é
 * uma tela quebrada, e quebraria a validação a 390px que a D-101 protege explicitamente.
 *
 * Então aqui a camada renderiza **só o topo**, que é **exatamente o comportamento de hoje** (o
 * `if (stacked === …) return …` que existia antes desta SPEC). Nada regride no preview.
 *
 * ⛔ **O que o web NÃO prova, e é o ponto inteiro da SPEC:** o gesto de borda, a transição
 * interrompível e o botão físico do Android **só existem em build nativo** (gate G7). O 390px prova
 * ausência de regressão; a existência do gesto se prova num aparelho — como já vale para
 * notificações, `toDataURL` e a folha de compartilhamento.
 *
 * `onDismiss` não é chamado aqui: sem pilha nativa não há gesto que possa disparar a dispensa, e
 * inventar um caminho de saída que o nativo não tem faria as duas plataformas discordarem.
 */
export function NativeStack({ layers }: { layers: readonly StackLayer[]; onDismiss: () => void }) {
  const top = layers[layers.length - 1];
  return <View style={styles.fill}>{top ? top.content : null}</View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
