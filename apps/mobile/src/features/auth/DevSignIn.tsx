import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design/primitives';
import { HIT_TARGET, color, radius, space } from '@/design/tokens';

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
      <Text variant="overline" tone="muted">
        Somente desenvolvimento (web)
      </Text>
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        disabled={busy}
        onPress={run}
        accessibilityRole="button"
      >
        <Text>{busy ? 'Entrando…' : 'Entrar como usuária de desenvolvimento'}</Text>
      </Pressable>
      {message ? (
        <Text accessibilityLiveRegion="polite" variant="caption" tone="danger">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.sm },
  // Dashed on purpose, and the only dashed border in the app: this must never be mistaken for a
  // product control. Everything else comes from the tokens, so it does not look like a different app
  // bolted onto the sign-in screen either.
  button: {
    padding: space.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: HIT_TARGET,
  },
  disabled: { opacity: 0.45 },
});
