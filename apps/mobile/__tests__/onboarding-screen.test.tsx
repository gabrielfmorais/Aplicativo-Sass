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
const fillSingles = (s: ReturnType<typeof render>) => {
  fireEvent.press(s.getByText('Cacheado')); // hairPattern = curly
  fireEvent.press(s.getByText('Médio')); // strandThickness = medium
  fireEvent.press(s.getByText('Equilibrado')); // scalpTendency = balanced
  fireEvent.press(s.getByText('2x por semana')); // washFrequency = twice_weekly
  fireEvent.press(s.getByText('Quase nunca')); // heatUsage = almost_never
  fireEvent.press(s.getByText('Manter o cabelo saudável')); // primaryGoal
};

describe('OnboardingScreen (SPEC-002)', () => {
  it('does not save until every required answer is given', () => {
    const port = makePort();
    const s = render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    fireEvent.press(s.getByText('Salvar perfil')); // disabled → no-op
    expect(port.save).not.toHaveBeenCalled();
  });

  it('saves the mapped answers (empty chemical = none) and reports the snapshot', async () => {
    const port = makePort();
    const onSaved = jest.fn();
    const s = render(<OnboardingScreen hairProfile={port} onSaved={onSaved} />);
    fillSingles(s);
    fireEvent.press(s.getByText('Com bastante frizz')); // currentConcerns = [frizz]
    fireEvent.press(s.getByText('Salvar perfil'));
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
    const s = render(<OnboardingScreen hairProfile={port} onSaved={jest.fn()} />);
    fillSingles(s);
    fireEvent.press(s.getByText('Com bastante frizz')); // frizz
    fireEvent.press(s.getByText('Sem problema importante')); // clears frizz → [no_major_concern]
    fireEvent.press(s.getByText('Salvar perfil'));
    await waitFor(() =>
      expect(port.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentConcerns: ['no_major_concern'] }),
      ),
    );
  });
});
