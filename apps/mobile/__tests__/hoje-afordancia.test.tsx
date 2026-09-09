import { careColor } from '@/design/tokens';
import { ProductMark } from '@/features/shelf/ProductIdentity';
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

describe('SPEC-055 + SPEC-063 — nunca uma caixa vazia; sempre uma marca', () => {
  /**
   * ⚠️ **Esta barreira mudou de forma na SPEC-063, e a intenção dela ficou intacta.**
   *
   * O que a SPEC-055 consertou foi um **quadrado cinza vazio** reservado *"para a linha não pular"*:
   * com o catálogo vazio, a Prateleira ganhava três caixas em branco, e três caixas em branco leem
   * como **imagem quebrada**. A regra que ela escreveu — *"um espaço reservado que nunca vai ser
   * preenchido é pior que nenhum"* — continua certa.
   *
   * ⚠️ **A SPEC-063 mostrou que havia uma terceira saída, melhor que as duas.** Não renderizar nada
   * resolve a caixa vazia mas deixa a **coluna de texto desalinhada** numa lista em que metade dos
   * produtos tem foto — e o produto manual **nunca** terá foto, então o desalinho é permanente.
   * O monograma **não é espaço reservado: é conteúdo**, e é o que mantém a lista alinhada.
   *
   * Então o teste passa a afirmar o que sempre importou: **nunca uma caixa vazia** — sem foto,
   * aparece a inicial.
   */
  const identidade = (imageUrl: string | null) => ({
    id: 'c1',
    brand: 'Marca Fictícia',
    line: null,
    name: 'Produto',
    variant: null,
    category: 'mask' as const,
    imageUrl,
  });

  it('sem identidade de catálogo, mostra a inicial do nome dela — nunca um vazio', async () => {
    const s = await render(<ProductMark identity={null} name="Máscara da feira" />);
    s.getByText('M', { includeHiddenElements: true });
  });

  it('com identidade mas sem imagem, também mostra a inicial', async () => {
    const s = await render(<ProductMark identity={identidade(null)} name="Óleo de coco" />);
    s.getByText('Ó', { includeHiddenElements: true });
  });

  /** ⛔ E a marca **nunca** é um bloco sem conteúdo: sem foto, há letra; com foto, há imagem. */
  it('com imagem, a foto aparece e não há letra solta', async () => {
    const s = await render(
      <ProductMark identity={identidade('https://exemplo.test/p.jpg')} name="Produto" />,
    );
    expect(s.queryByText('P', { includeHiddenElements: true })).toBeNull();
  });
});
