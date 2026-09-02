import { StyleSheet, View } from 'react-native';

import { HunaFigure } from '@/design/HunaFigure';
import { Button, Screen, Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';

/**
 * SPEC-018 FR1 + SPEC-028 — a entrada da Huna.
 *
 * O app abria numa tela chamada "Entrar". Uma pessoa que nunca ouviu falar do produto encontrava um
 * formulário antes de encontrar uma razão — e primeira impressão não se repete.
 *
 * **Uma ideia por tela, e a ideia é a marca.** Nome, três palavras sobre o que o produto faz, a
 * figura, e **uma** ação. Nada mais cabe aqui: cada elemento a mais rouba do único que importa.
 *
 * ⚠️ **SPEC-028 — a figura deixou de ser um bloco e virou a tela.** A versão anterior era um painel
 * vinho com canto arredondado ocupando o topo: uma imagem **dentro de um cartão**, com uma borda
 * dizendo onde ela acaba. Agora a Musa ocupa a viewport inteira, atrás de tudo, e **se apaga** numa
 * máscara em gradiente antes do pé da tela — não há emenda, não há moldura, e o cabelo sangra pela
 * composição em vez de parar num raio de 28pt.
 *
 * ⚠️ **O texto nunca disputa com a figura, e isso é layout e não sorte.** O wordmark fica no topo,
 * sobre a parte profunda do campo, em branco. O bloco de copy e o botão ficam **abaixo da altura em
 * que a máscara já zerou** — ali o fundo é o creme da Huna, e `ink` sobre creme mede 13:1 como em
 * qualquer outra tela. Nenhuma caixa translúcida atrás de texto: caixa atrás de texto é o remendo de
 * quem pôs o texto no lugar errado.
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
      {/*
        Fora do fluxo e atrás de tudo: a figura não empurra o texto, o texto se apoia nela. É o que
        permite "figura parcialmente fora da área" sem que o layout precise saber disso.
      */}
      <HunaFigure style={styles.musa} />

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

      {/* O vão: é ele que reserva a metade de cima para a figura sem ninguém precisar medir nada. */}
      <View style={styles.gap} />

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
  /** Sem gutter e sem respiro no topo: a composição sangra até as bordas do aparelho. */
  page: { paddingTop: 0, paddingHorizontal: 0, gap: 0 },
  /**
   * A figura cobre a viewport inteira e vive **atrás** do conteúdo. Ela se apaga sozinha antes do
   * pé (a máscara está dentro dela), então não há corte, nem borda, nem cartão.
   */
  musa: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -space.xxl },
  /** O respiro do topo acomoda a barra de status por cima da parte profunda do campo. */
  brand: { paddingTop: space.xxxl + space.lg, paddingHorizontal: space.xl, gap: space.xs },
  /** Sobre o campo profundo, o eyebrow é claro — a cor da marca migrou para o fundo. */
  eyebrow: { color: color.onFilledMuted },
  /** Maior que `display`: é a única palavra da tela que precisa ser lembrada. */
  wordmark: { fontSize: 46, lineHeight: 52, letterSpacing: -0.6, color: color.onFilled },
  /**
   * `flex: 1` num vão vazio, e não altura fixa: numa tela de 320pt com fonte grande é o vão que
   * encolhe, e o texto continua inteiro (EC1). O mínimo garante que a figura nunca vire uma faixa.
   */
  gap: { flex: 1, minHeight: 150 },
  copy: { paddingHorizontal: space.xl, paddingBottom: space.lg },
});
