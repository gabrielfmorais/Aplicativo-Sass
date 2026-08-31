import type { HairProfilePort, HairProfileSnapshot } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

const snapshot: HairProfileSnapshot = {
  hairProfileId: 'hp-1',
  createdAt: '2026-08-27T10:00:00Z',
  hairPattern: 'curly',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['frizz'],
  primaryGoal: 'maintain_healthy_hair',
};

const makePort = () =>
  ({
    getCurrent: jest.fn(async () => null),
    save: jest.fn(async () => snapshot),
  }) as unknown as jest.Mocked<HairProfilePort>;

type Screen = Awaited<ReturnType<typeof render>>;

const advance = async (s: Screen) => fireEvent.press(s.getByText('Continuar'));

/**
 * Walks the eight steps of SPEC-002 (SPEC-016 FR3), answering each one, and stops **on** the last
 * step without confirming. The answers are the same ones the single-scroll version used, so what
 * the port receives can be compared against exactly the same expectation (AC2).
 */
const answerEveryStep = async (s: Screen) => {
  await fireEvent.press(s.getByText('Cacheado')); // hairPattern = curly
  await advance(s);
  await fireEvent.press(s.getByText('Médio')); // strandThickness = medium
  await advance(s);
  await fireEvent.press(s.getByText('Equilibrado')); // scalpTendency = balanced
  await advance(s);
  await fireEvent.press(s.getByText('2x por semana')); // washFrequency = twice_weekly
  await advance(s);
  await advance(s); // chemicalTreatments: none — the one optional step
  await fireEvent.press(s.getByText('Quase nunca')); // heatUsage = almost_never
  await advance(s);
  await fireEvent.press(s.getByText('Com bastante frizz')); // currentConcerns = [frizz]
  await advance(s);
  await fireEvent.press(s.getByText('Manter o cabelo saudável')); // primaryGoal
};

describe('OnboardingScreen (SPEC-002, stepped by SPEC-016)', () => {
  it('cannot advance past a question it has not answered', async () => {
    const port = makePort();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    // Step 1 is unanswered, so Continue is inert and the first question stays put.
    await advance(s);
    s.getByText('Qual é o seu tipo de curvatura?');
    expect(port.save).not.toHaveBeenCalled();
  });

  it('never saves before the last step is confirmed', async () => {
    const port = makePort();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    await answerEveryStep(s);
    // Every answer is in, and still nothing has been written: leaving here leaves no snapshot,
    // which is what makes reassessment safe to abandon (SPEC-014 G3).
    expect(port.save).not.toHaveBeenCalled();
    s.getByText('Ver meu cronograma');
  });

  it('saves exactly the same input the single-scroll version produced (AC2)', async () => {
    const port = makePort();
    const onSaved = jest.fn();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={onSaved} />);
    await answerEveryStep(s);
    await fireEvent.press(s.getByText('Ver meu cronograma'));
    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith({
        hairPattern: 'curly',
        strandThickness: 'medium',
        scalpTendency: 'balanced',
        washFrequency: 'twice_weekly',
        chemicalTreatments: [],
        heatUsage: 'almost_never',
        currentConcerns: ['frizz'],
        primaryGoal: 'maintain_healthy_hair',
      }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(snapshot));
  });

  it('keeps no_major_concern exclusive', async () => {
    const port = makePort();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    await answerEveryStep(s);
    // Back to the concerns step to exercise the exclusivity rule on the answers already given.
    await fireEvent.press(s.getByText('Voltar'));
    await fireEvent.press(s.getByText('Sem problema importante')); // clears frizz
    await advance(s);
    await fireEvent.press(s.getByText('Manter o cabelo saudável'));
    await fireEvent.press(s.getByText('Ver meu cronograma'));
    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentConcerns: ['no_major_concern'] }),
      ),
    );
  });

  /** Going back must not lose what she already answered — the point of a stepped flow. */
  it('remembers answers when she steps backwards and forwards', async () => {
    const port = makePort();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    await fireEvent.press(s.getByText('Cacheado'));
    await advance(s);
    await fireEvent.press(s.getByText('Médio'));
    await fireEvent.press(s.getByText('Voltar'));

    // The first question is showing again, with its answer still selected.
    s.getByText('Qual é o seu tipo de curvatura?');
    expect(s.getByText('Cacheado').props.accessibilityState?.checked ?? true).not.toBe(false);
    await advance(s);
    s.getByText('Qual é a espessura do fio?');
  });

  /** Reassessment (SPEC-014) needs a way out from the very first question. */
  it('offers cancel on the first step only when the caller can handle it', async () => {
    const port = makePort();
    const onCancel = jest.fn();
    const withCancel = await render(
      <OnboardingScreen hairProfile={port} onSaved={jest.fn()} onCancel={onCancel} />,
    );
    await fireEvent.press(withCancel.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();

    const first = await render(<OnboardingScreen hairProfile={makePort()} onSaved={jest.fn()} />);
    expect(first.queryByText('Cancelar')).toBeNull();
  });
});
