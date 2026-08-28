import type { HairPlanPort, HairProfileSnapshot, LocalDate, PlanDraft } from '@app/core';
import { buildPlan } from '@app/core';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CARE_TYPE_LABEL, EVIDENCE_LABEL, formatPlannedDate } from './copy';

type Item = { key: string; careTypeCode: keyof typeof CARE_TYPE_LABEL; plannedDate: string };

function Schedule({ items }: { items: readonly Item[] }) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Nenhum cuidado programado ainda.</Text>;
  }
  return (
    <View style={styles.list}>
      {items.map((c) => (
        <View key={c.key} style={styles.row}>
          <Text style={styles.rowDate}>{formatPlannedDate(c.plannedDate)}</Text>
          <Text style={styles.rowCare}>{CARE_TYPE_LABEL[c.careTypeCode]}</Text>
        </View>
      ))}
    </View>
  );
}

function Assessment({ draft }: { draft: PlanDraft }) {
  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        Sua avaliação capilar
      </Text>
      <Text style={styles.disclaimer}>
        Uma leitura cosmética das suas respostas para montar o cronograma — não é diagnóstico médico.
      </Text>
      {draft.evidenceCodes.map((code) => (
        <Text key={code} style={styles.evidence}>
          • {EVIDENCE_LABEL[code] ?? code}
        </Text>
      ))}
    </View>
  );
}

/**
 * SPEC-004 §5 — the first loop of perceived value: assessment + schedule in one screen.
 *
 * The preview runs the very same `buildPlan` from @app/core that the `generate-plan` Edge Function
 * runs, so what she confirms is what gets persisted (AC3). Confirming calls the server, which is the
 * only thing that can create a plan. Retrying reuses the same `clientRequestId`, so a failed or lost
 * response can never produce a second plan or a spurious supersede (AC9).
 *
 * Shown only while there is no active plan: the route loads the board once and renders the daily
 * screen instead as soon as one exists (SPEC-005).
 */
export function PlanScreen({
  profile,
  plans,
  today,
  newRequestId,
  onCreated,
  onOpenAccount,
  onCancel,
}: {
  profile: HairProfileSnapshot;
  plans: HairPlanPort;
  today: LocalDate;
  newRequestId: () => string;
  onCreated: () => void;
  onOpenAccount?: () => void;
  /**
   * Present only when this preview is replacing an active plan (SPEC-014). Its presence is what
   * makes the screen say so and offer a way out — the same screen, told what it is doing.
   */
  onCancel?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // One id per user intent: reused across retries so the server call stays idempotent.
  const requestId = useRef<string | null>(null);

  const draft = useMemo(() => buildPlan(profile, today), [profile, today]);

  const confirm = () => {
    if (submitting) return; // double-submit guard on top of the server-side idempotency
    requestId.current ??= newRequestId();
    setSubmitting(true);
    setMessage(null);
    plans
      .generate({ clientRequestId: requestId.current, startsOn: today })
      .then(() => {
        requestId.current = null;
        onCreated();
      })
      .catch(() => setMessage('Não foi possível criar seu cronograma. Tente novamente.'))
      .finally(() => setSubmitting(false));
  };

  const items: Item[] = draft.cares.map((c, i) => ({ key: `${c.plannedDate}-${i}`, ...c }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Este é o seu cronograma
      </Text>

      <Assessment draft={draft} />

      <View style={styles.block}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Próximas 4 semanas
        </Text>
        <Schedule items={items} />
      </View>

      {onCancel ? (
        <Text style={styles.replaceWarning}>
          Confirmar substitui seu cronograma atual. Seu histórico continua salvo.
        </Text>
      ) : null}

      <Pressable
        style={[styles.primary, submitting && styles.disabled]}
        disabled={submitting}
        onPress={confirm}
        accessibilityRole="button"
      >
        <Text style={styles.primaryText}>
          {submitting ? 'Criando…' : onCancel ? 'Confirmar novo cronograma' : 'Começar meu cronograma'}
        </Text>
      </Pressable>

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}

      {onCancel ? (
        <Pressable
          style={styles.secondary}
          disabled={submitting}
          onPress={onCancel}
          accessibilityRole="button"
        >
          <Text>Cancelar</Text>
        </Pressable>
      ) : onOpenAccount ? (
        <Pressable style={styles.secondary} onPress={onOpenAccount} accessibilityRole="button">
          <Text>Sua conta</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20 },
  replaceWarning: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  block: { gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 13, opacity: 0.7 },
  evidence: { fontSize: 14 },
  list: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowDate: { fontSize: 14, opacity: 0.8 },
  rowCare: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 14, opacity: 0.7 },
  primary: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: '#1c1c1e',
  },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
  disabled: { opacity: 0.4 },
  confirmed: { fontSize: 14 },
  message: { color: '#b00020' },
});
