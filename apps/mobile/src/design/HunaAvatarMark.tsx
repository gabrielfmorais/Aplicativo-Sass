import type { HunaAvatar } from '@app/core';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { AVATAR_MARKS, STRANDS } from '@/design/huna-avatars';

/**
 * SPEC-042 (F34) — a marca da Huna, desenhada.
 *
 * A geometria mora em `huna-avatars.ts`, como dado puro: este arquivo só a renderiza. É a mesma
 * separação do hero (SPEC-036), e o motivo é o mesmo — a composição pode ser vista fora do app.
 *
 * ⚠️ **A rotação vai para dentro do `<G>`, nunca na `View`.** Girar a `View` gira o retângulo que a
 * recorta, e o resultado é uma borda reta cortando o círculo — defeito real, medido a 390px na
 * SPEC-036 e que teste nenhum pegou.
 */
export function HunaAvatarMark({ avatar, size = 40 }: { avatar: HunaAvatar; size?: number }) {
  const mark = AVATAR_MARKS[avatar];
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={50} fill={mark.bg} />
        <G rotation={mark.tilt} origin="50, 50">
          {STRANDS.map((strand) => (
            <Path
              key={strand.d}
              d={strand.d}
              stroke={mark.strand}
              strokeWidth={strand.width}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}
