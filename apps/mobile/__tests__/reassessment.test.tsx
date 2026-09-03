import type {
  AuthPort,
  DeletionRequestPort,
  EntitlementsPort,
  HairPlanPort,
  HairProfileSnapshot,
  LocalDate,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
  Progress,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountScreen } from '@/features/account/AccountScreen';
import { ProgressSummary } from '@/features/care/ProgressSummary';
import { PlanScreen } from '@/features/plan/PlanScreen';

/** SPEC-035 — a tela passou a editar o nome, então ela precisa da porta e do valor atual. */
const profileStub = { get: async () => ({ displayName: null }), save: async () => undefined };
const identity = { profile: profileStub, displayName: null, onNameChanged: () => undefined };

const profile: HairProfileSnapshot = {
  hairProfileId: 'hp-1',
  hairPattern: 'curly',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['dryness'],
  primaryGoal: 'softness_and_hydration',
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
  createdAt: '2026-09-01T10:00:00.000Z',
};

const accountPorts = () => ({
  auth: { signOut: jest.fn(async () => undefined) } as unknown as AuthPort,
  deletion: {
    current: jest.fn(async () => null),
    request: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
  } as unknown as DeletionRequestPort,
  entitlements: { get: jest.fn(async () => []) } as unknown as EntitlementsPort,
  notificationPreferences: {
    get: jest.fn(async () => DEFAULT_NOTIFICATION_PREFERENCES),
    save: jest.fn(async () => undefined),
  } as unknown as NotificationPreferencesPort,
  notificationScheduler: {
    ensurePermission: jest.fn(async () => true),
    reconcile: jest.fn(async () => undefined),
  } as unknown as NotificationSchedulerPort,
  planPreferences: {
    get: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
  } as unknown as PlanPreferencesPort,
});

/** Free by default: the preview these tests assert on is the engine's, not a customised one. */
const previewPorts = () => ({
  entitlements: { get: jest.fn(async () => [] as readonly string[]) } as unknown as EntitlementsPort,
  planPreferences: {
    get: jest.fn(async () => null),
    save: jest.fn(async () => undefined),
  } as unknown as PlanPreferencesPort,
});

describe('reassessment entry point (SPEC-014 AC1)', () => {
  it('offers it, and says both what is replaced and what is kept', async () => {
    const p = accountPorts();
    const onReassess = jest.fn();
    const screen = await render(
      <AccountScreen
        {...p}
        {...identity}
        onNotificationPreferencesChanged={jest.fn()}
        onReassess={onReassess}
      />,
    );
    await waitFor(() => screen.getByText('Reavaliar meu cabelo'));
    screen.getByText(/O cronograma atual será substituído; o que você já registrou continua salvo\./);

    await fireEvent.press(screen.getByText('Reavaliar'));
    expect(onReassess).toHaveBeenCalled();
  });

  /** Without an active plan there is nothing to replace, so the option must not be there. */
  it('is absent when there is no active plan', async () => {
    const p = accountPorts();
    const screen = await render(
      <AccountScreen {...p} {...identity} onNotificationPreferencesChanged={jest.fn()} />,
    );
    await waitFor(() => screen.getByText('Sua conta na Huna'));
    expect(screen.queryByText('Reavaliar meu cabelo')).toBeNull();
  });
});

describe('the preview that replaces a plan (SPEC-014 AC4–AC6)', () => {
  const plans = (): jest.Mocked<HairPlanPort> =>
    ({
      getActive: jest.fn(async () => null),
      generate: jest.fn(async () => ({}) as never),
    }) as unknown as jest.Mocked<HairPlanPort>;

  const renderPreview = (
    port: HairPlanPort,
    over: Partial<{ onCreated: () => void; onCancel: () => void }> = {},
  ) =>
    render(
      <PlanScreen
        profile={profile}
        plans={port}
        today={'2026-09-10' as LocalDate}
        newRequestId={() => 'req-1'}
        onCreated={over.onCreated ?? jest.fn()}
        onCancel={over.onCancel ?? jest.fn()}
        {...previewPorts()}
      />,
    );

  it('warns that confirming replaces the current plan and that history is kept', async () => {
    const screen = await renderPreview(plans());
    await waitFor(() =>
      screen.getByText('Confirmar substitui seu cronograma atual. Seu histórico continua salvo.'),
    );
    screen.getByText('Confirmar novo cronograma');
  });

  it('generates once and hands control back', async () => {
    const port = plans();
    const onCreated = jest.fn();
    const screen = await renderPreview(port, { onCreated });
    await waitFor(() => screen.getByText('Confirmar novo cronograma'));

    await fireEvent.press(screen.getByText('Confirmar novo cronograma'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(port.generate).toHaveBeenCalledTimes(1);
  });

  /** G3: leaving the preview must not touch the plan she is still living on. */
  it('cancels without generating anything', async () => {
    const port = plans();
    const onCancel = jest.fn();
    const screen = await renderPreview(port, { onCancel });
    await waitFor(() => screen.getByText('Cancelar'));

    await fireEvent.press(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalled();
    expect(port.generate).not.toHaveBeenCalled();
  });

  it('shows the first-plan wording when nothing is being replaced', async () => {
    const screen = await render(
      <PlanScreen
        profile={profile}
        plans={plans()}
        today={'2026-09-10' as LocalDate}
        newRequestId={() => 'req-1'}
        onCreated={jest.fn()}
        onOpenAccount={jest.fn()}
        {...previewPorts()}
      />,
    );
    await waitFor(() => screen.getByText('Começar meu cronograma'));
    expect(screen.queryByText(/substitui seu cronograma atual/)).toBeNull();
    expect(screen.queryByText('Cancelar')).toBeNull();
  });
});

describe('history survives the new plan (SPEC-014 FR7/AC8)', () => {
  const progress = (over: Partial<Progress> = {}): Progress => ({
    elapsed: 0,
    done: 0,
    skipped: 0,
    overdue: 0,
    planned: 0,
    total: 0,
    checkInCount: 0,
    averageFeel: null,
    lifetimeDone: 0,
    ...over,
  });

  /**
   * The point of the whole line: a brand-new plan must not read as a brand-new user.
   *
   * ⚠️ **SPEC-034 — este teste travava duas frases que brigavam.** A 390px lia-se *"o resumo
   * aparece conforme você registra"* e, logo abaixo, *"desde o início, você concluiu 12 cuidados"*:
   * a tela prometia um resumo que já estava ali. Não era contradição de dado (um é o plano, o outro
   * é a vida inteira) — era **escopo faltando na frase**, e é o escopo que a asserção agora exige.
   */
  it('keeps her earlier work visible on a plan that just started', async () => {
    const screen = await render(<ProgressSummary progress={progress({ lifetimeDone: 12 })} />);
    screen.getByText('Seu plano começou agora. O resumo deste ciclo aparece conforme você registra.');
    screen.getByText('Desde o início, você concluiu 12 cuidados.');
  });

  it('stays quiet when the lifetime total would only repeat the plan total (EC6)', async () => {
    const screen = await render(
      <ProgressSummary progress={progress({ elapsed: 3, done: 3, lifetimeDone: 3 })} />,
    );
    expect(screen.queryByText(/Desde o início/)).toBeNull();
  });

  it('stays quiet for someone who has never completed anything (EC7)', async () => {
    const screen = await render(<ProgressSummary progress={progress({ elapsed: 2, done: 0, skipped: 2 })} />);
    expect(screen.queryByText(/Desde o início/)).toBeNull();
  });
});
