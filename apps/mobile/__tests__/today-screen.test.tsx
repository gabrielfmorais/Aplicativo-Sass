import type {
  CareBoard,
  CareTrackingPort,
  HairProfilePort,
  Instant,
  LocalDate,
  OilRoutineView,
  ProductPort,
  WashDayPort,
} from '@app/core';
import { CARE_GUIDES, ConflictError, instantFromString } from '@app/core';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { TodayScreen } from '@/features/care/TodayScreen';

const TODAY = '2026-09-10' as LocalDate;
/**
 * SPEC-032 — o título da Hoje é a **data por extenso**, e não mais "Seus cuidados".
 * Como âncora de carregamento ela é tão determinística quanto era: `TODAY` é fixo.
 */
const TODAY_LONG = 'Quinta, 10 de setembro';
const NOW = instantFromString('2026-09-10T12:00:00.000Z');

const board = (over: Partial<CareBoard> = {}): CareBoard => ({
  planId: 'plan-1',
  startsOn: '2026-09-01',
  hairProfileId: 'hp-1',
  assessmentAlgorithmVersion: 'v1',
  scheduleAlgorithmVersion: 'v1',
  pausedOn: null,
  washDayExecutionIds: [],
  careFinishes: [],
  cares: [
    {
      id: 'late',
      careTypeCode: 'hydration',
      plannedDate: '2026-09-08',
      status: 'planned',
      rescheduledToId: null,
    },
    {
      id: 'now',
      careTypeCode: 'nutrition',
      plannedDate: '2026-09-10',
      status: 'planned',
      rescheduledToId: null,
    },
    {
      id: 'next',
      careTypeCode: 'hydration',
      plannedDate: '2026-09-14',
      status: 'planned',
      rescheduledToId: null,
    },
  ],
  executions: [],
  checkIns: [],
  lifetimeDoneCount: 0,
  ...over,
});

const makePort = (overrides: Partial<CareTrackingPort> = {}): jest.Mocked<CareTrackingPort> =>
  ({
    getBoard: jest.fn(async () => null),
    submitCheckIn: jest.fn(async () => undefined),
    complete: jest.fn(async () => undefined),
    skip: jest.fn(async () => undefined),
    reschedule: jest.fn(async () => undefined),
    undo: jest.fn(async () => undefined),
    ...overrides,
  }) as unknown as jest.Mocked<CareTrackingPort>;

/**
 * SPEC-017 — por padrão o perfil de origem some, e com ele a explicação. Os testes desta suíte são
 * sobre o loop diário; a explicação tem suíte própria.
 */
/** SPEC-039 — a Hoje escreve a etapa de finalização; o resto do registro continua na sua tela. */
const washDayPort = (over: Partial<WashDayPort> = {}): WashDayPort => ({
  getFor: jest.fn(async () => ({
    washDayId: null,
    products: [],
    techniques: [],
    scalpFeel: null,
    finishStatus: null,
    finishTechnique: null,
  })),
  markProduct: jest.fn(async () => undefined),
  markTechnique: jest.fn(async () => undefined),
  setScalpFeel: jest.fn(async () => undefined),
  setFinishStatus: jest.fn(async () => undefined),
  setFinishTechnique: jest.fn(async () => {}),
  lastUsedFor: jest.fn(async () => []),
  ...over,
});

const hairProfilePort = (snapshot: unknown = null): HairProfilePort =>
  ({
    getById: jest.fn(async () => snapshot),
    getCurrent: jest.fn(async () => null),
    save: jest.fn(),
  }) as unknown as HairProfilePort;

const renderScreen = (
  care: CareTrackingPort,
  b: CareBoard = board(),
  onChanged: () => void = jest.fn(),
  now: () => Instant = () => NOW,
  newExecutionId: () => string = () => 'exec-1',
  onReassess: () => void = jest.fn(),
) =>
  render(
    <TodayScreen
      board={b}
      care={care}
      today={TODAY}
      now={now}
      timeZone="America/Sao_Paulo"
      newExecutionId={newExecutionId}
      onChanged={onChanged}
      hairProfile={hairProfilePort()}
      onOpenWashDay={jest.fn()}
      washDays={washDayPort()}
      profile={{ name: 'Ana', onPress: jest.fn() }}
      productCount={null}
      onOpenShelf={jest.fn()}
      onPause={jest.fn()}
      onPreviewResume={jest.fn(async () => ({ action: 'shifted' as const, shiftDays: 0, careCount: 0 }))}
      onResume={jest.fn()}
      onOpenCycle={jest.fn()}
      onReassess={onReassess}
    />,
  );

/** A plan whose four weeks are behind her: nothing overdue, nothing today, nothing upcoming. */
const finishedPlan = () =>
  board({
    cares: [
      {
        id: 'old',
        careTypeCode: 'hydration',
        plannedDate: '2026-09-02',
        status: 'skipped',
        rescheduledToId: null,
      },
    ],
  });

describe('TodayScreen (SPEC-005 §14)', () => {
  /**
   * SPEC-016 slice 2 restructured this screen around a single focus card, so the guarantee is no
   * longer expressed as four equal section headings: the most urgent care — the overdue one, since
   * the plan never moves itself (D-28) — leads, and every other care keeps its own state in words.
   * The guarantee asserted here is unchanged: overdue, today and upcoming stay distinguishable, and
   * lateness is still stated, not merely coloured.
   */
  it('leads with the overdue care and keeps today and upcoming distinguishable', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));

    // The focus card is the overdue one, and it says so in words as well as in colour.
    screen.getByText('Atrasado');
    screen.getByText(/atrasada há 2 dias/);

    // The other two are still there, still separated, still actionable.
    screen.getByText('Hoje');
    screen.getByText('Próximos');
    expect(screen.getAllByText('Fiz hoje')).toHaveLength(3);
  });

  it('reads the week around today, in words as well as in dots', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));

    // 2026-09-10 is a Thursday; its week runs Sunday 06 → Saturday 12.
    screen.getByLabelText('Quinta, 10 de setembro. hoje. Nutrição: planejada');
    screen.getByLabelText('Terça, 8 de setembro. Hidratação: atrasada');
    screen.getByLabelText('Domingo, 6 de setembro. sem cuidados');
    // The upcoming care falls on the 14th, outside this week — the strip does not invent it.
    expect(screen.queryByLabelText(/14 de setembro/)).toBeNull();
  });

  it('records a care and lets the route reload the board', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, board(), onChanged);
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(care.complete).toHaveBeenCalledWith({
      scheduledCareId: 'late',
      clientExecutionId: 'exec-1',
      timeZone: 'America/Sao_Paulo',
    });
  });

  /**
   * The guard is `if (busyId) return`: one transition at a time, for the *whole* screen, not just
   * for the button that was pressed. Pressing a second care while the first is in flight is the
   * stronger version of this assertion — and the only one still expressible, now that the busy
   * primary shows a spinner in place of its label instead of merely dimming it.
   */
  it('does not fire a second call while one is in flight (AC14)', async () => {
    let release: () => void = () => {};
    const care = makePort({ complete: jest.fn(() => new Promise<void>((r) => (release = r))) });
    const screen = await renderScreen(care);
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    // The pressed button is now busy: its label is gone, and the other two are still on screen.
    expect(screen.getAllByText('Fiz hoje')).toHaveLength(2);

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    await fireEvent.press(screen.getAllByText('Pular')[0]!);
    expect(care.complete).toHaveBeenCalledTimes(1);
    expect(care.skip).not.toHaveBeenCalled();

    // And it is *visibly* refused, not silently ignored: every write on every card reports itself
    // as disabled while a transition is running.
    expect(screen.getAllByRole('button', { name: 'Pular' })[0]?.props.accessibilityState).toMatchObject({
      disabled: true,
    });

    await act(async () => release());
  });

  it('reuses the same idempotency key when a failed completion is retried (AC14)', async () => {
    const complete = jest
      .fn<Promise<void>, [{ clientExecutionId: string }]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    let issued = 0;
    const screen = await renderScreen(
      makePort({ complete } as Partial<CareTrackingPort>),
      board(),
      jest.fn(),
      () => NOW,
      () => `exec-${++issued}`,
    );
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    await waitFor(() => screen.getByText('Não foi possível registrar. Tente novamente.'));
    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(2));

    expect(complete.mock.calls.map((c) => c[0].clientExecutionId)).toEqual(['exec-1', 'exec-1']);
  });

  it('reloads instead of arguing when the server says the care already moved on', async () => {
    const skip = jest.fn(async () => {
      throw new ConflictError('care.skip_failed', 'gone');
    });
    const care = makePort({ skip } as Partial<CareTrackingPort>);
    const onChanged = jest.fn();
    const screen = await renderScreen(care, board(), onChanged);
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Pular')[0]!);
    await waitFor(() => screen.getByText('Esse cuidado mudou. Atualizamos a tela.'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('reschedules through a quick option inside the allowed window', async () => {
    const care = makePort();
    const screen = await renderScreen(care);
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Reagendar')[0]!);
    await fireEvent.press(screen.getByText(/Em 3 dias/));
    await waitFor(() => expect(care.reschedule).toHaveBeenCalled());
    expect(care.reschedule).toHaveBeenCalledWith({
      scheduledCareId: 'late',
      newDate: '2026-09-13',
      timeZone: 'America/Sao_Paulo',
    });
  });
});

describe('TodayScreen — done and undo (D-69/D-12)', () => {
  const done = board({
    executions: [
      {
        id: 'e1',
        scheduledCareId: 'now',
        executedAt: '2026-09-10T11:55:00.000Z',
        executedOn: '2026-09-10',
        voidedAt: null,
      },
    ],
  });

  it('shows a completed care as done, with undo inside the window', async () => {
    const screen = await renderScreen(makePort(), done);
    await waitFor(() => screen.getByText('Feito'));
    screen.getByText('Desfazer');
  });

  it('undoes through the port', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, done, onChanged);
    await waitFor(() => screen.getByText('Desfazer'));

    await fireEvent.press(screen.getByText('Desfazer'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(care.undo).toHaveBeenCalledWith('e1');
  });

  it('hides undo once the 15-minute window has closed (AC17)', async () => {
    const screen = await renderScreen(makePort(), done, jest.fn(), () =>
      instantFromString('2026-09-10T12:20:00.000Z'),
    );
    await waitFor(() => screen.getByText('Feito'));
    expect(screen.queryByText('Desfazer')).toBeNull();
  });

  it('offers the care again after its execution was voided', async () => {
    const voided = board({
      executions: [
        {
          id: 'e1',
          scheduledCareId: 'now',
          executedAt: '2026-09-10T11:55:00.000Z',
          executedOn: '2026-09-10',
          voidedAt: '2026-09-10T11:58:00.000Z',
        },
      ],
    });
    const screen = await renderScreen(makePort(), voided);
    await waitFor(() => screen.getByText('Hoje'));
    expect(screen.queryByText('Feito')).toBeNull();
    expect(screen.getAllByText('Fiz hoje').length).toBeGreaterThan(0);
  });
});

describe('TodayScreen — empty states (AC15)', () => {
  it('says nothing is due today without breaking navigation', async () => {
    const screen = await renderScreen(
      makePort(),
      board({
        cares: [
          {
            id: 'next',
            careTypeCode: 'hydration',
            plannedDate: '2026-09-14',
            status: 'planned',
            rescheduledToId: null,
          },
        ],
      }),
    );
    await waitFor(() => screen.getByText('Nenhum cuidado hoje.'));
    // SPEC-026 — a saída para a conta saiu daqui: virou uma aba permanente, e um botão no pé da
    // Hoje seria um segundo caminho para o mesmo lugar. Ver o ciclo fica, porque ler o mês a partir
    // do dia é um gesto do dia.
    screen.getByText('Ver meu ciclo');
    expect(screen.queryByText('Sua conta')).toBeNull();
  });

  it('says the plan is over when nothing is left', async () => {
    const screen = await renderScreen(makePort(), finishedPlan());
    await waitFor(() => screen.getByText('Seu cronograma chegou ao fim.'));
    screen.getByText('Histórico');
    screen.getByText('Pulado');
  });
});

/**
 * D-82 — the four weeks running out used to be a dead end: the screen said so and offered nothing,
 * so the product went quiet exactly when she had finished a cycle.
 */
describe('TodayScreen — the end of a cycle offers the way forward (D-82)', () => {
  it('offers reassessment when the plan has run out, and says what is kept', async () => {
    const onReassess = jest.fn();
    const screen = await renderScreen(
      makePort(),
      finishedPlan(),
      jest.fn(),
      () => NOW,
      () => 'exec-1',
      onReassess,
    );
    await waitFor(() => screen.getByText('Reavaliar e montar o próximo'));
    screen.getByText(/o que você já registrou continua salvo/);

    await fireEvent.press(screen.getByText('Reavaliar e montar o próximo'));
    expect(onReassess).toHaveBeenCalled();
  });

  /** While there is still something to do, the offer would be noise pulling her out of the loop. */
  it('is absent while she still has cares to act on', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));
    expect(screen.queryByText('Reavaliar e montar o próximo')).toBeNull();
  });
});

describe('TodayScreen — "Como fazer" (SPEC-007 §14)', () => {
  const hydration = CARE_GUIDES.hydration;

  it('offers the guide on every actionable care and shows it in full when opened (AC5)', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));

    // overdue + today + upcoming — all three are still actionable
    expect(screen.getAllByText('Como fazer')).toHaveLength(3);

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    screen.getByText(`~${hydration.durationMin} min`);
    screen.getByText(hydration.whatItIs);
    for (const [index, step] of hydration.steps.entries()) {
      screen.getByText(`${index + 1}. ${step}`);
    }
    screen.getByText('Erros comuns');
    for (const mistake of hydration.commonMistakes) {
      screen.getByText(`• ${mistake}`);
    }
  });

  it('closes again on a second press (AC6)', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    screen.getByText(hydration.whatItIs);

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    expect(screen.queryByText(hydration.whatItIs)).toBeNull();
  });

  it('opens only the care that was pressed, not every row', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    // Both overdue and upcoming are hydration; only one panel may be open.
    expect(screen.getAllByText(hydration.whatItIs)).toHaveLength(1);
  });

  it('never writes when the guide is opened (AC8)', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, board(), onChanged);
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);

    expect(care.complete).not.toHaveBeenCalled();
    expect(care.skip).not.toHaveBeenCalled();
    expect(care.reschedule).not.toHaveBeenCalled();
    expect(care.undo).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('stays readable while a transition is in flight (AC9/EC3)', async () => {
    let release: () => void = () => {};
    const care = makePort({
      complete: jest.fn(() => new Promise<void>((resolve) => (release = resolve))),
    });
    const screen = await renderScreen(care, board());
    await waitFor(() => screen.getByText(TODAY_LONG));

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!); // row is now busy
    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    screen.getByText(hydration.whatItIs);

    // Settle the in-flight promise inside act, so the completion does not update state after the
    // test ends and hide a real warning behind noise.
    await act(async () => release());
  });

  it('does not offer the guide on a care that is already resolved (AC7)', async () => {
    const screen = await renderScreen(
      makePort(),
      board({
        cares: [
          {
            id: 'done-one',
            careTypeCode: 'hydration',
            plannedDate: '2026-09-02',
            status: 'skipped',
            rescheduledToId: null,
          },
        ],
      }),
    );
    await waitFor(() => screen.getByText('Pulado'));
    expect(screen.queryByText('Como fazer')).toBeNull();
  });
});

describe('TodayScreen — check-in (SPEC-006 §14)', () => {
  const doneBoard = (checkIns: CareBoard['checkIns'] = []) =>
    board({
      executions: [
        {
          id: 'e1',
          scheduledCareId: 'now',
          executedAt: '2026-09-10T11:55:00.000Z',
          executedOn: '2026-09-10',
          voidedAt: null,
        },
      ],
      checkIns,
    });

  it('asks how it went on a completed care and submits the rating (AC12)', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, doneBoard(), onChanged);
    await waitFor(() => screen.getByText('Como ficou?'));

    await fireEvent.press(screen.getByLabelText('4 de 5'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(care.submitCheckIn).toHaveBeenCalledWith({
      careExecutionId: 'e1',
      overallFeel: 4,
      clientCheckinId: 'exec-1',
    });
  });

  it('shows the answer back and stops asking once it exists (AC12)', async () => {
    const screen = await renderScreen(
      makePort(),
      doneBoard([{ id: 'ck1', careExecutionId: 'e1', overallFeel: 3 }]),
    );
    await waitFor(() => screen.getByText('Você marcou: 3/5'));
    expect(screen.queryByText('Como ficou?')).toBeNull();
  });

  it('never asks on a care that is not done (AC13)', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText(TODAY_LONG));
    expect(screen.queryByText('Como ficou?')).toBeNull();
  });

  it('reuses the same idempotency key when a failed check-in is retried (AC14)', async () => {
    const submitCheckIn = jest
      .fn<Promise<void>, [{ clientCheckinId: string }]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);
    let issued = 0;
    const screen = await renderScreen(
      makePort({ submitCheckIn } as Partial<CareTrackingPort>),
      doneBoard(),
      jest.fn(),
      () => NOW,
      () => `exec-${++issued}`,
    );
    await waitFor(() => screen.getByText('Como ficou?'));

    await fireEvent.press(screen.getByLabelText('5 de 5'));
    await waitFor(() => screen.getByText('Não foi possível registrar. Tente novamente.'));
    await fireEvent.press(screen.getByLabelText('5 de 5'));
    await waitFor(() => expect(submitCheckIn).toHaveBeenCalledTimes(2));

    expect(submitCheckIn.mock.calls.map((c) => c[0].clientCheckinId)).toEqual(['exec-1', 'exec-1']);
  });

  it('reloads instead of arguing when the server refuses the check-in', async () => {
    const submitCheckIn = jest.fn(async () => {
      throw new ConflictError('care.checkin_failed', 'already has a check-in');
    });
    const onChanged = jest.fn();
    const screen = await renderScreen(
      makePort({ submitCheckIn } as Partial<CareTrackingPort>),
      doneBoard(),
      onChanged,
    );
    await waitFor(() => screen.getByText('Como ficou?'));

    await fireEvent.press(screen.getByLabelText('2 de 5'));
    await waitFor(() => screen.getByText('Esse cuidado mudou. Atualizamos a tela.'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('leaves undo available alongside the check-in', async () => {
    const screen = await renderScreen(makePort(), doneBoard());
    await waitFor(() => screen.getByText('Como ficou?'));
    screen.getByText('Desfazer');
  });
});

/**
 * SPEC-024 FR1/FR7 — o registro do Wash Day, oferecido depois de concluir e **nunca** exigido.
 *
 * O rótulo é o único portador do fato: o board sabe quais execuções têm registro, nunca o que tem
 * dentro. Uma frase afirmando conteúdo mentiria no caso que a SPEC prevê — ela abre, desmarca tudo
 * e sai (EC4) — e um convite quando não há registro seria cobrança (AC8).
 */
/**
 * SPEC-026 fatia 2 (FR7/FR8) — a faixa da semana passou a comandar a tela.
 *
 * A SPEC-016 a deixou **deliberadamente** não clicável, e a razão estava escrita: um toque teria de
 * significar navegar ou filtrar, e nenhum dos dois existia. Agora existe — e o que estes testes
 * protegem é que a tela **inteira** passe a falar do dia escolhido, em vez de mostrar duas respostas
 * para a mesma pergunta, com a errada na parte de baixo, que é onde ninguém confere.
 */
describe('TodayScreen — o calendário clicável (SPEC-026)', () => {
  /** 2026-09-08 é a terça da mesma semana de 2026-09-10, e carrega o cuidado atrasado. */
  const tapDay = async (s: Awaited<ReturnType<typeof render>>, label: RegExp) =>
    fireEvent.press(s.getByLabelText(label));

  it('tocar num dia mostra o conteúdo daquele dia, e diz qual dia é em palavra', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(TODAY_LONG));

    await tapDay(s, /^Terça, 8 de setembro/);

    // FR8 — o título muda: um destaque na faixa é uma pista, e uma pista não é uma resposta.
    // SPEC-032 — e a resposta agora é a **data**, não uma frase sobre ela.
    expect(s.getByText('Terça, 8 de setembro')).toBeTruthy();
    expect(s.queryByText(TODAY_LONG)).toBeNull();
    // O cuidado daquele dia continua acionável: concluir vale para o cuidado, não para a data em
    // que ela está olhando.
    expect(s.getByText('Fiz hoje')).toBeTruthy();
  });

  it('num outro dia, some tudo o que falava de hoje', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(TODAY_LONG));
    await tapDay(s, /^Terça, 8 de setembro/);

    // Seções, explicação e saídas são sobre hoje. Mantê-las seria uma segunda resposta na mesma tela.
    expect(s.queryByText('Próximos')).toBeNull();
    expect(s.queryByText('Atrasados')).toBeNull();
    expect(s.queryByText('Ver meu ciclo')).toBeNull();
  });

  /** EC3 — um dia sem nada é um fato, não uma tela em branco. */
  it('um dia vazio diz que está vazio', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(TODAY_LONG));
    await tapDay(s, /^Quarta, 9 de setembro/);
    expect(s.getByText('Nada marcado nesse dia.')).toBeTruthy();
  });

  it('volta para hoje', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(TODAY_LONG));
    await tapDay(s, /^Terça, 8 de setembro/);
    await fireEvent.press(s.getByText('Voltar para hoje'));
    expect(s.getByText(TODAY_LONG)).toBeTruthy();
  });

  /**
   * O resumo saiu daqui e virou a aba Progresso. Duas cópias do mesmo número não divergem — vêm da
   * mesma fonte —, mas são ruído numa tela que existe para responder "o que eu faço agora".
   */
  it('não mostra mais o resumo de progresso, que agora é uma aba', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText(TODAY_LONG));
    expect(s.queryByText('Seu progresso')).toBeNull();
  });
});

describe('TodayScreen — o Wash Day (SPEC-024)', () => {
  const done = (over: Partial<CareBoard> = {}) =>
    board({
      cares: [
        {
          id: 'past',
          careTypeCode: 'hydration',
          plannedDate: '2026-09-09',
          status: 'planned',
          rescheduledToId: null,
        },
      ],
      executions: [
        {
          id: 'e-past',
          scheduledCareId: 'past',
          executedAt: instantFromString('2026-09-09T10:00:00.000Z'),
          executedOn: '2026-09-09',
          voidedAt: null,
        },
      ],
      checkIns: [],
      ...over,
    });

  it('oferece registrar num cuidado concluído, e nunca exige', async () => {
    const s = await renderScreen(makePort(), done());
    expect(s.getByText('Contar esse cuidado')).toBeTruthy();
    // Nem cobrança, nem promessa: nada afirma que falta preencher.
    expect(s.queryByText(/complete|falta|preencha/i)).toBeNull();
  });

  it('quando já existe registro, o rótulo muda — e nenhuma frase afirma o que tem dentro', async () => {
    const s = await renderScreen(makePort(), done({ washDayExecutionIds: ['e-past'] }));
    expect(s.getByText('Ver o que contei')).toBeTruthy();
    expect(s.queryByText('Contar esse cuidado')).toBeNull();
    expect(s.queryByText(/Você registrou/)).toBeNull();
  });

  it('abre o registro daquela execução, com o nome do cuidado', async () => {
    const onOpenWashDay = jest.fn();
    const s = await render(
      <TodayScreen
        board={done()}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={onOpenWashDay}
        washDays={washDayPort()}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );
    await fireEvent.press(s.getByText('Contar esse cuidado'));
    expect(onOpenWashDay).toHaveBeenCalledWith({
      careExecutionId: 'e-past',
      careTitle: 'Hidratação',
    });
  });
});

/**
 * SPEC-039 (F37) — a etapa que faltava entre o tratamento e o resultado.
 *
 * O fluxo canônico é `LAVOU → TRATAMENTO → FINALIZAÇÃO → RESULTADO/CHECK-IN` (Blueprint §22), e
 * até aqui a Hoje fazia a última pergunta antes da penúltima.
 */
describe('finalização na Hoje (SPEC-039)', () => {
  const doneBoard = (over: Partial<CareBoard> = {}) =>
    board({
      executions: [
        {
          id: 'e1',
          scheduledCareId: 'now',
          executedAt: '2026-09-10T11:55:00.000Z',
          executedOn: '2026-09-10',
          voidedAt: null,
        },
      ],
      ...over,
    });

  const renderDone = (washDays: WashDayPort, b: CareBoard = doneBoard(), onChanged = jest.fn()) =>
    render(
      <TodayScreen
        board={b}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={onChanged}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={washDays}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );

  it('pergunta a finalização ANTES do resultado (FR2)', async () => {
    const s = await renderDone(washDayPort());
    await waitFor(() => s.getByText('Você finalizou?'));

    const tree = JSON.stringify(s.toJSON());
    expect(tree.indexOf('Você finalizou?')).toBeLessThan(tree.indexOf('Como ficou?'));
  });

  it('grava a resposta pela porta, sem chave de idempotência (FR6)', async () => {
    const washDays = washDayPort();
    const onChanged = jest.fn();
    const s = await renderDone(washDays, doneBoard(), onChanged);
    await waitFor(() => s.getByText('Finalizei'));

    await fireEvent.press(s.getByText('Finalizei'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(washDays.setFinishStatus).toHaveBeenCalledWith({
      careExecutionId: 'e1',
      finishStatus: 'done',
    });
  });

  it('respondida, a pergunta não volta — e o título vira o nome da etapa (FR3/FR5)', async () => {
    const s = await renderDone(
      washDayPort(),
      doneBoard({ careFinishes: [{ careExecutionId: 'e1', status: 'done', technique: null }] }),
    );
    await waitFor(() => s.getByText('Finalização'));
    expect(s.queryByText('Você finalizou?')).toBeNull();
  });

  it('tocar na resposta marcada tira a resposta (FR8)', async () => {
    const washDays = washDayPort();
    const s = await renderDone(
      washDays,
      doneBoard({ careFinishes: [{ careExecutionId: 'e1', status: 'skipped', technique: null }] }),
    );
    await waitFor(() => s.getByText('Pulei dessa vez'));

    await fireEvent.press(s.getByText('Pulei dessa vez'));
    await waitFor(() =>
      expect(washDays.setFinishStatus).toHaveBeenCalledWith({
        careExecutionId: 'e1',
        finishStatus: null,
      }),
    );
  });

  /**
   * NG4 — **a ordem conduz; ela não tranca.** Pôr a etapa como pedágio transformaria em dois toques
   * a pergunta que o produto inteiro fez questão de manter em um.
   */
  it('o check-in continua acessível com a finalização não respondida (NG4)', async () => {
    const care = makePort();
    const s = await render(
      <TodayScreen
        board={doneBoard()}
        care={care}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={washDayPort()}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );
    await waitFor(() => s.getByText('Você finalizou?'));

    await fireEvent.press(s.getByLabelText('4 de 5'));
    await waitFor(() => expect(care.submitCheckIn).toHaveBeenCalled());
  });

  /** BR4 — nenhum rótulo desta etapa afirma nada sobre cabelo, e nenhum cobra. */
  it('não afirma nada sobre cabelo e não cobra (BR4/NG5)', async () => {
    const s = await renderDone(washDayPort());
    await waitFor(() => s.getByText('Você finalizou?'));

    expect(s.queryByText(/defini|frizz|volume|recomend|deveria|ideal|melhor/i)).toBeNull();
  });
});

/**
 * SPEC-041 FR2 (F48) — o painel "Meus produtos" no cartão do cuidado: a um toque, e nunca
 * empurrando a ação primária para baixo da dobra.
 */
describe('produtos na execução, na Hoje (SPEC-041)', () => {
  const shelfPorts = {
    washDays: washDayPort({ lastUsedFor: jest.fn(async () => []) }),
    products: { list: jest.fn(async () => []) } as unknown as ProductPort,
  };

  const renderWithShelf = (withShelf: boolean) =>
    render(
      <TodayScreen
        board={board()}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={shelfPorts.washDays}
        {...(withShelf ? { products: shelfPorts.products } : {})}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );

  /**
   * ⚠️ **Conta os cartões, e não "existe pelo menos um".**
   *
   * A primeira versão deste teste passava com a prop chegando **só no cartão de foco**: a `Section`
   * declarava `shelf` e não a repassava, então os cuidados de "Próximos" ficavam sem o painel — e o
   * teste, que só perguntava se o rótulo existia em algum lugar, não via diferença. Quem viu foi o
   * DEV real a 390px. Contar é o que torna o repasse observável.
   */
  it('oferece o painel em TODO cuidado acionável, não só no de foco', async () => {
    const s = await renderWithShelf(true);
    await waitFor(() => s.getAllByText('Meus produtos'));
    const actionable = s.getAllByText('Fiz hoje').length;
    expect(actionable).toBeGreaterThan(1);
    expect(s.getAllByText('Meus produtos')).toHaveLength(actionable);
  });

  it('o painel começa fechado', async () => {
    const s = await renderWithShelf(true);
    await waitFor(() => s.getAllByText('Meus produtos'));
    expect(s.queryByText(/Na sua prateleira|Sua prateleira está vazia/)).toBeNull();
  });

  it('abrir mostra o que ela tem', async () => {
    const s = await renderWithShelf(true);
    await waitFor(() => s.getAllByText('Meus produtos'));
    await fireEvent.press(s.getAllByText('Meus produtos')[0] as never);
    await waitFor(() => s.getByText(/Sua prateleira está vazia/));
  });

  /** Sem a prateleira, o cartão continua inteiro — a capability é opcional (FR4/NG5). */
  it('sem a prateleira, o cartão não oferece o painel e nada quebra', async () => {
    const s = await renderWithShelf(false);
    await waitFor(() => s.getAllByText('Fiz hoje'));
    expect(s.queryByText('Meus produtos')).toBeNull();
  });
});

/**
 * SPEC-040 FR6 (F39) — a rotina de óleo na Hoje: **só quando vence ou está vencida**, e adiar tem o
 * mesmo peso que fazer.
 */
describe('rotina de óleo na Hoje (SPEC-040)', () => {
  const oilView = (over: Partial<OilRoutineView> = {}): OilRoutineView => ({
    state: 'none',
    everyDays: null,
    dueOn: null,
    daysLate: 0,
    lastDoneOn: null,
    doneCount: 0,
    ...over,
  });

  const renderWithOil = (over: Partial<OilRoutineView>, handlers: Record<string, unknown> = {}) =>
    render(
      <TodayScreen
        board={board()}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={washDayPort()}
        oil={{ view: oilView(over), busy: false, onDone: jest.fn(), onPostpone: jest.fn(), ...handlers }}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );

  it('sem rotina, a Hoje não fala de óleo (EC6)', async () => {
    const s = await renderWithOil({});
    expect(s.queryByText('Hora do seu óleo')).toBeNull();
  });

  it('a próxima ocorrência ainda longe também não aparece', async () => {
    const s = await renderWithOil({ state: 'upcoming', everyDays: 7, dueOn: '2026-09-17' as never });
    expect(s.queryByText('Hora do seu óleo')).toBeNull();
  });

  it('vencendo hoje, oferece fazer e adiar', async () => {
    const s = await renderWithOil({ state: 'due_today', everyDays: 7, dueOn: TODAY as never });
    await waitFor(() => s.getByText('Hora do seu óleo'));
    s.getByText('Você programou o óleo para hoje.');
    s.getByText('Passei óleo');
    s.getByText('Adiar um dia');
  });

  it('marcar chama a porta', async () => {
    const onDone = jest.fn();
    const s = await renderWithOil({ state: 'due_today', everyDays: 7, dueOn: TODAY as never }, { onDone });
    await fireEvent.press(s.getByText('Passei óleo'));
    expect(onDone).toHaveBeenCalled();
  });

  it('adiar chama a porta, e é uma ação como outra qualquer (BR2/D-28)', async () => {
    const onPostpone = jest.fn();
    const s = await renderWithOil(
      { state: 'overdue', everyDays: 7, dueOn: '2026-09-03' as never, daysLate: 7 },
      { onPostpone },
    );
    await fireEvent.press(s.getByText('Adiar um dia'));
    expect(onPostpone).toHaveBeenCalled();
  });

  /**
   * NG3/BR4 — diz o fato, não cobra, e não afirma nada sobre cabelo.
   *
   * Asserção **exata**, e não uma varredura por palavras proibidas: a tela inteira contém
   * "Hidratação" — que é um tipo de cuidado do cronograma, não uma alegação — e uma varredura larga
   * reprovaria por isso, dizendo a coisa errada sobre um texto certo. A barreira por palavra existe
   * onde ela pode ser escopada: no cartão (`oil-routine.test.tsx`) e no texto do lembrete
   * (`notifications.test.ts`).
   */
  it('vencida, conta os dias sem cobrar', async () => {
    const s = await renderWithOil({
      state: 'overdue',
      everyDays: 7,
      dueOn: '2026-09-03' as never,
      daysLate: 7,
    });
    s.getByText('Hora do seu óleo');
    s.getByText('Você programou o óleo para há 7 dias.');
  });

  it('vencida ontem, fala em ontem e não em "há 1 dias"', async () => {
    const s = await renderWithOil({
      state: 'overdue',
      everyDays: 7,
      dueOn: '2026-09-09' as never,
      daysLate: 1,
    });
    s.getByText('Você programou o óleo para ontem.');
  });
});

/**
 * SPEC-045 (F46) — o cuidado concluído vira card, **dali mesmo**.
 *
 * ⚠️ **Conta, e não "existe pelo menos um".** É a lição da SPEC-041, em que a `Section` declarava
 * `shelf` e **não a repassava**: o painel chegava só ao cartão de foco, e o teste, que perguntava se
 * o rótulo existia em algum lugar, não via diferença. Quem viu foi o DEV real a 390px. `onShare`
 * atravessa a mesma cadeia de props, então merece a mesma barreira.
 */
describe('compartilhar o cuidado concluído, na Hoje (SPEC-045)', () => {
  /**
   * **Dois** concluídos de propósito: um cai no cartão de foco e o outro numa seção. Com um só, um
   * repasse quebrado ainda passaria — foi exatamente assim que a SPEC-041 escapou.
   */
  const doisConcluidos = board({
    executions: [
      {
        id: 'e-late',
        scheduledCareId: 'late',
        executedAt: instantFromString('2026-09-08T10:00:00.000Z'),
        executedOn: '2026-09-08',
        voidedAt: null,
      },
      {
        id: 'e-now',
        scheduledCareId: 'now',
        executedAt: instantFromString('2026-09-10T10:00:00.000Z'),
        executedOn: '2026-09-10',
        voidedAt: null,
      },
    ],
  });

  const renderWithShare = (withShare: boolean) =>
    render(
      <TodayScreen
        board={doisConcluidos}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={washDayPort()}
        {...(withShare ? { onShare: jest.fn() } : {})}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );

  it('oferece compartilhar em TODO cuidado concluído, não só no primeiro', async () => {
    const s = await renderWithShare(true);
    // "Contar esse cuidado"/"Ver o que contei" só existem em cuidado com execução — é a mesma
    // população que pode virar card.
    const concluidos =
      s.queryAllByText('Contar esse cuidado').length + s.queryAllByText('Ver o que contei').length;
    expect(concluidos).toBeGreaterThan(1);
    expect(s.getAllByText('Compartilhar')).toHaveLength(concluidos);
  });

  /** Sem a porta, nenhum botão — e nada de botão morto (a lição da SPEC-027). */
  it('sem onShare, não existe botão nenhum', async () => {
    const s = await renderWithShare(false);
    expect(s.queryAllByText('Compartilhar')).toHaveLength(0);
  });

  it('leva o nome do cuidado, que é o que o card mostra', async () => {
    const onShare = jest.fn();
    const s = await render(
      <TodayScreen
        board={doisConcluidos}
        care={makePort()}
        today={TODAY}
        now={() => NOW}
        timeZone="America/Sao_Paulo"
        newExecutionId={() => 'exec-1'}
        onChanged={jest.fn()}
        hairProfile={hairProfilePort()}
        onOpenWashDay={jest.fn()}
        washDays={washDayPort()}
        onShare={onShare}
        profile={{ name: 'Ana', onPress: jest.fn() }}
        productCount={null}
        onOpenShelf={jest.fn()}
        onPause={jest.fn()}
        onPreviewResume={jest.fn()}
        onResume={jest.fn()}
        onOpenCycle={jest.fn()}
      />,
    );
    fireEvent.press(s.getAllByText('Compartilhar')[0]!);
    expect(onShare).toHaveBeenCalledWith(expect.any(String));
    expect(onShare.mock.calls[0]![0]).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});
