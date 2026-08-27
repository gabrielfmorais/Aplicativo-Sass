import type { CareBoard, CareItem, CareTrackingPort, Instant, LocalDate } from '@app/core';
import { buildTodayView, canUndo } from '@app/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CARE_TYPE_LABEL, formatPlannedDate } from '@/features/plan/copy';

/**
 * Quick reschedule targets. All fall inside the approved window (today … today+28, BR8); a real
 * date picker is design work this slice does not need (SPEC-005 §14, minimal functional UI).
 */
const RESCHEDULE_OPTIONS = [
  { days: 1, label: 'Amanhã' },
  { days: 3, label: 'Em 3 dias' },
  { days: 7, label: 'Em 7 dias' },
] as const;

const addDaysIso = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

type Action = { kind: 'complete' | 'skip' | 'undo' } | { kind: 'reschedule'; days: number };

function CareRow({
  item,
  today,
  now,
  busy,
  onAct,
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  busy: boolean;
  onAct: (item: CareItem, action: Action) => void;
}) {
  const [choosingDate, setChoosingDate] = useState(false);
  const undoable = item.execution !== null && canUndo(item.execution, now);

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.care}>{CARE_TYPE_LABEL[item.careTypeCode]}</Text>
        <Text style={styles.date}>
          {formatPlannedDate(item.plannedDate)}
          {item.outcome === 'overdue'
            ? ` · atrasada há ${item.daysLate} dia${item.daysLate > 1 ? 's' : ''}`
            : ''}
        </Text>
      </View>

      {item.outcome === 'done' ? (
        <View style={styles.actions}>
          <Text style={styles.doneMark}>Feito</Text>
          {undoable ? (
            <Pressable
              style={styles.action}
              disabled={busy}
              onPress={() => onAct(item, { kind: 'undo' })}
              accessibilityRole="button"
            >
              <Text>Desfazer</Text>
            </Pressable>
          ) : null}
        </View>
      ) : item.outcome === 'skipped' ? (
        <Text style={styles.resolved}>Pulado</Text>
      ) : item.outcome === 'rescheduled' ? (
        <Text style={styles.resolved}>Reagendado</Text>
      ) : (
        <>
          <View style={styles.actions}>
            <Pressable
              style={[styles.action, styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={() => onAct(item, { kind: 'complete' })}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Fiz hoje</Text>
            </Pressable>
            <Pressable
              style={[styles.action, busy && styles.disabled]}
              disabled={busy}
              onPress={() => setChoosingDate((v) => !v)}
              accessibilityRole="button"
            >
              <Text>Reagendar</Text>
            </Pressable>
            <Pressable
              style={[styles.action, busy && styles.disabled]}
              disabled={busy}
              onPress={() => onAct(item, { kind: 'skip' })}
              accessibilityRole="button"
            >
              <Text>Pular</Text>
            </Pressable>
          </View>
          {choosingDate ? (
            <View style={styles.actions}>
              {RESCHEDULE_OPTIONS.map((option) => (
                <Pressable
                  key={option.days}
                  style={[styles.action, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => {
                    setChoosingDate(false);
                    onAct(item, { kind: 'reschedule', days: option.days });
                  }}
                  accessibilityRole="button"
                >
                  <Text>
                    {option.label} ({formatPlannedDate(addDaysIso(today, option.days))})
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function Section({
  title,
  items,
  empty,
  ...rest
}: {
  title: string;
  items: readonly CareItem[];
  empty?: string;
  today: LocalDate;
  now: Instant;
  busyId: string | null;
  onAct: (item: CareItem, action: Action) => void;
}) {
  if (items.length === 0 && !empty) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        items.map((item) => (
          <CareRow
            key={item.id}
            item={item}
            today={rest.today}
            now={rest.now}
            busy={rest.busyId === item.id}
            onAct={rest.onAct}
          />
        ))
      )}
    </View>
  );
}

/**
 * SPEC-005 §14 — the daily loop: what is late, what is due today, what comes next.
 *
 * Every state on screen is derived by `buildTodayView` from the plan's cares plus the executions
 * recorded against them: nothing here reads a "completed" or "overdue" column, because neither
 * exists (D-69 §8.2). An action that the server refuses because the care moved on reloads the board
 * and shows the truth, instead of arguing with the user.
 */
export function TodayScreen({
  board,
  care,
  today,
  now,
  timeZone,
  newExecutionId,
  onChanged,
  onOpenAccount,
}: {
  board: CareBoard;
  care: CareTrackingPort;
  today: LocalDate;
  now: () => Instant;
  timeZone: string;
  newExecutionId: () => string;
  onChanged: () => void;
  onOpenAccount: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // One idempotency key per care per user intent: reused on retry so a lost response cannot
  // produce a second execution (AC14). Cleared once the care is recorded.
  const [keys] = useState(() => new Map<string, string>());

  const view = useMemo(() => buildTodayView(board.cares, board.executions, today), [board, today]);
  const renderedNow = now();

  const act = (item: CareItem, action: Action) => {
    if (busyId) return; // one transition at a time; also the double-tap guard
    setBusyId(item.id);
    setMessage(null);

    const run = (): Promise<unknown> => {
      switch (action.kind) {
        case 'complete': {
          const key = keys.get(item.id) ?? newExecutionId();
          keys.set(item.id, key);
          return care
            .complete({ scheduledCareId: item.id, clientExecutionId: key, timeZone })
            .then(() => keys.delete(item.id));
        }
        case 'skip':
          return care.skip(item.id);
        case 'reschedule':
          return care.reschedule({
            scheduledCareId: item.id,
            newDate: addDaysIso(today, action.days),
            timeZone,
          });
        case 'undo':
          return item.execution ? care.undo(item.execution.id) : Promise.resolve();
      }
    };

    run()
      .then(onChanged)
      .catch((error: unknown) => {
        // A conflict means the screen was stale: reload and show the real state (§16).
        if ((error as { kind?: string })?.kind === 'conflict') {
          setMessage('Esse cuidado mudou. Atualizamos a tela.');
          onChanged();
          return;
        }
        setMessage('Não foi possível registrar. Tente novamente.');
      })
      .finally(() => setBusyId(null));
  };

  const nothingLeft = view.overdue.length === 0 && view.today.length === 0 && view.upcoming.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Seus cuidados
      </Text>

      <Section
        title="Atrasados"
        items={view.overdue}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
      />
      <Section
        title="Hoje"
        items={view.today}
        empty={nothingLeft ? 'Seu cronograma chegou ao fim.' : 'Nenhum cuidado hoje.'}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
      />
      <Section
        title="Próximos"
        items={view.upcoming}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
      />
      <Section
        title="Histórico"
        items={view.history}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
      />

      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}

      <Pressable style={styles.action} onPress={onOpenAccount} accessibilityRole="button">
        <Text>Sua conta</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 20 },
  title: { fontSize: 24, fontWeight: '600' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  row: { gap: 8, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  rowHead: { gap: 2 },
  care: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 13, opacity: 0.8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  action: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#1c1c1e', borderColor: '#1c1c1e' },
  primaryText: { color: '#fff', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  doneMark: { fontSize: 14, fontWeight: '600' },
  resolved: { fontSize: 14, opacity: 0.7 },
  empty: { fontSize: 14, opacity: 0.7 },
  message: { color: '#b00020' },
});
