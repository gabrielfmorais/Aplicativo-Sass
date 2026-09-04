import type { ShelfUsage } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { ShelfUsageScreen } from '@/features/insights/ShelfUsageScreen';

/**
 * SPEC-049 (P6) — **Smart Shelf**.
 *
 * ⚠️ O que estes testes guardam: **contagem, nunca julgamento**, e *"ainda sem registro"* como
 * **fato, não conselho**.
 */

const view = (over: Partial<ShelfUsage> = {}): ShelfUsage => ({
  totalProducts: 3,
  recordedCares: 6,
  used: [{ id: 'p1', name: 'Máscara da feira', cares: 4 }],
  neverUsed: [{ id: 'p3', name: 'Creme novo' }],
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
