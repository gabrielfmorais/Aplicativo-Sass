import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { ScreenStack, ScreenStackItem } from 'react-native-screens';

/**
 * ADR-012 / SPEC-061 — **a pilha nativa, dirigida pelo estado que o app já tinha.**
 *
 * **O problema.** O gesto de voltar arrastando da borda **não existia** (SPEC-060 OQ1). É a
 * interação mais automática que há num iPhone: quem usa iOS arrasta antes de procurar um botão, e
 * quando nada acontece a leitura não é *"este app não tem esse gesto"*, é *"este app travou"*.
 *
 * ⛔ **Não existe meio-termo.** O gesto de borda do iOS é interrompível, segue o dedo e acompanha a
 * transição. Imitá-lo à mão exigiria uma dependência de gestos e ainda assim seria imitação. Ou é
 * pilha nativa, ou não é.
 *
 * **A decisão (ADR-012): pilha nativa, NÃO migração para rotas.** As portas já vivem em contexto
 * (`useAuth`), mas o **estado carregado** — board, perfil, jornada, insights — mora em
 * `AuthenticatedApp` e desce por prop; uma rota empilhada pelo router seria **irmã**, não filha, e
 * não veria nada disso. Sair por rotas obrigaria a subir todo o estado para um provider, num arquivo
 * de 884 linhas com **zero cobertura de teste** (medido). Esta camada entrega o mesmo gesto sem
 * mover estado nenhum: cada tela mantém exatamente os props que já tinha.
 *
 * ⚠️ **Ela mora DENTRO da casca, ACIMA da `TabBar`** — por isso a barra **não desliza** com a
 * transição, que é como as pilhas do próprio iOS se comportam sob uma tab bar. E é o que preserva a
 * decisão de produto da SPEC-026/027: *"sair de uma tela nunca deve exigir encontrar o botão certo
 * antes"*.
 *
 * ⚠️ **`onDismiss` é a única ligação nova.** O gesto e o botão físico do Android produzem a **mesma**
 * mudança de estado que o botão "Voltar" da tela já fazia — não há um segundo caminho de saída para
 * divergir do primeiro.
 *
 * **Sem dependência nova:** `react-native-screens` já é dependência (o `expo-router` depende dele).
 */
export type StackLayer = {
  /** Identidade da camada. Trocar de id é o que empilha; repetir mantém. */
  readonly id: string;
  readonly content: ReactNode;
};

export function NativeStack({
  layers,
  onDismiss,
}: {
  /** A raiz primeiro; no máximo uma empilhada acima dela. */
  layers: readonly StackLayer[];
  /** Chamado quando o gesto ou o botão físico fecham a camada do topo. */
  onDismiss: () => void;
}) {
  return (
    <ScreenStack style={styles.fill}>
      {layers.map((layer, index) => (
        <ScreenStackItem
          key={layer.id}
          screenId={layer.id}
          style={StyleSheet.absoluteFill}
          /** O cabeçalho é da tela, não da pilha: cada uma já traz o seu "Voltar" e seu título. */
          headerConfig={{ hidden: true }}
          /**
           * ⚠️ **A raiz não se fecha.** Sem isto, arrastar na aba Hoje tentaria desempilhar o app
           * inteiro — e no Android o botão físico sairia do app a partir de qualquer aba.
           */
          gestureEnabled={index > 0}
          nativeBackButtonDismissalEnabled={index > 0}
          stackAnimation={index > 0 ? 'slide_from_right' : 'none'}
          onDismissed={index > 0 ? onDismiss : undefined}
        >
          {layer.content}
        </ScreenStackItem>
      ))}
    </ScreenStack>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
