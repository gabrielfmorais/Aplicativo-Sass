import type { ShareCardContent, ShareFormatKey } from '@app/core';
import { SHARE_FORMATS } from '@app/core';
import { forwardRef } from 'react';
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';

import { AVATAR_MARKS, STRANDS } from '@/design/huna-avatars';
import { CARD_FONT, CARD_LAYOUT, CARD_PALETTE, CARD_STRANDS, heroFontSize } from '@/design/share-card-art';

/**
 * SPEC-044 (F45) — **o card**, inteiro em `react-native-svg`.
 *
 * ⚠️ **SVG e não `View`, e isso é o que torna o share possível sem dependência nova.** `Svg` expõe
 * `toDataURL()`, então o próprio card se rasteriza — não é preciso capturar a tela nem instalar um
 * capturador. De quebra ele **renderiza no preview web**, o que mantém a validação a 390px viva
 * (D-101): foi exatamente essa validação que reprovou uma dependência antes.
 *
 * 🔒 **Direção canônica do hero (SPEC-036).** Fluxo, mechas, movimento. ⛔ **Sem personagem, sem
 * rosto, sem cabeça, sem corpo, sem silhueta humana** — e um card sai do app para o feed de outra
 * pessoa, que é o último lugar onde valeria reabrir uma decisão que já reprovou quatro tentativas.
 *
 * ⚠️ **Ele só sabe o que o `ShareCardContent` traz** (BR1). Não recebe view interna, não recebe
 * sessão, não recebe id: o que não está no tipo não tem por onde chegar aqui.
 */
export const ShareCard = forwardRef<
  Svg,
  { content: ShareCardContent; format: ShareFormatKey; width: number }
>(function ShareCard({ content, format, width }, ref) {
  const { width: vw, height: vh } = SHARE_FORMATS[format];
  const scale = width / vw;
  const clip = `clip-${format}`;
  const grad = `grad-${format}`;
  const base = vh - CARD_LAYOUT.contentBottom;
  const mark = content.avatar ? AVATAR_MARKS[content.avatar] : null;
  // ⚠️ SVG não reflui texto: o que não couber **sai do quadro**, sem aviso.
  const heroSize = heroFontSize(content.value, vw - CARD_LAYOUT.marginX * 2);

  return (
    <Svg ref={ref} width={width} height={vh * scale} viewBox={`0 0 ${vw} ${vh}`}>
      <Defs>
        <LinearGradient id={grad} x1="0" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={CARD_PALETTE.background} />
          <Stop offset="1" stopColor={CARD_PALETTE.backgroundEnd} />
        </LinearGradient>
        <ClipPath id={clip}>
          <Rect x="0" y="0" width={vw} height={vh} />
        </ClipPath>
      </Defs>

      <Rect x="0" y="0" width={vw} height={vh} fill={`url(#${grad})`} />

      {/*
          ⚠️ **Esticadas até a altura do formato, não centradas** — e a diferença só apareceu a
          390px. Centrando um quadro de 1000 dentro de 1920, as mechas terminavam ~40px antes da
          base e o `strokeLinecap="round"` deixava **as pontas arredondadas visíveis dentro do
          card**: cabelo que começa e termina no meio do quadro vira objeto, e objeto não é cabelo.
          Esticando, elas sangram pelas duas bordas em qualquer formato — e no 9:16 a queda fica
          mais longa, que é justamente o que um Story pede.
        */}
      <G clipPath={`url(#${clip})`} transform={`scale(1 ${vh / 1000})`}>
        {CARD_STRANDS.map((strand, i) => (
          <Path
            key={i}
            d={strand.d}
            fill="none"
            stroke={CARD_PALETTE.strand}
            strokeOpacity={strand.opacity}
            strokeWidth={strand.width}
            strokeLinecap="round"
          />
        ))}
      </G>

      {/* A marca é discreta e fica longe do conteúdo — o card é da conquista dela, não nosso. */}
      <Text
        fontFamily={CARD_FONT}
        x={CARD_LAYOUT.marginX}
        y={CARD_LAYOUT.wordmarkY}
        fontSize={34}
        fontWeight="700"
        fill={CARD_PALETTE.wordmark}
        letterSpacing={12}
      >
        HUNA
      </Text>

      {mark ? (
        <G transform={`translate(${CARD_LAYOUT.marginX} ${base - 396})`}>
          <Circle cx={26} cy={0} r={26} fill={mark.bg} />
          {/* A marca dela, na mesma geometria do avatar de 40px — reduzida, nunca redesenhada. */}
          <G transform={`translate(0 -26) scale(0.52) rotate(${mark.tilt} 50 50)`}>
            {STRANDS.map((s, i) => (
              <Path
                key={i}
                d={s.d}
                fill="none"
                stroke={mark.strand}
                strokeWidth={s.width}
                strokeLinecap="round"
              />
            ))}
          </G>
        </G>
      ) : null}

      {content.displayName ? (
        <Text
          fontFamily={CARD_FONT}
          x={CARD_LAYOUT.marginX + (mark ? 70 : 0)}
          y={base - 384}
          fontSize={36}
          fill={CARD_PALETTE.footnote}
        >
          {content.displayName}
        </Text>
      ) : null}

      <Text
        fontFamily={CARD_FONT}
        x={CARD_LAYOUT.marginX}
        y={base - 286}
        fontSize={40}
        fontWeight="600"
        fill={CARD_PALETTE.headline}
        letterSpacing={7}
      >
        {content.headline.toUpperCase()}
      </Text>

      <Text
        fontFamily={CARD_FONT}
        x={CARD_LAYOUT.marginX - 8}
        y={base - 90}
        fontSize={heroSize}
        fontWeight="800"
        fill={CARD_PALETTE.value}
      >
        {content.value}
      </Text>

      {/* O rótulo quebra em duas linhas fixas: SVG não reflui texto, e medir fonte aqui seria
            adivinhar. Duas linhas cabem em todas as frases que o core produz. */}
      {splitLabel(content.valueLabel).map((line, i) => (
        <Text
          key={i}
          fontFamily={CARD_FONT}
          x={CARD_LAYOUT.marginX}
          y={base - 24 + i * 54}
          fontSize={42}
          fill={CARD_PALETTE.label}
        >
          {line}
        </Text>
      ))}

      {content.footnote ? (
        <Text
          fontFamily={CARD_FONT}
          x={CARD_LAYOUT.marginX}
          y={base + 110}
          fontSize={32}
          fill={CARD_PALETTE.footnote}
        >
          {content.footnote}
        </Text>
      ) : null}
    </Svg>
  );
});

/** Quebra no último espaço antes do meio, para as duas linhas ficarem parecidas. */
const splitLabel = (label: string): string[] => {
  const words = label.split(' ');
  if (words.length < 4) return [label];
  const at = Math.ceil(words.length / 2);
  return [words.slice(0, at).join(' '), words.slice(at).join(' ')];
};
