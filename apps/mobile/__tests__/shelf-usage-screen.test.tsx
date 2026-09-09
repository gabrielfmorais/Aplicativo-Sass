import type { Product, ShelfUsage } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { ShelfUsageScreen } from '@/features/insights/ShelfUsageScreen';

/**
 * SPEC-049 (P6) — **Smart Shelf**.
 *
 * ⚠️ O que estes testes guardam: **contagem, nunca julgamento**, e *"ainda sem registro"* como
 * **fato, não conselho**.
 */

const MASCARA: Product = { id: 'p1', name: 'Máscara da feira', category: 'mask', catalog: null };
const NOVO: Product = { id: 'p3', name: 'Creme novo', category: 'leave_in', catalog: null };

const view = (over: Partial<ShelfUsage> = {}): ShelfUsage => ({
  totalProducts: 3,
  recordedCares: 6,
  used: [{ product: MASCARA, cares: 4, lastUsedOn: '2026-09-04' }],
  neverUsed: [NOVO],
  ...over,
});

const screen = (over: Partial<Parameters<typeof ShelfUsageScreen>[0]> = {}) =>
  render(<ShelfUsageScreen view={view()} loading={false} entitled onBack={jest.fn()} {...over} />);

describe('Sua prateleira, em uso (SPEC-049)', () => {
  it('conta em quantos registros o produto apareceu', async () => {
    const s = await screen();
    s.getByText('Máscara da feira');
    s.getByText('em 4 registros de 6');
  });

  it('lista o que ainda não apareceu, como fato e não como conselho', async () => {
    const s = await screen();
    s.getByText('Creme novo');
    s.getByText(/a Huna só conta o que você marcou/);
    // ⚠️ Nada sobre descartar, trocar ou comprar — isso é `P18`, atrás do próprio gate.
    expect(s.queryByText(/descart|jogue|troque|substitu|compre|deixe de usar/i)).toBeNull();
  });

  /** ⚠️ Sem média, sem nota, sem ordem de mérito — ranking é `P7`, outra decisão. */
  it('não julga produto: nenhuma nota, média ou "melhor"', async () => {
    const s = await screen();
    expect(s.queryByText(/\d+\s?%/)).toBeNull();
    expect(s.queryByText(/nota|média|melhor|pior|ranking|score|funciona/i)).toBeNull();
  });

  it('com produtos e nenhuma marcação, diz que ainda está conhecendo a rotina', async () => {
    const s = await screen({ view: view({ used: [], recordedCares: 0 }) });
    s.getByText('A Huna ainda está conhecendo sua rotina');
    s.getByText(/ainda não marcou nenhum num cuidado/);
  });

  it('prateleira vazia é convite, não erro', async () => {
    const s = await screen({ view: view({ totalProducts: 0, used: [], neverUsed: [] }) });
    s.getByText('Sua prateleira ainda está vazia');
  });

  /** Premium é adição, nunca muro (D-83). */
  it('sem a capability, explica o que o premium acrescenta e não mostra número nenhum', async () => {
    const s = await screen({ entitled: false });
    s.getByText('Faz parte do premium');
    expect(s.queryByText(/em 4 registros/)).toBeNull();
    expect(s.queryByText(/bloquead|desbloqu|cadeado/i)).toBeNull();
  });

  it('quando a leitura falha, diz e oferece tentar de novo', async () => {
    const onRetry = jest.fn();
    const s = await screen({ view: null, loading: false, failed: true, onRetry });
    s.getByText(/Não foi possível ler seus registros/);
    fireEvent.press(s.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalled();
  });
});

/**
 * SPEC-066 (`P6`) — **o vidro e a última vez.**
 *
 * ⚠️ A tela era uma lista de nomes numa superfície **Premium** — a mesma queixa que o dono fez sobre
 * a prateleira dentro do cuidado. E a contagem responde *quantas vezes*, não *quando*.
 */
describe('Sua prateleira, em uso — identidade e última vez (SPEC-066)', () => {
  const COM_CATALOGO: Product = {
    id: 'pc',
    name: 'Invigo Nutri-Enrich',
    category: 'shampoo',
    catalog: {
      id: 'k1',
      brand: 'Wella Professionals',
      line: 'Invigo',
      name: 'Nutri-Enrich Shampoo',
      variant: '250ml',
      category: 'shampoo',
      imageUrl: null,
    },
  };

  it('mostra a data do último registro, no dia civil dela', async () => {
    const s = await screen();
    // ⛔ Dia civil lido como números puros (ADR-008): nenhum `Date` com fuso entra no caminho.
    s.getByText('última vez em sex, 04/09');
  });

  /** FR1 — marca e categoria acompanham o nome, como na prateleira e no cuidado. */
  it('mostra marca e categoria junto do nome dela', async () => {
    const s = await screen({
      view: view({ used: [{ product: COM_CATALOGO, cares: 2, lastUsedOn: '2026-09-01' }] }),
    });
    s.getByText('Invigo Nutri-Enrich');
    s.getByText(/Wella Professionals/);
  });

  /** FR5/FR3 — quem não tem foto rende o monograma, e a lista continua alinhada. */
  it('produto sem foto rende a inicial, inclusive na lista sem registro', async () => {
    const s = await screen();
    s.getByText('M', { includeHiddenElements: true }); // Máscara da feira
    s.getByText('C', { includeHiddenElements: true }); // Creme novo
  });

  /**
   * ⛔ **A data é dita e mais nada** (BR4). *"Faz tempo"*, *"você não usa desde"* ou qualquer
   * adjetivo sobre o tempo decorrido seria conselho com cara de fato — e conselho sobre produto é
   * `P18`, atrás do próprio gate.
   */
  it('não adjetiva o tempo decorrido', async () => {
    const s = await screen();
    expect(s.queryByText(/faz tempo|há muito|abandonad|esquecid|parou de|desde então/i)).toBeNull();
  });
});
