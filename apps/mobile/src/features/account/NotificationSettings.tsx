import type {
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Chip, Row, Stack, Text } from '@/design/primitives';

/**
 * Four fixed times instead of a picker: it covers the real cases in one tap and needs no new UI
 * dependency (SPEC-008 §14). A picker is design work this slice does not need.
 */
const TIMES = ['08:00', '12:00', '19:00', '21:00'] as const;

/**
 * SPEC-008 §14 — the reminder settings, on the account screen the app already has.
 *
 * Two things this screen must never do: claim reminders are on when the OS refused (FR2), and
 * reconcile against a preference that failed to save (§16). Both are why saving happens first and
 * the local state only follows a confirmed write.
 */
export function NotificationSettings({
  preferences: port,
  scheduler,
  onChanged,
}: {
  preferences: NotificationPreferencesPort;
  scheduler: NotificationSchedulerPort;
  /** Lets the route rebuild and reconcile the intents once the preference really changed. */
  onChanged: (preferences: NotificationPreferences) => void;
}) {
  const [prefs, setPrefs] = useState<NotificationPreferences | 'loading' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setPrefs('loading');
    let active = true;
    port
      .get()
      // No row yet means she has never opted in — that is "everything off", not an error (§16).
      .then((p) => active && setPrefs(p ?? DEFAULT_NOTIFICATION_PREFERENCES))
      .catch(() => active && setPrefs('error'));
    return () => {
      active = false;
    };
  }, [port]);
  useEffect(() => load(), [load]);

  if (prefs === 'loading') return <Text tone="muted">Carregando lembretes…</Text>;
  if (prefs === 'error') {
    return (
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Lembretes
        </Text>
        <Text tone="muted" accessibilityLiveRegion="polite">
          Não foi possível carregar seus lembretes.
        </Text>
        <Button label="Tentar novamente" variant="secondary" onPress={load} />
      </Card>
    );
  }

  const apply = (next: NotificationPreferences) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    const run = async () => {
      // Turning them on is the only step that can be refused by something outside the app.
      if (next.enabled && !prefs.enabled) {
        const granted = await scheduler.ensurePermission();
        if (!granted) {
          setMessage('As notificações estão bloqueadas nas configurações do sistema.');
          return;
        }
      }
      await port.save(next);
      setPrefs(next);
      onChanged(next);
    };

    void run()
      .catch(() => setMessage('Não foi possível salvar. Tente novamente.'))
      .finally(() => setBusy(false));
  };

  return (
    <Card>
      <Text variant="heading" accessibilityRole="header">
        Lembretes
      </Text>

      {/* Checkbox rather than button-with-selected: this is a thing that is on or off, and that is
          what a screen reader should hear. The visible label still says which. */}
      <Row gap="sm">
        <Chip
          label={prefs.enabled ? 'Lembretes ligados' : 'Lembretes desligados'}
          selected={prefs.enabled}
          multi
          disabled={busy}
          onPress={() => apply({ ...prefs, enabled: !prefs.enabled })}
        />
      </Row>

      {prefs.enabled ? (
        <Stack gap="sm">
          <Text variant="overline" tone="muted">
            Horário
          </Text>
          {/* One choice out of four — radios, which is what `multi={false}` gives. */}
          <Row gap="sm">
            {TIMES.map((time) => (
              <Chip
                key={time}
                label={time}
                selected={prefs.reminderTimeLocal === time}
                disabled={busy}
                onPress={() => apply({ ...prefs, reminderTimeLocal: time })}
              />
            ))}
          </Row>

          <Row gap="sm">
            <Chip
              label="Lembrar do check-in"
              selected={prefs.checkinReminderEnabled}
              multi
              disabled={busy}
              onPress={() => apply({ ...prefs, checkinReminderEnabled: !prefs.checkinReminderEnabled })}
            />
          </Row>
        </Stack>
      ) : null}

      {message ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {message}
        </Text>
      ) : null}
    </Card>
  );
}
