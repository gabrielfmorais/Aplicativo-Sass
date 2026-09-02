import { StyleSheet, View } from 'react-native';

import { HunaFigure } from '@/design/HunaFigure';
import { Button, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';

/**
 * SPEC-018 FR1 — a entrada da Huna.
 *
 * O app abria numa tela chamada "Entrar". Uma pessoa que nunca ouviu falar do produto encontrava um
 * formulário antes de encontrar uma razão — e primeira impressão não se repete.
 *
 * **Uma ideia por tela, e a ideia é a marca.** Nome, três palavras sobre o que o produto faz, o
 * hero, e **uma** ação. Nada mais cabe aqui: cada elemento a mais rouba do único que importa.
 *
 * **A copy não promete resultado.** "Seu cabelo. Sua rotina. Sua evolução." descreve o que o app
 * organiza, não o que o cabelo dela vai virar — promessa de resultado capilar seria conteúdo
 * substantivo e cairia no gate de domínio (D-26/BR2/BR3). O que ela lê é verdade sobre o produto.
 */
export function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <Screen
      scroll={false}
      style={styles.page}
      footer={
        <Stack gap="sm">
          <Button label="Começar" onPress={onStart} />
          {/* Uma linha, sem asterisco: o que o produto faz e o que ele não é. */}
          <Text variant="caption" tone="muted" center>
            Grátis para começar. Sem anúncios.
          </Text>
        </Stack>
      }
    >
      <View style={styles.brand}>
        <Text variant="overline" tone="accent">
          Cuidado capilar
        </Text>
        {/* O wordmark é tipográfico de propósito (OQ2): existe nome, ainda não existe marca
            gráfica — e uma marca fácil de trocar é o que o dono pediu. */}
        <Text variant="display" style={styles.wordmark} accessibilityRole="header">
          Huna
        </Text>
      </View>

      <HunaFigure style={styles.hero} />

      <Stack gap="sm">
        <Text variant="title">Seu cabelo. Sua rotina. Sua evolução.</Text>
        <Text tone="muted">
          Um cronograma feito a partir do que você conta sobre o seu cabelo — e que acompanha você semana a
          semana.
        </Text>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A abertura respira: mais ar em cima do que o gutter padrão, porque aqui o espaço é o conteúdo.
  page: { paddingTop: space.xxxl, gap: space.xl },
  brand: { gap: space.xs },
  /** Maior que `display`: é a única palavra da tela que precisa ser lembrada. */
  wordmark: { fontSize: 44, lineHeight: 50, letterSpacing: -0.5 },
  /**
   * `flex: 1` em vez de altura fixa: numa tela de 320pt com fonte grande, o hero cede espaço ao
   * texto em vez de empurrá-lo para fora (EC1). O mínimo garante que ele nunca vire uma faixa.
   */
  hero: {
    flex: 1,
    minHeight: 180,
    // Sangra além do gutter da página: um hero contido pelo respiro do texto lê como imagem dentro
    // de um cartão. Ilustração de abertura toca as bordas.
    marginHorizontal: -space.xl,
  },
});
