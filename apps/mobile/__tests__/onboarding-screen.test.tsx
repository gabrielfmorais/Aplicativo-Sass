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

// Uses option labels that are unique across the screen so each press is unambiguous.
const fillSingles = async (s: Awaited<ReturnType<typeof render>>) => {
  await fireEvent.press(s.getByText('Cacheado')); // hairPattern = curly
  await fireEvent.press(s.getByText('Médio')); // strandThickness = medium
  await fireEvent.press(s.getByText('Equilibrado')); // scalpTendency = balanced
  await fireEvent.press(s.getByText('2x por semana')); // washFrequency = twice_weekly
  await fireEvent.press(s.getByText('Quase nunca')); // heatUsage = almost_never
  await fireEvent.press(s.getByText('Manter o cabelo saudável')); // primaryGoal
};

describe('OnboardingScreen (SPEC-002)', () => {
  it('does not save until every required answer is given', async () => {
    const port = makePort();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    await fireEvent.press(s.getByText('Salvar perfil')); // disabled → no-op
    expect(port.save).not.toHaveBeenCalled();
  });

  it('saves the mapped answers (empty chemical = none) and reports the snapshot', async () => {
    const port = makePort();
    const onSaved = jest.fn();
    const s = await render(<OnboardingScreen hairProfile={port} onSaved={onSaved} />);
    await fillSingles(s);
    await fireEvent.press(s.getByText('Com bastante frizz')); // currentConcerns = [frizz]
    await fireEvent.press(s.getByText('Salvar perfil'));
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
    await fillSingles(s);
    await fireEvent.press(s.getByText('Com bastante frizz')); // frizz
    await fireEvent.press(s.getByText('Sem problema importante')); // clears frizz → [no_major_concern]
    await fireEvent.press(s.getByText('Salvar perfil'));
    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentConcerns: ['no_major_concern'] }),
      ),
    );
  });
});
