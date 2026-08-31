import type {
  EntitlementsPort,
  HairPlan,
  HairPlanPort,
  HairProfileSnapshot,
  LocalDate,
  PlanPreferences,
  PlanPreferencesPort,
} from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanCustomizationSection } from '@/features/account/PlanCustomizationSection';
import { PlanScreen } from '@/features/plan/PlanScreen';

/** 2026-09-01 is a Tuesday; `twice_weekly` puts the engine on Tuesdays and Saturdays. */
const TODAY = '2026-09-01' as LocalDate;

const profile: HairProfileSnapshot = {
  hairProfileId: 'hp-1',
  createdAt: '2026-08-27T10:00:00Z',
  hairPattern: 'curly',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['dryness'],
  primaryGoal: 'softness_and_hydration',
};

const entitlementsPort = (granted: readonly string[] | Error): EntitlementsPort =>
  ({
    get: jest.fn(async () => {
      if (granted instanceof Error) throw granted;
      return granted;
    }),
  }) as unknown as EntitlementsPort;

const preferencesPort = (
  stored: PlanPreferences | null | Error,
  save: jest.Mock = jest.fn(async () => undefined),
): jest.Mocked<PlanPreferencesPort> =>
  ({
    get: jest.fn(async () => {
      if (stored instanceof Error) throw stored;
      return stored;
    }),
    save,
  }) as unknown as jest.Mocked<PlanPreferencesPort>;

const plansPort = (): jest.Mocked<HairPlanPort> =>
  ({
    getActive: jest.fn(async () => null),
    generate: jest.fn(async () => ({}) as HairPlan),
  }) as unknown as jest.Mocked<HairPlanPort>;

const renderPreview = (entitlements: EntitlementsPort, planPreferences: PlanPreferencesPort) =>
  render(
    <PlanScreen
      profile={profile}
      plans={plansPort()}
      today={TODAY}
      newRequestId={() => 'req-1'}
      onCreated={jest.fn()}
      onOpenAccount={jest.fn()}
      entitlements={entitlements}
      planPreferences={planPreferences}
    />,
  );

describe('SPEC-015 — the preview shows what the server will persist', () => {
  it('applies her preferred weekdays when she is entitled', async () => {
    const screen = await renderPreview(
      entitlementsPort(['plan_customization']),
      preferencesPort({ preferredWeekdays: [1, 4] }), // Monday and Thursday
    );
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    // The engine puts her first care on Tuesday 01/09; her routine moves it to Thursday 03/09,
    // and every remaining care lands on a Monday or a Thursday.
    screen.getByText('qui, 03/09');
    expect(screen.queryByText('ter, 01/09')).toBeNull();
    expect(screen.getAllByText(/^(seg|qui), /)).toHaveLength(8);
    // The cadence is untouched: still eight cares over the window.
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  it('ignores the stored routine when she is not entitled — free sees the engine plan', async () => {
    const screen = await renderPreview(entitlementsPort([]), preferencesPort({ preferredWeekdays: [1, 4] }));
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    screen.getByText('ter, 01/09');
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  /** §16 — an error must never open a paid capability, and must never lose a care either. */
  it('falls back to the engine plan when either read fails (fail closed)', async () => {
    const screen = await renderPreview(
      entitlementsPort(new Error('offline')),
      preferencesPort({ preferredWeekdays: [1, 4] }),
    );
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    screen.getByText('ter, 01/09');
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  it('says so when her routine cannot hold every care, without hiding any of them (EC1)', async () => {
    // Two cares a week cannot both land on one weekday.
    const screen = await renderPreview(
      entitlementsPort(['plan_customization']),
      preferencesPort({ preferredWeekdays: [3] }),
    );
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    screen.getByText(/alguns ficaram no dia sugerido pela avaliação\. Nenhum cuidado foi removido\./);
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  it('says nothing about placement when she chose no days', async () => {
    const screen = await renderPreview(
      entitlementsPort(['plan_customization']),
      preferencesPort({ preferredWeekdays: [] }),
    );
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    expect(screen.queryByText(/Nenhum cuidado foi removido/)).toBeNull();
  });
});

describe('SPEC-015 FR1 — the weekday chooser in the account', () => {
  it('is a locked, honest explanation for a free user — never a broken control', async () => {
    const screen = await render(
      <PlanCustomizationSection
        entitlements={entitlementsPort([])}
        planPreferences={preferencesPort(null)}
      />,
    );
    await waitFor(() => screen.getByText('Seus dias preferidos'));
    screen.getByText(/faz parte do premium/);
    expect(screen.queryByText('Salvar meus dias')).toBeNull();
  });

  it('lets an entitled user choose days and save them', async () => {
    const save = jest.fn(async () => undefined);
    const prefs = preferencesPort({ preferredWeekdays: [] }, save);
    const screen = await render(
      <PlanCustomizationSection
        entitlements={entitlementsPort(['plan_customization'])}
        planPreferences={prefs}
      />,
    );
    await waitFor(() => screen.getByText('Salvar meus dias'));

    await fireEvent.press(screen.getByLabelText('sábado'));
    await fireEvent.press(screen.getByLabelText('terça-feira'));
    await fireEvent.press(screen.getByText('Salvar meus dias'));

    // Normalised on the way out: sorted, deduplicated, regardless of the order she tapped.
    await waitFor(() => expect(save).toHaveBeenCalledWith({ preferredWeekdays: [2, 6] }));
  });

  /** Saving a routine must not silently rewrite the schedule she is living on today (FR4). */
  it('says the current schedule is untouched and offers the preview instead', async () => {
    const onApply = jest.fn();
    const screen = await render(
      <PlanCustomizationSection
        entitlements={entitlementsPort(['plan_customization'])}
        planPreferences={preferencesPort({ preferredWeekdays: [6] })}
        onApply={onApply}
      />,
    );
    await waitFor(() => screen.getByText('Salvar meus dias'));
    await fireEvent.press(screen.getByText('Salvar meus dias'));

    await waitFor(() => screen.getByText(/Seu cronograma atual continua como está/));
    await fireEvent.press(screen.getByText('Ver novo cronograma'));
    expect(onApply).toHaveBeenCalled();
  });

  it('reports a failed save and keeps the choice on screen for a retry', async () => {
    const save = jest.fn(async () => {
      throw new Error('offline');
    });
    const screen = await render(
      <PlanCustomizationSection
        entitlements={entitlementsPort(['plan_customization'])}
        planPreferences={preferencesPort({ preferredWeekdays: [6] }, save)}
      />,
    );
    await waitFor(() => screen.getByText('Salvar meus dias'));
    await fireEvent.press(screen.getByText('Salvar meus dias'));

    await waitFor(() => screen.getByText('Não foi possível salvar seus dias. Tente novamente.'));
    expect(screen.queryByText(/Seu cronograma atual continua como está/)).toBeNull();
    screen.getByText('Salvar meus dias');
  });

  it('treats a failed read as free and offers a retry, never as a downgrade', async () => {
    const screen = await render(
      <PlanCustomizationSection
        entitlements={entitlementsPort(new Error('offline'))}
        planPreferences={preferencesPort(null)}
      />,
    );
    await waitFor(() => screen.getByText(/Seu cronograma segue o padrão\./));
    screen.getByText('Tentar novamente');
    expect(screen.queryByText('Salvar meus dias')).toBeNull();
  });
});
