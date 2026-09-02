import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useReduceMotion } from './motion';
import { color } from './tokens';

/**
 * SPEC-027 — o hero da Huna: uma figura **de perfil**, com o cabelo como protagonista.
 *
 * ⚠️ **O que veio antes, e por que foi reprovado olhando a tela.** A versão da SPEC-026 desenhava a
 * figura **de frente**: uma elipse ameixa grande, um círculo claro no meio e um retângulo de
 * pescoço. A 390px isso não lê como mulher nem como cabelo — lê como **microfone**. O erro não foi
 * o SVG, foi a pose: de frente, o cabelo só pode aparecer como moldura atrás da cabeça, e moldura
 * atrás de um oval claro é exatamente a silhueta de um microfone. Somam-se a isso duas linhas de
 * contorno que deveriam ser fios e leem como o contorno de um ovo.
 *
 * **De perfil, o cabelo tem para onde ir.** É a diferença estrutural, não estética: com o rosto
 * virado, a massa de cabelo ganha uma **direção** — nasce na coroa, passa por trás da cabeça e cai
 * em diagonal atravessando o quadro. Aí ela pode ser longa, pode ter mechas por cima e pode se
 * mover, porque há um caminho a percorrer. De frente não havia.
 *
 * **A leitura, camada por camada** — e nenhuma delas é "um oval sobre outro":
 *
 * 1. `MASS` — a massa de cabelo, **atrás de tudo**, da coroa até fora do quadro embaixo à esquerda.
 * 2. `PROFILE` — testa, nariz, lábio, queixo, mandíbula, pescoço e ombro num **único contorno**.
 *    Um perfil é a silhueta humana mais reconhecível que existe, e é ela que impede a figura de
 *    virar mancha. É também o que dispensa rosto: não há olho, boca nem traço étnico desenhado.
 * 3. `CROWN` — a mecha que cobre o alto da cabeça e define a **linha do cabelo** na testa. Sem ela
 *    o crânio fica careca entre a massa de trás e a testa.
 * 4. `STRANDS` — mechas longas por cima, claras, que dão textura à massa sem recortá-la (o erro dos
 *    "gomos" registrado na versão anterior: volume vem de traço por cima, nunca de subdividir).
 * 5. `FILAMENTS` — dois fios luminosos com **nós de luz** ao longo do caminho. É a única pista de
 *    tecnologia, e é deliberadamente pequena: a direção pede "meio futurista", não robô. Um fio que
 *    brilha e tem pontos é cabelo e é dado ao mesmo tempo; uma placa de circuito seria nenhum dos
 *    dois.
 *
 * **Continua servindo qualquer cabelo.** O argumento que criou o placeholder abstrato continua de
 * pé: o produto atende liso, ondulado, cacheado e crespo, e a primeira tela não pode dizer a
 * nenhuma delas que este lugar não é para ela. Por isso a massa é **volume sem textura declarada** —
 * não é liso escorrido nem cacho definido — e o perfil não tem traço facial algum.
 *
 * **O movimento.** As mechas e os filamentos vivem em camadas próprias, que giram alguns graus em
 * torno da **coroa** — é o pivô certo, porque cabelo balança preso ao couro cabeludo, não ao centro
 * da imagem. Períodos longos, não múltiplos entre si, e os filamentos entram com atraso: é o atraso
 * que faz o conjunto parecer massa em movimento em vez de uma imagem girando inteira.
 *
 * ⚠️ **Por que o giro está numa `Animated.View` e não em `<G originX/originY>`.** A versão anterior
 * animava `G` com `originX`/`originY`, e no preview web isso vira o atributo DOM inválido
 * `transform-origin` — dois erros vermelhos em cima da barra inferior, em toda tela que mostra o
 * hero. `transformOrigin` como **estilo** de View é suportado nas duas plataformas e não emite nada.
 *
 * **Redução de movimento (FR20):** nada anima antes de a preferência ser **conhecida** — o estado
 * inicial do hook é `null`, não `false`, e tratar `null` como "pode animar" é o defeito que a
 * SPEC-018 corrigiu.
 *
 * Decorativo para tecnologia assistiva: não há aqui informação que alguém precise para agir.
 */

/** O palco. Retrato largo: sobra quadro à esquerda, que é para onde o cabelo cai. */
const W = 320;
const H = 400;

/** A coroa, em fração do palco. É o pivô do movimento e o centro do brilho. */
const CROWN_X = 0.66;
const CROWN_Y = 0.12;

/**
 * A massa de cabelo. **Uma** forma cheia, da coroa até sair do quadro embaixo à esquerda.
 *
 * Ela passa por baixo do rosto de propósito: o contorno do perfil é desenhado depois e recorta o que
 * sobra. Modelar a massa "contornando" a face daria uma borda dupla no lugar exato onde o olho
 * procura o perfil.
 */
export const MASS =
  'M 206 34 C 254 34, 286 72, 288 124 C 290 172, 276 210, 262 244 C 248 278, 232 312, 210 340 C 186 372, 150 392, 108 398 L 20 398 C 22 356, 34 300, 50 250 C 66 200, 86 140, 118 92 C 142 56, 174 34, 206 34 Z';

/**
 * O perfil: um caminho só, do alto da cabeça ao ombro. Testa, arco da sobrancelha, ponte, nariz,
 * filtro, lábio, queixo, mandíbula, pescoço, ombro — e a volta pelas costas, que fica escondida sob
 * a massa.
 *
 * ⚠️ **O nariz é a assinatura.** É o único trecho em que a curva sai da silhueta, e é ele que faz o
 * olho ler "perfil de uma pessoa" em vez de "forma clara". Achatá-lo devolve a mancha.
 */
export const PROFILE =
  'M 158 128 C 154 88, 180 60, 208 62 C 234 64, 246 88, 246 112 C 246 119, 241 121, 240 126 C 244 132, 251 141, 251 147 C 251 152, 245 153, 240 152 C 241 157, 240 160, 237 163 C 242 167, 242 174, 237 180 C 232 187, 220 193, 202 196 C 200 210, 199 222, 198 234 C 198 250, 226 260, 262 272 C 282 281, 293 306, 296 400 L 40 400 C 44 330, 100 286, 144 276 C 160 268, 168 250, 170 234 L 170 200 C 156 190, 150 158, 158 128 Z';

/**
 * A mecha da coroa: cobre o alto da cabeça e desenha a linha do cabelo na testa. Crescente —
 * borda de fora acompanhando o crânio, borda de dentro descendo até a têmpora.
 */
export const CROWN =
  'M 132 160 C 132 92, 170 44, 220 44 C 262 44, 292 82, 294 132 C 278 92, 252 70, 220 72 C 184 74, 158 106, 150 158 C 148 168, 133 170, 132 160 Z';

/**
 * As duas mechas que caem **na frente** do corpo, uma de cada lado. Elas fazem duas coisas que
 * nenhuma outra camada faz.
 *
 * **Profundidade.** Sem elas o cabelo termina atrás da figura e a composição vira "pessoa colada num
 * fundo". Com cabelo comprido, parte dele passa por cima do corpo — é isso que o olho espera.
 *
 * **Peso.** Sem elas, pescoço e peito ocupavam um terço do quadro numa chapa clara e o cabelo
 * deixava de ser o protagonista por área. A mecha da direita cobre o ombro da frente e devolve o
 * equilíbrio, sem que nada precise encolher.
 *
 * ⚠️ **Nenhuma das duas encosta no rosto.** A primeira versão da mecha esquerda começava em
 * `160 160`, dentro da têmpora, e a ponta virava uma **cunha escura no meio da testa** — lia como
 * hematoma, não como cabelo. Uma mecha nasce da massa, nunca da pele.
 */
export const SIDE_FALL =
  'M 268 168 C 280 206, 284 250, 280 296 C 276 342, 268 374, 264 400 L 316 400 C 318 346, 310 280, 296 236 C 288 206, 278 182, 268 168 Z';

export const FRONT_FALL =
  'M 148 124 C 134 152, 124 186, 118 214 C 111 274, 107 358, 106 398 L 26 398 C 28 344, 40 280, 62 226 C 82 188, 116 146, 148 124 Z';

/**
 * As mechas longas, por cima da massa. Traço aberto e claro: textura sem recorte.
 *
 * Todas nascem perto da coroa e caem na mesma diagonal da massa. Uma mecha que corre contra a massa
 * lê como risco na tela, não como cabelo.
 */
export const STRANDS = [
  'M 222 40 C 268 62, 288 112, 280 166 C 272 220, 246 272, 214 320',
  'M 202 36 C 240 70, 250 124, 236 178 C 222 232, 190 288, 152 340',
  'M 178 44 C 202 88, 200 144, 180 196 C 160 248, 126 308, 88 366',
  'M 154 62 C 166 108, 152 162, 126 212 C 100 262, 66 322, 36 380',
  'M 236 54 C 282 82, 298 132, 290 186 C 282 238, 258 288, 230 336',
] as const;

/**
 * Os dois fios luminosos. Mesmo caminho de mecha, traço mais fino e mais claro — e com nós de luz
 * pousados em cima, que são a única nota de tecnologia da figura.
 */
export const FILAMENTS = [
  'M 190 40 C 226 78, 232 132, 214 186 C 196 240, 162 296, 124 350',
  'M 166 54 C 186 100, 176 154, 152 204 C 128 254, 96 312, 60 366',
] as const;

/** Os nós, em coordenadas do palco. Poucos e desalinhados: constelação, não régua. */
const NODES = [
  { cx: 222, cy: 110, r: 2.6 },
  { cx: 214, cy: 190, r: 1.8 },
  { cx: 176, cy: 266, r: 2.2 },
  { cx: 182, cy: 140, r: 1.6 },
  { cx: 110, cy: 330, r: 2.4 },
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

  return value.interpolate({ inputRange: [0, 1], outputRange: [`${-degrees}deg`, `${degrees}deg`] });
};

/**
 * Os dois enquadramentos, e por que existem dois.
 *
 * ⚠️ **O mesmo desenho não serve para um painel alto e para uma faixa baixa.** Com `slice`, o SVG
 * escala pela largura: numa faixa de 390×200 sobra só o topo do quadro, e o topo do quadro é o
 * **cabelo acima da cabeça** — a tela de login mostrava uma cúpula rosa sem rosto nenhum. Não era
 * bug de layout: era um recorte pedido para um formato que não é o dele.
 *
 * `portrait` é o quadro inteiro, para o painel da abertura. `band` recorta a **cabeça**, que é o
 * que ainda diz "Huna" em 200pt de altura. Um recorte, não um segundo desenho: os mesmos caminhos,
 * a mesma animação, outro `viewBox`.
 */
const FRAMES = {
  portrait: { viewBox: `0 0 ${W} ${H}`, align: 'xMidYMin' },
  band: { viewBox: `0 26 ${W} 186`, align: 'xMidYMid' },
} as const;

export type FigureFrame = keyof typeof FRAMES;

export function HunaFigure({
  style,
  frame = 'portrait',
}: {
  style?: StyleProp<ViewStyle>;
  frame?: FigureFrame;
}) {
  const reduce = useReduceMotion();
  // `null` é "ainda não sabemos". Não animar até saber.
  const moving = reduce === false;

  const strands = useSway(moving, 17, 1.6, 0);
  const filaments = useSway(moving, 11, 3.4, 1400);

  /** Todas as camadas compartilham palco e enquadramento — senão elas não se registram. */
  const svgProps = {
    width: '100%',
    height: '100%',
    viewBox: FRAMES[frame].viewBox,
    preserveAspectRatio: `${FRAMES[frame].align} slice`,
  } as const;

  /** O pivô é a coroa: cabelo balança preso ao couro cabeludo, não ao centro da imagem. */
  const pivot = { transformOrigin: `${CROWN_X * 100}% ${CROWN_Y * 100}%` } as const;

  return (
    <View
      style={[styles.stage, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg {...svgProps}>
        <Defs>
          <LinearGradient id="stage" x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={color.violet} />
            <Stop offset="0.55" stopColor={color.wine} />
            <Stop offset="1" stopColor="#2E0F22" />
          </LinearGradient>
          {/*
            O gradiente do cabelo **gira** na diagonal: um lado pega luz, o outro cai na sombra. É o
            que dá volume a uma forma cheia — a alternativa seria recortar a massa em mechas, que na
            versão anterior virou "casulo com gomos".

            ⚠️ **`userSpaceOnUse`, e não é detalhe.** O padrão do SVG é `objectBoundingBox`: cada
            caminho recebe o gradiente esticado sobre a **sua própria** caixa. A coroa e a massa
            usavam o mesmo `url(#hair)` e mesmo assim discordavam da cor em cada ponto da tela,
            porque as caixas têm tamanhos diferentes — e a discordância aparecia como uma **cunha
            escura na têmpora**, que lia como buraco no meio do cabelo. Em coordenadas do palco, as
            quatro formas de cabelo compartilham **um** gradiente e a emenda desaparece.
          */}
          <LinearGradient id="hair" gradientUnits="userSpaceOnUse" x1={W * 0.86} y1="0" x2={W * 0.06} y2={H}>
            <Stop offset="0" stopColor="#D07EA0" />
            <Stop offset="0.34" stopColor={color.berry} />
            <Stop offset="0.72" stopColor={color.accent} />
            <Stop offset="1" stopColor="#2C0E1E" />
          </LinearGradient>
          {/*
            A mecha da frente é **mais escura** que a massa de trás. Invertido, ela sumiria; com o
            contraste, o olho entende que uma passa por cima da outra — profundidade é diferença de
            luminância, não de forma.
          */}
          <LinearGradient
            id="hairFront"
            gradientUnits="userSpaceOnUse"
            x1={W * 0.9}
            y1="0"
            x2={W * 0.1}
            y2={H}
          >
            <Stop offset="0" stopColor={color.accent} />
            <Stop offset="0.5" stopColor={color.wine} />
            <Stop offset="1" stopColor="#240B18" />
          </LinearGradient>
          {/* Pele: clara e quente, sem ser bege de retrato — presença, não pessoa específica. */}
          <LinearGradient
            id="skin"
            gradientUnits="userSpaceOnUse"
            x1={W * 0.85}
            y1={H * 0.1}
            x2={W * 0.3}
            y2={H}
          >
            <Stop offset="0" stopColor="#FAE6EE" />
            <Stop offset="0.55" stopColor="#EBC8D7" />
            <Stop offset="1" stopColor="#C894AC" />
          </LinearGradient>
          <RadialGradient id="glow" cx={`${CROWN_X}`} cy={`${CROWN_Y + 0.12}`} r="0.62">
            <Stop offset="0" stopColor="#F0B9CE" stopOpacity="0.42" />
            <Stop offset="1" stopColor="#F0B9CE" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width={W} height={H} fill="url(#stage)" />
        <Ellipse cx={W * CROWN_X} cy={H * (CROWN_Y + 0.12)} rx={W * 0.62} ry={H * 0.5} fill="url(#glow)" />

        {/* 1. A massa, atrás de tudo. */}
        <Path d={MASS} fill="url(#hair)" />
        {/* 2. O perfil por cima: é ele que recorta a massa e dá a leitura da figura. */}
        <Path d={PROFILE} fill="url(#skin)" />
        {/* 3. A coroa, fechando o alto da cabeça e marcando a linha do cabelo. */}
        <Path d={CROWN} fill="url(#hair)" />
        {/* 4. As mechas da frente, por cima do corpo: profundidade, e o peso de volta no cabelo. */}
        <Path d={SIDE_FALL} fill="url(#hairFront)" />
        <Path d={FRONT_FALL} fill="url(#hairFront)" />
      </Svg>

      {/* 4. As mechas: textura por cima, nunca recorte. */}
      <Animated.View style={[StyleSheet.absoluteFill, pivot, { transform: [{ rotate: strands }] }]}>
        <Svg {...svgProps}>
          {STRANDS.map((d, i) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke="#FBE2EC"
              strokeWidth={i % 2 === 0 ? 1.5 : 1}
              strokeLinecap="round"
              opacity={i % 2 === 0 ? 0.34 : 0.2}
            />
          ))}
        </Svg>
      </Animated.View>

      {/* 5. Os filamentos e seus nós, com o atraso maior. */}
      <Animated.View style={[StyleSheet.absoluteFill, pivot, { transform: [{ rotate: filaments }] }]}>
        <Svg {...svgProps}>
          {FILAMENTS.map((d) => (
            <Path
              key={d}
              d={d}
              fill="none"
              stroke="#FFF0F6"
              strokeWidth={0.9}
              strokeLinecap="round"
              opacity={0.5}
            />
          ))}
          {NODES.map((n) => (
            <Circle key={`${n.cx}-${n.cy}`} cx={n.cx} cy={n.cy} r={n.r} fill="#FFF0F6" opacity={0.75} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: color.wine },
});
