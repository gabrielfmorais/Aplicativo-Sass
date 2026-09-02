import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import { color } from './tokens';

/**
 * SPEC-026 fatia 8 — a assinatura de fundo da Huna.
 *
 * **Ambientação, não papel de parede.** Curvas grandes inspiradas em mechas, em ameixa e lilás com
 * presença muito baixa, sobre o creme que continua sendo o canvas. A intenção é lembrar cabelo e
 * movimento quase sem ser notada — se ela for percebida como desenho, está errada.
 *
 * ⚠️ **Opacidades entre 0.04 e 0.13, e é de propósito.** A primeira versão ficou entre 0.03 e
 * 0.07 e o fundo simplesmente não existia a 390px: sutil não é ausente. A curva tem de ser
 * percebida de canto de olho, e não só num zoom. O fundo tem de perder **toda** disputa com
 * o conteúdo: qualquer coisa acima disso vira decoração e come o contraste do texto que passa por
 * cima. A regra de contraste (AC8) não é afrouxada aqui — ela é respeitada por o fundo praticamente
 * não existir em termos de luminância.
 *
 * **Não é animado.** Movimento no fundo de uma tela que rola é enjoativo, e um fundo que se mexe
 * atrás de texto compete com a leitura. O movimento do produto está no hero e nas microinterações,
 * onde há um gesto para acompanhar.
 *
 * Decorativo para tecnologia assistiva, e `pointerEvents="none"`: nunca intercepta um toque.
 */

/**
 * Três curvas longas, abertas, atravessando a tela — não fios finos: nesta opacidade um traço fino
 * simplesmente desaparece, e o que resta é sujeira. Formas grandes e preenchidas são o único jeito
 * de sugerir mecha quase no limiar do invisível.
 */
const SWEEPS = [
  'M-40 120 C 60 60, 180 140, 300 90 C 380 56, 430 80, 460 120 L 460 -40 L -40 -40 Z',
  'M-40 520 C 80 460, 160 560, 280 520 C 380 486, 430 520, 460 560 L 460 700 L -40 700 Z',
  'M-40 330 C 90 290, 150 380, 260 350 C 360 322, 420 350, 460 380',
] as const;

export function HunaBackdrop() {
  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sweepA" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color.violet} stopOpacity="0.1" />
            <Stop offset="1" stopColor={color.accent} stopOpacity="0.04" />
          </LinearGradient>
          <LinearGradient id="sweepB" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.berry} stopOpacity="0.09" />
            <Stop offset="1" stopColor={color.wine} stopOpacity="0.04" />
          </LinearGradient>
          {/* O glow: um sopro de luz atrás do conteúdo, para o creme não ser uma chapa uniforme. */}
          <RadialGradient id="bloom" cx="0.78" cy="0.16" r="0.6">
            <Stop offset="0" stopColor={color.berry} stopOpacity="0.13" />
            <Stop offset="1" stopColor={color.berry} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bloomLow" cx="0.16" cy="0.82" r="0.55">
            <Stop offset="0" stopColor={color.violet} stopOpacity="0.12" />
            <Stop offset="1" stopColor={color.violet} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Ellipse cx={330} cy={120} rx={280} ry={240} fill="url(#bloom)" />
        <Ellipse cx={70} cy={620} rx={260} ry={220} fill="url(#bloomLow)" />

        <Path d={SWEEPS[0]} fill="url(#sweepA)" />
        <Path d={SWEEPS[1]} fill="url(#sweepB)" />
        {/* A única aberta: um traço largo e translúcido, que é o mais perto de "mecha" que esta
            opacidade permite sem virar mancha. */}
        <Path
          d={SWEEPS[2]}
          fill="none"
          stroke={color.accent}
          strokeOpacity="0.08"
          strokeWidth={26}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}
