import type { CatalogProduct, ProductCatalogPort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CatalogSearchSection } from '@/features/shelf/CatalogSearchSection';

/**
 * ⚠️ **SPEC-054 (F32) — a busca do catálogo, e sobretudo QUANDO ela não existe.**
 *
 * O que este arquivo protege, em ordem de importância: que **com o catálogo vazio a busca não
 * apareça** — vazio é o estado de hoje e o permanente até a ingestão acontecer, e uma busca que
 * sempre volta vazia promete um caminho e entrega um beco —, que **digitar continue sendo o caminho
 * completo**, e que **nada aqui recomende**.
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

describe('CatalogSearchSection (SPEC-054)', () => {
  /**
   * ⚠️ **A asserção mais importante do arquivo, e ela mudou depois de o dono usar o produto.**
   *
   * A primeira versão **escondia** a busca com o catálogo vazio. O dono digitou *"wella"*, não achou
   * nada, e **não teve como saber se o catálogo estava vazio ou se a busca tinha quebrado**. Esconder
   * não protege dela: apaga a informação de que a capability existe e está crescendo.
   */
  it('com o catálogo vazio, diz que está EM EXPANSÃO — nunca que falhou (FR8)', async () => {
    const catalog = port({ isAvailable: jest.fn(async () => false) });
    const s = await show(catalog);
    await waitFor(() => s.getByText('Catálogo de produtos ainda em expansão'));
    // ⛔ E não pode parecer erro nem busca sem resultado.
    expect(s.queryByText(/não foi possível|erro|falhou|não encontramos/i)).toBeNull();
    // O caminho de sempre é nomeado ali mesmo.
    s.getByText(/escreva o nome do jeito que você chama/i);
  });

  /** Falhar em saber é tratado como vazio: "em expansão" é verdade nos dois casos. */
  it('se a checagem falhar, também diz "em expansão", não "erro"', async () => {
    const catalog = port({ isAvailable: jest.fn(async () => Promise.reject(new Error('rede'))) });
    const s = await show(catalog);
    await waitFor(() => s.getByText('Catálogo de produtos ainda em expansão'));
  });

  /** ⚠️ Enquanto não se sabe, nada é afirmado — nem a busca, nem a expansão. */
  it('antes da resposta, não afirma nada sobre o catálogo', async () => {
    let resolver: (v: boolean) => void = () => {};
    const catalog = port({ isAvailable: jest.fn(() => new Promise<boolean>((r) => (resolver = r))) });
    const s = await show(catalog);
    expect(s.queryByText('Catálogo de produtos ainda em expansão')).toBeNull();
    expect(s.queryByText('Procurar o produto')).toBeNull();
    resolver(true);
    await waitFor(() => s.getByText('Procurar o produto'));
  });

  /**
   * ⚠️ **Os dois vazios são coisas diferentes, e a tela tem de distingui-los.** Catálogo vazio é *o
   * app ainda está crescendo*; termo sem par é *a busca rodou e não achou*. Uma frase só para os dois
   * faria a usuária culpar o produto errado.
   */
  it('catálogo com linhas e termo sem par diz OUTRA coisa', async () => {
    const s = await show(port({ search: jest.fn(async () => []) }));
    await waitFor(() => s.getByText('Procurar o produto'));
    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'wella');
    await fireEvent.press(s.getByText('Buscar'));
    await waitFor(() => s.getByText(/Não encontramos esse produto/i));
    expect(s.queryByText('Catálogo de produtos ainda em expansão')).toBeNull();
  });

  it('com catálogo, busca por texto e mostra marca, linha e variante', async () => {
    const catalog = port();
    const s = await show(catalog);
    await waitFor(() => s.getByText('Procurar o produto'));

    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'shampoo');
    await fireEvent.press(s.getByText('Buscar'));

    await waitFor(() => s.getByText('Shampoo de Teste'));
    s.getByText('Marca Fictícia · Linha Teste · 300ml');
    expect(catalog.search).toHaveBeenCalledWith({ text: 'shampoo' });
  });

  /** `F33` — o código de barras já busca; o que falta é o scanner (OQ2). */
  it('um termo só de dígitos é buscado como EAN', async () => {
    const catalog = port();
    const s = await show(catalog);
    await waitFor(() => s.getByText('Procurar o produto'));

    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), '7891234567895');
    await fireEvent.press(s.getByText('Buscar'));

    await waitFor(() => expect(catalog.search).toHaveBeenCalledWith({ ean: '7891234567895' }));
  });

  it('escolher um produto entrega o produto inteiro, com o id do catálogo', async () => {
    const onPick = jest.fn();
    const s = await show(port(), onPick);
    await waitFor(() => s.getByText('Procurar o produto'));
    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'shampoo');
    await fireEvent.press(s.getByText('Buscar'));
    await waitFor(() => s.getByText('Shampoo de Teste'));

    await fireEvent.press(s.getByLabelText('Adicionar Marca Fictícia Shampoo de Teste à prateleira'));
    expect(onPick).toHaveBeenCalledWith(REAL);
  });

  /** ⚠️ Sem resultado não é falha dela nem do app — e o caminho de digitar está logo abaixo. */
  it('sem resultado, oferece escrever o nome em vez de mostrar erro', async () => {
    const s = await show(port({ search: jest.fn(async () => []) }));
    await waitFor(() => s.getByText('Procurar o produto'));
    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'nada');
    await fireEvent.press(s.getByText('Buscar'));
    await waitFor(() => s.getByText(/pode escrever o nome/i));
    expect(s.queryByText(/erro|falha|não foi possível/i)).toBeNull();
  });

  /** Uma busca que falhou também não vira erro de tela: digitar continua ali, inteiro. */
  it('busca que falha degrada para "não encontramos", nunca para um erro', async () => {
    const s = await show(port({ search: jest.fn(async () => Promise.reject(new Error('rede'))) }));
    await waitFor(() => s.getByText('Procurar o produto'));
    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'shampoo');
    await fireEvent.press(s.getByText('Buscar'));
    await waitFor(() => s.getByText(/pode escrever o nome/i));
  });

  /**
   * ⛔ **A barreira de linguagem.** Um catálogo que diz *"recomendado"* ou *"para o seu cabelo"* é
   * a `P18` sem gate; um que diz *"popular"* é o `T2` entrando pela ordenação (NG3/AC8).
   */
  it('nada na busca recomenda, ordena por mérito ou afirma efeito', async () => {
    const s = await show(port());
    await waitFor(() => s.getByText('Procurar o produto'));
    await fireEvent.changeText(s.getByLabelText('Marca ou nome do produto'), 'shampoo');
    await fireEvent.press(s.getByText('Buscar'));
    await waitFor(() => s.getByText('Shampoo de Teste'));

    const proibidos =
      /recomendad|popular|mais vendid|ideal|melhor|para o seu cabelo|indicad|hidrata|nutre|repara/i;
    expect(s.queryByText(proibidos)).toBeNull();
    // A barreira no outro sentido: ela reprova as frases que não podem aparecer.
    for (const frase of ['Recomendado para você', 'O mais popular', 'Ideal para cabelos secos']) {
      expect(proibidos.test(frase)).toBe(true);
    }
  });
});
