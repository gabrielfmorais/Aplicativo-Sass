import type { CareTypeCode, Product } from '@app/core';
import { CARE_TYPE_CODES } from '@app/core';
import { render, waitFor } from '@testing-library/react-native';

import { CareProductsPanel } from '@/features/care/CareProductsPanel';
import { CARE_TYPE_LABEL } from '@/features/plan/copy';
import { productsOfLastMarkedHub } from '@/infrastructure/supabase/wash-day-adapter';

/**
 * ⚠️ **SPEC-063 — a auditoria que o dono mandou fazer, virada em barreira.**
 *
 * O pedido original dizia *"um produto principal da prateleira **para aquele cuidado**"* e *"outras
 * opções **compatíveis**"*. A auditoria mediu o que o sistema sabe: as categorias são
 * `shampoo · conditioner · mask · leave_in · oil · styler · other`, e o próprio vocabulário diz que
 * *"categoria é organização de prateleira, não afirmação capilar"* — os guias confirmam, existe
 * *"máscara de hidratação"* **e** *"máscara de reconstrução"*.
 *
 * ⛔ **Nada no sistema associa produto a etapa.** Então o destaque é ancorado no **fato dela** — o que
 * ela marcou da última vez que fez este tipo de cuidado — e nenhum texto afirma adequação.
 */

const MANUAL: Product = { id: 'm1', name: 'Máscara da feira', category: 'mask', catalog: null };
const DE_CATALOGO: Product = {
  id: 'c1',
  name: 'Invigo Nutri-Enrich',
  category: 'mask',
  catalog: {
    id: 'k1',
    brand: 'Wella',
    line: 'Invigo',
    name: 'Nutri-Enrich Mask',
    variant: '500ml',
    category: 'mask',
    imageUrl: 'https://exemplo.test/m.jpg',
  },
};
const SEM_FOTO: Product = { ...DE_CATALOGO, id: 'c2', catalog: { ...DE_CATALOGO.catalog!, imageUrl: null } };

const painel = (lastUsed: readonly Product[], shelf: readonly Product[], code: CareTypeCode = 'hydration') =>
  render(
    <CareProductsPanel
      careTypeCode={code}
      washDays={{ lastUsedFor: async () => lastUsed } as never}
      products={{ list: async () => shelf } as never}
    />,
  );

describe('SPEC-063 BR1 — nada aqui afirma adequação', () => {
  /**
   * ⚠️ **A barreira central, e ela é mais larga que a da SPEC-041 de propósito.** Aquela cobria
   * *recomendado · ideal · melhor · indicado*; esta acrescenta as palavras que **o próprio pedido do
   * dono trazia** — "compatível", "para este cuidado", "para esta etapa" —, porque foram elas que a
   * auditoria reprovou, e é exatamente por elas que a tentação volta.
   */
  const PROIBIDO =
    /recomend|ideal|indicad|melhor|combina|compat[íi]v|adequad|perfeit|para este cuidado|para esta etapa|serve para|apropriad/i;

  it.each(CARE_TYPE_CODES)('%s: nenhum texto da tela afirma adequação', async (code) => {
    const s = await painel([DE_CATALOGO], [DE_CATALOGO, MANUAL], code);
    await waitFor(() => s.getByText(new RegExp(`Você usou na última ${CARE_TYPE_LABEL[code]}`)));
    expect(s.queryByText(PROIBIDO)).toBeNull();
  });

  /** E o estado sem histórico também não pode escorregar: é onde inventar um "principal" tentaria. */
  it('sem histórico, o texto continua factual', async () => {
    const s = await painel([], [MANUAL]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    expect(s.queryByText(PROIBIDO)).toBeNull();
  });
});

describe('SPEC-063 FR1/BR3 — o destaque é fato dela, ou não existe', () => {
  /** O rótulo nomeia o cuidado **e** o tempo verbal é passado: é história, não indicação. */
  it('o destaque é rotulado pelo que ela fez, e nomeia o cuidado', async () => {
    const s = await painel([DE_CATALOGO], [DE_CATALOGO], 'reconstruction');
    await waitFor(() => s.getByText('Você usou na última Reconstrução'));
  });

  /**
   * ⛔ **BR3 — sem registro anterior não há destaque, e nada o substitui.** Escolher um produto
   * qualquer para preencher o lugar seria inventar exatamente a adequação que a auditoria proibiu.
   */
  it('sem registro anterior, nenhum produto é promovido a destaque', async () => {
    const s = await painel([], [MANUAL, DE_CATALOGO]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    expect(s.queryByText(/Você usou na última/)).toBeNull();
  });

  /**
   * ⚠️ **FR3 — se ela marcou três, os três aparecem.** Eleger "o principal" seria ordem de mérito,
   * a mesma recusa que mantém a `P7` fora da Smart Shelf.
   */
  it('todos os produtos da última vez aparecem, sem eleger um', async () => {
    const s = await painel([MANUAL, DE_CATALOGO], [MANUAL, DE_CATALOGO]);
    await waitFor(() => s.getByText(/Você usou na última/));
    s.getByText('Máscara da feira');
    s.getByText('Invigo Nutri-Enrich');
  });
});

describe('SPEC-063 FR4/FR5 — deixou de ser lista de nomes', () => {
  /** A categoria aparece — é organização de prateleira, e não diz para que o produto serve. */
  it('cada produto mostra a categoria', async () => {
    const s = await painel([], [MANUAL]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    s.getByText('Máscara');
  });

  /**
   * ⚠️ **FR5 — o monograma existe para o produto sem foto**, e é o que mantém a coluna de texto
   * alinhada. ⛔ Não é a caixa cinza vazia que a SPEC-055 removeu: aquilo era espaço reservado que
   * nunca preencheria; isto é conteúdo, e é permanente para o produto manual.
   */
  it('produto sem foto rende a inicial, e não um buraco', async () => {
    const s = await painel([], [MANUAL, SEM_FOTO]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    /**
     * ⚠️ `includeHiddenElements` porque o monograma é **escondido do leitor de tela de propósito**:
     * o nome está do lado, e uma letra lida em voz alta só somaria ruído. Ele é canal visual, e o
     * teste tem de perguntar pela árvore renderizada, não pela de acessibilidade.
     */
    s.getByText('M', { includeHiddenElements: true }); // Máscara da feira
    s.getByText('I', { includeHiddenElements: true }); // Invigo Nutri-Enrich
  });

  /** E a marca continua vindo **junto** do nome, nunca no lugar dele (BR4/SPEC-054). */
  it('a marca acompanha o nome dela, sem substituí-lo', async () => {
    const s = await painel([], [DE_CATALOGO]);
    await waitFor(() => s.getByText('Da sua prateleira'));
    /**
     * ⚠️ **A asserção mudou de forma, não de intenção** — e a mudança veio de um defeito visto a
     * 390px: `marca · nome` num só texto fazia *"Wella Professionals · Invigo N…"*, ou seja, **a
     * marca comendo o nome**. O que a SPEC-054 protege é *"a marca vem junto do nome, nunca no lugar
     * dele"*; com o nome sozinho na primeira linha isso fica **mais** verdadeiro, não menos.
     */
    s.getByText('Invigo Nutri-Enrich');
    s.getByText(/Wella/);
  });
});

describe('SPEC-063 — "da última vez" é o último USO, não o último registro', () => {
  /**
   * ⚠️ **O defeito que a validação no DEV real achou, e ele é anterior a esta SPEC.**
   *
   * O registro é feito por partes: marcar só uma técnica, ou responder só a finalização, **já cria o
   * registro sem produto nenhum**. A função pegava o registro mais recente que **existisse** — então
   * na prateleira da usuária de desenvolvimento, com a hidratação mais recente tendo **zero
   * produtos** e duas mais antigas tendo um cada, o destaque ficava **mudo justamente para quem tem
   * histórico de verdade**.
   */
  it('pula o registro sem produto e usa o anterior que tenha', () => {
    const escolhido = productsOfLastMarkedHub(
      ['hub-recente', 'hub-do-meio', 'hub-antigo'],
      [
        { wash_day_id: 'hub-do-meio', product_id: 'p1' },
        { wash_day_id: 'hub-antigo', product_id: 'p2' },
      ],
    );
    expect(escolhido).toEqual(['p1']);
  });

  /** Com o mais recente marcado, ele vence — a ordem continua sendo a verdade. */
  it('o mais recente com produto vence os anteriores', () => {
    expect(
      productsOfLastMarkedHub(
        ['a', 'b'],
        [
          { wash_day_id: 'b', product_id: 'antigo' },
          { wash_day_id: 'a', product_id: 'novo' },
        ],
      ),
    ).toEqual(['novo']);
  });

  /** Vários produtos no mesmo registro vêm todos: nenhum é eleito o principal (FR3). */
  it('traz todos os produtos daquele registro', () => {
    expect(
      productsOfLastMarkedHub(
        ['a'],
        [
          { wash_day_id: 'a', product_id: 'p1' },
          { wash_day_id: 'a', product_id: 'p2' },
        ],
      ),
    ).toEqual(['p1', 'p2']);
  });

  /** Nenhum registro com produto: vazio, e o painel não inventa destaque (BR3). */
  it('sem nenhuma marcação, devolve vazio', () => {
    expect(productsOfLastMarkedHub(['a', 'b'], [])).toEqual([]);
  });
});
