import type { Product, ProductPort, WashDayPort, WashDayRecord } from '@app/core';
import { InfrastructureError } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { WashDayScreen } from '@/features/care/WashDayScreen';

const EXECUTION = 'exec-1';

const SHELF: readonly Product[] = [
  { id: 'p1', name: 'Máscara da feira', category: 'mask' },
  { id: 'p2', name: 'Shampoo do mercado', category: 'shampoo' },
];

const EMPTY: WashDayRecord = {
  washDayId: null,
  products: [],
  techniques: [],
  scalpFeel: null,
  finishStatus: null,
};

/** BR3/AC4 — ela usou e depois tirou da prateleira. O registro é do passado, e o passado não muda. */
const ARCHIVED: Product = { id: 'p-old', name: 'Creme que acabou', category: 'leave_in' };

const makeProducts = (over: Partial<ProductPort> = {}): ProductPort => ({
  list: jest.fn(async () => SHELF),
  add: jest.fn(async ({ name, category }) => ({ id: 'p-new', name, category })),
  rename: jest.fn(async () => undefined),
  archive: jest.fn(async () => undefined),
  ...over,
});

const makeWashDays = (over: Partial<WashDayPort> = {}): WashDayPort => ({
  getFor: jest.fn(async () => EMPTY),
  markProduct: jest.fn(async () => undefined),
  markTechnique: jest.fn(async () => undefined),
  setScalpFeel: jest.fn(async () => undefined),
  setFinishStatus: jest.fn(async () => undefined),
  lastUsedFor: jest.fn(async () => []),
  ...over,
});

const renderScreen = async (washDays: WashDayPort, products: ProductPort = makeProducts()) => {
  const onBack = jest.fn();
  const view = await render(
    <WashDayScreen
      careExecutionId={EXECUTION}
      careTitle="Hidratação"
      washDays={washDays}
      products={products}
      onBack={onBack}
    />,
  );
  await waitFor(() => view.getByText('Seu registro'));
  return { ...view, onBack };
};

/**
 * SPEC-024 (F25) — o registro do que ela realmente fez.
 *
 * O que estes testes protegem não é o formulário: é a **forma do dado**. Um campo de texto a mais
 * aqui e `P5`/`P6`/`P8` param de conseguir comparar qualquer coisa (AC7), e uma frase a mais e a
 * tela passa a interpretar o que ela nem tem volume para interpretar (AC8).
 */
describe('WashDayScreen (SPEC-024)', () => {
  it('marca um produto e uma técnica, cada um na sua escrita (AC1/§16)', async () => {
    const washDays = makeWashDays();
    const s = await renderScreen(washDays);

    await fireEvent.press(s.getByText('Máscara da feira'));
    await fireEvent.press(s.getByText('Difusor'));

    await waitFor(() => expect(washDays.markProduct).toHaveBeenCalledTimes(1));
    expect(washDays.markProduct).toHaveBeenCalledWith({
      careExecutionId: EXECUTION,
      productId: 'p1',
      used: true,
    });
    expect(washDays.markTechnique).toHaveBeenCalledWith({
      careExecutionId: EXECUTION,
      technique: 'diffuser',
      used: true,
    });
  });

  /** EC5 — dois toques marcam e desmarcam. Nunca duas linhas, e nunca um estado que não é o dela. */
  it('o segundo toque desmarca', async () => {
    const washDays = makeWashDays();
    const s = await renderScreen(washDays);

    await fireEvent.press(s.getByText('Máscara da feira'));
    await waitFor(() => expect(washDays.markProduct).toHaveBeenCalledTimes(1));
    await fireEvent.press(s.getByText('Máscara da feira'));

    await waitFor(() => expect(washDays.markProduct).toHaveBeenCalledTimes(2));
    expect(jest.mocked(washDays.markProduct).mock.calls[1]?.[0]).toEqual({
      careExecutionId: EXECUTION,
      productId: 'p1',
      used: false,
    });
  });

  /** AC3 — sair no meio e voltar preserva o que ela marcou; o servidor é quem lembra, não a tela. */
  it('reabre com o que já estava marcado', async () => {
    const washDays = makeWashDays({
      getFor: jest.fn(async () => ({
        washDayId: 'w1',
        products: [SHELF[1] as Product],
        techniques: ['co_wash' as const],
        scalpFeel: null,
        finishStatus: null,
      })),
    });
    const s = await renderScreen(washDays);

    // O chip marcado é o mesmo elemento; o que muda é o estado que ele anuncia.
    expect(s.getByLabelText('Shampoo do mercado — Shampoo')).toBeTruthy();
    await fireEvent.press(s.getByText('Só condicionador'));
    await waitFor(() =>
      expect(washDays.markTechnique).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        technique: 'co_wash',
        // Já estava marcada ao abrir, então o toque **desmarca**: a tela lê o registro, não um
        // estado inicial que ela inventou.
        used: false,
      }),
    );
  });

  /**
   * BR3/AC4 — um produto arquivado sumiu da prateleira, não do registro em que foi usado. A linha da
   * junção continua no banco; se a tela montasse os chips só a partir da prateleira ativa, ela diria
   * "não marcado" sobre um fato que aconteceu.
   */
  it('mostra o produto que ela arquivou depois de usar', async () => {
    const washDays = makeWashDays({
      getFor: jest.fn(async () => ({
        washDayId: 'w1',
        products: [ARCHIVED],
        techniques: [],
        scalpFeel: null,
        finishStatus: null,
      })),
    });
    const s = await renderScreen(washDays);

    expect(s.getByText('Creme que acabou')).toBeTruthy();
    // E continua sendo dela para corrigir: desmarcar um uso registrado por engano segue possível.
    await fireEvent.press(s.getByText('Creme que acabou'));
    await waitFor(() =>
      expect(washDays.markProduct).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        productId: 'p-old',
        used: false,
      }),
    );
  });

  /**
   * §16 — a marcação que falhou volta atrás, sozinha, e a tela diz qual foi. As outras seguem: são
   * escritas independentes, e um "não foi possível salvar" genérico esconderia o que entrou.
   */
  it('desfaz só a marcação que falhou e nomeia qual foi', async () => {
    const washDays = makeWashDays({
      markProduct: jest.fn(async () => {
        throw new InfrastructureError('care.wash_day_mark_failed', 'rede');
      }),
    });
    const s = await renderScreen(washDays);

    await fireEvent.press(s.getByText('Difusor'));
    await fireEvent.press(s.getByText('Máscara da feira'));

    expect(await s.findByText(/Não foi possível marcar Máscara da feira agora/)).toBeTruthy();
    // A técnica que deu certo continua marcada — nada foi desfeito em bloco.
    expect(washDays.markTechnique).toHaveBeenCalledWith({
      careExecutionId: EXECUTION,
      technique: 'diffuser',
      used: true,
    });
  });

  /** EC1 — prateleira vazia é convite, não beco: ela resolve dali mesmo. */
  it('com a prateleira vazia, cadastra dali e já marca o que acabou de cadastrar (FR6)', async () => {
    const products = makeProducts({ list: jest.fn(async () => []) });
    const washDays = makeWashDays();
    const s = await renderScreen(washDays, products);

    expect(s.getByText(/Sua prateleira está vazia/)).toBeTruthy();
    await fireEvent.changeText(s.getByLabelText('Nome do produto'), '  Creme   novo  ');
    await fireEvent.press(s.getByText('Leave-in ou creme'));
    await fireEvent.press(s.getByText('Adicionar à prateleira'));

    // Normalização de espaço vem do core, uma vez só (SPEC-023): a tela não tem regra própria.
    await waitFor(() =>
      expect(products.add).toHaveBeenCalledWith({ name: 'Creme novo', category: 'leave_in' }),
    );
    // Ela cadastrou porque **acabou de usar**: cobrar um toque a mais é o que faz o registro não
    // ser preenchido (G4).
    await waitFor(() =>
      expect(washDays.markProduct).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        productId: 'p-new',
        used: true,
      }),
    );
  });

  /** Uma leitura que falhou nunca pode virar "você não marcou nada" (§16). */
  it('mostra erro com nova tentativa em vez de um registro vazio', async () => {
    const washDays = makeWashDays({
      getFor: jest.fn(async () => {
        throw new InfrastructureError('care.wash_day_read_failed', 'rede');
      }),
    });
    const s = await render(
      <WashDayScreen
        careExecutionId={EXECUTION}
        careTitle="Hidratação"
        washDays={washDays}
        products={makeProducts()}
        onBack={jest.fn()}
      />,
    );
    expect(await s.findByText('Não foi possível abrir seu registro.')).toBeTruthy();
    expect(s.queryByText('Produtos')).toBeNull();
    expect(s.getByText('Tentar novamente')).toBeTruthy();
  });

  /**
   * SPEC-025 — escolha única: tocar em outra troca, tocar na marcada tira. Uma escrita nos dois
   * casos, nunca um apaga-e-escreve que deixaria uma janela sem resposta.
   */
  it('o couro cabeludo é escolha única: trocar substitui, tocar de novo tira', async () => {
    const washDays = makeWashDays();
    const s = await renderScreen(washDays);

    await fireEvent.press(s.getByText('Oleoso rápido'));
    await waitFor(() =>
      expect(washDays.setScalpFeel).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        scalpFeel: 'oily_quickly',
      }),
    );

    await fireEvent.press(s.getByText('Ressecado'));
    await waitFor(() => expect(washDays.setScalpFeel).toHaveBeenCalledTimes(2));
    expect(jest.mocked(washDays.setScalpFeel).mock.calls[1]?.[0]).toEqual({
      careExecutionId: EXECUTION,
      scalpFeel: 'dry_tendency',
    });

    // Tocar na marcada tira a resposta — e não responder é um estado válido (EC2).
    await fireEvent.press(s.getByText('Ressecado'));
    await waitFor(() => expect(washDays.setScalpFeel).toHaveBeenCalledTimes(3));
    expect(jest.mocked(washDays.setScalpFeel).mock.calls[2]?.[0]).toEqual({
      careExecutionId: EXECUTION,
      scalpFeel: null,
    });
  });

  it('reabre com a resposta de couro que ela já tinha dado (AC3)', async () => {
    const washDays = makeWashDays({
      getFor: jest.fn(async () => ({
        washDayId: 'w1',
        products: [],
        techniques: [],
        scalpFeel: 'balanced' as const,
        finishStatus: null,
      })),
    });
    const s = await renderScreen(washDays);
    // Já marcada ao abrir, então o toque **tira**: a tela lê o registro, não um estado que inventou.
    await fireEvent.press(s.getByText('Equilibrado'));
    await waitFor(() =>
      expect(washDays.setScalpFeel).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        scalpFeel: null,
      }),
    );
  });

  /**
   * BR3/NG4 — **não é uma escala.** O check-in de fios é 1 a 5 e tem resposta melhor; este não tem.
   * Um couro oleoso não é uma nota baixa, e a tela não pode sugerir que seja.
   */
  it('não apresenta nenhuma opção de couro como melhor que outra', async () => {
    const s = await renderScreen(makeWashDays());
    for (const label of ['Oleoso rápido', 'Equilibrado', 'Ressecado']) {
      expect(s.getByText(label)).toBeTruthy();
    }
    // Sem nota, sem escala, sem ideal, e sem o vocabulário de sintoma que muda a natureza do dado.
    const forbidden = [/ideal|melhor|saud|normal|proble/i, /coceir|descama|caspa|ferida|queda|\bdor\b/i];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    /**
     * As amostras precisam casar — e as **legítimas** precisam NÃO casar. A primeira versão desta
     * barreira usava `dor` com um lookahead frouxo e reprovava "Condicionador" e "Finalizador": uma
     * barreira que acusa o vocabulário certo é tão inútil quanto uma que nunca acusa nada.
     */
    for (const sample of ['couro saudável', 'coceira', 'caspa', 'dor no couro', 'queda de fio']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
    for (const legit of ['Condicionador', 'Finalizador', 'Secador', 'Oleoso rápido', 'Ressecado']) {
      expect(forbidden.some((p) => p.test(legit))).toBe(false);
    }
  });

  /**
   * AC7 — **nenhum campo de texto sobre o cuidado**. É a decisão mais importante da SPEC: texto
   * livre não se compara nem se agrega, e destruiria `P5`, `P6`, `P7` e `P8`.
   *
   * O único campo digitável da tela cadastra um **produto** (SPEC-023) e só aparece quando ela pede.
   */
  it('não tem campo de texto sobre o cuidado', async () => {
    const s = await renderScreen(makeWashDays());
    expect(s.queryByLabelText('Nome do produto')).toBeNull();

    await fireEvent.press(s.getByText('Usei um produto novo'));
    // Aparece um campo, e ele é do produto — não do que ela fez no cabelo.
    expect(s.getByLabelText('Nome do produto')).toBeTruthy();
  });

  /**
   * AC8 — a barreira. Nada aqui liga produto a resultado, sugere, pontua ou cobra: ler é `P5`/`P6`/
   * `P8`, é Premium, e exige volume. As amostras precisam casar, senão a barreira não protege nada.
   */
  it('não liga produto a resultado, não sugere, não pontua e não cobra', async () => {
    const s = await renderScreen(makeWashDays());

    const forbidden = [
      /\b(funcion|combin|ideal|melhor|pior|indicad|recomend)/i,
      /\b(porque|por isso|resultado|efeito|deixou o cabelo)/i,
      /\b(complet|falta|preench|parabéns|continue assim)/i,
      /\d+\s*%/,
    ];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    for (const sample of [
      'esse produto funcionou',
      'o resultado foi melhor',
      'complete seu registro',
      '70%',
    ]) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});

/**
 * SPEC-039 FR4 (F37) — a finalização tem **seção própria** no registro, e não um chip entre as
 * técnicas. A separação é a SPEC: fundi-las é o que a D-102 proibiu, e a barreira de vocabulário
 * mora no core (`finish-step.test.ts`).
 */
describe('WashDayScreen — a finalização (SPEC-039)', () => {
  it('é uma seção própria, logo depois de "Como você fez"', async () => {
    const s = await renderScreen(makeWashDays());
    await waitFor(() => s.getByText('Finalização'));

    const tree = JSON.stringify(s.toJSON());
    expect(tree.indexOf('Como você fez')).toBeLessThan(tree.indexOf('Finalização'));
    s.getByText('Finalizei');
    s.getByText('Pulei dessa vez');
  });

  it('marca a etapa pela porta, e não como técnica', async () => {
    const washDays = makeWashDays();
    const s = await renderScreen(washDays);
    await waitFor(() => s.getByText('Finalizei'));

    await fireEvent.press(s.getByText('Finalizei'));
    await waitFor(() =>
      expect(washDays.setFinishStatus).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        finishStatus: 'done',
      }),
    );
    expect(washDays.markTechnique).not.toHaveBeenCalled();
  });

  it('já respondida, tocar na mesma tira a resposta (FR8)', async () => {
    const washDays = makeWashDays({
      getFor: jest.fn(async () => ({
        washDayId: 'w1',
        products: [],
        techniques: [],
        scalpFeel: null,
        finishStatus: 'skipped' as const,
      })),
    });
    const s = await renderScreen(washDays);
    await waitFor(() => s.getByText('Pulei dessa vez'));

    await fireEvent.press(s.getByText('Pulei dessa vez'));
    await waitFor(() =>
      expect(washDays.setFinishStatus).toHaveBeenCalledWith({
        careExecutionId: EXECUTION,
        finishStatus: null,
      }),
    );
  });

  it('a escrita que falha volta atrás e diz qual foi', async () => {
    const washDays = makeWashDays({
      setFinishStatus: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    const s = await renderScreen(washDays);
    await waitFor(() => s.getByText('Finalizei'));

    await fireEvent.press(s.getByText('Finalizei'));
    await waitFor(() => s.getByText(/Não foi possível marcar Finalizei/));
  });
});
