import { StyleSheet, View } from 'react-native';

import { HunaFigure } from '@/design/HunaFigure';
import { Button, Screen, Stack, Text } from '@/design/primitives';
import { color, radius, space } from '@/design/tokens';

/**
 * SPEC-018 FR1 — a entrada da Huna.
 *
 * O app abria numa tela chamada "Entrar". Uma pessoa que nunca ouviu falar do produto encontrava um
 * formulário antes de encontrar uma razão — e primeira impressão não se repete.
 *
 * **Uma ideia por tela, e a ideia é a marca.** Nome, três palavras sobre o que o produto faz, o
 * hero, e **uma** ação. Nada mais cabe aqui: cada elemento a mais rouba do único que importa.
 *
 * **SPEC-027 — o hero deixou de ser uma faixa e virou a tela.** Antes: creme no topo, uma faixa
 * escura no meio com bordas retas em cima e embaixo, creme de novo. Três blocos, e a marca escrita
 * em cinza sobre o creme — a tela de abertura de um produto premium parecendo um documento com uma
 * figura colada no meio. Agora o painel escuro **começa no topo** e o wordmark mora **dentro** dele,
 * em branco sobre ameixa. Uma emenda em vez de duas, e a primeira coisa que se vê é a cor da marca.
 *
 * ⚠️ **O texto fica sobre a parte vazia do painel, nunca sobre a figura.** A figura ocupa a direita
 * e o baixo; o wordmark ocupa o alto à esquerda, que é exatamente onde o cabelo não vai. Não há
 * caixa translúcida atrás do texto, porque caixa atrás de texto é o remendo de quem pôs o texto no
 * lugar errado.
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
      <View style={styles.hero}>
        <HunaFigure style={StyleSheet.absoluteFill} />
        <View style={styles.brand}>
          <Text variant="overline" style={styles.eyebrow}>
            Cuidado capilar
          </Text>
          {/* O wordmark é tipográfico de propósito (OQ2): existe nome, ainda não existe marca
              gráfica — e uma marca fácil de trocar é o que o dono pediu. */}
          <Text variant="display" style={styles.wordmark} accessibilityRole="header">
            Huna
          </Text>
        </View>
      </View>

      <Stack gap="sm" style={styles.copy}>
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
  /**
   * Sem gutter e sem respiro no topo: o painel escuro sangra até a borda da tela nos três lados.
   * O gutter volta só para o texto, logo abaixo.
   */
  page: { paddingTop: 0, paddingHorizontal: 0, gap: space.xl },
  /**
   * `flex: 1` em vez de altura fixa: numa tela de 320pt com fonte grande, o painel cede espaço ao
   * texto em vez de empurrá-lo para fora (EC1). O mínimo garante que ele nunca vire uma faixa.
   */
  hero: {
    flex: 1,
    minHeight: 260,
    justifyContent: 'flex-start',
    /** O canto arredondado só embaixo: em cima ele encosta na borda do aparelho. */
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: color.wine,
  },
  /** O respiro do topo é grande porque acomoda a barra de status por cima do painel. */
  brand: { paddingTop: space.xxxl + space.lg, paddingHorizontal: space.xl, gap: space.xs },
  /** Sobre ameixa, o eyebrow é claro — a cor da marca migrou para o fundo. */
  eyebrow: { color: color.onFilledMuted },
  /** Maior que `display`: é a única palavra da tela que precisa ser lembrada. */
  wordmark: { fontSize: 44, lineHeight: 50, letterSpacing: -0.5, color: color.onFilled },
  copy: { paddingHorizontal: space.xl },
});
