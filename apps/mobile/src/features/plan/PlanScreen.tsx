import type { HairPlan, HairPlanPort, HairProfileSnapshot, LocalDate, PlanDraft } from '@app/core';
import { buildPlan } from '@app/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
 */
export function PlanScreen({
  profile,
  plans,
  today,
  newRequestId,
  onOpenAccount,
}: {
  profile: HairProfileSnapshot;
  plans: HairPlanPort;
  today: LocalDate;
  newRequestId: () => string;
  onOpenAccount: () => void;
}) {
  // 'loading' → reading; 'error' → read failed (retry); null → no plan yet (preview); plan → active.
  const [plan, setPlan] = useState<'loading' | 'error' | HairPlan | null>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // One id per user intent: reused across retries so the server call stays idempotent.
  const requestId = useRef<string | null>(null);

  const load = useCallback(() => {
    setPlan('loading');
    plans
      .getActive()
      .then(setPlan)
      .catch(() => setPlan('error'));
  }, [plans]);
  useEffect(load, [load]);

  const draft = useMemo(() => buildPlan(profile, today), [profile, today]);

  const confirm = () => {
    if (submitting) return; // double-submit guard on top of the server-side idempotency
    requestId.current ??= newRequestId();
    setSubmitting(true);
    setMessage(null);
    plans
      .generate({ clientRequestId: requestId.current, startsOn: today })
      .then((created) => {
        requestId.current = null;
        setPlan(created);
      })
      .catch(() => setMessage('Não foi possível criar seu cronograma. Tente novamente.'))
      .finally(() => setSubmitting(false));
  };

  if (plan === 'loading') return null;

  if (plan === 'error') {
    return (
      <View style={styles.center}>
        <Text accessibilityLiveRegion="polite">Não foi possível carregar seu cronograma.</Text>
        <Pressable style={styles.secondary} onPress={load} accessibilityRole="button">
          <Text>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  const previewing = plan === null;
  const items: Item[] = previewing
    ? draft.cares.map((c, i) => ({ key: `${c.plannedDate}-${i}`, ...c }))
    : plan.cares.map((c) => ({ key: c.id, careTypeCode: c.careTypeCode, plannedDate: c.plannedDate }));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {previewing ? 'Este é o seu cronograma' : 'Seu cronograma'}
      </Text>

      <Assessment draft={draft} />

      <View style={styles.block}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Próximas 4 semanas
        </Text>
        <Schedule items={items} />
      </View>

      {previewing ? (
        <Pressable
          style={[styles.primary, submitting && styles.disabled]}
          disabled={submitting}
          onPress={confirm}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>{submitting ? 'Criando…' : 'Começar meu cronograma'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.confirmed} accessibilityLiveRegion="polite">
          Cronograma ativo desde {formatPlannedDate(plan.startsOn)}.
        </Text>
      )}

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}

      <Pressable style={styles.secondary} onPress={onOpenAccount} accessibilityRole="button">
        <Text>Sua conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20 },
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
