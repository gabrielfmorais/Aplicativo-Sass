import type { Product, ProductPort } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ShelfScreen } from '@/features/shelf/ShelfScreen';

const makePort = (overrides: Partial<ProductPort> = {}): jest.Mocked<ProductPort> =>
  ({
    list: jest.fn(async () => [] as readonly Product[]),
    add: jest.fn(async () => undefined),
    rename: jest.fn(async () => undefined),
    archive: jest.fn(async () => undefined),
    ...overrides,
  }) as unknown as jest.Mocked<ProductPort>;

const renderScreen = (products: ProductPort) => render(<ShelfScreen products={products} />);

/**
 * SPEC-023 (F26). É a prateleira dela: o app guarda o que ela digitou e mais nada. Não é loja, não
 * é catálogo, e não interpreta — interpretar é `P6`, é Premium, e exige volume mínimo.
 */
describe('ShelfScreen (SPEC-023)', () => {
  it('cadastra com nome e categoria, e normaliza só o espaço', async () => {
    const products = makePort();
    const s = await renderScreen(products);
    await waitFor(() => s.getByText(/Nada aqui ainda/));

    await fireEvent.changeText(s.getByLabelText('Nome do produto'), '  Máscara   da feira  ');
    await fireEvent.press(s.getByText('Máscara'));
    await fireEvent.press(s.getByText('Adicionar'));

    // O nome é dela: apara e colapsa espaço, e não toca em mais nada.
    await waitFor(() =>
      expect(products.add).toHaveBeenCalledWith({ name: 'Máscara da feira', category: 'mask' }),
    );
  });

  it('exige nome e categoria antes de deixar adicionar', async () => {
    const products = makePort();
    const s = await renderScreen(products);
    await waitFor(() => s.getByText(/Nada aqui ainda/));

    expect(s.getByText('Adicionar').parent?.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.changeText(s.getByLabelText('Nome do produto'), 'Shampoo X');
    // Nome sem categoria ainda não basta.
    expect(s.getByText('Adicionar').parent?.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(s.getByText('Shampoo'));
    expect(s.getByText('Adicionar').parent?.props.accessibilityState?.disabled).toBe(false);
  });

  /** EC2 — duplicata não é falha, é informação. Mostrar o erro cru faria ela achar que quebrou. */
  it('nome repetido vira uma frase, não um erro', async () => {
    const duplicate = Object.assign(new Error('dup'), { code: 'hair_profile.product_duplicate' });
    const products = makePort({ add: jest.fn(async () => Promise.reject(duplicate)) });
    const s = await renderScreen(products);
    await waitFor(() => s.getByText(/Nada aqui ainda/));

    await fireEvent.changeText(s.getByLabelText('Nome do produto'), 'Shampoo X');
    await fireEvent.press(s.getByText('Shampoo'));
    await fireEvent.press(s.getByText('Adicionar'));

    expect(await s.findByText('Você já tem esse produto na prateleira.')).toBeTruthy();
    expect(s.queryByText(/Não foi possível adicionar/)).toBeNull();
  });

  it('lista o que ela tem e deixa tirar da prateleira', async () => {
    const products = makePort({
      list: jest.fn(async () => [{ id: 'p1', name: 'Shampoo X', category: 'shampoo' as const }]),
    });
    const s = await renderScreen(products);
    await waitFor(() => s.getByText('Shampoo X'));

    await fireEvent.press(s.getByLabelText('Tirar Shampoo X da prateleira'));
    await waitFor(() => expect(products.archive).toHaveBeenCalledWith('p1'));
    // Nunca apagar: arquivar é o verbo, e a linha continua no banco (BR4).
    expect(products).not.toHaveProperty('delete');
  });

  it('uma leitura que falha não vira prateleira vazia', async () => {
    const products = makePort({ list: jest.fn(async () => Promise.reject(new Error('rede'))) });
    const s = await renderScreen(products);

    expect(await s.findByText('Não foi possível carregar sua prateleira.')).toBeTruthy();
    expect(s.queryByText(/Nada aqui ainda/)).toBeNull();
    s.getByText('Tentar novamente');
  });

  it('prateleira vazia convida, sem cobrar', async () => {
    const s = await renderScreen(makePort());
    expect(await s.findByText('Nada aqui ainda. Comece pelo que você mais usa.')).toBeTruthy();
  });

  /**
   * AC6/AC7 — a barreira. O app nunca afirma nada sobre um produto que ele não sabe, e nunca
   * interpreta: interpretar é Premium e exige volume mínimo. As amostras precisam casar.
   */
  it('não afirma nada sobre o produto e não interpreta nada', async () => {
    const products = makePort({
      list: jest.fn(async () => [{ id: 'p1', name: 'Shampoo X', category: 'shampoo' as const }]),
    });
    const s = await renderScreen(products);
    await waitFor(() => s.getByText('Shampoo X'));

    const forbidden = [
      /\b(indicado para|ideal para|composição|ingredientes|preço|R\$)/i,
      /\b(mais usado|mais eficaz|melhor para você|recomendamos|combina com)/i,
      /\b(funciona|resultado comprovado|repara|recupera)/i,
      /\d+\s*%/,
    ];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    for (const sample of ['indicado para cabelos secos', 'seu mais usado', 'R$ 39,90', 'repara os fios']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});

/**
 * SPEC-033 — a prateleira mostra primeiro o que ela **tem**.
 *
 * ⚠️ **O que estes testes protegem é uma inversão medida.** A tela chamada "Prateleira" abria com
 * ~470px de formulário vazio — campo mais sete categorias — e o que ela tem em casa começava abaixo
 * da dobra. O "Adicionar" ficava fixo no rodapé, permanentemente desabilitado enquanto o formulário
 * estivesse vazio: um botão primário morto no pé de toda visita.
 */
describe('ShelfScreen — o cadastro é ação, não o topo da tela (SPEC-033)', () => {
  const withProducts = () =>
    makePort({
      list: jest.fn(
        async () =>
          [
            { id: 'p1', name: 'Shampoo X', category: 'shampoo', archivedAt: null },
          ] as unknown as readonly Product[],
      ),
    });

  it('com produtos, abre na lista — e o formulário não ocupa a tela', async () => {
    const s = await renderScreen(withProducts());
    await waitFor(() => s.getByText('Shampoo X'));

    expect(s.queryByLabelText('Nome do produto')).toBeNull();
    // A vaga primária existe e **abre** o formulário; ela não é um botão de enviar desabilitado.
    const open = s.getByText('Adicionar produto');
    expect(open.parent?.props.accessibilityState?.disabled).toBe(false);
  });

  it('tocar em "Adicionar produto" revela o formulário, e dá como voltar', async () => {
    const s = await renderScreen(withProducts());
    await waitFor(() => s.getByText('Shampoo X'));

    await fireEvent.press(s.getByText('Adicionar produto'));
    expect(s.getByLabelText('Nome do produto')).toBeTruthy();
    // A lista não some ao cadastrar: ela é a referência de "já tenho isso".
    expect(s.getByText('Shampoo X')).toBeTruthy();

    await fireEvent.press(s.getByText('Cancelar'));
    expect(s.queryByLabelText('Nome do produto')).toBeNull();
  });

  /**
   * ⚠️ **Sem nada cadastrado, o formulário É o conteúdo.** Escondê-lo atrás de um toque esconderia a
   * única coisa que há para fazer na tela — e não há para onde "cancelar" voltar.
   */
  it('com a prateleira vazia, o formulário já vem aberto e não oferece cancelar', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(/Nada aqui ainda/));

    expect(s.getByLabelText('Nome do produto')).toBeTruthy();
    expect(s.queryByText('Cancelar')).toBeNull();
    expect(s.queryByText('Adicionar produto')).toBeNull();
  });

  /**
   * ⚠️ **Uma leitura que falhou não é uma prateleira vazia**, e portanto não abre o formulário
   * sozinha — abrir seria afirmar "você não tem nada" a partir de um erro de rede.
   */
  it('uma leitura que falha não abre o formulário', async () => {
    const s = await renderScreen(makePort({ list: jest.fn(async () => Promise.reject(new Error('x'))) }));
    await waitFor(() => s.getByText('Tentar novamente'));

    expect(s.queryByLabelText('Nome do produto')).toBeNull();
  });
});
