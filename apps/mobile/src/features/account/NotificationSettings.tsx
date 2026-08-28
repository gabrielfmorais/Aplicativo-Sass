import type {
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

  if (prefs === 'loading') return <Text>Carregando lembretes…</Text>;
  if (prefs === 'error') {
    return (
      <View style={styles.section}>
        <Text accessibilityLiveRegion="polite">Não foi possível carregar seus lembretes.</Text>
        <Pressable style={styles.option} onPress={load} accessibilityRole="button">
          <Text>Tentar novamente</Text>
        </Pressable>
      </View>
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
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Lembretes
      </Text>

      <Pressable
        style={[styles.option, prefs.enabled && styles.selected, busy && styles.disabled]}
        disabled={busy}
        onPress={() => apply({ ...prefs, enabled: !prefs.enabled })}
        accessibilityRole="button"
        accessibilityState={{ selected: prefs.enabled }}
      >
        <Text>{prefs.enabled ? 'Lembretes ligados' : 'Lembretes desligados'}</Text>
      </Pressable>

      {prefs.enabled ? (
        <>
          <Text style={styles.label}>Horário</Text>
          <View style={styles.row}>
            {TIMES.map((time) => (
              <Pressable
                key={time}
                style={[
                  styles.option,
                  prefs.reminderTimeLocal === time && styles.selected,
                  busy && styles.disabled,
                ]}
                disabled={busy}
                onPress={() => apply({ ...prefs, reminderTimeLocal: time })}
                accessibilityRole="button"
                accessibilityState={{ selected: prefs.reminderTimeLocal === time }}
              >
                <Text>{time}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.option, prefs.checkinReminderEnabled && styles.selected, busy && styles.disabled]}
            disabled={busy}
            onPress={() => apply({ ...prefs, checkinReminderEnabled: !prefs.checkinReminderEnabled })}
            accessibilityRole="button"
            accessibilityState={{ selected: prefs.checkinReminderEnabled }}
          >
            <Text>Lembrar do check-in</Text>
          </Pressable>
        </>
      ) : null}

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, opacity: 0.8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  selected: { borderWidth: 2 },
  disabled: { opacity: 0.4 },
  message: { color: '#b00020' },
});
