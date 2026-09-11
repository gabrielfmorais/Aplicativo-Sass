import { CARE_GUIDES, CARE_TYPE_CODES } from '@app/core';
import { render } from '@testing-library/react-native';

import { Button } from '@/design/primitives';
import { careColor, color } from '@/design/tokens';
import { CareGuidePanel } from '@/features/care/CareGuidePanel';

/**
 * ⚠️ **SPEC-062 — o piloto da UI Intelligence, e a barreira que o torna possível sem sign-off.**
 *
 * O "Como fazer" foi redesenhado inteiro: chip de duração, objetivo liderando, passos com marcador
 * numerado e "Erros comuns" em bloco de atenção. ⛔ **E nenhuma palavra do conteúdo capilar mudou** —
 * essa é exatamente a fronteira do D-70, que segue o **conteúdo** e não o autor: realçar o que o
 * texto diz não altera o que ele afirma, e é por isso que uma entrega de apresentação não precisa
 * atravessar o gate.
 */

type Node = { props?: Record<string, unknown>; children?: unknown };
const walk = (n: unknown): Node[] => {
  if (!n || typeof n !== 'object') return [];
  const self = n as Node;
  const kids = Array.isArray(self.children) ? self.children : [];
  return [self, ...kids.flatMap(walk)];
};
const flat = (v: unknown): Record<string, unknown> =>
  Array.isArray(v)
    ? v.reduce<Record<string, unknown>>((a, i) => ({ ...a, ...flat(i) }), {})
    : v && typeof v === 'object'
      ? (v as Record<string, unknown>)
      : {};

describe('SPEC-062 AC1 — o conteúdo é intocável', () => {
  /**
   * ⚠️ **Esta é a asserção que autoriza a rodada.** O conteúdo é `candidate` e o PUBLIC RELEASE
   * segue bloqueado até o sign-off de domínio (D-26/D-70/OQ-REL). Se um redesign pudesse mexer no
   * texto, ele estaria atravessando o gate por uma porta lateral — a de "é só apresentação".
   */
  it('o texto de cada guia continua sendo o do core, palavra por palavra', async () => {
    for (const code of CARE_TYPE_CODES) {
      const guide = CARE_GUIDES[code];
      const s = await render(<CareGuidePanel guide={guide} />);

      s.getByText(guide.whatItIs);
      for (const step of guide.steps) s.getByText(step);
      for (const mistake of guide.commonMistakes) s.getByText(mistake);
      s.getByText(`~${guide.durationMin} min`);
    }
  });

  /** E o status de governança segue `candidate` — o redesign não promoveu nada. */
  it('nenhum guia virou `validated` por causa do redesign', () => {
    for (const code of CARE_TYPE_CODES) {
      expect(CARE_GUIDES[code].validationStatus).toBe('candidate');
    }
  });
});

describe('SPEC-062 — o guia se escaneia', () => {
  /** FR3 — o passo deixou de ser `"1. texto"` e virou marcador + texto: é o que devolve o escaneio. */
  it('cada passo tem um marcador numerado, na ordem', async () => {
    const guide = CARE_GUIDES.hydration;
    const s = await render(<CareGuidePanel guide={guide} />);
    guide.steps.forEach((_, index) => s.getByText(String(index + 1)));
    // Sem número a mais: um marcador órfão seria um passo que não existe.
    expect(s.queryByText(String(guide.steps.length + 1))).toBeNull();
  });

  /** FR4 — "Erros comuns" tem título próprio e não se confunde com mais um passo. */
  it('os erros comuns têm bloco e título próprios', async () => {
    const s = await render(<CareGuidePanel guide={CARE_GUIDES.hydration} />);
    s.getByText('Erros comuns');
    s.getByText('Passo a passo');
  });
});

describe('SPEC-062 BR2 — a cor é sempre a do tipo de cuidado', () => {
  /**
   * ⚠️ **Vale para os QUATRO tipos, inclusive a Restauração** (SPEC-038, a cor mais recente). Uma
   * cor escolhida à mão aqui faria o mesmo cuidado ter um tom no guia e outro na Hoje.
   */
  it.each(CARE_TYPE_CODES)('%s pinta o guia com a própria cor', async (code) => {
    const s = await render(<CareGuidePanel guide={CARE_GUIDES[code]} />);
    const usadas = walk(s.toJSON())
      .map((n) => flat(n.props?.style))
      .flatMap((st) => [st.backgroundColor, st.color])
      .filter((v): v is string => typeof v === 'string');

    expect(usadas).toContain(careColor[code].bg);
    expect(usadas).toContain(careColor[code].fg);

    // ⛔ E nunca a cor de outro cuidado: um tipo tem uma cor só, em todo o app.
    for (const outro of CARE_TYPE_CODES) {
      if (outro !== code) expect(usadas).not.toContain(careColor[outro].fg);
    }
  });

  /**
   * BR3 — o bloco de atenção usa a família `danger`, **não** um tom de cuidado: âmbar é a Nutrição,
   * e um aviso em âmbar dentro de um guia de Hidratação leria como referência a outro cuidado.
   */
  it('o bloco de atenção não empresta a cor de nenhum cuidado', async () => {
    const s = await render(<CareGuidePanel guide={CARE_GUIDES.hydration} />);
    const fundos = walk(s.toJSON())
      .map((n) => flat(n.props?.style).backgroundColor)
      .filter((v): v is string => typeof v === 'string');
    expect(fundos).toContain(color.dangerSoft);
  });
});

describe('SPEC-062 FR5/BR4 — aberto parece aberto', () => {
  /**
   * ⚠️ **O estado existia só para leitor de tela.** "Como fazer" com o guia aberto era pixel por
   * pixel igual a fechado.
   */
  it('`active` pinta a família ameixa, e o repouso não', async () => {
    const aberto = await render(<Button label="Como fazer" active onPress={jest.fn()} />);
    const fechado = await render(<Button label="Como fazer" variant="secondary" onPress={jest.fn()} />);

    const fundoDe = (s: Awaited<ReturnType<typeof render>>) =>
      walk(s.toJSON())
        .map((n) => flat(n.props?.style).backgroundColor)
        .filter((v): v is string => typeof v === 'string');

    expect(fundoDe(aberto)).toContain(color.accentSoft);
    expect(fundoDe(fechado)).not.toContain(color.accentSoft);
  });

  /**
   * ⛔ **A semântica continua sendo `expanded`, nunca `selected`.** Anunciar `selected` diria à
   * tecnologia assistiva que o botão é uma opção escolhida entre outras — ele não é, ele abre um
   * painel.
   */
  it('`active` não vira `selected` para a tecnologia assistiva', async () => {
    const s = await render(
      <Button label="Como fazer" active a11y={{ expanded: true }} onPress={jest.fn()} />,
    );
    /**
     * ⚠️ **SPEC-072 — o `Button` passou a declarar `aria-expanded`, e o estado NATIVO não mudou.**
     *
     * O `Pressable` do RN 0.86 funde `expanded: ariaExpanded ?? accessibilityState?.expanded`, então
     * o nó nativo recebe exatamente o mesmo `accessibilityState` de antes — é isto que esta asserção
     * prova, e é a garantia de que **nada regride no iPhone**. O ganho do `aria-*` é no **web**, onde
     * o legado era descartado e o atributo nunca chegava ao DOM; essa metade se prova medindo a
     * página a 390px, não aqui.
     *
     * A barreira da SPEC-062 BR4 é a mesma de sempre: `expanded` sim, `selected` **nunca** — o botão
     * abre um painel, não é uma opção escolhida entre outras.
     */
    const estado = s.getByRole('button').props.accessibilityState as Record<string, unknown>;
    expect(estado.expanded).toBe(true);
    expect(estado.selected).toBeUndefined();
  });
});

describe('SPEC-062 — contraste é número, não gosto', () => {
  /**
   * ⚠️ **A SPEC-035 mediu 1,03:1 numa pastilha que "existia"** — o canal estava no código e não na
   * tela, e ninguém viu porque *"tem uma pastilha"* é verdade no código-fonte. Cada superfície nova
   * desta rodada carrega texto, então cada uma é medida aqui.
   */
  const ratio = (fg: string, bg: string) => {
    const channels = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const lum = (h: string) => {
      const [r, g, b] = channels(h).map(lin) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  };

  /** O chip de duração e o marcador numerado, nos quatro tipos. */
  it.each(CARE_TYPE_CODES)('%s: número e chip são legíveis sobre o próprio tom', (code) => {
    expect(ratio(careColor[code].fg, careColor[code].bg)).toBeGreaterThanOrEqual(4.5);
  });

  /** O bloco de atenção: título em `danger`, corpo em `ink`, os dois sobre o blush. */
  it('o bloco de erros comuns é legível', () => {
    expect(ratio(color.danger, color.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(color.ink, color.dangerSoft)).toBeGreaterThanOrEqual(4.5);
  });

  /** E o botão aberto: texto ameixa sobre a tinta ameixa. */
  it('o estado aberto do botão é legível', () => {
    expect(ratio(color.accent, color.accentSoft)).toBeGreaterThanOrEqual(4.5);
  });
});
