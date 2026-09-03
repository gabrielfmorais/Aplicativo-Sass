/**
 * SPEC-036 — o hero da Huna: **cabelo abstrato**, como dados.
 *
 * ⚠️ **Não há personagem aqui, e essa é a decisão final de direção.** As versões anteriores tentaram
 * desenhar uma figura — de frente, de perfil, de costas — e todas foram reprovadas. Rosto, corpo e
 * silhueta humana são implacáveis: um milímetro errado vira "estranho", e a 390px o erro aparece
 * antes de qualquer outra coisa. O dono encerrou a frente de personagem e escolheu o que o produto
 * realmente precisa dizer: *"transforme a identidade da Huna em 3 ou 4 grandes mechas orgânicas e
 * fluidas"*.
 *
 * **Sem anatomia, sem personagem, sem realismo.** Massas grandes, curvas suaves, vinho · ameixa ·
 * roxo · berry, com movimento lento e um atraso próprio para cada uma.
 *
 * ⚠️ **Poucas e largas, e isso não é economia.** Uma versão anterior tinha vinte fitas finas e a
 * 390px o olho parava de seguir a curva para começar a **contar listras**. Quatro massas em curva
 * longa se leem de relance — que é o único teste que um hero precisa passar.
 *
 * ⚠️ **Translucidez é o que impede a volta das "listras duras".** Massa opaca sobre massa opaca cria
 * uma **borda**; translúcida sobre translúcida cria um terceiro tom que nenhuma das duas tem, e a
 * transição vira sombra em vez de recorte.
 *
 * ⚠️ **São DUAS composições, e não uma recortada em dois tamanhos.** A abertura é vertical e sangra
 * pela tela; o login é uma faixa larga dentro de um cartão. Enquadrar a composição alta na caixa
 * larga já foi tentado e reprovado — lia exatamente como o que era, *"uma imagem cortada"*. Cada
 * cena tem as suas mechas, desenhadas para a **proporção** em que vai viver, e as duas partilham
 * tinta, gesto e maquinário.
 *
 * Puro: só números e strings, sem React e sem SVG. É o que permite renderizar esta geometria **fora
 * do app** e olhar antes de decidir — o passo que faltava nas versões reprovadas.
 */

import type { Spine, WidthProfile } from './ribbon';
import { color } from './tokens';

export type PaintName = 'deep' | 'wine' | 'berry' | 'plum' | 'violet';

export type Strand = {
  /** Um nome, porque quatro massas se discutem por nome e vinte fitas só se discutiam por índice. */
  readonly id: string;
  readonly spine: Spine;
  readonly width: WidthProfile;
  readonly paint: PaintName;
  readonly opacity: number;
  /** O balanço próprio: período em segundos, amplitude em graus, e o atraso na entrada. */
  readonly sway: { readonly seconds: number; readonly degrees: number; readonly delay: number };
};

const p = (x: number, y: number) => ({ x, y });

/* ────────────────────────────  A ABERTURA  ──────────────────────────── */

/** O palco da abertura. Alto porque a tela é alta: um palco quadrado mostra menos da metade dela. */
const OPEN = { W: 360, H: 780 } as const;

/**
 * As quatro mechas da abertura.
 *
 * ⚠️ **Todas nascem acima do quadro e saem por baixo.** Massa que começa e termina dentro do
 * enquadramento lê como objeto recortado; massa que atravessa lê como movimento contínuo. Por isso
 * as espinhas começam em `y` negativo e terminam além do pé — o que se vê é sempre um trecho.
 *
 * ⚠️ **Os períodos não são múltiplos entre si e os atrasos crescem.** É o desalinhamento que faz o
 * conjunto parecer cabelo em vez de uma imagem girando inteira: a massa de trás vai primeiro, as da
 * frente respondem depois. Amplitudes de um a três graus — movimento lento, não animação.
 */
const OPEN_STRANDS: readonly Strand[] = [
  {
    id: 'deep',
    spine: [p(46, -90), p(118, 60), p(84, 214), p(172, 356), p(148, 520)],
    width: { max: 214, bulge: 0.95, taper: 0.9 },
    paint: 'deep',
    opacity: 1,
    sway: { seconds: 23, degrees: 1.1, delay: 0 },
  },
  {
    id: 'wine',
    spine: [p(168, -90), p(248, 72), p(204, 226), p(296, 366), p(276, 520)],
    width: { max: 172, bulge: 0.9, taper: 0.9 },
    paint: 'wine',
    opacity: 0.78,
    sway: { seconds: 17, degrees: 1.8, delay: 900 },
  },
  {
    id: 'violet',
    spine: [p(296, -90), p(360, 84), p(318, 238), p(392, 380), p(372, 520)],
    width: { max: 136, bulge: 0.9, taper: 0.9 },
    paint: 'violet',
    opacity: 0.62,
    sway: { seconds: 13, degrees: 2.4, delay: 1800 },
  },
  {
    id: 'berry',
    spine: [p(104, -90), p(186, 84), p(140, 244), p(228, 392), p(206, 520)],
    width: { max: 96, bulge: 0.85, taper: 1 },
    paint: 'berry',
    opacity: 0.5,
    sway: { seconds: 9, degrees: 3, delay: 2700 },
  },
];

/* ────────────────────────────  O LOGIN  ──────────────────────────── */

/** O palco do banner: largo e baixo, porque é essa a caixa em que ele vive. */
const BAND = { W: 360, H: 132 } as const;

/**
 * As mechas do banner — **desenhadas para a faixa**, não recortadas da abertura.
 *
 * ⚠️ **É por isso que elas existem separadas.** Um close da composição vertical dentro de uma caixa
 * 3:1 foi tentado e reprovado: lia como imagem cortada, porque era. Aqui o gesto é o mesmo — curvas
 * longas, translúcidas, na mesma família de cor — mas a direção é **horizontal**, que é como uma
 * faixa se lê. Elas entram por um lado e saem pelo outro; nenhuma começa ou termina à vista.
 */
const BAND_STRANDS: readonly Strand[] = [
  {
    id: 'flow',
    spine: [p(-60, 116), p(70, 72), p(190, 110), p(310, 62), p(430, 92)],
    width: { max: 92, bulge: 0.9, taper: 0.8 },
    paint: 'wine',
    opacity: 0.9,
    sway: { seconds: 21, degrees: 0.8, delay: 0 },
  },
  {
    id: 'sweep',
    spine: [p(-60, 56), p(80, 96), p(200, 46), p(320, 88), p(430, 50)],
    width: { max: 62, bulge: 0.85, taper: 0.9 },
    paint: 'berry',
    opacity: 0.55,
    sway: { seconds: 15, degrees: 1.3, delay: 800 },
  },
  {
    id: 'edge',
    spine: [p(-60, 16), p(90, 46), p(210, 8), p(330, 42), p(430, 12)],
    width: { max: 54, bulge: 0.85, taper: 0.9 },
    paint: 'violet',
    opacity: 0.5,
    sway: { seconds: 11, degrees: 1.8, delay: 1700 },
  },
  /**
   * A faixa de baixo. **Ela existe porque o pé do cartão estava vazio** — as três primeiras se
   * concentravam na metade de cima e a base virava um bloco escuro sem informação, que num cartão
   * pequeno é metade da peça.
   */
  {
    id: 'base',
    spine: [p(-60, 152), p(80, 124), p(200, 154), p(320, 118), p(430, 142)],
    width: { max: 72, bulge: 0.9, taper: 0.85 },
    paint: 'plum',
    opacity: 0.6,
    sway: { seconds: 9, degrees: 2.2, delay: 2500 },
  },
];

/* ────────────────────────────  TINTA  ──────────────────────────── */

/**
 * As tintas, como dados pelo mesmo motivo que as mechas: é o que permite renderizar exatamente este
 * desenho fora do app. Uma pré-visualização que usa outras cores não valida cor nenhuma.
 */
export const PAINTS: Record<string, readonly { offset: number; color: string }[]> = {
  deep: [
    { offset: 0, color: '#6B2C4A' },
    { offset: 0.5, color: '#40142A' },
    { offset: 1, color: '#260D1A' },
  ],
  wine: [
    { offset: 0, color: '#A03F66' },
    { offset: 0.55, color: color.wine },
    { offset: 1, color: '#2C0D1C' },
  ],
  berry: [
    { offset: 0, color: '#E695B4' },
    { offset: 0.45, color: color.berry },
    { offset: 1, color: '#521A34' },
  ],
  plum: [
    { offset: 0, color: '#BA6690' },
    { offset: 0.5, color: color.accent },
    { offset: 1, color: '#3A1239' },
  ],
  violet: [
    { offset: 0, color: '#A283C9' },
    { offset: 0.5, color: color.violet },
    { offset: 1, color: '#281246' },
  ],
};

/* ────────────────────────────  AS CENAS  ──────────────────────────── */

export type Scene = {
  /** O palco em coordenadas de usuário — é ele que a rampa da máscara e as tintas usam. */
  readonly stage: { readonly W: number; readonly H: number };
  readonly viewBox: string;
  readonly align: string;
  /**
   * ⚠️ **A caixa é 20% maior que a camada, e isso conserta um defeito visto a 390px.** Girar a
   * camada gira o retângulo que a recorta: apareceu uma borda reta vertical à esquerda e um corte
   * diagonal embaixo, onde a camada girada deixou de cobrir a tela. Sangrar o desenho não resolve —
   * o corte é o limite da camada. Com a camada maior, o giro nunca chega à borda visível.
   *
   * ⚠️ **E a `viewBox` cresce na mesma proporção, o que mantém o enquadramento intacto.** Com
   * `slice` a escala é `max(largura/vbW, altura/vbH)`: multiplicar os dois lados por 1,2 deixa a
   * escala igual. O crescimento acompanha o **alinhamento** — quem alinha pelo centro cresce
   * simétrico; quem alinha pelo topo cresce para os lados e para **baixo**, e o topo fica onde
   * estava. Crescer simétrico num quadro alinhado pelo topo deslocaria o desenho.
   */
  readonly box: {
    readonly left: `${number}%`;
    readonly top: 0 | `${number}%`;
    readonly width: `${number}%`;
    readonly height: `${number}%`;
  };
  /** O eixo da luz, em coordenadas do palco: **uma** luz para todas as mechas da cena. */
  readonly light: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };
  /** O pivô do balanço, em fração da camada. */
  readonly pivot: string;
  readonly strands: readonly Strand[];
  /** Um fundo chapado atrás das mechas. O banner tem; a abertura sangra sobre o creme e não tem. */
  readonly ground?: PaintName;
  /** A dissolução no pé, quando a cena termina na tela em vez de num cartão. */
  readonly fade?: { readonly from: number; readonly to: number };
  /**
   * A **ponte** entre o topo do desenho e o wordmark: um véu escuro que desce e some.
   *
   * ⚠️ **Ele existe porque o texto estava pousado por acidente.** "Cuidado capilar" e "Huna" ficavam
   * sobre o que quer que a mecha da vez tivesse deixado ali — e as mechas **se movem**, então o
   * contraste era diferente a cada segundo. O véu dá ao topo um chão deliberado: o texto passa a ter
   * onde se apoiar, o contraste deixa de depender do balanço, e a faixa superior lê como parte da
   * composição em vez de sobra dela.
   */
  readonly veil?: { readonly to: number; readonly opacity: number };
};

export const SCENES: Record<'portrait' | 'banner', Scene> = {
  portrait: {
    stage: OPEN,
    viewBox: '-36 0 432 936',
    align: 'xMidYMin',
    box: { left: '-10%', top: 0, width: '120%', height: '120%' },
    light: { x1: OPEN.W * 0.72, y1: 0, x2: OPEN.W * 0.24, y2: OPEN.H * 0.62 },
    /** Preso em cima, solto embaixo — e o giro só descobre a borda de baixo, que já é sangria. */
    pivot: '50% 0%',
    strands: OPEN_STRANDS,
    fade: { from: 0.52, to: 0.64 },
    veil: { to: 0.34, opacity: 0.66 },
  },
  banner: {
    stage: BAND,
    viewBox: '-36 -13 432 158',
    align: 'xMidYMid',
    box: { left: '-10%', top: '-10%', width: '120%', height: '120%' },
    light: { x1: BAND.W * 0.92, y1: 0, x2: BAND.W * 0.08, y2: BAND.H },
    pivot: '50% 50%',
    strands: BAND_STRANDS,
    ground: 'deep',
  },
};

export type FigureFrame = keyof typeof SCENES;

/**
 * A altura de render de cada enquadramento, em pontos.
 *
 * ⚠️ **Ela mora aqui porque a altura é parte do enquadramento, não da tela.** O `banner` foi
 * desenhado para uma proporção; o número que a realiza tem de vir do mesmo lugar que o palco, senão
 * "o mesmo banner do login" passa a depender de alguém digitar 132 duas vezes — e duas telas que
 * deveriam ser idênticas divergem na primeira mudança. Isto também tira o último literal de
 * dimensão de dentro de tela de produto (SPEC-016 FR2/AC1).
 *
 * `portrait` não aparece aqui: na abertura a figura é o fundo e ocupa o que sobra, então quem
 * decide a altura é o layout, não o enquadramento.
 */
export const FRAME_HEIGHT = { banner: 132 } as const;
