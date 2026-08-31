import type { CareBoard, CareItem, CareTrackingPort, Instant, LocalDate } from '@app/core';
import { CARE_GUIDES, CHECKIN_SCALE, buildProgress, buildTodayView, canCheckIn, canUndo } from '@app/core';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CareGuidePanel } from '@/features/care/CareGuidePanel';
import { ProgressSummary } from '@/features/care/ProgressSummary';
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

type Action =
  | { kind: 'complete' | 'skip' | 'undo' }
  | { kind: 'reschedule'; days: number }
  | { kind: 'checkin'; feel: number };

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
  const [showGuide, setShowGuide] = useState(false);
  const undoable = item.execution !== null && canUndo(item.execution, now);
  // A care type the app has no guide for cannot happen today (the DB CHECK pins the set, and the
  // guides are exhaustive by type). If it ever did, the row simply loses the button (SPEC-007 EC1).
  const guide = CARE_GUIDES[item.careTypeCode];

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
        <>
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
          {item.checkIn ? (
            <Text style={styles.resolved}>{`Você marcou: ${item.checkIn.overallFeel}/5`}</Text>
          ) : canCheckIn(item) ? (
            // SPEC-006 §14 — one question, one tap, on the care she just finished. No navigation:
            // taking her off this screen is the friction G1 exists to remove.
            <View style={styles.checkin}>
              <Text style={styles.checkinTitle}>Como ficou?</Text>
              <View style={styles.actions}>
                {CHECKIN_SCALE.map((feel) => (
                  <Pressable
                    key={feel}
                    style={[styles.action, busy && styles.disabled]}
                    disabled={busy}
                    onPress={() => onAct(item, { kind: 'checkin', feel })}
                    accessibilityRole="button"
                    accessibilityLabel={`${feel} de 5`}
                  >
                    <Text>{feel}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.scaleHint}>1 = nada bom · 5 = muito bom</Text>
            </View>
          ) : null}
        </>
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
            {guide ? (
              // Never disabled by `busy`: reading how to do the care is not a write, so an action
              // in flight must not block it (SPEC-007 FR6/EC3).
              <Pressable
                style={styles.action}
                onPress={() => setShowGuide((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showGuide }}
              >
                <Text>Como fazer</Text>
              </Pressable>
            ) : null}
          </View>
          {showGuide && guide ? <CareGuidePanel guide={guide} /> : null}
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
  onReassess,
}: {
  board: CareBoard;
  care: CareTrackingPort;
  today: LocalDate;
  now: () => Instant;
  timeZone: string;
  newExecutionId: () => string;
  onChanged: () => void;
  onOpenAccount: () => void;
  /**
   * D-82 — the way out of a finished cycle. Present whenever there is an active plan, which is the
   * only situation this screen renders in; it is optional so a test can render the screen without
   * asserting on navigation.
   */
  onReassess?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // One idempotency key per care per user intent: reused on retry so a lost response cannot
  // produce a second execution (AC14). Cleared once the care is recorded.
  const [keys] = useState(() => new Map<string, string>());

  const view = useMemo(
    () => buildTodayView(board.cares, board.executions, today, board.checkIns),
    [board, today],
  );
  const progress = useMemo(() => buildProgress(view, board.lifetimeDoneCount), [view, board]);
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
        case 'checkin': {
          if (!item.execution) return Promise.resolve();
          // Same per-intent key discipline as completing: a retry after a lost response must not
          // produce a second check-in (SPEC-006 FR6/AC14).
          const key = keys.get(`ck:${item.id}`) ?? newExecutionId();
          keys.set(`ck:${item.id}`, key);
          return care
            .submitCheckIn({
              careExecutionId: item.execution.id,
              overallFeel: action.feel,
              clientCheckinId: key,
            })
            .then(() => keys.delete(`ck:${item.id}`));
        }
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

  // Nothing left in the plan — either its four weeks elapsed, or she settled every remaining care
  // early. Until D-82 this was a dead end: the screen said so and offered nothing, so the product
  // simply went quiet. The copy below covers both ways of getting here, which is why it talks about
  // the plan being empty rather than about four weeks having passed.
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
      {nothingLeft && onReassess ? (
        <View style={styles.cycleEnd}>
          <Text style={styles.cycleEndText}>
            Não sobrou nenhum cuidado no seu cronograma atual. Reavaliar seu cabelo monta as próximas semanas
            a partir de como ele está agora — o que você já registrou continua salvo.
          </Text>
          <Pressable style={styles.cycleEndButton} onPress={onReassess} accessibilityRole="button">
            <Text>Reavaliar e montar o próximo</Text>
          </Pressable>
        </View>
      ) : null}

      {/* After the actionable sections and before the detail: she settles the day first, then
          sees the accumulated summary, which reads naturally as a preface to the history. */}
      <ProgressSummary progress={progress} />

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
  cycleEnd: { gap: 8, paddingVertical: 8 },
  cycleEndText: { fontSize: 14, lineHeight: 20 },
  cycleEndButton: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
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
  checkin: { gap: 6, paddingTop: 4 },
  checkinTitle: { fontSize: 14, fontWeight: '600' },
  scaleHint: { fontSize: 12, opacity: 0.7 },
  resolved: { fontSize: 14, opacity: 0.7 },
  empty: { fontSize: 14, opacity: 0.7 },
  message: { color: '#b00020' },
});
