import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Defs,
  G,
  Ellipse,
  LinearGradient,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useReduceMotion } from './motion';
import { ribbonPath, type Spine, type WidthProfile } from './ribbon';
import { color } from './tokens';

/**
 * SPEC-028 — a **Musa Digital** da Huna.
 *
 * ⚠️ **A decisão de tecnologia, tomada com o repositório aberto e não por preferência.**
 *
 * A direção autorizou trocar de tecnologia se o SVG fosse o limitador. Ele não é — e a medição é
 * simples: `react-native-svg@15.15.4` traz `Mask`, `ClipPath`, gradientes lineares e radiais em
 * espaço de usuário, e a suíte de filtros inteira. Nada do que esta figura precisa está fora dele.
 *
 * As alternativas foram avaliadas e **reprovadas por motivo concreto, não por contagem de
 * dependências**:
 *
 * - **Rive** exige um `.riv` autorado no editor gráfico da Rive. Ninguém nesta sessão produz esse
 *   arquivo, e o runtime é nativo — quebraria a validação a 390px, que é hoje o único jeito de ver o
 *   produto (D-101 reprova exatamente por isso).
 * - **Lottie** aceita JSON gerado por código, mas **a arte continua vindo de mim**: seria a mesma
 *   ilustração, escrita num formato pior, mais uma dependência nativa e mais um risco no preview.
 *   Trocar de formato não desenha melhor.
 *
 * **O limitador real era o método.** As três versões anteriores foram escritas à mão, caminho por
 * caminho, e isso tem um teto de quatro ou cinco formas — depois disso ninguém segura o conjunto na
 * cabeça. Quatro formas opacas leem **flat**, por mais bem desenhadas que estejam: falta
 * sobreposição para o olho construir profundidade.
 *
 * **Então o cabelo deixou de ser desenhado e passou a ser gerado.** `ribbon.ts` transforma uma
 * espinha e um perfil de largura numa fita fechada em Bézier; aqui embaixo há **vinte** espinhas, em
 * quatro planos de profundidade, com gradiente e transparência próprios. Não é o mesmo desenho
 * polido: é outro objeto, feito de outro jeito.
 *
 * **A figura.** Entre escultura digital e editorial de beleza: perfil liso, **sem olho, sem boca,
 * sem sobrancelha**, numa superfície perolada que se dissolve antes de virar busto. O corpo existe
 * só até onde a silhueta precisa dele e some num gradiente — o protagonista absoluto é o cabelo, e
 * um torso desenhado por inteiro competiria com ele.
 *
 * **Continua servindo qualquer cabelo.** O argumento que criou o placeholder abstrato da SPEC-018
 * segue valendo: sem rosto, sem traço étnico, e fitas que não são liso escorrido nem cacho definido.
 *
 * **O movimento.** Quatro planos, períodos que não são múltiplos entre si, e o atraso crescendo do
 * fundo para a frente: a massa vai primeiro, as fitas do meio respondem depois, e os fios finos são
 * os últimos. É o atraso que faz o conjunto parecer cabelo em vez de uma imagem girando inteira —
 * vento fraco, não animação.
 *
 * **Redução de movimento (FR2):** nada anima antes de a preferência ser **conhecida** — o estado
 * inicial do hook é `null`, não `false`.
 *
 * Decorativo para tecnologia assistiva: não há aqui informação que alguém precise para agir.
 */

/**
 * O palco. **Alto**, e a altura é o requisito: cabelo comprido precisa de percurso, e a primeira
 * tentativa usou um palco quase quadrado num aparelho de 844pt — com `slice`, isso amplia pela
 * altura e mostra 47% da largura. O resultado foi um túnel de fitas gigantes sem figura dentro.
 * A proporção do palco tem de parecer com a proporção da tela.
 */
const W = 360;
const H = 780;

/** A coroa. Pivô do movimento e centro do brilho — cabelo balança preso ao couro cabeludo. */
const CROWN = { x: 266, y: 96 };

/**
 * O perfil: testa, ponte, nariz, lábio, queixo, mandíbula e pescoço num contorno só, e um ombro que
 * **não fecha** — ele desce e o gradiente o dissolve antes que vire busto.
 *
 * ⚠️ **O nariz é a única saliência, e é de propósito.** É ele que faz o olho ler "perfil" em vez de
 * "forma clara"; achatá-lo devolve a mancha. Todo o resto da superfície é liso: a direção pede
 * escultura, e escultura não tem detalhe facial — não há olho, boca nem sobrancelha aqui.
 */
export const PROFILE =
  'M 216 158 C 214 116, 234 86, 261 86 C 287 86, 303 110, 303 134 C 303 141, 298 143, 297 147 C 301 154, 309 162, 309 168 C 309 173, 303 174, 298 173 C 299 178, 298 181, 295 184 C 300 188, 300 195, 295 202 C 290 210, 280 215, 266 217 C 264 231, 263 244, 262 257 C 262 271, 280 279, 298 289 C 314 297, 322 318, 326 366 L 328 460 L 154 460 C 160 398, 186 350, 220 332 C 231 319, 234 301, 235 283 L 235 223 C 222 213, 214 188, 216 158 Z';

/** Onde a luz encosta na testa. Uma só, larga e fraca: pérola, não brilho de plástico. */
export const SHEEN =
  'M 236 132 C 242 104, 260 90, 280 94 C 266 100, 252 116, 246 140 C 242 158, 240 176, 242 192 C 232 176, 230 152, 236 132 Z';

/**
 * A touca: a mecha que cobre o **couro cabeludo**, desenhada por cima de tudo.
 *
 * ⚠️ **Sem ela o hero vira um bulbo.** Vinte fitas que nascem perto da coroa convergem lá em cima, e
 * um feixe convergindo num ponto é exatamente o defeito registrado desde a primeira versão: cabelo
 * não sai de um bico, ele emoldura. A touca esconde as vinte raízes de uma vez e devolve a linha do
 * cabelo na testa — é o último elemento desenhado, e por isso funciona.
 */
export const CAP =
  'M 204 214 C 200 132, 228 82, 268 82 C 312 82, 340 122, 342 186 C 332 148, 314 122, 290 118 C 254 112, 228 156, 226 216 C 222 230, 205 228, 204 214 Z';

/**
 * As fitas. **Isto é o cabelo** — não há massa única atrás da cabeça, e é essa a diferença entre a
 * silhueta capilar que a direção pediu e o capacete que ela recusou.
 *
 * Cada uma declara por onde passa (`spine`), quão cheia é (`width`), de que cor (`paint`), quanto
 * deixa passar (`opacity`) e em que plano vive (`layer`). Cruzamento e transparência são o que
 * constroem profundidade: uma fita translúcida por cima de outra cria um terceiro tom que nenhuma
 * das duas tem, e é aí que o desenho deixa de ser flat.
 *
 * `front` passa **na frente do rosto e do corpo** — sem isso a figura fica colada num fundo.
 */
type Ribbon = {
  readonly spine: Spine;
  readonly width: WidthProfile;
  readonly paint: string;
  readonly opacity: number;
  readonly layer: 0 | 1 | 2 | 3;
};

const p = (x: number, y: number) => ({ x, y });

/**
 * ⚠️ **A regra que salva o rosto, e ela é a diferença entre Musa e casulo.**
 *
 * A primeira distribuição espalhava as fitas para os dois lados a partir da coroa, simétricas e do
 * mesmo comprimento. A 390px isso não lê como cabelo: lê como **casulo** — uma cúpula fechada com a
 * figura enterrada dentro. Cabelo comprido de uma figura de perfil não envolve a cabeça: ele cai
 * para **um lado**.
 *
 * Daí a regra: **nenhuma fita desenhada depois da figura nasce à direita de `x = 254`.** A direita é
 * onde está o rosto, e uma fita que atravessa a testa apaga o perfil — que é a única coisa que
 * impede o desenho de virar mancha. Quem define a silhueta do lado direito vive no plano 0, atrás
 * da figura, e é o próprio contorno do rosto que a recorta.
 */
export const RIBBONS: readonly Ribbon[] = [
  // --- plano 0: atrás da figura. Define a silhueta dos dois lados; o rosto recorta o que sobra.
  {
    spine: [p(282, 106), p(340, 214), p(354, 400), p(332, 594), p(300, 800)],
    width: { max: 86 },
    paint: 'deep',
    opacity: 1,
    layer: 0,
  },
  {
    spine: [p(226, 112), p(156, 216), p(110, 398), p(106, 588), p(132, 800)],
    width: { max: 104 },
    paint: 'deep',
    opacity: 1,
    layer: 0,
  },
  {
    spine: [p(250, 92), p(196, 196), p(160, 392), p(158, 592), p(184, 800)],
    width: { max: 84 },
    paint: 'wine',
    opacity: 0.95,
    layer: 0,
  },
  {
    spine: [p(272, 94), p(310, 206), p(322, 400), p(304, 596), p(274, 800)],
    width: { max: 64 },
    paint: 'wine',
    opacity: 0.95,
    layer: 0,
  },

  // --- plano 1: o corpo do cabelo, todo caindo para a esquerda. É aqui que a marca aparece.
  {
    spine: [p(244, 100), p(178, 236), p(140, 428), p(142, 610), p(170, 790)],
    width: { max: 62 },
    paint: 'berry',
    opacity: 0.9,
    layer: 1,
  },
  {
    spine: [p(250, 108), p(206, 248), p(178, 436), p(182, 614), p(208, 788)],
    width: { max: 52 },
    paint: 'plum',
    opacity: 0.9,
    layer: 1,
  },
  {
    spine: [p(228, 98), p(152, 244), p(114, 440), p(118, 620), p(148, 792)],
    width: { max: 46 },
    paint: 'violet',
    opacity: 0.85,
    layer: 1,
  },
  {
    spine: [p(238, 114), p(196, 254), p(172, 446), p(176, 620), p(200, 790)],
    width: { max: 40 },
    paint: 'berry',
    opacity: 0.85,
    layer: 1,
  },
  {
    spine: [p(216, 104), p(132, 252), p(92, 448), p(98, 626), p(130, 794)],
    width: { max: 42 },
    paint: 'plum',
    opacity: 0.8,
    layer: 1,
  },

  // --- plano 2: as da frente. Cruzam o pescoço e o ombro — nunca o rosto.
  {
    spine: [p(246, 118), p(214, 268), p(196, 452), p(202, 626), p(224, 792)],
    width: { max: 34 },
    paint: 'deep',
    opacity: 0.88,
    layer: 2,
  },
  {
    spine: [p(232, 116), p(184, 272), p(158, 458), p(164, 630), p(190, 792)],
    width: { max: 30 },
    paint: 'wine',
    opacity: 0.82,
    layer: 2,
  },
  {
    spine: [p(252, 132), p(230, 282), p(218, 464), p(222, 634), p(240, 790)],
    width: { max: 24 },
    paint: 'deep',
    opacity: 0.8,
    layer: 2,
  },
  // Passa **abaixo do queixo**, pelo pescoço: é ela que quebra a coluna clara do corpo sem tocar no rosto.
  {
    spine: [p(250, 150), p(262, 262), p(278, 372), p(258, 512), p(226, 700)],
    width: { max: 28 },
    paint: 'wine',
    opacity: 0.72,
    layer: 2,
  },

  // --- plano 3: os fios. Finos, claros, com o maior atraso: são eles que dizem "vivo".
  {
    spine: [p(240, 102), p(190, 244), p(162, 436), p(166, 612), p(190, 790)],
    width: { max: 8 },
    paint: 'lilac',
    opacity: 0.7,
    layer: 3,
  },
  {
    spine: [p(248, 112), p(214, 252), p(194, 442), p(198, 616), p(220, 790)],
    width: { max: 6 },
    paint: 'pearl',
    opacity: 0.6,
    layer: 3,
  },
  {
    spine: [p(226, 104), p(158, 250), p(124, 444), p(128, 618), p(156, 792)],
    width: { max: 8 },
    paint: 'lilac',
    opacity: 0.65,
    layer: 3,
  },
  {
    spine: [p(254, 124), p(238, 262), p(228, 450), p(232, 622), p(248, 790)],
    width: { max: 6 },
    paint: 'pearl',
    opacity: 0.55,
    layer: 3,
  },
  {
    spine: [p(210, 106), p(124, 256), p(84, 452), p(90, 624), p(122, 794)],
    width: { max: 7 },
    paint: 'pearl',
    opacity: 0.5,
    layer: 3,
  },
  // A única à direita do rosto: ela mora **fora** dele, encostada na silhueta de trás.
  {
    spine: [p(316, 134), p(350, 240), p(360, 416), p(340, 600), p(312, 796)],
    width: { max: 6 },
    paint: 'lilac',
    opacity: 0.5,
    layer: 3,
  },
];

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
 * Os dois enquadramentos do mesmo desenho.
 *
 * ⚠️ **Com `slice`, um SVG escala pela largura.** Numa faixa de 200pt de altura sobrava só o topo do
 * quadro — que é o cabelo **acima** da testa. `band` recorta a cabeça, que é o que ainda diz "Huna"
 * numa faixa baixa.
 */
const FRAMES = {
  portrait: { viewBox: `0 0 ${W} ${H}`, align: 'xMidYMin' },
  band: { viewBox: `60 58 ${W - 100} 186`, align: 'xMidYMid' },
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

  /**
   * Períodos primos entre si e atrasos crescentes: as camadas nunca voltam a se alinhar, e é o
   * desalinhamento que faz o conjunto parecer cabelo. Amplitudes de poucos graus — vento fraco.
   */
  const sway = [
    useSway(moving, 23, 0.9, 0),
    useSway(moving, 17, 1.7, 700),
    useSway(moving, 13, 2.6, 1500),
    useSway(moving, 9, 4.2, 2300),
  ] as const;

  /** Gerar vinte contornos custa; gerar uma vez por montagem não custa nada. */
  const paths = useMemo(() => RIBBONS.map((r) => ({ ...r, d: ribbonPath(r.spine, r.width) })), []);

  /**
   * ⚠️ **`absoluteFill` em toda camada, e isto foi um defeito de verdade.** As camadas são vários
   * `Svg` sobrepostos; sem posicionamento absoluto eles entram no fluxo e **empilham na vertical** —
   * o campo ficava com a metade de cima da tela, a figura com a de baixo, e a touca ia parar em cima
   * da copy. A 390px isso lê como um corte horizontal no meio da composição, que foi exatamente o
   * que apareceu na primeira renderização.
   */
  const svg = {
    width: '100%',
    height: '100%',
    style: StyleSheet.absoluteFill,
    viewBox: FRAMES[frame].viewBox,
    preserveAspectRatio: `${FRAMES[frame].align} slice`,
  } as const;

  /** O pivô do giro é a coroa, em fração do palco. */
  const pivot = { transformOrigin: `${(CROWN.x / W) * 100}% ${(CROWN.y / H) * 100}%` } as const;

  /**
   * ⚠️ **Cada camada é um `Svg` próprio, e cada `Svg` precisa das suas `defs` com ids próprios.**
   *
   * No nativo as definições são escopadas por raiz de SVG; **na web não são** — vários `<svg>` na
   * mesma página compartilham o documento, e uma referência a `#deep` resolve para o **primeiro**
   * `#deep` que o navegador achar. Com sete cópias do mesmo id o desenho continuava certo só porque
   * as cópias eram idênticas: no dia em que alguém mudasse uma, a web usaria outra em silêncio. O
   * prefixo por camada tira essa armadilha do caminho.
   */
  const layer = (which: 0 | 1 | 2 | 3, children: React.ReactNode) => {
    const ns = `hf${which}`;
    return (
      <Animated.View
        key={which}
        style={[StyleSheet.absoluteFill, pivot, { transform: [{ rotate: sway[which] }] }]}
      >
        <Svg {...svg}>
          <Defs>
            <Paints ns={ns} />
            <Fade ns={ns} />
          </Defs>
          <G mask={`url(#${ns}-fade)`}>{children}</G>
        </Svg>
      </Animated.View>
    );
  };

  const ribbonsOf = (which: number) =>
    paths
      .filter((r) => r.layer === which)
      .map((r, i) => (
        <Path key={`${which}-${i}`} d={r.d} fill={`url(#hf${which}-${r.paint})`} opacity={r.opacity} />
      ));

  return (
    <View
      style={[styles.stage, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {/* O campo: o gradiente da marca que **desaparece** antes do pé, para não haver emenda. */}
      <Svg {...svg}>
        <Defs>
          <Field ns="hfField" />
          <Fade ns="hfField" />
        </Defs>
        <G mask="url(#hfField-fade)">
          <Rect x="0" y="0" width={W} height={H} fill="url(#hfField-field)" />
          <Ellipse cx={CROWN.x} cy={CROWN.y + 150} rx={W * 0.72} ry={H * 0.34} fill="url(#hfField-bloom)" />
        </G>
      </Svg>

      {layer(0, ribbonsOf(0))}

      {/* A figura, entre o cabelo de trás e o da frente. */}
      <Svg {...svg}>
        <Defs>
          <Paints ns="hfBody" />
          <Fade ns="hfBody" />
        </Defs>
        <G mask="url(#hfBody-fade)">
          <Path d={PROFILE} fill="url(#hfBody-skin)" />
          <Path d={SHEEN} fill="url(#hfBody-pearl)" opacity={0.5} />
        </G>
      </Svg>

      {layer(1, ribbonsOf(1))}
      {layer(2, ribbonsOf(2))}
      {layer(3, ribbonsOf(3))}

      {/* A touca, por último: esconde as vinte raízes de uma vez e devolve a linha do cabelo. */}
      <Svg {...svg}>
        <Defs>
          <Paints ns="hfCap" />
          <Fade ns="hfCap" />
        </Defs>
        <G mask="url(#hfCap-fade)">
          <Path d={CAP} fill="url(#hfCap-wine)" />
        </G>
      </Svg>
    </View>
  );
}

/**
 * O gradiente do campo e o brilho. Não há retângulo de cor chapada em lugar nenhum: o topo é
 * profundo, o pé é **transparente**, e a tela abaixo continua sendo o creme da Huna.
 */
function Field({ ns }: { ns: string }) {
  return (
    <>
      <LinearGradient
        id={`${ns}-field`}
        gradientUnits="userSpaceOnUse"
        x1={W * 0.8}
        y1="0"
        x2={W * 0.2}
        y2={H}
      >
        <Stop offset="0" stopColor={color.violet} />
        <Stop offset="0.42" stopColor="#3B1128" />
        <Stop offset="0.78" stopColor={color.wine} stopOpacity="0.5" />
        <Stop offset="1" stopColor={color.wine} stopOpacity="0" />
      </LinearGradient>
      <RadialGradient id={`${ns}-bloom`} cx="0.5" cy="0.42" r="0.6">
        <Stop offset="0" stopColor="#F3B8CE" stopOpacity="0.34" />
        <Stop offset="1" stopColor="#F3B8CE" stopOpacity="0" />
      </RadialGradient>
    </>
  );
}

/**
 * ⚠️ **Todos em `userSpaceOnUse`, e isso não é preferência.** O padrão do SVG é
 * `objectBoundingBox`: cada caminho recebe o gradiente esticado sobre a **sua** caixa. Com vinte
 * fitas de tamanhos diferentes compartilhando quatro gradientes, isso daria vinte iluminações
 * discordantes — a mesma classe de defeito que, na versão anterior, virou uma cunha escura na
 * têmpora. Em coordenadas do palco há **uma** luz, e todas as fitas obedecem a ela.
 */
function Paints({ ns }: { ns: string }) {
  const axis = { gradientUnits: 'userSpaceOnUse', x1: W * 0.86, y1: 0, x2: W * 0.1, y2: H } as const;
  return (
    <>
      <LinearGradient id={`${ns}-deep`} {...axis}>
        <Stop offset="0" stopColor="#5E2340" />
        <Stop offset="0.5" stopColor="#3A1226" />
        <Stop offset="1" stopColor="#200A16" />
      </LinearGradient>
      <LinearGradient id={`${ns}-wine`} {...axis}>
        <Stop offset="0" stopColor="#8E3358" />
        <Stop offset="0.55" stopColor={color.wine} />
        <Stop offset="1" stopColor="#2A0C1A" />
      </LinearGradient>
      <LinearGradient id={`${ns}-berry`} {...axis}>
        <Stop offset="0" stopColor="#D77BA0" />
        <Stop offset="0.45" stopColor={color.berry} />
        <Stop offset="1" stopColor="#4A1730" />
      </LinearGradient>
      <LinearGradient id={`${ns}-plum`} {...axis}>
        <Stop offset="0" stopColor="#B45F87" />
        <Stop offset="0.5" stopColor={color.accent} />
        <Stop offset="1" stopColor="#331036" />
      </LinearGradient>
      <LinearGradient id={`${ns}-violet`} {...axis}>
        <Stop offset="0" stopColor="#9B7BC4" />
        <Stop offset="0.5" stopColor={color.violet} />
        <Stop offset="1" stopColor="#241040" />
      </LinearGradient>
      <LinearGradient id={`${ns}-lilac`} {...axis}>
        <Stop offset="0" stopColor="#F0DCEE" />
        <Stop offset="0.6" stopColor="#C9A6D8" />
        <Stop offset="1" stopColor="#8E6BA8" />
      </LinearGradient>
      <LinearGradient id={`${ns}-pearl`} {...axis}>
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.55" stopColor="#FBE9F1" />
        <Stop offset="1" stopColor="#E2BCD0" />
      </LinearGradient>
      {/* A pele: perolada, quase translúcida, e some antes de virar busto. */}
      <LinearGradient
        id={`${ns}-skin`}
        gradientUnits="userSpaceOnUse"
        x1={W * 0.8}
        y1={H * 0.09}
        x2={W * 0.46}
        y2={H * 0.56}
      >
        <Stop offset="0" stopColor="#FFF6FA" />
        <Stop offset="0.4" stopColor="#F3D8E5" />
        <Stop offset="0.64" stopColor="#D9A8C0" stopOpacity="0.72" />
        <Stop offset="0.86" stopColor="#B98BA6" stopOpacity="0.18" />
        <Stop offset="1" stopColor="#B98BA6" stopOpacity="0" />
      </LinearGradient>
    </>
  );
}

/**
 * A dissolução no pé.
 *
 * ⚠️ **É a máscara que substitui o retângulo vinho com canto arredondado.** Um painel com borda
 * termina; uma máscara em gradiente **não termina** — a figura, o cabelo e o campo se apagam juntos
 * na mesma altura e entregam a tela ao creme sem emenda. É a diferença entre um pôster dentro de um
 * cartão e uma composição.
 */
function Fade({ ns }: { ns: string }) {
  return (
    <>
      <LinearGradient id={`${ns}-fadeRamp`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.42" stopColor="#FFFFFF" />
        <Stop offset="0.68" stopColor="#000000" />
        <Stop offset="1" stopColor="#000000" />
      </LinearGradient>
      <Mask id={`${ns}-fade`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
        <Rect x="0" y="0" width={W} height={H} fill={`url(#${ns}-fadeRamp)`} />
      </Mask>
    </>
  );
}

const styles = StyleSheet.create({
  // Sem cor de fundo: o campo é desenhado e some. Uma cor aqui recriaria a borda que a máscara tira.
  stage: { overflow: 'hidden' },
});
