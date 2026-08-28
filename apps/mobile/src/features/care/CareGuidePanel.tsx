import type { CareGuide } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

/**
 * SPEC-007 §14 — "Como fazer" for the care the user is looking at.
 *
 * Pure presentation over a constant from the app bundle: no fetch, so no loading, no error and no
 * retry state exists here, and the instructions work with the phone offline (§16). Rendered with
 * plain `<Text>` rather than markdown — one less dependency, and nothing user- or server-supplied
 * is ever interpreted (§11).
 */
export function CareGuidePanel({ guide }: { guide: CareGuide }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.duration}>~{guide.durationMin} min</Text>
      <Text style={styles.what}>{guide.whatItIs}</Text>

      <View style={styles.block}>
        {guide.steps.map((step, index) => (
          <Text key={step} style={styles.step}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>

      <View style={styles.block}>
        <Text style={styles.mistakesTitle}>Erros comuns</Text>
        {guide.commonMistakes.map((mistake) => (
          <Text key={mistake} style={styles.mistake}>
            • {mistake}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 8, paddingVertical: 10, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#d1d1d6' },
  duration: { fontSize: 13, fontWeight: '600', opacity: 0.8 },
  what: { fontSize: 14, lineHeight: 20 },
  block: { gap: 4 },
  step: { fontSize: 14, lineHeight: 20 },
  mistakesTitle: { fontSize: 13, fontWeight: '600' },
  mistake: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
});
