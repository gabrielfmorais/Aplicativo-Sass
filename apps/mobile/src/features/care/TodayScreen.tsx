import type {
  CareBoard,
  CareItem,
  CareTrackingPort,
  HairProfilePort,
  Instant,
  LocalDate,
  ResumeOutcome,
} from '@app/core';
import { CARE_GUIDES, CHECKIN_SCALE, buildProgress, buildTodayView, canCheckIn, canUndo } from '@app/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Row, Screen, Stack, Tag, Text } from '@/design/primitives';
import { HIT_TARGET_MIN, color, radius, space } from '@/design/tokens';
import { CareGuidePanel } from '@/features/care/CareGuidePanel';
import { CareTypeMark } from '@/features/care/CareTypeMark';
import { PauseCard } from '@/features/care/PauseCard';
import { PlanRationale } from '@/features/care/PlanRationale';
import { ProgressSummary } from '@/features/care/ProgressSummary';
import { WeekStrip } from '@/features/care/WeekStrip';
import { buildWeek } from '@/features/care/week';
import { CARE_TYPE_LABEL, formatPlannedDate } from '@/features/plan/copy';
import { reasonOf } from '@/shared/failure-detail';

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

/**
 * SPEC-024 — tudo o que um cartão precisa saber sobre o registro do Wash Day: se aquela execução já
 * tem um (FR7) e como abrir o dela. Nada além disso atravessa a tela — o conteúdo do registro é da
 * `WashDayScreen`, e trazê-lo até aqui só para contar chips seria uma segunda verdade sobre o
 * mesmo fato.
 */
type WashDayAccess = {
  registered: (careExecutionId: string) => boolean;
  open: (item: CareItem) => void;
};

/** The planned day, plus how late it is when it is late — the same sentence, wherever it appears. */
const whenOf = (item: CareItem): string =>
  item.outcome === 'overdue'
    ? `${formatPlannedDate(item.plannedDate)} · atrasada há ${item.daysLate} dia${item.daysLate > 1 ? 's' : ''}`
    : formatPlannedDate(item.plannedDate);

/**
 * The state of a care, always as a word. Colour is the second channel, never the only one.
 *
 * `planned` has no tag: in the focus card it is always today's care and reads "Hoje"; in a list it
 * is an upcoming care whose date is printed right underneath. A "Planejado" chip would say nothing
 * either place, so it is not produced at all.
 */
const stateTagOf = (item: CareItem): { label: string; tone: 'danger' | 'success' | 'neutral' } | null => {
  switch (item.outcome) {
    case 'overdue':
      return { label: 'Atrasado', tone: 'danger' };
    case 'done':
      return { label: 'Feito', tone: 'success' };
    case 'skipped':
      return { label: 'Pulado', tone: 'neutral' };
    case 'rescheduled':
      return { label: 'Reagendado', tone: 'neutral' };
    case 'planned':
      return null;
  }
};

// -------------------------------------------------------------------------------------- check-in

/**
 * SPEC-006 §14 — one question, one tap, on the care she just finished. No navigation: taking her off
 * this screen is the friction G1 exists to remove.
 */
function CheckInPrompt({ blocked, onAnswer }: { blocked: boolean; onAnswer: (feel: number) => void }) {
  return (
    <Stack gap="sm">
      <Text variant="bodyStrong">Como ficou?</Text>
      <Row gap="sm">
        {CHECKIN_SCALE.map((feel) => (
          <Pressable
            key={feel}
            disabled={blocked}
            onPress={() => onAnswer(feel)}
            accessibilityRole="button"
            accessibilityLabel={`${feel} de 5`}
            accessibilityState={{ disabled: blocked }}
            style={({ pressed }) => [
              styles.feel,
              pressed && !blocked && styles.feelPressed,
              blocked && styles.off,
            ]}
          >
            <Text variant="bodyStrong">{feel}</Text>
          </Pressable>
        ))}
      </Row>
      <Text variant="caption" tone="muted">
        1 = nada bom · 5 = muito bom
      </Text>
    </Stack>
  );
}

// ------------------------------------------------------------------------------------- care body

/**
 * Everything a care offers, minus its heading — shared by the focus card and the list cards so the
 * two can never drift apart in what they allow. `emphasis` decides only how loud "Fiz hoje" is:
 * exactly one button on this screen is the primary one, and it belongs to the focus.
 */
function CareActions({
  item,
  today,
  now,
  busy,
  blocked,
  emphasis,
  onAct,
  washDay,
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  /** This care is the one in flight — it is what shows the spinner. */
  busy: boolean;
  /**
   * *Some* care is in flight. `act` allows one transition at a time for the whole screen, so every
   * write on every card must look refused while one runs: a button that stays lit and then silently
   * does nothing is worse than a disabled one, because she cannot tell which of the two happened.
   * Reading stays open — "Como fazer" is never blocked (SPEC-007 FR6/EC3).
   */
  blocked: boolean;
  emphasis: 'focus' | 'list';
  onAct: (item: CareItem, action: Action) => void;
  /** SPEC-024 — o registro do que ela usou, oferecido depois de concluir (FR1). */
  washDay: WashDayAccess;
}) {
  const [choosingDate, setChoosingDate] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const undoable = item.execution !== null && canUndo(item.execution, now);
  // A care type the app has no guide for cannot happen today (the DB CHECK pins the set, and the
  // guides are exhaustive by type). If it ever did, the card simply loses the button (SPEC-007 EC1).
  const guide = CARE_GUIDES[item.careTypeCode];

  if (item.outcome === 'done') {
    /**
     * SPEC-024 FR1/FR7 — o registro do que ela usou, **oferecido** e nunca exigido, e a evidência de
     * que ele existe. Nunca bloqueado por uma transição em voo: é navegação, não escrita, como
     * "Como fazer" (SPEC-007 EC3).
     *
     * **O rótulo é o fato, e não uma frase ao lado dele.** "Você registrou o que usou" seria falso
     * no único caso que a SPEC prevê explicitamente: ela abre, desmarca tudo e sai (EC4). O board
     * carrega quais execuções **têm** registro, nunca o que tem dentro — então afirmar conteúdo aqui
     * seria afirmar o que esta tela não sabe. Dizer o contrário, um convite quando não há registro,
     * seria cobrança, que AC8 proíbe.
     */
    const registered = item.execution !== null && washDay.registered(item.execution.id);
    return (
      <Stack gap="md">
        {item.checkIn ? (
          <Text tone="muted">{`Você marcou: ${item.checkIn.overallFeel}/5`}</Text>
        ) : canCheckIn(item) ? (
          <CheckInPrompt blocked={blocked} onAnswer={(feel) => onAct(item, { kind: 'checkin', feel })} />
        ) : null}
        <Row gap="sm">
          {item.execution ? (
            <Button
              label={registered ? 'Ver o que contei' : 'Contar esse cuidado'}
              variant="ghost"
              size="sm"
              onPress={() => washDay.open(item)}
            />
          ) : null}
          {undoable ? (
            <Button
              label="Desfazer"
              variant="ghost"
              size="sm"
              disabled={blocked}
              onPress={() => onAct(item, { kind: 'undo' })}
            />
          ) : null}
        </Row>
      </Stack>
    );
  }

  if (item.outcome === 'skipped' || item.outcome === 'rescheduled') return null;

  return (
    <Stack gap="md">
      <Button
        label="Fiz hoje"
        variant={emphasis === 'focus' ? 'primary' : 'secondary'}
        size={emphasis === 'focus' ? 'md' : 'sm'}
        busy={busy}
        disabled={blocked}
        onPress={() => onAct(item, { kind: 'complete' })}
        style={emphasis === 'list' ? styles.listPrimary : undefined}
      />
      <Row gap="sm">
        {guide ? (
          // Never blocked: reading how to do the care is not a write, so an action in flight must
          // not take it away (SPEC-007 FR6/EC3).
          <Button
            label="Como fazer"
            variant="ghost"
            size="sm"
            accessibilityState={{ expanded: showGuide }}
            onPress={() => setShowGuide((v) => !v)}
          />
        ) : null}
        <Button
          label="Reagendar"
          variant="ghost"
          size="sm"
          disabled={blocked}
          accessibilityState={{ expanded: choosingDate }}
          onPress={() => setChoosingDate((v) => !v)}
        />
        <Button
          label="Pular"
          variant="ghost"
          size="sm"
          disabled={blocked}
          onPress={() => onAct(item, { kind: 'skip' })}
        />
      </Row>
      {choosingDate ? (
        <Row gap="sm">
          {RESCHEDULE_OPTIONS.map((option) => (
            <Button
              key={option.days}
              label={`${option.label} (${formatPlannedDate(addDaysIso(today, option.days))})`}
              variant="secondary"
              size="sm"
              disabled={blocked}
              onPress={() => {
                setChoosingDate(false);
                onAct(item, { kind: 'reschedule', days: option.days });
              }}
            />
          ))}
        </Row>
      ) : null}
      {showGuide && guide ? <CareGuidePanel guide={guide} /> : null}
    </Stack>
  );
}

// ------------------------------------------------------------------------------------ focus card

/**
 * The one thing this screen is about. Everything else on the page is quieter than this card by
 * construction: it is the only place a filled accent button appears.
 */
function FocusCard({
  item,
  today,
  now,
  busy,
  blocked,
  onAct,
  washDay,
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  busy: boolean;
  blocked: boolean;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
}) {
  const state = stateTagOf(item);
  const guide = CARE_GUIDES[item.careTypeCode];
  return (
    <Card style={styles.focus}>
      {state ? <Tag label={state.label} tone={state.tone} /> : <Tag label="Hoje" tone="accent" />}
      <CareTypeMark careTypeCode={item.careTypeCode} big />
      <Text variant="caption" tone="muted">
        {item.outcome === 'done' ? 'Registrado' : whenOf(item)}
        {guide && item.outcome !== 'done' ? ` · ~${guide.durationMin} min` : ''}
      </Text>
      <View style={styles.focusActions}>
        <CareActions
          item={item}
          today={today}
          now={now}
          busy={busy}
          blocked={blocked}
          emphasis="focus"
          onAct={onAct}
          washDay={washDay}
        />
      </View>
    </Card>
  );
}

// ----------------------------------------------------------------------------------- list cards

function CareCard({
  item,
  today,
  now,
  busy,
  blocked,
  onAct,
  washDay,
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  busy: boolean;
  blocked: boolean;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
}) {
  const state = stateTagOf(item);
  return (
    <Card>
      <Row gap="sm" style={styles.cardHead}>
        <CareTypeMark careTypeCode={item.careTypeCode} />
        {state ? <Tag label={state.label} tone={state.tone} /> : null}
      </Row>
      <Text variant="caption" tone="muted">
        {whenOf(item)}
      </Text>
      <CareActions
        item={item}
        today={today}
        now={now}
        busy={busy}
        blocked={blocked}
        emphasis="list"
        onAct={onAct}
        washDay={washDay}
      />
    </Card>
  );
}

function Section({
  title,
  items,
  ...rest
}: {
  title: string;
  items: readonly CareItem[];
  today: LocalDate;
  now: Instant;
  busyId: string | null;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
}) {
  if (items.length === 0) return null;
  return (
    <Stack gap="md">
      {/* `muted`, not `faint`: this is a heading, and a heading belongs to the second tier of the
          ink scale — the third is for metadata that repeats something already on screen. */}
      <Text variant="overline" tone="muted" accessibilityRole="header">
        {title}
      </Text>
      {items.map((item) => (
        <CareCard
          key={item.id}
          item={item}
          today={rest.today}
          now={rest.now}
          busy={rest.busyId === item.id}
          blocked={rest.busyId !== null}
          onAct={rest.onAct}
          washDay={rest.washDay}
        />
      ))}
    </Stack>
  );
}

/**
 * SPEC-005 §14 — the daily loop: what is late, what is due today, what comes next.
 *
 * Every state on screen is derived by `buildTodayView` from the plan's cares plus the executions
 * recorded against them: nothing here reads a "completed" or "overdue" column, because neither
 * exists (D-69 §8.2). An action that the server refuses because the care moved on reloads the board
 * and shows the truth, instead of arguing with the user.
 *
 * SPEC-016 slice 2 gave the screen a shape. It used to be four sections of equal weight, each row
 * carrying four buttons of equal weight, which is the same as having no hierarchy at all: the
 * question "what do I do now?" had to be answered by reading everything. Now one card answers it,
 * a week strip says where she is, and nothing that was actionable became hidden — the sections are
 * quieter, not collapsed, because "Como fazer" is promised on every actionable care (SPEC-007 AC5).
 */
export function TodayScreen({
  board,
  care,
  today,
  now,
  timeZone,
  newExecutionId,
  onChanged,
  hairProfile,
  onPause,
  onPreviewResume,
  onResume,
  onOpenAccount,
  onOpenCycle,
  onOpenWashDay,
  onReassess,
}: {
  board: CareBoard;
  care: CareTrackingPort;
  today: LocalDate;
  now: () => Instant;
  timeZone: string;
  newExecutionId: () => string;
  onChanged: () => void;
  /** SPEC-017 — para ler o snapshot que gerou o plano ativo, não o perfil de hoje. */
  hairProfile: HairProfilePort;
  /** SPEC-022 — pausar, prever a volta e voltar. A rota é quem chama o port. */
  onPause: () => void;
  onPreviewResume: () => Promise<ResumeOutcome>;
  onResume: () => void;
  onOpenAccount: () => void;
  /** SPEC-019 — a forma do mês, a partir da tela que mostra o dia. */
  onOpenCycle: () => void;
  /**
   * SPEC-024 FR1 — abrir o registro do que ela usou naquela execução. A rota é quem monta a tela;
   * daqui sai só o par (execução, nome do cuidado) que ela precisa ver para saber de que dia se
   * trata.
   */
  onOpenWashDay: (input: { careExecutionId: string; careTitle: string }) => void;
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
  /**
   * The care she last acted on in this session. It exists to fix a real hole: completing an
   * *overdue* care makes it `done` on a past day, which `buildTodayView` files under history — so
   * the "Como ficou?" she just earned used to jump to the bottom of the screen, below the progress
   * summary. Holding it in the focus card keeps the reward where the action was. Session-scoped and
   * purely presentational: it decides nothing, and losing it costs nothing.
   */
  const [justActedId, setJustActedId] = useState<string | null>(null);
  /**
   * Why the last transition failed, rendered **only under `__DEV__`** (D-87/D-90). The user gets
   * "Não foi possível registrar. Tente novamente." and nothing else; whoever is debugging gets the
   * code and the message, on screen, without opening devtools. Never logged, never leaves the device.
   */
  const [failure, setFailure] = useState<string | null>(null);

  const view = useMemo(
    () => buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn),
    [board, today],
  );
  const progress = useMemo(() => buildProgress(view, board.lifetimeDoneCount), [view, board]);
  const renderedNow = now();

  const allItems = useMemo(() => [...view.overdue, ...view.today, ...view.upcoming, ...view.history], [view]);
  const week = useMemo(() => buildWeek(allItems, today), [allItems, today]);

  // The focus, in priority order: the care she just settled while it still has something to offer
  // (a check-in to answer, an undo still open), then the oldest overdue one (D-28 — the plan never
  // moves itself, so a late care stays the most urgent thing until she decides), then today's.
  const recent = justActedId ? allItems.find((i) => i.id === justActedId) : undefined;
  const recentHolds =
    recent !== undefined &&
    recent.outcome === 'done' &&
    recent.execution !== null &&
    (canCheckIn(recent) || canUndo(recent.execution, renderedNow));
  const focus = recentHolds ? recent : (view.overdue[0] ?? view.today[0] ?? null);

  /**
   * SPEC-024 — o que os cartões precisam saber sobre o Wash Day, num objeto só: se aquela execução
   * já tem registro (FR7) e como abrir o dela. Um objeto em vez de dois props porque a informação
   * atravessa quatro componentes, e quatro assinaturas com dois campos cada envelhecem pior.
   */
  const washDay: WashDayAccess = {
    registered: (executionId) => board.washDayExecutionIds.includes(executionId),
    open: (item) => {
      if (!item.execution) return;
      onOpenWashDay({
        careExecutionId: item.execution.id,
        careTitle: CARE_TYPE_LABEL[item.careTypeCode],
      });
    },
  };

  const notFocus = (item: CareItem) => item.id !== focus?.id;
  const restOverdue = view.overdue.filter(notFocus);
  const restToday = view.today.filter(notFocus);
  const history = view.history.filter(notFocus);

  const act = (item: CareItem, action: Action) => {
    if (busyId) return; // one transition at a time; also the double-tap guard
    setBusyId(item.id);
    setMessage(null);
    setFailure(null);
    setJustActedId(item.id);

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
        setFailure(reasonOf(error));
      })
      .finally(() => setBusyId(null));
  };

  // Nothing left in the plan — either its four weeks elapsed, or she settled every remaining care
  // early. Until D-82 this was a dead end: the screen said so and offered nothing, so the product
  // simply went quiet. The copy below covers both ways of getting here, which is why it talks about
  // the plan being empty rather than about four weeks having passed.
  const nothingLeft = view.overdue.length === 0 && view.today.length === 0 && view.upcoming.length === 0;
  const nextUp = view.upcoming[0];
  /**
   * SPEC-022 FR3 — pausada, a Hoje é **calma**, não vazia: diz o estado, desde quando, e oferece
   * voltar. O cartão de foco e as seções continuam ali, sem nada marcado como atrasado — porque
   * pausada nada atrasou (BR1), e não porque a tela esconda alguma coisa.
   */
  const paused = board.pausedOn !== null;

  return (
    <Screen>
      <Stack gap="md">
        <Text variant="overline" tone="faint">
          {formatPlannedDate(today)}
        </Text>
        <Text variant="display" accessibilityRole="header">
          Seus cuidados
        </Text>
      </Stack>

      <WeekStrip week={week} />

      {/* Pausada, a pausa vem **antes** do cuidado do dia: é o que explica por que nada está
          atrasado, e ler a explicação depois da consequência é ler ao contrário. Andando, ela fica
          no fim, quieta, perto das outras saídas. */}
      {paused ? (
        <PauseCard
          pausedOn={board.pausedOn}
          busy={busyId !== null}
          onPause={onPause}
          onPreviewResume={onPreviewResume}
          onResume={onResume}
        />
      ) : null}

      {focus ? (
        <FocusCard
          item={focus}
          today={today}
          now={renderedNow}
          busy={busyId === focus.id}
          blocked={busyId !== null}
          onAct={act}
          washDay={washDay}
        />
      ) : (
        <Card tone="muted" style={styles.focus}>
          <Text variant="title">
            {nothingLeft ? 'Seu cronograma chegou ao fim.' : 'Nenhum cuidado hoje.'}
          </Text>
          {nextUp ? (
            <Text tone="muted">
              {`Próximo: ${CARE_TYPE_LABEL[nextUp.careTypeCode]} · ${formatPlannedDate(nextUp.plannedDate)}`}
            </Text>
          ) : null}
        </Card>
      )}

      {nothingLeft && onReassess ? (
        <Card tone="accent">
          <Text tone="muted">
            Não sobrou nenhum cuidado no seu cronograma atual. Reavaliar seu cabelo monta as próximas semanas
            a partir de como ele está agora — o que você já registrou continua salvo.
          </Text>
          <Button label="Reavaliar e montar o próximo" onPress={onReassess} />
        </Card>
      ) : null}

      <Section
        title="Atrasados"
        items={restOverdue}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
        washDay={washDay}
      />
      <Section
        title="Hoje"
        items={restToday}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
        washDay={washDay}
      />
      <Section
        title="Próximos"
        items={view.upcoming}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
        washDay={washDay}
      />

      {/* After the actionable sections and before the detail: she settles the day first, then
          sees the accumulated summary, which reads naturally as a preface to the history. */}
      <ProgressSummary progress={progress} />

      {/* SPEC-017 OQ2 — aqui, e não no cartão de foco: a explicação é leitura reflexiva, e no topo
          competiria com a única ação primária da tela. Fechada por padrão (FR1). */}
      <PlanRationale
        hairProfile={hairProfile}
        hairProfileId={board.hairProfileId}
        startsOn={board.startsOn as LocalDate}
        assessmentAlgorithmVersion={board.assessmentAlgorithmVersion}
        scheduleAlgorithmVersion={board.scheduleAlgorithmVersion}
      />

      <Section
        title="Histórico"
        items={history}
        today={today}
        now={renderedNow}
        busyId={busyId}
        onAct={act}
        washDay={washDay}
      />

      {message ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {message}
        </Text>
      ) : null}
      {__DEV__ && failure ? (
        <Text variant="caption" tone="faint">
          {failure}
        </Text>
      ) : null}

      {/* Duas saídas quietas, na mesma linha: a Hoje continua com uma única ação primária, que é
          o cuidado do dia. Ver o ciclo nunca compete com fazer o cuidado. */}
      {paused ? null : (
        <PauseCard
          pausedOn={null}
          busy={busyId !== null}
          onPause={onPause}
          onPreviewResume={onPreviewResume}
          onResume={onResume}
        />
      )}

      <Row gap="sm">
        <Button label="Ver meu ciclo" variant="ghost" onPress={onOpenCycle} />
        <Button label="Sua conta" variant="ghost" onPress={onOpenAccount} />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardHead: { alignItems: 'center', justifyContent: 'space-between' },
  focus: { padding: space.xl, gap: space.md },
  focusActions: { paddingTop: space.sm },
  listPrimary: { alignSelf: 'flex-start' },
  feel: {
    minWidth: HIT_TARGET_MIN,
    minHeight: HIT_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.borderStrong,
    backgroundColor: color.surface,
  },
  feelPressed: { backgroundColor: color.accentSoft, borderColor: color.accent },
  off: { opacity: 0.45 },
});
