import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useReduceMotion } from './motion';
import { color } from './tokens';

/**
 * SPEC-026 fatia 5 (FR19/FR20) — o hero da Huna. Substitui o `HairFlow` placeholder.
 *
 * **Por que SVG.** O placeholder eram `View`s arredondadas, porque `View` era o que existia sem
 * dependência nova — e `View` desenha **um retângulo com canto arredondado**, nada mais. Fio de
 * cabelo é curva; retângulo estreito é listra, e a direção recusou listras explicitamente.
 * `react-native-svg` dá Bézier de verdade (D-101) e roda no preview onde o produto é validado.
 *
 * ⚠️ **Cinco tentativas, e o que cada uma ensinou — porque é fácil desfazer isso sem saber.**
 *
 * 1. Mechas convergindo num ponto do topo → **bulbo**. Cabelo não sai de um bico; ele emoldura.
 * 2. Cabelo e pele em tons vizinhos de vinho sobre creme → **vaso**. Contraste não é acabamento: é
 *    a diferença entre uma figura e uma mancha. Daí o fundo escuro.
 * 3. Mechas fechadas com um segmento reto no pé → **listras verticais**, exatamente o que a direção
 *    recusa. Mecha afina; a ponta é curva.
 * 4. Massa dividida em mechas internas mais claras → **casulo com gomos**. Volume não vem de
 *    subdividir a silhueta; vem de **uma** forma cheia com um gradiente que gira.
 *
 * O que sobrou é o que funciona: **três formas grandes e nada dentro delas.** Massa de cabelo,
 * rosto, ombro — cada uma numa faixa de luminosidade diferente. Os fios finos por cima são a única
 * subdivisão, e são traço, não recorte.
 *
 * ⚠️ **O argumento de diversidade do placeholder continua valendo.** O `HairFlow` era abstrato
 * porque *"desenhar uma pessoa obriga a escolher um tipo de cabelo, e o produto atende liso,
 * ondulado, cacheado e crespo — a primeira tela não pode dizer a uma delas que este lugar não é
 * para ela"*. Aqui não há rosto, não há traço étnico e o cabelo é **volume sem textura declarada**:
 * não é liso escorrido nem cacho definido. Continua sendo qualquer cabelo, agora com corpo.
 *
 * **Nem humana realista, nem robô, nem cartoon.** Formas cheias em gradiente, sem contorno e sem
 * articulação: presença, não personagem.
 *
 * **O movimento.** Três camadas com períodos longos e **dessincronizados**, e os fios periféricos
 * entram por último, com atraso — é o atraso que faz o conjunto parecer massa em movimento em vez
 * de uma imagem girando inteira. Amplitudes de poucos graus: cabelo assentando.
 *
 * **Redução de movimento (FR20):** nada anima antes de a preferência ser **conhecida** — o estado
 * inicial do hook é `null`, não `false`, e um `null` tratado como "pode animar" é exatamente o
 * defeito que a SPEC-018 corrigiu.
 *
 * Decorativo para tecnologia assistiva: não há informação aqui que alguém precise para agir.
 */

const AnimatedG = Animated.createAnimatedComponent(G);

/** O palco. Retrato: a figura é vertical, e é a altura que o cabelo ocupa. */
const W = 240;
const H = 300;

/**
 * A massa de cabelo: **uma** forma, cheia, do alto até abaixo do ombro.
 *
 * Assimétrica de propósito — a queda da direita é mais larga e mais baixa. Cabelo simétrico lê como
 * peruca em manequim, e a assimetria é o que dá a impressão de peso caindo.
 */
export const MASS =
  'M120 40 C 78 40, 52 78, 48 146 C 44 214, 54 264, 70 300 L 186 300 C 198 258, 202 200, 196 140 C 190 76, 162 40, 120 40 Z';

/**
 * Os fios que escapam da massa. Traço aberto, sem preenchimento — é o que separa "fio" de "mecha",
 * e é a **única** subdivisão do cabelo: recortar a massa em pedaços mais claros virou gomos.
 *
 * **Dois segmentos cúbicos, e não um.** Um segmento só desenha um arco, e arco não parece fio: falta
 * a inflexão, o ponto onde a curva vira. Foi a barreira de Bézier que apontou isso — ela exigia duas
 * curvas por caminho, e a primeira versão dos fios tinha uma. O desenho é que estava pobre.
 */
export const LOOSE = [
  'M96 46 C 60 66, 40 108, 38 164 C 36 220, 46 260, 60 296',
  'M146 46 C 182 66, 204 108, 206 164 C 208 220, 198 262, 184 298',
  'M104 42 C 74 72, 60 122, 60 176 C 60 226, 68 264, 78 298',
  'M138 42 C 168 72, 182 122, 182 176 C 182 226, 174 264, 164 298',
] as const;

/** Um balanço lento, em loop, com atraso próprio. Devolve a rotação em graus, já interpolada. */
const useSway = (enabled: boolean, seconds: number, degrees: number, delay: number) => {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: seconds * 500,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: seconds * 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, value, seconds, delay]);

  return value.interpolate({ inputRange: [0, 1], outputRange: [`${-degrees}`, `${degrees}`] });
};

export function HunaFigure({ style }: { style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  // `null` é "ainda não sabemos". Não animar até saber.
  const moving = reduce === false;

  /**
   * Períodos que não são múltiplos entre si, e atrasos diferentes: as camadas nunca voltam a se
   * alinhar, e é o desalinhamento que faz o conjunto parecer cabelo em vez de um carrossel. Os fios
   * soltos são os últimos a entrar — o "pequeno atraso" da direção.
   */
  const mass = useSway(moving, 19, 1.2, 0);
  const loose = useSway(moving, 11, 3.2, 1400);

  return (
    <View
      style={[styles.stage, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {/*
        `YMin`: quando o palco é mais largo que alto, o corte tira o **pé** e mantém a cabeça. Com
        `YMid` a figura ficava decapitada nas faixas baixas, que é o uso do login e do onboarding.
      */}
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice">
        <Defs>
          <LinearGradient id="stage" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={color.violet} />
            <Stop offset="1" stopColor={color.wine} />
          </LinearGradient>
          {/*
            O gradiente do cabelo **gira** (x1/y1 → x2/y2 na diagonal) e é o que faz uma forma cheia
            ter volume: um lado pega luz, o outro cai na sombra. É a alternativa a recortar a massa,
            que foi a tentativa que virou gomos.
          */}
          <LinearGradient id="hair" x1="0.08" y1="0.05" x2="0.85" y2="0.95">
            <Stop offset="0" stopColor="#C2688C" />
            <Stop offset="0.42" stopColor={color.accent} />
            <Stop offset="1" stopColor="#3F1428" />
          </LinearGradient>
          {/* Rosto e ombro: claros e quentes, sem serem bege de pele — presença, não retrato. */}
          <LinearGradient id="skin" x1="0.2" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor="#FBEEF2" />
            <Stop offset="1" stopColor="#E6C4D2" />
          </LinearGradient>
          <RadialGradient id="glow" cx="0.5" cy="0.28" r="0.5">
            <Stop offset="0" stopColor="#EDB6CB" stopOpacity="0.38" />
            <Stop offset="1" stopColor="#EDB6CB" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={W} height={H} fill="url(#stage)" />
        <Ellipse cx={W / 2} cy={H * 0.28} rx={W * 0.46} ry={H * 0.34} fill="url(#glow)" />

        {/* O ombro, por baixo de tudo: só as pontas escapam da massa. */}
        <Path d="M14 300 C 24 234, 66 198, 120 194 C 174 198, 216 234, 226 300 Z" fill="url(#skin)" />

        <AnimatedG originX={W / 2} originY={44} rotation={mass}>
          <Path d={MASS} fill="url(#hair)" />
        </AnimatedG>

        {/*
          O rosto: uma elipse clara **dentro** da massa escura, e é a leitura inteira da figura. Menor
          que a massa em toda volta — é a folga de cabelo em cima e dos lados que faz o olho entender
          "emoldurado por cabelo" em vez de "um oval sobre outro".
        */}
        {/*
          O pescoço **alarga** até o ombro em vez de convergir. Convergindo, as duas bordas se
          encontravam num bico e a figura ganhava uma gota pendurada no queixo.
        */}
        <Path
          d="M106 150 C 106 172, 108 186, 110 200 C 116 202, 124 202, 130 200 C 132 186, 134 172, 134 150 Z"
          fill="url(#skin)"
        />
        <Ellipse cx={120} cy={118} rx={31} ry={36} fill="url(#skin)" />

        {/* Os fios soltos, com o atraso maior. Claros sobre o escuro: leitura, não contorno. */}
        <AnimatedG originX={W / 2} originY={44} rotation={loose}>
          {LOOSE.map((d, i) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke="#F6D4E0"
              strokeWidth={i % 2 === 0 ? 1.3 : 0.9}
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 0.34 : 0.22}
            />
          ))}
        </AnimatedG>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: color.wine },
});
