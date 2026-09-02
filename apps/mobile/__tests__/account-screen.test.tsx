import type {
  AuthPort,
  DeletionRequestPort,
  EntitlementsPort,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AccountScreen } from '@/features/account/AccountScreen';

const ports = (deletionOverrides: Partial<DeletionRequestPort> = {}) => ({
  auth: { signOut: jest.fn(async () => undefined) } as unknown as AuthPort,
  deletion: {
    current: jest.fn(async () => null),
    request: jest.fn(async () => undefined),
    cancel: jest.fn(async () => undefined),
    ...deletionOverrides,
  } as unknown as DeletionRequestPort,
  entitlements: { get: jest.fn(async () => [] as readonly string[]) } as unknown as EntitlementsPort,
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

/** `render` resolves asynchronously in this setup, which is why every suite here awaits it. */
const renderScreen = async (p: ReturnType<typeof ports>, extra: Record<string, unknown> = {}) =>
  await render(<AccountScreen {...p} onNotificationPreferencesChanged={jest.fn()} {...extra} />);

describe('AccountScreen — the deletion read has to end somewhere (SPEC-016 FR4/AC4)', () => {
  /**
   * It used to leave `requestedAt` on `'loading'` when the read failed, so the section showed a
   * spinner that never ended and offered nothing — the user could not request deletion, could not
   * retry, and had no way to learn that anything had gone wrong.
   */
  it('shows a retry when the deletion status cannot be read, instead of loading forever', async () => {
    const p = ports({
      current: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    const screen = await renderScreen(p);

    await waitFor(() => screen.getByText('Não foi possível carregar sua conta.'));
    expect(screen.queryByText('Carregando sua conta…')).toBeNull();
    screen.getByText('Tentar novamente');
  });

  it('re-reads when the retry is pressed', async () => {
    let attempt = 0;
    const current = jest.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('offline');
      return null;
    });
    const screen = await renderScreen(ports({ current } as Partial<DeletionRequestPort>));

    await waitFor(() => screen.getByText('Tentar novamente'));
    await fireEvent.press(screen.getByText('Tentar novamente'));

    await waitFor(() => screen.getByText('Solicitar exclusão da conta'));
    expect(current).toHaveBeenCalledTimes(2);
  });

  /** Signing out must not depend on a read that failed — it is the one way out of a broken state. */
  it('still offers sign-out while the deletion status is unreadable', async () => {
    const p = ports({
      current: jest.fn(async () => {
        throw new Error('offline');
      }),
    });
    const screen = await renderScreen(p);

    await waitFor(() => screen.getByText('Tentar novamente'));
    await fireEvent.press(screen.getByText('Sair'));
    expect(p.auth.signOut).toHaveBeenCalled();
  });
});

describe('AccountScreen — premium reads as addition, never as subtraction (G7/FR6)', () => {
  it('names the free plan and promises nothing is taken away, without quoting a price', async () => {
    const screen = await renderScreen(ports());
    await waitFor(() => screen.getByText('Plano atual: Gratuito'));

    screen.getByText('Tudo o que você já usa continua no plano gratuito.');
    // Price and period come from the store at runtime (D-83). A number typed into a screen is a
    // number that will be wrong one day, so none may appear here.
    expect(screen.queryByText(/R\$/)).toBeNull();
  });
});

describe('AccountScreen — the way back belongs to the screen', () => {
  it('offers it when the route provides one, and not otherwise', async () => {
    const onBack = jest.fn();
    const withBack = await renderScreen(ports(), { onBack });
    await waitFor(() => withBack.getByText('Voltar aos cuidados'));
    await fireEvent.press(withBack.getByText('Voltar aos cuidados'));
    expect(onBack).toHaveBeenCalled();

    const without = await renderScreen(ports());
    // SPEC-026 — a aba se chama pelo que ela é: ela. "Sua conta" descrevia uma gaveta de
    // configurações, e assinatura e lembretes deixaram de ser a primeira coisa que ela vê aqui.
    await waitFor(() => without.getByText('Você'));
    expect(without.queryByText('Voltar aos cuidados')).toBeNull();
  });
});
