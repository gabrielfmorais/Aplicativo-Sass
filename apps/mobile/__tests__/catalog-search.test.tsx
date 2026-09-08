import type { CatalogProduct, ProductCatalogPort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CatalogSearchSection } from '@/features/shelf/CatalogSearchSection';

/**
 * SPEC-054 (F32) — a busca do catálogo · SPEC-058 — **autocomplete em tempo real**.
 *
 * O que este arquivo protege: com o catálogo vazio a busca não aparece; **a busca sugere enquanto ela
 * digita** (sem botão "Buscar"), mostrando **marcas** e **produtos**; os dois vazios (catálogo sem
 * linhas vs termo sem par) continuam distintos; e **nada aqui recomenda nem ordena por mérito**.
 */

const REAL: CatalogProduct = {
  id: 'c1',
  brand: 'Marca Fictícia',
  line: 'Linha Teste',
  name: 'Shampoo de Teste',
  variant: '300ml',
  category: 'shampoo',
  ean: '7891234567895',
  imageUrl: 'https://exemplo.test/p.jpg',
};

const port = (over: Partial<ProductCatalogPort> = {}): ProductCatalogPort => ({
  isAvailable: jest.fn(async () => true),
  search: jest.fn(async () => [REAL]),
  ...over,
});

const show = (catalog: ProductCatalogPort, onPick = jest.fn()) =>
  render(<CatalogSearchSection catalog={catalog} busy={false} onPick={onPick} />);

const type = (s: Awaited<ReturnType<typeof show>>, t: string) =>
  fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), t);

describe('CatalogSearchSection (SPEC-054 / SPEC-058)', () => {
  it('com o catálogo vazio, diz que está EM EXPANSÃO — nunca que falhou (FR8)', async () => {
    const s = await show(port({ isAvailable: jest.fn(async () => false) }));
    await waitFor(() => s.getByText('Catálogo de produtos ainda em expansão'));
    expect(s.queryByText(/não foi possível|erro|falhou|não encontramos/i)).toBeNull();
    s.getByText(/escreva o nome do jeito que você chama/i);
  });

  it('se a checagem falhar, também diz "em expansão", não "erro"', async () => {
    const s = await show(port({ isAvailable: jest.fn(async () => Promise.reject(new Error('rede'))) }));
    await waitFor(() => s.getByText('Catálogo de produtos ainda em expansão'));
  });

  it('antes da resposta, não afirma nada sobre o catálogo', async () => {
    let resolver: (v: boolean) => void = () => {};
    const s = await show(port({ isAvailable: jest.fn(() => new Promise<boolean>((r) => (resolver = r))) }));
    expect(s.queryByText('Procurar o produto')).toBeNull();
    resolver(true);
    await waitFor(() => s.getByText('Procurar o produto'));
  });

  it('digitar sugere sem clicar em nada (autocomplete), e mostra marca/linha/variante', async () => {
    const catalog = port();
    const s = await show(catalog);
    await waitFor(() => s.getByText('Procurar o produto'));
    expect(s.queryByText('Buscar')).toBeNull(); // sem botão: a experiência é instantânea

    type(s, 'shampoo');
    await waitFor(() => s.getByText('Shampoo de Teste'));
    s.getByText('Marca Fictícia · Linha Teste · 300ml');
    expect(catalog.search).toHaveBeenCalledWith({ text: 'shampoo' });
  });

  it('mostra a MARCA como atalho, e tocar nela busca aquela marca', async () => {
    const catalog = port();
    const s = await show(catalog);
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, 'sha');
    await waitFor(() => s.getByText('Shampoo de Teste'));
    s.getByText('Marcas');
    // O atalho da marca leva a uma busca por ela.
    await fireEvent.press(s.getByLabelText('Ver produtos da Marca Fictícia'));
    await waitFor(() => expect(catalog.search).toHaveBeenCalledWith({ text: 'Marca Fictícia' }));
  });

  it('um termo só de dígitos é buscado como EAN', async () => {
    const catalog = port();
    const s = await show(catalog);
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, '7891234567895');
    await waitFor(() => expect(catalog.search).toHaveBeenCalledWith({ ean: '7891234567895' }));
  });

  it('escolher um produto entrega o produto inteiro, com o id do catálogo', async () => {
    const onPick = jest.fn();
    const s = await show(port(), onPick);
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, 'shampoo');
    await waitFor(() => s.getByText('Shampoo de Teste'));
    await fireEvent.press(s.getByLabelText('Adicionar Marca Fictícia Shampoo de Teste à prateleira'));
    expect(onPick).toHaveBeenCalledWith(REAL);
  });

  it('termo sem par diz "não encontramos" — distinto do catálogo vazio', async () => {
    const s = await show(port({ search: jest.fn(async () => []) }));
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, 'wella');
    await waitFor(() => s.getByText(/Não encontramos esse produto/i));
    expect(s.queryByText('Catálogo de produtos ainda em expansão')).toBeNull();
  });

  it('busca que falha degrada para "não encontramos", nunca para um erro', async () => {
    const s = await show(port({ search: jest.fn(async () => Promise.reject(new Error('rede'))) }));
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, 'shampoo');
    await waitFor(() => s.getByText(/pode escrever o nome/i));
  });

  it('nada na busca recomenda, ordena por mérito ou afirma efeito', async () => {
    const s = await show(port());
    await waitFor(() => s.getByText('Procurar o produto'));
    type(s, 'shampoo');
    await waitFor(() => s.getByText('Shampoo de Teste'));
    const proibidos =
      /recomendad|popular|mais vendid|ideal|melhor|para o seu cabelo|indicad|hidrata|nutre|repara/i;
    expect(s.queryByText(proibidos)).toBeNull();
    for (const frase of ['Recomendado para você', 'O mais popular', 'Ideal para cabelos secos'])
      expect(proibidos.test(frase)).toBe(true);
  });
});
