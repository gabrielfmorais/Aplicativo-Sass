import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';

import { PAINTS, SCENES, type FigureFrame, type Scene, type Strand } from './huna-hero';
import { useReduceMotion } from './motion';
import { ribbonPath } from './ribbon';

/**
 * SPEC-036 — o hero da Huna: **cabelo abstrato**.
 *
 * ⚠️ **Não há personagem, e essa é a decisão final de direção.** As versões anteriores desenharam
 * uma figura — de frente, de perfil, de costas — e todas foram reprovadas. Rosto, corpo e silhueta
 * humana são implacáveis: um milímetro errado vira "estranho". O dono encerrou a frente de
 * personagem e escolheu o que o produto precisa dizer: grandes mechas orgânicas, e nada mais.
 *
 * **Este arquivo é o palco. O desenho está em `huna-hero.ts`, e essa separação é o método.** A
 * geometria é dado puro, sem React e sem SVG — o que permite renderizá-la **fora do app** e olhar
 * antes de decidir. As versões reprovadas foram julgadas só depois de prontas.
 *
 * ⚠️ **São duas CENAS, não dois recortes.** A abertura é vertical e sangra pela tela; o login é uma
 * faixa larga dentro de um cartão. Enquadrar a composição alta na caixa larga foi tentado e
 * reprovado — lia como imagem cortada, porque era. Cada cena traz as suas mechas, o seu palco, a sua
 * luz e o seu pivô; este componente não sabe desenhar nada, só monta o que a cena declara.
 *
 * **Redução de movimento (FR2):** nada anima antes de a preferência ser **conhecida** — o estado
 * inicial do hook é `null`, não `false`. E o repouso é o **meio** do arco, não a ponta.
 *
 * Decorativo para tecnologia assistiva: não há aqui informação que alguém precise para agir.
 */

/** O que todo `Svg` de uma cena recebe: mesmo palco, mesmo enquadramento, mesma caixa. */
type SvgProps = {
  style: StyleProp<ViewStyle>;
  viewBox: string;
  preserveAspectRatio: string;
};

/**
 * Um balanço lento, em loop, com atraso próprio.
 *
 * ⚠️ **O repouso é o MEIO do balanço, e não a ponta.** O valor parado vale 0; com `[0, 1]` mapeado
 * para `[-graus, +graus]`, o zero seria o **extremo**, e cada mecha ficaria torcida no limite do
 * arco. Como a preferência de redução de movimento chega de forma assíncrona, **toda** usuária veria
 * essa pose no primeiro quadro e um pulo quando a animação começasse. Com `[-1, 1]` em torno de
 * zero, parado é neutro.
 *
 * ⚠️ **E o driver é nativo.** Animar a prop de um nó SVG obriga a atravessar a ponte a cada quadro —
 * um render de React por quadro, por mecha, e no teste isso vira uma enxurrada de `act(...)`. Girar
 * a `View` que contém o SVG não: o transform vive na thread de UI.
 */
const useSway = (enabled: boolean, seconds: number, degrees: number, delay: number) => {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) return;
    const swing = (toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        swing(1, seconds * 500),
        swing(-1, seconds * 1000),
        swing(0, seconds * 500),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enabled, value, seconds, delay]);

  return value.interpolate({
    inputRange: [-1, 1],
    outputRange: [`${-degrees}deg`, `${degrees}deg`],
  });
};

/**
 * Uma mecha: o contorno, a tinta e o **seu** balanço.
 *
 * ⚠️ **Cada mecha é um componente, e não uma volta de `map` dentro do pai.** Chamar `useSway` dentro
 * de um `map` amarra a quantidade de hooks ao tamanho da lista — funciona enquanto a lista é
 * constante e quebra no dia em que alguém a torna dinâmica, que é a armadilha que a regra dos hooks
 * existe para impedir. E aqui a lista **muda mesmo**: cada cena traz a sua.
 *
 * ⚠️ **Cada `Svg` precisa das suas `defs` com ids próprios.** No nativo as definições são escopadas
 * por raiz de SVG; **na web não são** — vários `<svg>` na mesma página compartilham o documento, e
 * uma referência a `#wine` resolve para o **primeiro** `#wine` que o navegador achar. Com várias
 * cópias do mesmo id o desenho continuava certo só porque as cópias eram idênticas; no dia em que
 * alguém mudasse uma, a web usaria outra em silêncio.
 */
function Lock({
  strand,
  scene,
  svg,
  moving,
}: {
  strand: Strand;
  scene: Scene;
  svg: SvgProps;
  moving: boolean;
}) {
  const rotate = useSway(moving, strand.sway.seconds, strand.sway.degrees, strand.sway.delay);
  /** Gerar o contorno custa; gerar uma vez por montagem não custa nada. */
  const d = useMemo(() => ribbonPath(strand.spine, strand.width), [strand]);
  const ns = `hh-${strand.id}`;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transformOrigin: scene.pivot }, { transform: [{ rotate }] }]}
    >
      <Svg {...svg}>
        <Defs>
          <Paint ns={ns} scene={scene} name={strand.paint} />
          <Fade ns={ns} scene={scene} />
        </Defs>
        <Veiled ns={ns} scene={scene}>
          <Path d={d} fill={`url(#${ns}-paint)`} opacity={strand.opacity} />
        </Veiled>
      </Svg>
    </Animated.View>
  );
}

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
  const scene = SCENES[frame];

  const svg: SvgProps = {
    style: [styles.canvas, scene.box],
    viewBox: scene.viewBox,
    preserveAspectRatio: `${scene.align} slice`,
  };

  return (
    <View
      style={[styles.stage, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {/* O fundo do cartão, quando a cena tem um. Parado: só as mechas se movem. */}
      {scene.ground ? (
        <Svg {...svg}>
          <Defs>
            <Paint ns="hh-ground" scene={scene} name={scene.ground} />
          </Defs>
          <Rect
            x={-scene.stage.W}
            y={-scene.stage.H}
            width={scene.stage.W * 3}
            height={scene.stage.H * 3}
            fill="url(#hh-ground-paint)"
          />
        </Svg>
      ) : null}

      {scene.strands.map((s) => (
        <Lock key={s.id} strand={s} scene={scene} svg={svg} moving={moving} />
      ))}

      {/*
        A ponte com o wordmark: um véu escuro no topo, por cima de tudo e **parado**.
        Sem ele o texto se apoia no que a mecha da vez tiver deixado ali — e as mechas se movem.
      */}
      {scene.veil ? (
        <Svg {...svg}>
          <Defs>
            {/*
              ⚠️ **O eixo começa em `y = 0`, e não acima do quadro.** Na primeira versão ele ia de
              `-H` até o pé do véu: em `y = 0` a rampa já estava a dois terços do caminho, o véu
              chegava quase transparente na única faixa em que ele precisava existir, e o topo ficou
              exatamente como estava antes. O que cobre acima de zero é o retângulo, não a rampa —
              antes do primeiro `stop` o gradiente mantém a cor dele.
            */}
            <LinearGradient
              id="hh-veil"
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2={scene.stage.H * scene.veil.to}
            >
              <Stop offset="0" stopColor="#260D18" stopOpacity={scene.veil.opacity} />
              <Stop offset="0.55" stopColor="#260D18" stopOpacity={scene.veil.opacity * 0.4} />
              <Stop offset="1" stopColor="#260D18" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x={-scene.stage.W}
            y={-scene.stage.H}
            width={scene.stage.W * 3}
            height={scene.stage.H * 2}
            fill="url(#hh-veil)"
          />
        </Svg>
      ) : null}
    </View>
  );
}

/**
 * ⚠️ **Em `userSpaceOnUse`, e isso não é preferência.** O padrão do SVG é `objectBoundingBox`: cada
 * caminho recebe o gradiente esticado sobre a **sua** caixa. Com mechas de tamanhos diferentes, isso
 * daria iluminações discordantes. Em coordenadas do palco há **uma** luz, e todas obedecem a ela.
 */
function Paint({ ns, scene, name }: { ns: string; scene: Scene; name: string }) {
  return (
    <LinearGradient
      id={`${ns}-paint`}
      gradientUnits="userSpaceOnUse"
      x1={scene.light.x1}
      y1={scene.light.y1}
      x2={scene.light.x2}
      y2={scene.light.y2}
    >
      {(PAINTS[name] ?? []).map((s) => (
        <Stop key={s.offset} offset={s.offset} stopColor={s.color} />
      ))}
    </LinearGradient>
  );
}

/** Aplica a dissolução, quando a cena tem uma. Num cartão não há o que dissolver. */
function Veiled({ ns, scene, children }: { ns: string; scene: Scene; children: React.ReactNode }) {
  if (!scene.fade) return <G>{children}</G>;
  return <G mask={`url(#${ns}-fade)`}>{children}</G>;
}

/**
 * A dissolução no pé.
 *
 * ⚠️ **Ela tem de zerar ANTES do texto.** O hero não pode encostar em nenhuma escrita da tela — nem
 * a 20% de opacidade. Alongar as mechas sem mover a rampa junto é o jeito de reintroduzir o defeito.
 *
 * ⚠️ **E é a máscara que substitui o retângulo com canto arredondado.** Um painel com borda termina;
 * uma máscara em gradiente **não termina** — a composição se apaga e entrega a tela ao creme sem
 * emenda. É a diferença entre um pôster dentro de um cartão e uma composição.
 */
function Fade({ ns, scene }: { ns: string; scene: Scene }) {
  if (!scene.fade) return null;
  const { W, H } = scene.stage;
  return (
    <>
      <LinearGradient id={`${ns}-ramp`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset={scene.fade.from} stopColor="#FFFFFF" />
        <Stop offset={scene.fade.to} stopColor="#000000" />
        <Stop offset="1" stopColor="#000000" />
      </LinearGradient>
      {/*
        ⚠️ **Bem maior que o palco, de propósito.** O enquadramento pode olhar para uma janela
        deslocada e as mechas nascem acima do quadro; o que cai fora da máscara é apagado. Uma
        máscara do tamanho exato do palco viraria um corte reto na borda.
      */}
      <Mask id={`${ns}-fade`} maskUnits="userSpaceOnUse" x={-W} y={-H} width={W * 3} height={H * 2}>
        <Rect x={-W} y={-H} width={W * 3} height={H * 2} fill={`url(#${ns}-ramp)`} />
      </Mask>
    </>
  );
}

const styles = StyleSheet.create({
  // Sem cor de fundo: quem tem fundo declara `ground`. Uma cor aqui recriaria a moldura que a
  // máscara existe para tirar.
  stage: { overflow: 'hidden' },
  canvas: { position: 'absolute' },
});
