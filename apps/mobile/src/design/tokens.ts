import type { CareTypeCode } from '@app/core';

/**
 * SPEC-016 §14 — the visual identity, as values instead of adjectives.
 *
 * Everything a product screen paints comes from here. A literal `'#1c1c1e'` or `padding: 14` in a
 * feature is a bug (FR2): the moment two screens pick their own greys, the product stops looking
 * like one product, and no amount of later tidying fixes it as cheaply as not doing it.
 *
 * The direction, in four words: clear, light, confident, warm. Concretely —
 *
 * - **Warm neutrals, never cold grey.** A bone/sand canvas reads as care; #F2F2F2 reads as a
 *   settings dialog. This one decision does more for "premium" than any other here.
 * - **Graphite instead of pure black.** #000 on a warm base looks like a browser default. A deep
 *   warm charcoal keeps the contrast and loses the harshness.
 * - **Uma família, não um acento solto (SPEC-026 FR16).** A SPEC-016 tinha **uma** cor saturada,
 *   usada com parcimônia deliberada. Com nove capabilities na tela, a parcimônia virou palidez: o
 *   app ficou branco, e branco não é identidade. Agora são quatro tons da mesma família — vinho,
 *   ameixa, berry e roxo profundo — e a ameixa continua sendo a **ação**. Os outros três pintam
 *   superfície e hierarquia, nunca ação: se tudo é acento, nada é.
 * - **Cor entra em superfície, não em texto pequeno.** É assim que se ganha personalidade sem
 *   perder legibilidade — e todo par novo aqui foi **medido**, não estimado (FR18).
 * - **Care colours inform, they do not decorate.** Hydration, nutrition and reconstruction each own
 *   a hue, consistently, everywhere. Colour becomes a second way to read the plan at a glance.
 *
 * Structured so a dark theme is a second palette rather than a rewrite (OQ3), but light only ships.
 */

export const color = {
  /** Page background — warm bone. The single most identity-defining value in this file. */
  canvas: '#FBF8F5',
  /** Raised content on the canvas. */
  surface: '#FFFFFF',
  /** Quiet blocks that should sit back: unselected chips, muted panels. */
  surfaceMuted: '#F4EFE9',
  /** Pressed/hover wash on a light surface. */
  surfacePressed: '#EFE7DF',

  border: '#E7DED5',
  borderStrong: '#D3C6BA',

  /** Primary text — warm charcoal, ~13:1 on canvas. */
  ink: '#2B2523',
  /** Secondary text: still comfortably readable, clearly subordinate. */
  inkMuted: '#6B615B',
  /**
   * The quietest tone in the scale — hints, metadata, an eyebrow above a heading.
   *
   * It is quiet, **not** decorative: 4.97:1 on the canvas, so it clears WCAG AA for body text like
   * everything else here. The first draft of this token was `#988C84`, which measured 3.09:1 and
   * therefore failed for every size the app uses. There is no such thing as text that does not have
   * to be readable — if a value ever wants to go lighter than this, it may only paint a shape.
   */
  inkFaint: '#756A62',
  /** Text on a filled accent/ink surface. */
  onFilled: '#FFFFFF',
  /**
   * O subordinado **sobre** uma superfície de marca: um eyebrow, um rótulo secundário no painel
   * escuro. Rosa claríssimo em vez de branco a 80% de opacidade — opacidade sobre um gradiente muda
   * de cor conforme o ponto, e um valor fixo é a mesma cor em toda a superfície.
   *
   * Mede 9.4:1 sobre o vinho: subordinado é hierarquia, nunca permissão para ser ilegível.
   */
  onFilledMuted: '#EDC4D5',

  /** The accent. Deep plum: the action colour and the premium colour. */
  accent: '#7A2F52',
  accentPressed: '#5F2340',
  /** Tinted accent background — selected states, premium panels. */
  accentSoft: '#F6E9EF',
  accentBorder: '#E0C2D1',

  /**
   * SPEC-026 FR16 — a família da marca. **Nenhuma delas é ação**: ação é `accent`, e continua
   * sendo só ela. Estas pintam superfície, profundidade e hierarquia.
   *
   * Medidas sobre o canvas (`#FBF8F5`), porque a SPEC-016 já reprovou um token por 3.09:1 e a
   * paleta nova não reabre isso: vinho **11.70:1** · ameixa 8.42:1 · berry **5.36:1** · roxo
   * **11.13:1**. Com branco por cima: vinho 12.38:1 · berry 5.67:1 · roxo 11.77:1.
   */
  wine: '#5A1F3C',
  berry: '#A8446B',
  violet: '#4A2A5E',

  /**
   * As superfícies suaves da família. `ink` fica acima de 12:1 em todas, e `inkMuted` acima de
   * 5:1 — o que significa que elas podem carregar texto de verdade, e não só decorar.
   */
  wineSoft: '#F3E7EC',
  berrySoft: '#FAEBF0',
  violetSoft: '#EDE8F4',
  /**
   * O creme **tingido**: a base quente com um sopro de ameixa. Existe para um bloco grande poder
   * pertencer à marca sem virar um retângulo colorido — é a diferença entre um app com identidade e
   * um app pintado.
   */
  brandTint: '#F6EDF0',

  /** Care types (FR5). Distinct hues, none of them the accent, so a plan is readable by colour. */
  hydration: '#2F6E7C',
  hydrationSoft: '#E4EFF1',
  /**
   * Era `#A9661F`, e media **3.88:1** sobre o próprio tom claro e **4.31:1** sobre o
   * canvas — abaixo de AA nos dois. Passou despercebido porque âmbar sobre creme *parece* legível, e
   * porque até a SPEC-026 ninguém tinha calculado. Este mede 5.19:1 e 5.76:1, e continua sendo a
   * mesma família: o cuidado se lê pela cor, e uma cor que não se lê não informa nada.
   */
  nutrition: '#8F5416',
  nutritionSoft: '#F7EBDD',
  reconstruction: '#6B4E9E',
  reconstructionSoft: '#EDE8F7',
  /**
   * SPEC-038 — o quarto tipo. Índigo porque as três vagas vizinhas já estavam ocupadas por famílias
   * diferentes (teal, âmbar, violeta) e as duas cores semânticas — verde de sucesso e vermelho de
   * erro — não podem ser tipo de cuidado: um cuidado que aparece em verde lê como "feito".
   * Medido: **6,44:1** sobre o creme e **5,76:1** sobre o próprio tom, na mesma faixa das outras.
   */
  restoration: '#3A5A96',
  restorationSoft: '#E8ECF6',

  success: '#2E6B4F',
  successSoft: '#E3EFE9',
  danger: '#A33A2E',
  dangerSoft: '#F8E7E4',
} as const;

/**
 * ⚠️ **A chave é o tipo do core, e não uma união escrita aqui.** Ela era uma lista literal de três
 * valores, escrita à mão ao lado da de lá: um quarto tipo de cuidado entraria no `CARE_TYPE_CODES`,
 * o `careColor` continuaria compilando e o cuidado novo apareceria **sem cor** — silêncio, não erro.
 * Amarrada ao core, esquecer a cor vira falha de compilação, que é o acoplamento certo (SPEC-038).
 */
export type CareColorKey = CareTypeCode;

/** Care type → its hue and tint, so no screen has to remember the mapping. */
export const careColor: Record<CareColorKey, { readonly fg: string; readonly bg: string }> = {
  hydration: { fg: color.hydration, bg: color.hydrationSoft },
  nutrition: { fg: color.nutrition, bg: color.nutritionSoft },
  reconstruction: { fg: color.reconstruction, bg: color.reconstructionSoft },
  restoration: { fg: color.restoration, bg: color.restorationSoft },
};

/** 4-based rhythm. Screens compose from these; they never invent a number in between. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;

/**
 * The type scale. Sizes are deliberately few — a scale with a step for every whim is not a scale.
 * `lineHeight` is set on every one because inherited leading is where vertical rhythm dies.
 */
export const type = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 29, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Small all-caps label. Used for section eyebrows, never for anything long. */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8 },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Barely-there elevation. A card should feel a millimetre off the page, not floating — heavy
 * shadows on a warm palette look muddy, and this product wants calm.
 */
export const elevation = {
  card: {
    shadowColor: '#3A2A1F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Minimum comfortable tap target (SPEC-016 BR4/AC5). */
export const HIT_TARGET = 48;

/**
 * The floor for a *secondary* target, when several of them share a row and 48pt each would push the
 * row into a second line on a 320pt screen (EC3). Still above the 44pt BR4 requires — a smaller
 * button is allowed to look lighter, never to become harder to hit.
 */
export const HIT_TARGET_MIN = 44;

/**
 * The app is a phone app. On the web preview (D-80) the viewport is a desktop window, so content is
 * capped and centred — otherwise a row of chips stretches across 1500px and nothing anyone sees
 * there tells the truth about the product.
 */
export const CONTENT_MAX_WIDTH = 460;

/**
 * SPEC-018 fatia 3 — quanto a opção escolhida cresce no instante do toque.
 *
 * Seis por cento. Menos não é percebido, mais lê como um pulo — e uma fileira de opções pulando é
 * ruído, não resposta. Fica aqui, e não na primitiva, porque escala de movimento é decisão do
 * sistema visual pela mesma razão que espaçamento e cor são.
 */
export const CHIP_POP = 1.06;

/**
 * Duração da transição de conteúdo, em milissegundos, e o deslocamento vertical de entrada, em
 * pontos. Curta o bastante para não fazer ninguém esperar por ela, longa o bastante para o olho
 * perceber que a tela **mudou** em vez de piscar; e uma subida pequena, que sugere chegada sem
 * virar carrossel.
 */
export const REVEAL_MS = 260;
export const REVEAL_RISE = 10;
