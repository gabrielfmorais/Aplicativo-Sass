import type { Progress } from '@app/core';
import { StyleSheet, Text, View } from 'react-native';

/**
 * SPEC-009 §14 — three facts, in words, about what she actually recorded.
 *
 * Deliberately not a dashboard: no percentage, no score, no trend arrow, no chart. A fraction is
 * exact and cannot be over-read; "73%" from four cares invites a conclusion the data does not
 * support (§2). Every line names its scope ("neste plano") and the rating is labelled as her own
 * answer, so observed and inferred never blur (BR6/BR7).
 */
export function ProgressSummary({ progress }: { progress: Progress }) {
  const { elapsed, done, skipped, checkInCount, averageFeel } = progress;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        Seu progresso
      </Text>

      {elapsed === 0 ? (
        <Text style={styles.line}>
          Seu plano começou agora. O resumo aparece conforme você registra os cuidados.
        </Text>
      ) : (
        <>
          <Text style={styles.line}>
            {`Neste plano, você concluiu ${done} de ${elapsed} cuidados até aqui.`}
          </Text>
          {skipped > 0 ? (
            <Text style={styles.line}>{skipped > 1 ? `Pulou ${skipped}.` : 'Pulou 1.'}</Text>
          ) : null}
        </>
      )}

      {checkInCount > 0 ? (
        <Text style={styles.line}>
          {averageFeel === null
            ? `Você avaliou ${checkInCount} ${checkInCount > 1 ? 'cuidados' : 'cuidado'}.`
            : `Você avaliou ${checkInCount} cuidados · média ${averageFeel.toFixed(1).replace('.', ',')} de 5 (sua avaliação).`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 6, paddingTop: 4 },
  title: { fontSize: 16, fontWeight: '600' },
  line: { fontSize: 14, lineHeight: 20 },
});
