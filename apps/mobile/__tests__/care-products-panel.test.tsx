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

const MASK: Product = { id: 'p1', name: 'Máscara da feira', category: 'mask', catalog: null };
const SHAMPOO: Product = { id: 'p2', name: 'Shampoo do mercado', category: 'shampoo', catalog: null };
const OIL: Product = { id: 'p3', name: 'Óleo de coco', category: 'oil', catalog: null };

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
    await waitFor(() => s.getByText(/Você usou na última/));
    s.getByText('Máscara da feira');
  });

  /**
   * ⚠️ **A barreira do D-26/D-70.** Um shampoo aparece num cuidado de hidratação porque é dela, não
   * porque o app decidiu que shampoo serve para hidratar. No dia em que alguém filtrar por
   * categoria, este teste cai — e a conversa que ele força é a do gate.
   */
  it('NÃO filtra a prateleira por categoria (D-26/D-70)', async () => {
    const s = await renderPanel([], [MASK, SHAMPOO, OIL]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    s.getByText('Máscara da feira');
    s.getByText('Shampoo do mercado');
    s.getByText('Óleo de coco');
  });

  /** O mesmo vidro duas vezes na mesma tela foi achado real na auditoria da SPEC-026. */
  it('não repete, na prateleira, o que já apareceu em "da última vez"', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText(/Você usou na última/));
    expect(s.getAllByText('Máscara da feira')).toHaveLength(1);
    s.getByText('Outros da sua prateleira');
  });

  it('sem registro anterior, mostra só a prateleira — e não inventa um "da última vez"', async () => {
    const s = await renderPanel([], [SHAMPOO]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    expect(s.queryByText(/Você usou na última/)).toBeNull();
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
    await waitFor(() => s.getByText('Da sua prateleira'));
    expect(s.washDays.lastUsedFor).toHaveBeenCalledWith('hydration');
  });

  /**
   * NG — nada aqui recomenda, ordena por mérito ou promete resultado. O painel apresenta; quem
   * recomenda é a `P18`, que é outra capability e tem outro gate.
   */
  it('não recomenda, não ordena por mérito e não promete nada', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText(/Você usou na última/));
    expect(s.queryByText(/recomend|ideal|melhor|indicad|use |experimente|compre/i)).toBeNull();
  });
});

/**
 * ⚠️ **SPEC-054 G4/AC9 — o mesmo produto, a mesma marca, a mesma foto.**
 *
 * O que se protege aqui é a **continuidade**: se a prateleira mostra a embalagem e a execução mostra
 * um nome solto, é o mesmo vidro parecendo dois produtos — e é exatamente o que o catálogo existe
 * para acabar.
 */
describe('CareProductsPanel — a identidade do catálogo (SPEC-054)', () => {
  const REAL: Product = {
    id: 'p9',
    name: 'Meu shampoo',
    category: 'shampoo',
    catalog: {
      id: 'c1',
      brand: 'Marca Fictícia',
      line: 'Linha Teste',
      name: 'Shampoo de Teste',
      variant: '300ml',
      category: 'shampoo',
      imageUrl: 'https://exemplo.test/p.jpg',
    },
  };

  it('mostra a marca junto do nome no que ela usou da última vez', async () => {
    const s = await renderPanel([REAL], [REAL]);
    await waitFor(() => s.getByText(/Você usou na última/));
    // ⚠️ O nome DELA continua sendo o título; a marca é a segunda linha.
    s.getByText('Meu shampoo');
    s.getByText('Marca Fictícia · Linha Teste · 300ml');
  });

  it('no resto da prateleira, a marca vem junto do nome, nunca no lugar dele', async () => {
    const s = await renderPanel([MASK], [MASK, REAL]);
    await waitFor(() => s.getByText('Outros da sua prateleira'));
    // ⚠️ O nome DELA lidera a linha e a marca acompanha na legenda — ver SPEC-063: juntar os dois
    // num texto só fazia a marca longa truncar justamente o nome que ela reconhece.
    s.getByText('Meu shampoo');
    s.getByText(/Marca Fictícia/);
  });

  /**
   * ⚠️ **A regressão que vale mais que as outras.** Toda prateleira que existe hoje é manual, e o
   * catálogo vazio é o estado permanente até a ingestão acontecer.
   */
  it('sem catálogo, o painel é byte a byte o de antes (AC1)', async () => {
    const s = await renderPanel([MASK], [MASK, SHAMPOO]);
    await waitFor(() => s.getByText(/Você usou na última/));
    s.getByText('Máscara da feira');
    s.getByText('Shampoo do mercado');
    // Nenhuma segunda linha inventada onde não há catálogo.
    expect(s.queryByText(/ · /)).toBeNull();
  });

  /** FR7 — produto de catálogo **sem foto** continua utilizável, e continua mostrando a marca. */
  it('produto de catálogo sem imagem não perde a marca', async () => {
    const semFoto: Product = { ...REAL, catalog: { ...REAL.catalog!, imageUrl: null } };
    const s = await renderPanel([semFoto], [semFoto]);
    await waitFor(() => s.getByText(/Você usou na última/));
    s.getByText('Marca Fictícia · Linha Teste · 300ml');
  });
});
