import type { HairPlan, HairPlanPort, HairProfileSnapshot, LocalDate } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanScreen } from '@/features/plan/PlanScreen';

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

const activePlan: HairPlan = {
  id: 'plan-1',
  hairProfileId: 'hp-1',
  startsOn: '2026-09-01',
  assessmentAlgorithmVersion: 'v1',
  scheduleAlgorithmVersion: 'v1',
  createdAt: '2026-09-01T10:00:00Z',
  cares: [{ id: 'c1', careTypeCode: 'hydration', plannedDate: '2026-09-01' }],
};

const makePort = (overrides: Partial<HairPlanPort> = {}): jest.Mocked<HairPlanPort> =>
  ({
    getActive: jest.fn(async () => null),
    generate: jest.fn(async () => activePlan),
    ...overrides,
  }) as unknown as jest.Mocked<HairPlanPort>;

const renderScreen = (plans: HairPlanPort, newRequestId = () => 'req-1') =>
  render(
    <PlanScreen
      profile={profile}
      plans={plans}
      today={TODAY}
      newRequestId={newRequestId}
      onOpenAccount={jest.fn()}
    />,
  );

describe('PlanScreen (SPEC-004 §5/§7)', () => {
  it('shows the assessment and the previewed schedule when there is no plan yet', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    screen.getByText('Sua avaliação capilar');
    // hydration emphasis from primary_goal (worksheet §3 P1) + the wash-frequency rationale.
    screen.getByText('• Você quer mais maciez e hidratação.');
    screen.getByText('• A frequência dos cuidados acompanha a sua rotina de lavagem.');
    // twice_weekly → 8 cares over the 28-day window (worksheet §5/§9).
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  it('creates the plan server-side on confirmation and then shows it as active', async () => {
    const plans = makePort();
    const screen = await renderScreen(plans);
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => screen.getByText('Seu cronograma'));
    expect(plans.generate).toHaveBeenCalledWith({ clientRequestId: 'req-1', startsOn: '2026-09-01' });
    expect(plans.generate).toHaveBeenCalledTimes(1);
  });

  it('does not submit twice while a creation is in flight (no duplicate history)', async () => {
    let release: (p: HairPlan) => void = () => {};
    const plans = makePort({ generate: jest.fn(() => new Promise<HairPlan>((r) => (release = r))) });
    const screen = await renderScreen(plans);
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => screen.getByText('Criando…'));
    await fireEvent.press(screen.getByText('Criando…'));
    expect(plans.generate).toHaveBeenCalledTimes(1);

    release(activePlan);
    await waitFor(() => screen.getByText('Seu cronograma'));
  });

  it('retrying a failed creation reuses the same clientRequestId (idempotent, AC9)', async () => {
    const generate = jest
      .fn<Promise<HairPlan>, [{ clientRequestId: string; startsOn: string }]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(activePlan);
    const plans = makePort({ generate });
    let issued = 0;
    const screen = await renderScreen(plans, () => `req-${++issued}`);
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => screen.getByText('Não foi possível criar seu cronograma. Tente novamente.'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => screen.getByText('Seu cronograma'));
    expect(generate.mock.calls.map((c) => c[0].clientRequestId)).toEqual(['req-1', 'req-1']);
  });

  it('renders the persisted plan when one is already active (reopening the app)', async () => {
    const plans = makePort({ getActive: jest.fn(async () => activePlan) });
    const screen = await renderScreen(plans);
    await waitFor(() => screen.getByText('Seu cronograma'));
    screen.getByText('Cronograma ativo desde ter, 01/09.');
    expect(screen.queryByText('Começar meu cronograma')).toBeNull();
  });

  it('offers a recoverable path when the plan cannot be read', async () => {
    const getActive = jest
      .fn<Promise<HairPlan | null>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(activePlan);
    const screen = await renderScreen(makePort({ getActive }));
    await waitFor(() => screen.getByText('Não foi possível carregar seu cronograma.'));

    await fireEvent.press(screen.getByText('Tentar novamente'));
    await waitFor(() => screen.getByText('Seu cronograma'));
  });

  it('survives an active plan with no cares without breaking navigation', async () => {
    const plans = makePort({ getActive: jest.fn(async () => ({ ...activePlan, cares: [] })) });
    const screen = await renderScreen(plans);
    await waitFor(() => screen.getByText('Seu cronograma'));
    screen.getByText('Nenhum cuidado programado ainda.');
    screen.getByText('Sua conta');
  });
});
