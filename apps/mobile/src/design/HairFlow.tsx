import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useReduceMotion } from './motion';
import { color, radius } from './tokens';

/**
 * SPEC-018 FR3 — o hero da Huna: cabelo como protagonista, em movimento.
 *
 * **Por que abstrato, e não uma ilustração de uma mulher.** Desenhar uma pessoa obriga a escolher
 * *um* tipo de cabelo, e o produto atende liso, ondulado, cacheado e crespo — a primeira tela do
 * app não pode dizer a uma delas que este lugar não é para ela. Fios abstratos representam cabelo
 * sem eleger textura. Não é economia de escopo: é a resposta certa ao requisito de diversidade.
 *
 * **Por que sem biblioteca.** Lottie, SVG e `reanimated` são dependência nova (§4) para desenhar
 * meia dúzia de curvas que se movem devagar. Isto são Views arredondadas com transformações — o
 * `Animated` da plataforma faz, o bundle não cresce, e não há asset para carregar nem falhar.
 *
 * **O movimento é lento de propósito.** Ciclos de dezoito a vinte e seis segundos, dessincronizados,
 * com deslocamentos de poucos graus: perto do limiar do perceptível. Cabelo assentando, não cabelo
 * ao vento — a diferença entre "cuidado" e "comercial de xampu".
 *
 * Decorativo para tecnologia assistiva (`accessibilityElementsHidden` / `importantForAccessibility`):
 * não há informação aqui que alguém precise para agir, e anunciá-lo só atrapalharia a leitura.
 */

/**
 * Uma mecha. As proporções são o que faz isto ler como cabelo: **estreita, e muito mais alta que o
 * palco**. A primeira versão usava formas largas, e a composição virou manchas sobrepostas — porque
 * uma View larga com raio grande é uma elipse, e elipse nenhuma parece fio. Fio é comprido e fino.
 */
type StrandSpec = {
  readonly rotate: number;
  /** Fração da largura do palco onde a mecha começa. Negativo é permitido: mecha cortada continua. */
  readonly left: number;
  readonly width: number;
  readonly tint: string;
  readonly opacity: number;
  /** Segundos de um ciclo completo. Valores diferentes e não múltiplos: nunca sincronizam. */
  readonly period: number;
  /** Amplitude do balanço, em graus. */
  readonly sway: number;
};

const TONES = [color.accent, color.accentPressed, color.reconstruction] as const;

/**
 * Dezesseis mechas, geradas com variação determinística — dezesseis objetos escritos à mão seriam
 * ruído, e sortear faria a abertura mudar a cada abertura, que é o oposto de marca.
 *
 * O leque abre da esquerda para a direita: as rotações crescem, e é isso que dá sensação de queda.
 */
const STRANDS: readonly StrandSpec[] = Array.from({ length: 7 }, (_, i) => {
  const t = i / 6;
  return {
    rotate: -14 + t * 28,
    left: -0.34 + t * 1.32,
    width: 0.3 + ((i * 3) % 4) * 0.09,
    tint: TONES[i % 3]!,
    // Muito translúcidas. Quatro iterações provaram que quanto mais opacas, mais estas formas
    // insistem em ser o que não são; translúcidas e sobrepostas, elas viram luz sobre o canvas.
    opacity: 0.05 + ((i * 5) % 3) * 0.035,
    period: 19 + ((i * 3) % 5) * 2.3,
    sway: 1.2 + ((i * 4) % 4) * 0.6,
  };
});

function Strand({
  spec,
  size,
  animate,
}: {
  spec: (typeof STRANDS)[number];
  size: { width: number; height: number };
  animate: boolean;
}) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: (spec.period * 1000) / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: (spec.period * 1000) / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, drift, spec.period]);

  const swing = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [`${-spec.sway}deg`, `${spec.sway}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.strand,
        {
          // Mais alta que o palco e ancorada acima do topo: o fio entra na cena vindo de fora, e o
          // recorte do palco corta as duas pontas — o que sugere comprimento em vez de mostrá-lo.
          top: -0.35 * size.height,
          height: 1.7 * size.height,
          left: spec.left * size.width,
          width: spec.width * size.width,
          backgroundColor: spec.tint,
          opacity: spec.opacity,
          // Giro pelo centro, com amplitude de poucos graus: sobre um fio muito mais alto que o
          // palco, o deslocamento visível acontece nas pontas — que é onde cabelo se move.
          transform: [{ rotate: `${spec.rotate}deg` }, { rotate: swing }],
        },
      ]}
    />
  );
}

export function HairFlow({ style }: { style?: StyleProp<ViewStyle> }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // FR4 — quem pediu menos movimento ao sistema recebe uma composição parada, não uma mais lenta.
  // `=== false`, não `!`: enquanto a preferência não voltou o valor é `null`, e mover antes de
  // saber é exatamente o que FR4 proíbe.
  const animate = useReduceMotion() === false;

  return (
    <View
      style={[styles.stage, style]}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {size ? STRANDS.map((spec, i) => <Strand key={i} spec={spec} size={size} animate={animate} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * Recorta as mechas, que são muito maiores que o palco de propósito — fio cortado sugere
   * continuação. Sem fundo próprio: as mechas ficam sobre o canvas quente, o que faz a composição
   * ler como ilustração da página e não como uma imagem dentro de um cartão.
   */
  stage: { overflow: 'hidden' },
  /**
   * A forma é o ponto inteiro. Cantos opostos com raio enorme e os outros dois quase retos
   * transformam o retângulo numa **foice** — barriga de um lado, ponta afilada do outro. É a
   * silhueta de uma mecha, e é o que retângulo arredondado nunca vai ser: fio reto lê como listra.
   */
  strand: {
    position: 'absolute',
    borderTopLeftRadius: 9999,
    borderBottomRightRadius: 9999,
    borderTopRightRadius: radius.sm,
    borderBottomLeftRadius: radius.sm,
  },
});
