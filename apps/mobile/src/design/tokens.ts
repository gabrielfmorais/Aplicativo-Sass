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
 * - **One saturated accent: deep plum.** Adult and feminine without the pink cliché the brief
 *   explicitly rules out. Used for the primary action and for premium — sparingly, so it still
 *   means something when it appears.
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

  /** The accent. Deep plum: the action colour and the premium colour. */
  accent: '#7A2F52',
  accentPressed: '#5F2340',
  /** Tinted accent background — selected states, premium panels. */
  accentSoft: '#F6E9EF',
  accentBorder: '#E0C2D1',

  /** Care types (FR5). Distinct hues, none of them the accent, so a plan is readable by colour. */
  hydration: '#2F6E7C',
  hydrationSoft: '#E4EFF1',
  nutrition: '#A9661F',
  nutritionSoft: '#F7EBDD',
  reconstruction: '#6B4E9E',
  reconstructionSoft: '#EDE8F7',

  success: '#2E6B4F',
  successSoft: '#E3EFE9',
  danger: '#A33A2E',
  dangerSoft: '#F8E7E4',
} as const;

export type CareColorKey = 'hydration' | 'nutrition' | 'reconstruction';

/** Care type → its hue and tint, so no screen has to remember the mapping. */
export const careColor: Record<CareColorKey, { readonly fg: string; readonly bg: string }> = {
  hydration: { fg: color.hydration, bg: color.hydrationSoft },
  nutrition: { fg: color.nutrition, bg: color.nutritionSoft },
  reconstruction: { fg: color.reconstruction, bg: color.reconstructionSoft },
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
