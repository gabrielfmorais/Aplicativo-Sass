import { careColor, color } from '@/design/tokens';

/**
 * SPEC-026 AC8 / SPEC-016 FR2 — a paleta, **medida**.
 *
 * Este arquivo existe por causa de um erro concreto: o primeiro `inkFaint` da SPEC-016 media
 * **3.09:1** e foi escolhido a olho. Passava por "quieto" e reprovava para qualquer tamanho de texto
 * que o app usa. Cor é a única decisão visual deste projeto que tem resposta certa, e é a única que
 * não se confere olhando — então se confere aqui.
 *
 * Fórmula de luminância relativa da WCAG 2.1. AA para texto é 4.5:1, e nada aqui fica abaixo disso.
 */
const luminance = (hex: string): number => {
  const channels = (hex.replace('#', '').match(/../g) ?? []).map((pair) => {
    const v = parseInt(pair, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5;

describe('contraste da paleta (SPEC-026 AC8)', () => {
  it('a fórmula está certa: preto sobre branco é 21:1, e branco sobre branco é 1:1', () => {
    // Sem esta âncora, um erro na fórmula faria **todos** os outros casos passarem em silêncio.
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('todo texto sobre o canvas passa AA', () => {
    for (const token of ['ink', 'inkMuted', 'inkFaint', 'accent', 'wine', 'berry', 'violet'] as const) {
      expect({ token, ratio: contrast(color[token], color.canvas) }).toMatchObject({
        ratio: expect.any(Number),
      });
      expect(contrast(color[token], color.canvas)).toBeGreaterThanOrEqual(AA);
    }
  });

  /** As superfícies da família precisam poder **carregar texto**, não só decorar. */
  it('ink e inkMuted passam AA sobre cada superfície suave', () => {
    for (const surface of [
      'surface',
      'surfaceMuted',
      'accentSoft',
      'wineSoft',
      'berrySoft',
      'violetSoft',
      'brandTint',
    ] as const) {
      expect(contrast(color.ink, color[surface])).toBeGreaterThanOrEqual(AA);
      expect(contrast(color.inkMuted, color[surface])).toBeGreaterThanOrEqual(AA);
    }
  });

  /** O cabeçalho de aba é vinho cheio com texto claro; é o par mais forte da tela e o mais fácil de errar. */
  it('o texto sobre uma superfície cheia da marca passa AA', () => {
    for (const filled of ['wine', 'accent', 'violet', 'berry', 'ink'] as const) {
      expect(contrast(color.onFilled, color[filled])).toBeGreaterThanOrEqual(AA);
    }
  });

  /**
   * SPEC-027 — o subordinado sobre a superfície de marca. Ele existe para **não** disputar com o
   * título, e é exatamente por isso que precisa ser medido: "secundário" é a desculpa mais comum
   * para um valor ilegível. Aqui vale sobre as superfícies em que ele pode aparecer, não só sobre a
   * que ele estreou.
   */
  it('o texto subordinado sobre a marca também passa AA, e continua abaixo do principal', () => {
    for (const filled of ['wine', 'accent', 'violet'] as const) {
      expect(contrast(color.onFilledMuted, color[filled])).toBeGreaterThanOrEqual(AA);
      // Subordinado é hierarquia: se ele empatasse com `onFilled`, não haveria hierarquia nenhuma.
      expect(contrast(color.onFilledMuted, color[filled])).toBeLessThan(
        contrast(color.onFilled, color[filled]),
      );
    }
  });

  /**
   * ⚠️ **A lista era escrita à mão, e por isso não crescia com o produto.** Ela nomeava os três
   * tipos de cuidado um por um: o quarto (`restoration`, SPEC-038) entraria no `careColor` e
   * **nenhum teste o mediria** — exatamente o defeito que a `nutrition` teve por semanas antes da
   * SPEC-026, quando ninguém tinha calculado nada. Agora a fonte é o próprio mapa: um tipo novo é
   * medido no dia em que ganha cor, sem ninguém lembrar de vir aqui.
   */
  it('as cores de cuidado continuam legíveis sobre o próprio tom claro e sobre o canvas', () => {
    const pairs = [
      ...Object.values(careColor).map((c) => [c.fg, c.bg] as const),
      [color.success, color.successSoft] as const,
      [color.danger, color.dangerSoft] as const,
    ];
    for (const [fg, bg] of pairs) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
      expect(contrast(fg, color.canvas)).toBeGreaterThanOrEqual(AA);
    }
  });

  /**
   * SPEC-038 — **um tipo de cuidado não pode usar a cor de um estado.**
   *
   * Verde é "feito" e vermelho é "erro" em todo o app. Um cuidado pintado de verde lê como concluído
   * antes de qualquer palavra ser lida, e nenhuma cópia desfaz isso. Duas cores de cuidado iguais
   * têm o mesmo problema pelo lado oposto: a cor deixa de informar e vira decoração (FR5).
   */
  it('cada tipo de cuidado tem a sua cor, e nenhuma delas é cor de estado', () => {
    const hues = Object.values(careColor).map((c) => c.fg);
    expect(new Set(hues).size).toBe(hues.length);
    for (const hue of hues) {
      expect([color.success, color.danger, color.accent]).not.toContain(hue);
    }
  });
  /**
   * SPEC-035 — **a pastilha da aba ativa tem de se ver.**
   *
   * ⚠️ Ela vinha em `accentSoft` sobre uma barra em `brandTint` e media **1,03:1**: dois cremes
   * praticamente iguais. O canal existia no código e não existia na tela — a barra prometia quatro
   * sinais de estado e entregava três, e ninguém percebeu porque "tem uma pastilha" é verdade no
   * código-fonte. Um estado que não se enxerga não é um estado, e a única defesa contra isso voltar
   * é um número.
   */
  it('a pastilha da aba ativa se distingue da barra', () => {
    expect(contrast(color.accent, color.brandTint)).toBeGreaterThan(4.5);
    /** E o ícone dentro dela precisa se ler sobre a própria pastilha. */
    expect(contrast(color.onFilled, color.accent)).toBeGreaterThan(4.5);
  });
});
