import type { NotificationIntent, NotificationSchedulerPort } from '@app/core';
import * as Notifications from 'expo-notifications';

/**
 * ADR-009 / D-22 — the only file in the app that knows `expo-notifications` exists. The domain
 * produces intents; this turns them into OS schedules and nothing else.
 *
 * Reconciliation is cancel-everything-then-schedule rather than a diff: the app owns every
 * notification it has scheduled, the intent set is small (≤ 28), and "replace the world" is the one
 * strategy that cannot drift. A stale reminder means telling her to do a care she already did, so
 * the simplest provably-correct approach wins over a cleverer one (FR8/G5).
 */
/**
 * SPEC-060 FR7 — ⚠️ **sem isto, no iPhone, um lembrete que dispara com a Huna aberta não aparece.**
 *
 * O iOS **suprime** a notificação local em primeiro plano quando o app não declara o contrário; o
 * Android a mostra. Ou seja: a SPEC-008 inteira — cinco intents, teto diário, reconciliação —
 * entregava **nada** no caso mais comum de todos, que é ela estar com o app aberto na hora do
 * cuidado, e nenhum teste veria. É a mesma família do defeito da SPEC-053, em que a rotina de óleo
 * lembrou zero vezes com o CI verde.
 *
 * Fica no escopo do módulo, e não dentro do factory: o handler precisa estar registrado **antes** de
 * qualquer notificação chegar, e o módulo é importado pelo bootstrap na abertura do app.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    // O app não usa contador no ícone: um número que ninguém zera vira ruído permanente.
    shouldSetBadge: false,
  }),
});

export const createLocalNotificationAdapter = (): NotificationSchedulerPort => ({
  async ensurePermission(): Promise<boolean> {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // `canAskAgain === false` means the user refused for good; asking again would do nothing.
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  },

  async reconcile(intents: readonly NotificationIntent[]): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    // Permission can be revoked in system settings long after she opted in (EC2). Cancelling first
    // and then bailing out leaves the device in the only honest state: nothing pending.
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    for (const intent of intents) {
      const [year, month, day] = intent.date.split('-').map(Number) as [number, number, number];
      const [hour, minute] = intent.time.split(':').map(Number) as [number, number];
      await Notifications.scheduleNotificationAsync({
        // The deterministic intent id doubles as the OS identifier (FR9), so the same state always
        // produces the same schedule and a replay cannot duplicate anything.
        identifier: intent.id,
        content: { title: intent.title, body: intent.body },
        // A local civil date-time: constructed in the device's own timezone, which is exactly the
        // timezone the intent's date and time are expressed in (ADR-008).
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(year, month - 1, day, hour, minute, 0, 0),
        },
      });
    }
  },
});
