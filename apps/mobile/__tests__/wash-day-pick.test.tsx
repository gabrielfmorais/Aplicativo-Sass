import type { Product, ProductPort, WashDayPort, WashDayRecord } from '@app/core';
import { render, waitFor } from '@testing-library/react-native';

import { HIT_TARGET_MIN } from '@/design/tokens';
import { WashDayScreen } from '@/features/care/WashDayScreen';

/**
 * ⚠️ **SPEC-065 — a tela onde ela REGISTRA, que é a fonte de tudo o que a Huna aprende depois.**
 *
 * `P2`, `P6`, `P8` e `P13` leem exatamente o que esta tela grava. Uma tela de registro difícil não
 * produz uma camada de inteligência pobre — produz uma camada **vazia**.
 *
 * O que estes testes protegem: que ela **reconheça o vidro** antes de tocar, e que o app **não
 * sugira nada** aqui (§5) — porque um produto pré-marcado que ela não desmarcou vira um fato que ela
 * nunca afirmou, e volta depois como padrão sobre a rotina dela.
 */

const EXECUTION = 'exec-1';

const MANUAL: Product = { id: 'p1', name: 'Máscara da feira', category: 'mask', catalog: null };
const COM_FOTO: Product = {
  id: 'p2',
  name: 'Invigo Nutri-Enrich',
  category: 'shampoo',
  catalog: {
    id: 'c1',
    brand: 'Wella Professionals',
    line: 'Invigo',
    name: 'Nutri-Enrich Deep Nourishing Shampoo',
    variant: '500ml',
    category: 'shampoo',
    imageUrl: 'https://exemplo.test/s.jpg',
  },
};
const SEM_FOTO: Product = { ...COM_FOTO, id: 'p3', catalog: { ...COM_FOTO.catalog!, imageUrl: null } };

const EMPTY: WashDayRecord = {
  washDayId: null,
  products: [],
  techniques: [],
  scalpFeel: null,
  finishStatus: null,
  finishTechnique: null,
};

const ports = (shelf: readonly Product[]) => {
  const washDays: WashDayPort = {
    getFor: jest.fn(async () => EMPTY),
    markProduct: jest.fn(async () => undefined),
    markTechnique: jest.fn(async () => undefined),
    setScalpFeel: jest.fn(async () => undefined),
    setFinishStatus: jest.fn(async () => undefined),
    setFinishTechnique: jest.fn(async () => {}),
    lastUsedFor: jest.fn(async () => []),
    finishHistory: jest.fn(async () => []),
  };
  const products: ProductPort = {
    list: jest.fn(async () => shelf),
    add: jest.fn(async ({ name, category }) => ({ id: 'novo', name, category, catalog: null })),
    rename: jest.fn(async () => undefined),
    archive: jest.fn(async () => undefined),
  };
  return { washDays, products };
};

const tela = async (shelf: readonly Product[]) => {
  const p = ports(shelf);
  const view = await render(
    <WashDayScreen
      careExecutionId={EXECUTION}
      careTitle="Hidratação"
      washDays={p.washDays}
      products={p.products}
      onBack={jest.fn()}
    />,
  );
  await waitFor(() => view.getByText('Seu registro'));
  return { ...view, ...p };
};

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

describe('SPEC-065 AC1 — ela reconhece o vidro antes de tocar', () => {
  it('o nome dela lidera, e a marca acompanha sem substituí-lo', async () => {
    const s = await tela([COM_FOTO]);
    /**
     * ⚠️ **O nome DELA inteiro, sozinho.** A versão anterior era um chip com `marca · nome` num
     * texto só, e a 390px o resultado medido foi *"Wella Professionals · Invigo Nutri-Enrich Dee…"*:
     * a marca comendo justamente o que ela reconhece na prateleira do banheiro (SPEC-054).
     */
    s.getByText('Invigo Nutri-Enrich');
    s.getByText(/Wella Professionals/);
  });

  /**
   * FR5 — produto sem foto rende o monograma, e é o que mantém a coluna de texto alinhada. Uma lista
   * em que metade tem imagem e metade não começa em dois lugares diferentes.
   */
  it('produto sem foto rende a inicial em vez de um buraco', async () => {
    const s = await tela([MANUAL, SEM_FOTO]);
    // Escondido do leitor de tela de propósito: o nome está ao lado (SPEC-063).
    s.getByText('M', { includeHiddenElements: true });
    s.getByText('I', { includeHiddenElements: true });
  });

  /** A categoria aparece — é organização de prateleira, e não diz para que o produto serve. */
  it('a categoria acompanha cada produto', async () => {
    const s = await tela([MANUAL]);
    // Texto exato: 'Máscara da feira' é o NOME dela, e 'Máscara' sozinho é a categoria.
    s.getByText('Máscara');
  });
});

describe('SPEC-065 §5/BR1/BR2 — o app não sugere nada aqui', () => {
  /**
   * ⛔ **A recusa central da SPEC, e ela é de INTEGRIDADE DE DADO, não de linguagem.** Esta tela é a
   * fonte do que `P2`/`P6`/`P8` leem. Pré-marcar "o que ela costuma usar" faria a camada que aprende
   * com os registros dela aprender com a **própria sugestão**.
   */
  it('nenhum produto começa marcado', async () => {
    const s = await tela([MANUAL, COM_FOTO]);
    for (const el of walk(s.toJSON())) {
      if (el.props?.accessibilityRole !== 'checkbox') continue;
      const state = el.props.accessibilityState as { checked?: boolean } | undefined;
      expect(state?.checked).toBe(false);
    }
    expect(s.washDays.markProduct).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **Reordenar por uso tem a mesma forma, mais suave:** pôr no topo o que ela costuma marcar
   * aumenta a chance de ela marcar de novo. A ordem é a da prateleira, que é fato dela.
   */
  it('a ordem é a que a porta devolve', async () => {
    const s = await tela([COM_FOTO, MANUAL]);
    const textos = walk(s.toJSON())
      .filter((el) => el.props?.accessibilityRole === 'checkbox')
      .map((el) => String(el.props?.accessibilityLabel ?? ''));
    expect(textos[0]).toContain('Invigo Nutri-Enrich');
    expect(textos[1]).toContain('Máscara da feira');
  });
});

describe('SPEC-065 AC5 — o alvo de toque do iPhone', () => {
  /** SPEC-060 fatia 2: 44pt é piso, e uma linha é mais fácil de errar que um chip. */
  it('cada produto oferecido mede ao menos 44pt', async () => {
    const s = await tela([MANUAL, COM_FOTO, SEM_FOTO]);
    const pequenos = walk(s.toJSON())
      .filter((el) => el.props?.accessibilityRole === 'checkbox')
      .map((el) => ({
        label: String(el.props?.accessibilityLabel ?? ''),
        altura: flat(el.props?.style).minHeight as number | undefined,
      }))
      .filter((x) => x.altura === undefined || x.altura < HIT_TARGET_MIN);
    expect(pequenos).toEqual([]);
  });
});

describe('SPEC-065 AC4 — nada aqui afirma adequação', () => {
  /** A mesma barreira da SPEC-063: as palavras que a auditoria do dono reprovou continuam fora. */
  const PROIBIDO =
    /recomend|ideal|indicad|melhor|combina|compat[íi]v|adequad|perfeit|para este cuidado|para esta etapa|serve para/i;

  it('a tela com prateleira cheia não introduz nenhuma dessas palavras', async () => {
    const s = await tela([MANUAL, COM_FOTO, SEM_FOTO]);
    expect(s.queryByText(PROIBIDO)).toBeNull();
  });
});
