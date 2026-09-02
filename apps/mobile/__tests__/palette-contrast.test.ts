import { color } from '@/design/tokens';

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

  it('as cores de cuidado continuam legíveis sobre o próprio tom claro e sobre o canvas', () => {
    for (const [fg, bg] of [
      [color.hydration, color.hydrationSoft],
      [color.nutrition, color.nutritionSoft],
      [color.reconstruction, color.reconstructionSoft],
      [color.success, color.successSoft],
      [color.danger, color.dangerSoft],
    ] as const) {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
      expect(contrast(fg, color.canvas)).toBeGreaterThanOrEqual(AA);
    }
  });
});
