import { careColor } from '@/design/tokens';
import { ProductThumb } from '@/features/shelf/ProductIdentity';
import { render } from '@testing-library/react-native';

/**
 * ⚠️ **SPEC-055 — as barreiras da rodada visual, e elas não são sobre gosto.**
 *
 * O que se protege aqui é **afordância**: uma coisa tocável tem de se parecer com uma coisa tocável.
 * A medição que abriu a rodada foi contar as variantes no repositório — `ghost` (fundo transparente,
 * texto cinza, **sem corpo**) era a **mais usada do app**, 46 contra 30 de `secondary`, com 13 na
 * Hoje. Usá-la como padrão de *"ação secundária"* foi o que deixou o produto sem alma.
 */

describe('SPEC-055 — a cor do cuidado pinta o cartão (FR4)', () => {
  /**
   * Os tokens prometem, por escrito, que *"a cor é uma segunda forma de ler o plano de relance"*. Na
   * tela real isso era **um ponto de 8px**: três cuidados de tipos diferentes eram três retângulos
   * brancos idênticos.
   */
  it('cada tipo tem uma cor própria, e nenhuma se repete', () => {
    const tons = Object.values(careColor).map((c) => c.fg);
    expect(new Set(tons).size).toBe(tons.length);
    expect(tons.length).toBe(4);
  });

  /** ⛔ BR2/NG4 — a cor do cuidado **informa**; ameixa continua sendo a única cor de **ação**. */
  it('nenhuma cor de cuidado é a cor de ação', () => {
    const acao = ['#7A2F52', '#5F2340'];
    for (const { fg } of Object.values(careColor)) {
      expect(acao).not.toContain(fg.toUpperCase());
    }
  });
});

describe('SPEC-055 — a miniatura só existe quando existe foto (FR6)', () => {
  /**
   * ⚠️ **O conserto de uma regressão da SPEC-054.** A primeira versão reservava um quadrado neutro
   * *"para a linha não pular"*. Com o catálogo vazio — o estado **permanente** até a ingestão — a
   * Prateleira ganhou **três caixas cinza em branco**, e três caixas em branco leem como imagem
   * quebrada. Um espaço reservado que nunca vai ser preenchido é pior que nenhum.
   */
  it('sem identidade de catálogo, nada é renderizado', async () => {
    const s = await render(<ProductThumb identity={null} />);
    expect(s.toJSON()).toBeNull();
  });

  it('com identidade mas sem imagem, também nada é renderizado', async () => {
    const s = await render(
      <ProductThumb
        identity={{
          id: 'c1',
          brand: 'Marca Fictícia',
          line: null,
          name: 'Produto',
          variant: null,
          category: 'mask',
          imageUrl: null,
        }}
      />,
    );
    expect(s.toJSON()).toBeNull();
  });

  it('com imagem, a miniatura aparece', async () => {
    const s = await render(
      <ProductThumb
        identity={{
          id: 'c1',
          brand: 'Marca Fictícia',
          line: null,
          name: 'Produto',
          variant: null,
          category: 'mask',
          imageUrl: 'https://exemplo.test/p.jpg',
        }}
      />,
    );
    expect(s.toJSON()).not.toBeNull();
  });
});
