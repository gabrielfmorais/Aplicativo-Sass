/**
 * SPEC-028 — a geometria da **fita**: a peça que faltava para o cabelo da Huna.
 *
 * ⚠️ **Por que este arquivo existe, e por que ele é a mudança real.**
 *
 * As três versões anteriores do hero foram desenhadas do mesmo jeito: eu escrevia caminhos SVG à
 * mão, olhava, e mexia nos números. Isso tem um teto, e o teto é baixo — um humano ajustando pontos
 * de controle um a um consegue **quatro ou cinco** formas antes de perder o controle do conjunto. E
 * quatro formas opacas, por melhor que sejam, leem **flat**: não há sobreposição suficiente para o
 * olho construir profundidade.
 *
 * Cabelo bonito não é feito de poucas formas grandes. É feito de **muitas fitas finas, longas, que
 * se cruzam** — cada uma com sua largura, sua cor, sua transparência e sua profundidade. Isso não se
 * escreve à mão: se gera.
 *
 * Aqui está o gerador. Uma fita nasce de duas coisas — uma **espinha** (por onde ela passa) e um
 * **perfil de largura** (como ela engrossa e afina) — e o módulo devolve o contorno fechado, em
 * curvas de Bézier de verdade. O hero deixa de ser um desenho e passa a ser **dados**: mudar o
 * cabelo vira mudar uma lista de pontos, não caçar um número no meio de um caminho de 400 caracteres.
 *
 * Puro, sem React e sem SVG: só números entram, só uma string sai. É o que o torna testável.
 */

export type Point = { readonly x: number; readonly y: number };

/**
 * A espinha de uma fita: os pontos por onde ela passa. O caminho entre eles é **suavizado**
 * (Catmull-Rom), então três ou quatro pontos bastam para uma curva longa e orgânica — que é
 * exatamente a razão de não escrever Bézier à mão: os pontos de controle são derivados, não
 * inventados.
 */
export type Spine = readonly Point[];

/**
 * Como a fita engrossa ao longo do caminho.
 *
 * - `max` — a largura no ponto mais gordo, em unidades do palco.
 * - `bulge` — onde fica esse ponto. Abaixo de 1 empurra o volume para **cima**, que é como cabelo se
 *   comporta: cheio perto da raiz, afinando até a ponta. Em 1, o volume fica no meio.
 * - `taper` — quão rápido ela afina nas duas pontas. Maior = ponta mais fina e mais longa.
 *
 * As duas extremidades chegam a zero de propósito: uma fita que termina num corte reto lê como
 * **listra**, e listra foi recusada desde a primeira direção.
 */
export type WidthProfile = {
  readonly max: number;
  readonly bulge?: number;
  readonly taper?: number;
};

const widthAt = (t: number, { max, bulge = 0.72, taper = 0.9 }: WidthProfile): number =>
  max * Math.pow(Math.sin(Math.PI * Math.pow(t, bulge)), taper);

/**
 * Catmull-Rom: o ponto e a tangente em `t` ao longo da espinha inteira.
 *
 * Catmull-Rom **passa pelos pontos dados** — diferente de Bézier, cujos pontos de controle ficam
 * fora da curva. É a diferença entre "a fita passa aqui" e "a fita passa mais ou menos por aqui", e
 * é o que torna a espinha uma descrição legível do desenho.
 */
const onSpine = (spine: Spine, t: number): { point: Point; tangent: Point } => {
  const segments = spine.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const i = Math.min(Math.floor(scaled), segments - 1);
  const u = scaled - i;

  // Extremidades duplicadas: a curva começa e termina exatamente no primeiro e no último ponto.
  const p0 = spine[Math.max(i - 1, 0)] as Point;
  const p1 = spine[i] as Point;
  const p2 = spine[i + 1] as Point;
  const p3 = spine[Math.min(i + 2, segments)] as Point;

  const u2 = u * u;
  const u3 = u2 * u;

  const axis = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
  const slope = (a: number, b: number, c: number, d: number): number =>
    0.5 * (c - a + 2 * (2 * a - 5 * b + 4 * c - d) * u + 3 * (-a + 3 * b - 3 * c + d) * u2);

  return {
    point: { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) },
    tangent: { x: slope(p0.x, p1.x, p2.x, p3.x), y: slope(p0.y, p1.y, p2.y, p3.y) },
  };
};

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * Uma polilinha vira curva: Catmull-Rom convertido para Bézier cúbica, que é o que o SVG fala.
 *
 * ⚠️ **Sem isto o contorno seria um polígono**, e polígono com 24 lados ainda é polígono: a 390px as
 * facetas aparecem justamente na borda, que é onde o olho procura a silhueta. Os pontos de controle
 * saem da diferença entre os vizinhos — a fórmula clássica, com a tensão em 1/6.
 */
const throughPoints = (points: readonly Point[]): string => {
  if (points.length < 2) return '';
  const first = points[0] as Point;
  let d = `M${round(first.x)} ${round(first.y)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(i - 1, 0)] as Point;
    const p1 = points[i] as Point;
    const p2 = points[i + 1] as Point;
    const p3 = points[Math.min(i + 2, points.length - 1)] as Point;

    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
};

/**
 * O contorno fechado de uma fita.
 *
 * Percorre a espinha, mede a largura em cada passo, desloca para os dois lados na **normal** da
 * tangente, e fecha o caminho: um lado na ida, o outro na volta. `samples` é a resolução — 26 é o
 * suficiente para uma fita da altura da tela sem faceta visível.
 */
export function ribbonPath(spine: Spine, width: WidthProfile, samples = 26): string {
  if (spine.length < 2) return '';
  const left: Point[] = [];
  const right: Point[] = [];

  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const { point, tangent } = onSpine(spine, t);
    const length = Math.hypot(tangent.x, tangent.y) || 1;
    // A normal é a tangente girada 90°. É ela que dá espessura à linha.
    const nx = -tangent.y / length;
    const ny = tangent.x / length;
    const half = widthAt(t, width) / 2;
    left.push({ x: point.x + nx * half, y: point.y + ny * half });
    right.push({ x: point.x - nx * half, y: point.y - ny * half });
  }

  // Ida por um lado, volta pelo outro, e `Z`: um contorno só, sem emenda visível nas pontas, porque
  // nas pontas a largura é zero e os dois lados se encontram no mesmo ponto.
  return `${throughPoints([...left, ...right.reverse()])} Z`;
}
