import type { CareBoard, CareTrackingPort, Instant, LocalDate } from '@app/core';
import { CARE_GUIDES, ConflictError, instantFromString } from '@app/core';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { TodayScreen } from '@/features/care/TodayScreen';

const TODAY = '2026-09-10' as LocalDate;
const NOW = instantFromString('2026-09-10T12:00:00.000Z');

const board = (over: Partial<CareBoard> = {}): CareBoard => ({
  planId: 'plan-1',
  startsOn: '2026-09-01',
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
      onOpenAccount={jest.fn()}
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
  it('separates overdue, today and upcoming, and says how late a care is', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText('Atrasados'));
    screen.getByText('Hoje');
    screen.getByText('Próximos');
    screen.getByText(/atrasada há 2 dias/);
  });

  it('records a care and lets the route reload the board', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, board(), onChanged);
    await waitFor(() => screen.getByText('Atrasados'));

    await fireEvent.press(screen.getAllByText('Fiz hoje')[0]!);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(care.complete).toHaveBeenCalledWith({
      scheduledCareId: 'late',
      clientExecutionId: 'exec-1',
      timeZone: 'America/Sao_Paulo',
    });
  });

  it('does not fire a second call while one is in flight (AC14)', async () => {
    let release: () => void = () => {};
    const care = makePort({ complete: jest.fn(() => new Promise<void>((r) => (release = r))) });
    const screen = await renderScreen(care);
    await waitFor(() => screen.getByText('Atrasados'));

    const buttons = screen.getAllByText('Fiz hoje');
    await fireEvent.press(buttons[0]!);
    await fireEvent.press(buttons[0]!);
    expect(care.complete).toHaveBeenCalledTimes(1);
    release();
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
    await waitFor(() => screen.getByText('Atrasados'));

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
    await waitFor(() => screen.getByText('Atrasados'));

    await fireEvent.press(screen.getAllByText('Pular')[0]!);
    await waitFor(() => screen.getByText('Esse cuidado mudou. Atualizamos a tela.'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('reschedules through a quick option inside the allowed window', async () => {
    const care = makePort();
    const screen = await renderScreen(care);
    await waitFor(() => screen.getByText('Atrasados'));

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
    screen.getByText('Sua conta');
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
    await waitFor(() => screen.getByText('Seus cuidados'));
    expect(screen.queryByText('Reavaliar e montar o próximo')).toBeNull();
  });
});

describe('TodayScreen — "Como fazer" (SPEC-007 §14)', () => {
  const hydration = CARE_GUIDES.hydration;

  it('offers the guide on every actionable care and shows it in full when opened (AC5)', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText('Atrasados'));

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
    await waitFor(() => screen.getByText('Atrasados'));

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    screen.getByText(hydration.whatItIs);

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    expect(screen.queryByText(hydration.whatItIs)).toBeNull();
  });

  it('opens only the care that was pressed, not every row', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText('Atrasados'));

    await fireEvent.press(screen.getAllByText('Como fazer')[0]!);
    // Both overdue and upcoming are hydration; only one panel may be open.
    expect(screen.getAllByText(hydration.whatItIs)).toHaveLength(1);
  });

  it('never writes when the guide is opened (AC8)', async () => {
    const care = makePort();
    const onChanged = jest.fn();
    const screen = await renderScreen(care, board(), onChanged);
    await waitFor(() => screen.getByText('Atrasados'));

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
    await waitFor(() => screen.getByText('Atrasados'));

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
    await waitFor(() => screen.getByText('Atrasados'));
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
