import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { HunaFigure } from './HunaFigure';
import { Reveal } from './Reveal';
import { Screen, Stack, Text } from './primitives';
import { space } from './tokens';

/**
 * SPEC-018 fatia 4 — a tela que não pergunta nada.
 *
 * Três momentos da primeira experiência têm exatamente a mesma forma: o cumprimento pelo nome, a
 * espera enquanto o cronograma é montado e a confirmação de que ele existe. Todos são o hero, uma
 * frase que é a tela inteira e, às vezes, uma ação. Estavam sendo escritos três vezes; aqui são um.
 *
 * **Espera é o caso principal, e é por isso que não há porcentagem.** Não temos progresso mensurável
 * — nada aqui conta etapas de verdade — então qualquer número seria inventado para fabricar sensação
 * de avanço. A referência que estudamos faz isso; nós recusamos (SPEC-018 §5). O que dá para dizer
 * com honestidade é **o que está acontecendo**, e isso cabe numa frase.
 */
export function Moment({
  overline,
  title,
  body,
  footer,
  style,
}: {
  overline?: string;
  title: string;
  body?: string;
  /** Ausente quando é espera: numa espera não há o que ela possa fazer. */
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Screen style={[styles.page, style]} {...(footer ? { footer } : {})}>
      <Reveal style={styles.body}>
        <Stack gap="xl">
          <HunaFigure frame="band" style={styles.hero} />
          <Stack gap="sm">
            {overline ? (
              <Text variant="overline" tone="accent">
                {overline}
              </Text>
            ) : null}
            {/*
             * `accessibilityLiveRegion` porque esta linha **é** a mudança de tela: quem usa leitor
             * de tela precisa ouvir que algo aconteceu, e o resto da tela é decorativo ou repetido.
             */}
            <Text variant="display" accessibilityRole="header" accessibilityLiveRegion="polite">
              {title}
            </Text>
            {body ? <Text tone="muted">{body}</Text> : null}
          </Stack>
        </Stack>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: space.xxl },
  /** Centrado no que sobra, e ainda rolável quando não sobra nada (EC1/EC5). */
  body: { flexGrow: 1, justifyContent: 'center' },
  /** Menor que na abertura: aqui o protagonista é a frase. */
  hero: { height: 140, marginHorizontal: -space.xl },
});
