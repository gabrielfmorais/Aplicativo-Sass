import type { HunaAvatar } from '../../identity/index.ts';

/**
 * SPEC-044 (F45) — o card compartilhável.
 *
 * > O ato de compartilhar é **FREE**. Crescimento orgânico não fica atrás de paywall. — D-103
 *
 * ⚠️ **Privacidade é a capability, não um extra dela.** Este tipo é a fronteira: o que não estiver
 * aqui **não pode** chegar ao card. Não há `userId`, não há id de fato, não há e-mail — e é por o
 * card ser construído a partir deste tipo, e não de uma view interna, que isso é verificável em vez
 * de prometido (BR1).
 */

/** Os dois formatos que o Blueprint §25 exige. As medidas são as que as redes esperam. */
export const SHARE_FORMATS = {
  story: { key: 'story', width: 1080, height: 1920, label: 'Stories' },
  feed: { key: 'feed', width: 1080, height: 1080, label: 'Feed' },
} as const;

export type ShareFormatKey = keyof typeof SHARE_FORMATS;

/**
 * As medidas em que o card deve ser **rasterizado**.
 *
 * ⚠️ **Existe porque o padrão do rasterizador é o tamanho da TELA.** `Svg.toDataURL()` sem medidas
 * gera o PNG no tamanho renderizado — ~210px de largura no preview —, e o card chegaria ao Instagram
 * minúsculo e borrado, com os formatos de 1080 existindo só no papel. A regra mora aqui, junto da
 * definição do formato, e não solta dentro de uma tela onde ninguém a veria sumir.
 */
export const captureSizeOf = (format: ShareFormatKey): { width: number; height: number } => ({
  width: SHARE_FORMATS[format].width,
  height: SHARE_FORMATS[format].height,
});

/**
 * O que ela escolhe mostrar.
 *
 * ⚠️ **O padrão é privado** (BR6): nome e avatar começam **desligados**. Um padrão que já traz o
 * nome dela transformaria o preview numa confirmação, e o preview é o consentimento — não um aviso.
 */
export type ShareCardOptions = {
  readonly showName: boolean;
  readonly showAvatar: boolean;
};

export const DEFAULT_SHARE_OPTIONS: ShareCardOptions = { showName: false, showAvatar: false };

/**
 * O conteúdo pronto do card. Tudo é texto já formatado: o card **não calcula nada**, porque um
 * número calculado aqui poderia discordar do número que a tela mostrou (BR4).
 */
export type ShareCardContent = {
  /** A conquista, em uma palavra ou duas. Nunca fala do cabelo dela (BR6 da SPEC-043). */
  readonly headline: string;
  /** O número grande. */
  readonly value: string;
  /** O que o número significa, **na primeira pessoa** — o card é dela, e quem lê não é ela. */
  readonly valueLabel: string;
  /** Uma linha de contexto, ou nada. */
  readonly footnote: string | null;
  /** `null` quando ela não quis, ou quando não há nome (SPEC-018 EC6). */
  readonly displayName: string | null;
  /** `null` quando ela não quis, ou quando não escolheu marca (SPEC-042). */
  readonly avatar: HunaAvatar | null;
};

/** No card, um nome longo trunca em vez de vazar do quadro (EC5). */
export const MAX_SHARE_NAME = 18;
