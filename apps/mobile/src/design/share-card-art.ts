/**
 * SPEC-044 (F45) — a arte do card compartilhável, como **dado puro**.
 *
 * Sem React, sem SVG, sem `react-native`: é o método da SPEC-036, e é ele que permite **desenhar o
 * card fora do app e olhar** antes de qualquer coisa entrar na tela. Toda versão reprovada do hero
 * foi julgada só depois de pronta; aqui a mesma disciplina custa nada.
 *
 * 🔒 **Direção canônica do hero, aplicada ao card** (SPEC-036, decisão do dono 2026-09-03): fluxo,
 * mechas, movimento capilar. ⛔ **Sem personagem, sem rosto, sem cabeça, sem corpo, sem silhueta
 * humana.** Um card sai do app e vai para o Instagram de outra pessoa — é o último lugar onde vale
 * reabrir uma decisão que já reprovou quatro tentativas.
 *
 * As coordenadas vivem num quadro de **1000 de largura**, e a altura muda com o formato. Quem
 * desenha escala; a geometria não sabe em que tamanho vai sair.
 */

/**
 * As mechas, num quadro de 1000 de largura, **atravessando o card inteiro** (de `-120` a `1420`,
 * portanto sempre sangrando pelas duas bordas em qualquer formato).
 *
 * ⚠️ **Quatro famílias foram desenhadas e comparadas fora do app antes desta entrar**, e a primeira
 * foi reprovada pelo modo de falha que o dono nomeou para o hero: *"fita abstrata, tecido,
 * tentáculo, onda genérica"*. Poucas mechas e grossas leem como vermes soltos, não como cabelo.
 *
 * O que resolveu foi **densidade com variação e convergência**: onze fios com espessuras alternadas
 * (14 a 46) que **caem juntos** curvando para a esquerda, como uma mecha vista de lado. É a mesma
 * lição das marcas da SPEC-042 — o que faz um conjunto parecer cabelo é o movimento comum, não o
 * traço individual — e a variação de opacidade dá a profundidade que uma opacidade só não dá.
 *
 * Elas ocupam a **direita**; a esquerda fica limpa para o conteúdo. É o que permite o mesmo desenho
 * servir 9:16 e 1:1 sem dois layouts.
 */
export const CARD_STRANDS = [
  { d: 'M 430 -120 C 367 210, 460 440, 340 720 S 295 1060, 349 1420', width: 14, opacity: 0.06 },
  { d: 'M 504 -120 C 427 210, 534 440, 394 720 S 339 1060, 405 1420', width: 22, opacity: 0.09 },
  { d: 'M 578 -120 C 487 210, 608 440, 448 720 S 383 1060, 461 1420', width: 34, opacity: 0.13 },
  { d: 'M 652 -120 C 547 210, 682 440, 502 720 S 427 1060, 517 1420', width: 46, opacity: 0.17 },
  { d: 'M 726 -120 C 607 210, 756 440, 556 720 S 471 1060, 573 1420', width: 26, opacity: 0.1 },
  { d: 'M 800 -120 C 667 210, 830 440, 610 720 S 515 1060, 629 1420', width: 18, opacity: 0.07 },
  { d: 'M 874 -120 C 727 210, 904 440, 664 720 S 559 1060, 685 1420', width: 38, opacity: 0.14 },
  { d: 'M 948 -120 C 787 210, 978 440, 718 720 S 603 1060, 741 1420', width: 28, opacity: 0.11 },
  { d: 'M 1022 -120 C 847 210, 1052 440, 772 720 S 647 1060, 797 1420', width: 16, opacity: 0.06 },
  { d: 'M 1096 -120 C 907 210, 1126 440, 826 720 S 691 1060, 853 1420', width: 30, opacity: 0.12 },
  { d: 'M 1170 -120 C 967 210, 1200 440, 880 720 S 735 1060, 909 1420', width: 20, opacity: 0.08 },
] as const;

/**
 * ⚠️ **A fonte precisa ser explícita, e isso só apareceu olhando a 390px.** O `<Text>` do
 * `react-native-svg` vira um `<text>` de SVG puro, que **não herda a tipografia do app**: no web ele
 * caía no padrão do documento e o card saía inteiro em **serifada** — genérico, datado, e nada
 * parecido com o resto da Huna. Nenhum outro lugar do design system precisa disto, porque toda outra
 * tela passa pelas primitivas.
 *
 * Continua **sem fonte custom** (SPEC-016 NG3): é a pilha do sistema, nomeada.
 */
export const CARD_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * O conteúdo é ancorado **embaixo, à esquerda**, e a marca fica no topo.
 *
 * ⚠️ A primeira composição centrava o bloco e deixava **a metade de baixo do 9:16 vazia** — num
 * Story, é justamente ali que o olho termina. Ancorar embaixo resolve os dois formatos com um
 * número só, porque a distância até a base não muda quando a altura muda.
 */
/**
 * O tamanho do número/palavra herói, **ajustado ao que cabe**.
 *
 * ⚠️ **Defeito visto a 390px:** o tamanho era fixo em 248, o que só serve para um número de um ou
 * dois dígitos. Um marco escrito por extenso saía **cortado na borda** — o card mostrava
 * *"5 cuidad"* — e um cuidado de nome comprido ("Reconstrução") faria o mesmo. SVG **não reflui
 * texto**, então nada avisa: o excesso simplesmente sai do quadro.
 *
 * A largura de um caractere numa bold sem serifa fica perto de `0,58 × tamanho`. Daí o tamanho que
 * cabe na largura útil, com teto (para o número não crescer sem motivo) e piso (para a frase não
 * virar legenda).
 */
export const heroFontSize = (text: string, available: number): number => {
  const fits = available / (Math.max(text.length, 1) * 0.58);
  return Math.max(96, Math.min(248, Math.round(fits)));
};

export const CARD_LAYOUT = {
  marginX: 90,
  wordmarkY: 130,
  /** Distância do bloco de conteúdo até a **base** do card. */
  contentBottom: 250,
} as const;

/**
 * A paleta do card. Fundo escuro de propósito: no feed de outra pessoa, um card claro desaparece
 * contra a interface branca das redes — e a família da marca (vinho, ameixa, roxo) só ganha peso
 * quando é ela que carrega o quadro, não quando decora uma borda.
 */
export const CARD_PALETTE = {
  background: '#3A1128',
  backgroundEnd: '#5A1F3C',
  strand: '#F6E9EF',
  headline: '#E8C8D8',
  value: '#FFFFFF',
  label: '#F0DCE6',
  footnote: '#D7B3C6',
  wordmark: '#E8C8D8',
} as const;
