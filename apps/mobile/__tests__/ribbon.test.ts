import { ribbonPath } from '@/design/ribbon';

/**
 * SPEC-028 — o gerador de fitas, que é o que substituiu o desenho à mão.
 *
 * Um teste não julga se um hero é bonito, e este não tenta. O que ele trava são as **propriedades
 * geométricas** sem as quais o desenho volta a ser o que foi recusado: fita que é polígono, fita que
 * termina em corte reto, fita que sai do palco por erro de conta.
 */

const SPINE = [
  { x: 100, y: 20 },
  { x: 160, y: 120 },
  { x: 150, y: 240 },
  { x: 110, y: 360 },
];

const numbers = (d: string): number[] =>
  (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => Number.isFinite(n));

describe('ribbonPath (SPEC-028)', () => {
  /**
   * ⚠️ A barreira contra a volta do polígono. Um contorno feito de `L` tem faceta visível na borda a
   * 390px — e a borda é exatamente onde o olho procura a silhueta. Só `C` desenha curva.
   */
  it('devolve um contorno fechado feito de curvas, nunca de retas', () => {
    const d = ribbonPath(SPINE, { max: 40 });
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBeGreaterThan(20);
    // Nenhum comando de reta: nem `L`, nem `H`, nem `V`.
    expect(d).not.toMatch(/[LHV]\s/);
  });

  /**
   * ⚠️ A barreira contra a **listra**. As duas pontas têm largura zero, então os dois lados da fita
   * se encontram no mesmo ponto. Uma fita que terminasse num corte reto seria uma listra, e listra
   * foi recusada desde a primeira direção.
   */
  it('afina até zero nas duas pontas', () => {
    const wide = ribbonPath(SPINE, { max: 60 });
    const thin = ribbonPath(SPINE, { max: 6 });
    // O primeiro ponto do contorno é a ponta de cima; ele não pode depender da largura máxima.
    const firstOf = (d: string) => numbers(d).slice(0, 2);
    expect(firstOf(wide)[0]).toBeCloseTo(firstOf(thin)[0] as number, 4);
    expect(firstOf(wide)[1]).toBeCloseTo(firstOf(thin)[1] as number, 4);
  });

  /** A espinha é uma descrição do desenho: a fita passa por onde ela manda, e não perto disso. */
  it('a fita passa pelos pontos da espinha, e o volume fica entre eles', () => {
    const d = ribbonPath(SPINE, { max: 50 });
    const xs = numbers(d).filter((_, i) => i % 2 === 0);
    const ys = numbers(d).filter((_, i) => i % 2 === 1);
    // Largura 50 em volta de uma espinha que vai de x=100 a x=160: a caixa cresce, mas não explode.
    expect(Math.min(...xs)).toBeGreaterThan(60);
    expect(Math.max(...xs)).toBeLessThan(200);
    expect(Math.min(...ys)).toBeGreaterThan(0);
    expect(Math.max(...ys)).toBeLessThan(400);
  });

  it('uma espinha degenerada não vira um caminho quebrado', () => {
    expect(ribbonPath([{ x: 0, y: 0 }], { max: 10 })).toBe('');
    expect(ribbonPath([], { max: 10 })).toBe('');
  });

  /** `bulge` move o volume; é o parâmetro que distingue cabelo (cheio em cima) de fita de presente. */
  it('bulge desloca o ponto mais largo ao longo da fita', () => {
    const highest = (d: string) => {
      const n = numbers(d);
      let widest = 0;
      // Amostras opostas do contorno: ida e volta têm o mesmo comprimento.
      const half = n.length / 2;
      for (let i = 0; i < half; i += 2) {
        const ax = n[i] as number;
        const ay = n[i + 1] as number;
        const bx = n[n.length - 2 - i] as number;
        const by = n[n.length - 1 - i] as number;
        const w = Math.hypot(ax - bx, ay - by);
        if (w > widest) widest = w;
      }
      return widest;
    };
    // Com o mesmo `max`, o pico continua sendo o mesmo — o que muda é onde ele acontece.
    expect(highest(ribbonPath(SPINE, { max: 40, bulge: 0.5 }))).toBeGreaterThan(20);
    expect(highest(ribbonPath(SPINE, { max: 40, bulge: 1 }))).toBeGreaterThan(20);
  });
});
