import type {
  AuthPort,
  DeletionRequestPort,
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
} from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NotificationSettings } from '@/features/account/NotificationSettings';

/**
 * Authenticated home for SPEC-001: logout and the account-deletion request contract (FR5/FR6).
 * Product screens arrive with later SPECs. Session behaviour after a request is not decided (D-60).
 */
export function AccountScreen({
  auth,
  deletion,
  notificationPreferences,
  notificationScheduler,
  onNotificationPreferencesChanged,
}: {
  auth: AuthPort;
  deletion: DeletionRequestPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  onNotificationPreferencesChanged: (preferences: NotificationPreferences) => void;
}) {
  const [requestedAt, setRequestedAt] = useState<string | null | 'loading'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      deletion
        .current()
        .then((r) => setRequestedAt(r?.requestedAt ?? null))
        .catch(() => setMessage('Não foi possível carregar sua conta.')),
    [deletion],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = (op: () => Promise<void>, fallback: string) =>
    void op()
      .then(refresh)
      .catch(() => setMessage(fallback));

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Sua conta
      </Text>

      <NotificationSettings
        preferences={notificationPreferences}
        scheduler={notificationScheduler}
        onChanged={onNotificationPreferencesChanged}
      />

      {requestedAt === 'loading' ? (
        <Text>Carregando…</Text>
      ) : requestedAt ? (
        <>
          <Text accessibilityLiveRegion="polite">
            Exclusão da conta solicitada em {new Date(requestedAt).toLocaleDateString()}. Você pode cancelar o
            pedido.
          </Text>
          <Pressable
            style={styles.button}
            onPress={() => act(deletion.cancel, 'Não foi possível cancelar.')}
            accessibilityRole="button"
          >
            <Text>Cancelar exclusão</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={styles.button}
          onPress={() => act(deletion.request, 'Não foi possível solicitar.')}
          accessibilityRole="button"
        >
          <Text>Solicitar exclusão da conta</Text>
        </Pressable>
      )}
      <Pressable
        style={styles.button}
        onPress={() => act(auth.signOut, 'Não foi possível sair.')}
        accessibilityRole="button"
      >
        <Text>Sair</Text>
      </Pressable>
      {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  button: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
});
