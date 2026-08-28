import type {
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { NotificationSettings } from '@/features/account/NotificationSettings';

const ports = (
  over: { stored?: NotificationPreferences | null; granted?: boolean; saveFails?: boolean } = {},
) => {
  const preferences: jest.Mocked<NotificationPreferencesPort> = {
    get: jest.fn(async () => over.stored ?? null),
    save: jest.fn(async () => {
      if (over.saveFails) throw new Error('offline');
    }),
  } as unknown as jest.Mocked<NotificationPreferencesPort>;
  const scheduler: jest.Mocked<NotificationSchedulerPort> = {
    ensurePermission: jest.fn(async () => over.granted ?? true),
    reconcile: jest.fn(async () => undefined),
  } as unknown as jest.Mocked<NotificationSchedulerPort>;
  return { preferences, scheduler };
};

const renderSettings = (p: ReturnType<typeof ports>, onChanged = jest.fn()) =>
  render(<NotificationSettings preferences={p.preferences} scheduler={p.scheduler} onChanged={onChanged} />);

const ON: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true };

describe('NotificationSettings (SPEC-008 §14/AC15)', () => {
  it('shows reminders off when she has never opted in', async () => {
    const screen = await renderSettings(ports());
    await waitFor(() => screen.getByText('Lembretes desligados'));
    // Nothing else is offered until they are on: no time, no check-in toggle.
    expect(screen.queryByText('Horário')).toBeNull();
  });

  it('asks the OS before turning them on, and saves once granted', async () => {
    const p = ports();
    const onChanged = jest.fn();
    const screen = await renderSettings(p, onChanged);
    await waitFor(() => screen.getByText('Lembretes desligados'));

    await fireEvent.press(screen.getByText('Lembretes desligados'));
    await waitFor(() => screen.getByText('Lembretes ligados'));

    expect(p.scheduler.ensurePermission).toHaveBeenCalled();
    expect(p.preferences.save).toHaveBeenCalledWith({ ...DEFAULT_NOTIFICATION_PREFERENCES, enabled: true });
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  /** FR2: the screen must never claim reminders are on when the OS refused. */
  it('does not turn on, save, or claim success when permission is denied', async () => {
    const p = ports({ granted: false });
    const onChanged = jest.fn();
    const screen = await renderSettings(p, onChanged);
    await waitFor(() => screen.getByText('Lembretes desligados'));

    await fireEvent.press(screen.getByText('Lembretes desligados'));
    await waitFor(() => screen.getByText('As notificações estão bloqueadas nas configurações do sistema.'));

    expect(p.preferences.save).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    screen.getByText('Lembretes desligados');
  });

  it('changes the hour without asking for permission again', async () => {
    const p = ports({ stored: ON });
    const screen = await renderSettings(p);
    await waitFor(() => screen.getByText('Horário'));

    await fireEvent.press(screen.getByText('08:00'));
    await waitFor(() =>
      expect(p.preferences.save).toHaveBeenCalledWith({ ...ON, reminderTimeLocal: '08:00' }),
    );
    expect(p.scheduler.ensurePermission).not.toHaveBeenCalled();
  });

  it('toggles the check-in reminder', async () => {
    const p = ports({ stored: ON });
    const screen = await renderSettings(p);
    await waitFor(() => screen.getByText('Lembrar do check-in'));

    await fireEvent.press(screen.getByText('Lembrar do check-in'));
    await waitFor(() =>
      expect(p.preferences.save).toHaveBeenCalledWith({ ...ON, checkinReminderEnabled: true }),
    );
  });

  it('turns them off again', async () => {
    const p = ports({ stored: ON });
    const screen = await renderSettings(p);
    await waitFor(() => screen.getByText('Lembretes ligados'));

    await fireEvent.press(screen.getByText('Lembretes ligados'));
    await waitFor(() => screen.getByText('Lembretes desligados'));
    expect(p.preferences.save).toHaveBeenCalledWith({ ...ON, enabled: false });
  });

  /** §16: reconciling against a preference that did not persist would leave the OS disagreeing. */
  it('keeps the previous value and does not notify the route when saving fails', async () => {
    const p = ports({ saveFails: true });
    const onChanged = jest.fn();
    const screen = await renderSettings(p, onChanged);
    await waitFor(() => screen.getByText('Lembretes desligados'));

    await fireEvent.press(screen.getByText('Lembretes desligados'));
    await waitFor(() => screen.getByText('Não foi possível salvar. Tente novamente.'));

    screen.getByText('Lembretes desligados');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('offers a retry when the preference cannot be read', async () => {
    const p = ports();
    p.preferences.get.mockRejectedValueOnce(new Error('offline'));
    const screen = await renderSettings(p);
    await waitFor(() => screen.getByText('Não foi possível carregar seus lembretes.'));

    await fireEvent.press(screen.getByText('Tentar novamente'));
    await waitFor(() => screen.getByText('Lembretes desligados'));
  });
});
