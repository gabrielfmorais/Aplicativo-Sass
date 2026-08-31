import type { CareGuide } from '@app/core';
import { StyleSheet, View } from 'react-native';

import { Stack, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';

/**
 * SPEC-007 §14 — "Como fazer" for the care the user is looking at.
 *
 * Pure presentation over a constant from the app bundle: no fetch, so no loading, no error and no
 * retry state exists here, and the instructions work with the phone offline (§16). Rendered with
 * plain `<Text>` rather than markdown — one less dependency, and nothing user- or server-supplied
 * is ever interpreted (§11).
 *
 * The rule down the left edge is what makes it read as *inside* the care it belongs to rather than
 * as one more block on the page: this panel opens in place, and the indent is the only thing saying
 * so once the card around it is scrolled past.
 */
export function CareGuidePanel({ guide }: { guide: CareGuide }) {
  return (
    <View style={styles.panel}>
      <Text variant="caption" tone="faint">
        ~{guide.durationMin} min
      </Text>
      <Text>{guide.whatItIs}</Text>

      <Stack gap="xs">
        {guide.steps.map((step, index) => (
          <Text key={step}>
            {index + 1}. {step}
          </Text>
        ))}
      </Stack>

      <Stack gap="xs">
        <Text variant="caption" tone="muted">
          Erros comuns
        </Text>
        {guide.commonMistakes.map((mistake) => (
          <Text key={mistake} tone="muted">
            • {mistake}
          </Text>
        ))}
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    paddingVertical: space.sm,
    paddingLeft: space.md,
    borderLeftWidth: 2,
    borderLeftColor: color.border,
  },
});
