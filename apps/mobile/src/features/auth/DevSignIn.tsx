import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * DEV-ONLY entry into the browser preview (D-85). Rendered **beside** `SignInScreen`, never inside
 * it: the official Apple / Google / email flows are not touched by a single line, and deleting this
 * feature is deleting this file plus the one line that renders it.
 *
 * It is labelled as what it is. A developer looking at the preview should never wonder whether this
 * is something a user could see — in a build where a user could see it, it does not exist
 * (`createDevSignIn` returns null; see the four guards there).
 */
export function DevSignIn({ onPress }: { onPress: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const run = () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    onPress()
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : 'Não foi possível entrar com o acesso de desenvolvimento.',
        ),
      )
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Somente desenvolvimento (web)</Text>
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={run}
        accessibilityRole="button"
      >
        <Text>{busy ? 'Entrando…' : 'Entrar como usuária de desenvolvimento'}</Text>
      </Pressable>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24, paddingBottom: 24, gap: 8 },
  label: { fontSize: 12, opacity: 0.6, textTransform: 'uppercase', letterSpacing: 1 },
  button: {
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
  },
  disabled: { opacity: 0.6 },
  message: { fontSize: 13, lineHeight: 18 },
});
