import type { Product, ProductPort, WashDayPort } from '@app/core';
import { render, waitFor } from '@testing-library/react-native';

import { CareProductsPanel } from '@/features/care/CareProductsPanel';

/**
 * SPEC-041 (F48) — o que ela **já tem**, no momento do cuidado.
 *
 * ⚠️ **A barreira principal não é de layout, é de domínio:** este painel não pode escolher produto
 * por categoria, composição ou indicação. Associar "máscara" a "hidratação" é conteúdo capilar
 * substantivo (D-26/D-70) — o que ele mostra é o registro que **ela** fez e a prateleira **dela**.
 */

const MASK: Product = { id: 'p1', name: 'Máscara da feira', category: 'mask' };
const SHAMPOO: Product = { id: 'p2', name: 'Shampoo do mercado', category: 'shampoo' };
const OIL: Product = { id: 'p3', name: 'Óleo de coco', category: 'oil' };

const ports = (lastUsed: readonly Product[], shelf: readonly Product[]) => ({
  washDays: { lastUsedFor: jest.fn(async () => lastUsed) } as unknown as WashDayPort,
  products: { list: jest.fn(async () => shelf) } as unknown as ProductPort,
});

const renderPanel = async (lastUsed: readonly Product[], shelf: readonly Product[]) => {
  const { washDays, products } = ports(lastUsed, shelf);
  return {
    ...(await render(<CareProductsPanel careTypeCode="hydration" washDays={washDays} products={products} />)),
    washDays,
    products,
  };
};

describe('produtos na execução (SPEC-041)', () => {
  it('mostra o que ela usou da última vez, como fato dela', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText('Da última vez você usou'));
    s.getByText('Máscara da feira');
  });

  /**
   * ⚠️ **A barreira do D-26/D-70.** Um shampoo aparece num cuidado de hidratação porque é dela, não
   * porque o app decidiu que shampoo serve para hidratar. No dia em que alguém filtrar por
   * categoria, este teste cai — e a conversa que ele força é a do gate.
   */
  it('NÃO filtra a prateleira por categoria (D-26/D-70)', async () => {
    const s = await renderPanel([], [MASK, SHAMPOO, OIL]);
    await waitFor(() => s.getByText('Na sua prateleira'));
    s.getByText('Máscara da feira');
    s.getByText('Shampoo do mercado');
    s.getByText('Óleo de coco');
  });

  /** O mesmo vidro duas vezes na mesma tela foi achado real na auditoria da SPEC-026. */
  it('não repete, na prateleira, o que já apareceu em "da última vez"', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText('Da última vez você usou'));
    expect(s.getAllByText('Máscara da feira')).toHaveLength(1);
    s.getByText('Também na sua prateleira');
  });

  it('sem registro anterior, mostra só a prateleira — e não inventa um "da última vez"', async () => {
    const s = await renderPanel([], [SHAMPOO]);
    await waitFor(() => s.getByText('Na sua prateleira'));
    expect(s.queryByText('Da última vez você usou')).toBeNull();
  });

  it('prateleira vazia é convite, não beco', async () => {
    const s = await renderPanel([], []);
    await waitFor(() => s.getByText(/Sua prateleira está vazia/));
  });

  /** Uma conveniência que não carregou não vira erro em tela cheia: ela ainda pode fazer o cuidado. */
  it('uma leitura que falhou não derruba o cuidado', async () => {
    const s = await render(
      <CareProductsPanel
        careTypeCode="hydration"
        washDays={
          {
            lastUsedFor: jest.fn(async () => {
              throw new Error('offline');
            }),
          } as unknown as WashDayPort
        }
        products={{ list: jest.fn(async () => []) } as unknown as ProductPort}
      />,
    );
    await waitFor(() => s.getByText(/Não foi possível abrir sua prateleira/));
  });

  it('pergunta pelo tipo do cuidado que está na tela', async () => {
    const s = await renderPanel([], [SHAMPOO]);
    await waitFor(() => s.getByText('Na sua prateleira'));
    expect(s.washDays.lastUsedFor).toHaveBeenCalledWith('hydration');
  });

  /**
   * NG — nada aqui recomenda, ordena por mérito ou promete resultado. O painel apresenta; quem
   * recomenda é a `P18`, que é outra capability e tem outro gate.
   */
  it('não recomenda, não ordena por mérito e não promete nada', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText('Da última vez você usou'));
    expect(s.queryByText(/recomend|ideal|melhor|indicad|use |experimente|compre/i)).toBeNull();
  });
});
