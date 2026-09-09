/**
 * ⚠️ **SPEC-060 FR7/AC6 — o defeito que este teste protege é silencioso e é iPhone-only.**
 *
 * O iOS **suprime** a notificação local em primeiro plano quando o app não declara um handler; o
 * Android a mostra. Sem `setNotificationHandler`, a SPEC-008 inteira — cinco intents, teto diário,
 * reconciliação, todas as suítes verdes — entregava **nada** no caso mais comum de todos: ela estar
 * com a Huna aberta na hora do cuidado.
 *
 * É a mesma família do defeito que a SPEC-053 mediu, em que a rotina de óleo lembrou zero vezes com
 * o CI verde: a peça existe, a ligação não.
 */

const mockSetNotificationHandler = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: mockSetNotificationHandler,
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

describe('SPEC-060 — lembrete com o app aberto aparece no iPhone', () => {
  it('o módulo registra o handler ao ser importado, antes de qualquer notificação chegar', async () => {
    // Importar o módulo é o gatilho: o handler mora no escopo do módulo, e não dentro do factory,
    // porque precisa estar de pé antes de a primeira notificação disparar.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/infrastructure/notifications/local-notification-adapter');

    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);

    const [{ handleNotification }] = mockSetNotificationHandler.mock.calls[0] as [
      { handleNotification: () => Promise<Record<string, boolean>> },
    ];
    const behaviour = await handleNotification();

    // O que "aparecer" significa no iOS: banner na hora e linha na central de notificações.
    expect(behaviour.shouldShowBanner).toBe(true);
    expect(behaviour.shouldShowList).toBe(true);
    expect(behaviour.shouldPlaySound).toBe(true);
    // ⛔ O contador do ícone continua desligado: um número que ninguém zera vira ruído permanente.
    expect(behaviour.shouldSetBadge).toBe(false);
  });
});
