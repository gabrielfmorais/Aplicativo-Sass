import type {
  EntitlementsPort,
  HairPlan,
  HairPlanPort,
  HairProfileSnapshot,
  LocalDate,
  PlanPreferencesPort,
} from '@app/core';
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

const createdPlan: HairPlan = {
  id: 'plan-1',
  hairProfileId: 'hp-1',
  startsOn: '2026-09-01',
  assessmentAlgorithmVersion: 'v1',
  scheduleAlgorithmVersion: 'v1',
  createdAt: '2026-09-01T10:00:00Z',
  cares: [
    {
      id: 'c1',
      careTypeCode: 'hydration',
      plannedDate: '2026-09-01',
      status: 'planned',
      rescheduledToId: null,
    },
  ],
};

const makePort = (overrides: Partial<HairPlanPort> = {}): jest.Mocked<HairPlanPort> =>
  ({
    getActive: jest.fn(async () => null),
    generate: jest.fn(async () => createdPlan),
    ...overrides,
  }) as unknown as jest.Mocked<HairPlanPort>;

/** Free by default: no entitlement, no stored routine — the plain SPEC-004 preview. */
const freePorts = () => ({
  entitlements: { get: jest.fn(async () => [] as readonly string[]) } as unknown as EntitlementsPort,
  planPreferences: {
    get: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
  } as unknown as PlanPreferencesPort,
});

const renderScreen = (
  plans: HairPlanPort,
  onCreated: () => void = jest.fn(),
  newRequestId: () => string = () => 'req-1',
) =>
  render(
    <PlanScreen
      profile={profile}
      plans={plans}
      today={TODAY}
      newRequestId={newRequestId}
      onCreated={onCreated}
      onOpenAccount={jest.fn()}
      {...freePorts()}
    />,
  );

describe('PlanScreen (SPEC-004 §5) — preview and confirmation only', () => {
  it('shows the assessment and the previewed schedule', async () => {
    const screen = await renderScreen(makePort());
    await waitFor(() => screen.getByText('Este é o seu cronograma'));
    screen.getByText('Sua avaliação capilar');
    // hydration emphasis from primary_goal (worksheet §3 P1) + the wash-frequency rationale.
    screen.getByText('• Você quer mais maciez e hidratação.');
    screen.getByText('• A frequência dos cuidados acompanha a sua rotina de lavagem.');
    // twice_weekly → 8 cares over the 28-day window (worksheet §5/§9).
    expect(screen.getAllByText(/Hidratação|Nutrição|Reconstrução/)).toHaveLength(8);
  });

  it('creates the plan server-side on confirmation and hands control back to the route', async () => {
    const plans = makePort();
    const onCreated = jest.fn();
    const screen = await renderScreen(plans, onCreated);
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
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

    release(createdPlan);
  });

  it('retrying a failed creation reuses the same clientRequestId (idempotent, AC9)', async () => {
    const generate = jest
      .fn<Promise<HairPlan>, [{ clientRequestId: string; startsOn: string }]>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(createdPlan);
    const plans = makePort({ generate });
    const onCreated = jest.fn();
    let issued = 0;
    const screen = await renderScreen(plans, onCreated, () => `req-${++issued}`);
    await waitFor(() => screen.getByText('Este é o seu cronograma'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => screen.getByText('Não foi possível criar seu cronograma. Tente novamente.'));

    await fireEvent.press(screen.getByText('Começar meu cronograma'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(generate.mock.calls.map((c) => c[0].clientRequestId)).toEqual(['req-1', 'req-1']);
  });
});

/**
 * SPEC-018 fatia 4 (FR9). O único instante entre a última resposta dela e o cronograma dela, e o
 * instante em que ele passa a existir. As duas coisas que este bloco protege: a espera não inventa
 * progresso, e a cerimônia não aparece onde ela atrapalha.
 */
describe('PlanScreen — criação e revelação (SPEC-018 FR9)', () => {
  /** Segura as leituras para que a espera fique na tela e possa ser observada. */
  const pendingPorts = () => ({
    entitlements: {
      get: jest.fn(() => new Promise<readonly string[]>(() => {})),
    } as unknown as EntitlementsPort,
    planPreferences: {
      get: jest.fn(() => new Promise(() => {})),
      save: jest.fn(async () => undefined),
    } as unknown as PlanPreferencesPort,
  });

  it('a espera diz o que está acontecendo, e não inventa porcentagem nem contagem', async () => {
    const screen = await render(
      <PlanScreen
        profile={profile}
        plans={makePort()}
        today={TODAY}
        newRequestId={() => 'req-1'}
        onCreated={jest.fn()}
        {...pendingPorts()}
      />,
    );

    screen.getByText('Estamos montando o seu cronograma.');
    // A recusa explícita da SPEC-018 §5: não temos progresso mensurável, então não há número honesto.
    expect(screen.queryByText(/\d+\s*%|passo \d|etapa \d/i)).toBeNull();
    // E nada para tocar: numa espera não há o que ela possa fazer.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a revelação acontece uma vez — a reavaliação vem comparar, não descobrir', async () => {
    const first = await render(
      <PlanScreen
        profile={profile}
        plans={makePort()}
        today={TODAY}
        newRequestId={() => 'req-1'}
        onCreated={jest.fn()}
        {...freePorts()}
      />,
    );
    await waitFor(() => first.getByText('Este é o seu cronograma'));
    first.getByText('Pronto');
    // Diz de onde o cronograma veio — processo, não orientação capilar (BR2/D-26).
    first.getByText(/Montado a partir do que você respondeu/);

    const again = await render(
      <PlanScreen
        profile={profile}
        plans={makePort()}
        today={TODAY}
        newRequestId={() => 'req-1'}
        onCreated={jest.fn()}
        onCancel={jest.fn()}
        {...freePorts()}
      />,
    );
    await waitFor(() => again.getByText('Este é o seu cronograma'));
    expect(again.queryByText('Pronto')).toBeNull();
    expect(again.queryByText(/Montado a partir do que você respondeu/)).toBeNull();
  });

  it('numa reavaliação a espera continua sendo uma espera comum', async () => {
    const screen = await render(
      <PlanScreen
        profile={profile}
        plans={makePort()}
        today={TODAY}
        newRequestId={() => 'req-1'}
        onCreated={jest.fn()}
        onCancel={jest.fn()}
        {...pendingPorts()}
      />,
    );
    screen.getByText('Montando seu cronograma…');
    expect(screen.queryByText('Estamos montando o seu cronograma.')).toBeNull();
  });
});
