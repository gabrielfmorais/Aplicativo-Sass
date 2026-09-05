import type {
  CareBoard,
  CareItem,
  CareTrackingPort,
  FinishStatus,
  FinishTechnique,
  HairProfilePort,
  Instant,
  LocalDate,
  ProductPort,
  OilRoutineView,
  ResumeOutcome,
  WashDayPort,
} from '@app/core';
import {
  CARE_GUIDES,
  CHECKIN_SCALE,
  FINISH_STATUSES,
  FINISH_TECHNIQUES,
  buildTodayView,
  canCheckIn,
  canUndo,
} from '@app/core';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Row, Screen, ScreenHeader, Stack, Tag, Text } from '@/design/primitives';
import { HomeSection } from '@/features/care/HomeSection';
import { SuggestionsCard } from '@/features/care/SuggestionsCard';
import { buildSuggestions, type Suggestion, type SuggestionKey } from '@/features/care/suggestions';
import { HIT_TARGET_MIN, color, radius, space } from '@/design/tokens';
import { CareGuidePanel } from '@/features/care/CareGuidePanel';
import { CareProductsPanel } from '@/features/care/CareProductsPanel';
import { CareTypeMark } from '@/features/care/CareTypeMark';
import { PauseCard } from '@/features/care/PauseCard';
import { PlanRationale } from '@/features/care/PlanRationale';
/**
 * SPEC-048 — o vocabulário de finalização é da `WashDayScreen`, que já é a dona dos rótulos do Wash
 * Day (`TECHNIQUE_LABEL`, `SCALP_LABEL`). Duas cópias discordariam na primeira renomeação, e o mesmo
 * registro dela apareceria com nomes diferentes em duas telas.
 */
import { FINISH_TECHNIQUE_LABEL } from '@/features/care/WashDayScreen';
import { WeekStrip } from '@/features/care/WeekStrip';
import { buildWeek } from '@/features/care/week';
import { CARE_TYPE_LABEL, formatLongDate, formatPlannedDate } from '@/features/plan/copy';
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
  | { kind: 'checkin'; feel: number }
  | { kind: 'finish'; status: FinishStatus | null }
  /** SPEC-048 (F38) — qual finalização ela fez. `null` volta a "ainda não disse qual". */
  | { kind: 'finishTechnique'; technique: FinishTechnique | null };

/**
 * SPEC-024 — tudo o que um cartão precisa saber sobre o registro do Wash Day: se aquela execução já
 * tem um (FR7) e como abrir o dela. Nada além disso atravessa a tela — o conteúdo do registro é da
 * `WashDayScreen`, e trazê-lo até aqui só para contar chips seria uma segunda verdade sobre o
 * mesmo fato.
 */
type WashDayAccess = {
  registered: (careExecutionId: string) => boolean;
  open: (item: CareItem) => void;
  /**
   * SPEC-039 — a etapa de finalização daquela execução, ou `null` para "ainda não disse". Vem junto
   * porque a pergunta mora no cartão, e uma pergunta que volta depois do reload é o app esquecendo
   * o que ela respondeu (FR5).
   */
  finishOf: (careExecutionId: string) => FinishStatus | null;
  /** SPEC-048 — qual finalização, lida do mesmo registro. */
  finishTechniqueOf: (careExecutionId: string) => FinishTechnique | null;
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

// --------------------------------------------------------------------------------- finalização

/**
 * SPEC-039 (F37) — a etapa que faltava entre o tratamento e o resultado.
 *
 * O fluxo canônico é `LAVOU → TRATAMENTO → FINALIZAÇÃO → RESULTADO/CHECK-IN` (Blueprint §22), e até
 * aqui a Hoje fazia a última pergunta antes da penúltima: o `CheckInPrompt` vinha primeiro e a
 * finalização não existia em lugar nenhum.
 *
 * **A ordem conduz; ela não tranca** (NG4/BR2). O check-in continua acessível com a finalização não
 * respondida — pôr a etapa como pedágio transformaria em dois toques a pergunta que o produto inteiro
 * fez questão de manter em um.
 *
 * ⚠️ **Nenhum rótulo aqui afirma nada sobre cabelo** (BR4). "Finalizei" e "Pulei dessa vez" dizem o
 * que ela fez. *Quais* finalizações e como fazê-las são o `F38`, atrás do gate D-26/D-70.
 */
const FINISH_LABEL: Record<FinishStatus, string> = {
  done: 'Finalizei',
  skipped: 'Pulei dessa vez',
};

function FinishPrompt({
  status,
  technique,
  blocked,
  onAnswer,
  onTechnique,
}: {
  status: FinishStatus | null;
  /** SPEC-048 — qual, ou `null` para "ainda não disse qual" (que não é `unknown`). */
  technique: FinishTechnique | null;
  blocked: boolean;
  /** `null` tira a resposta: voltar a "ainda não disse" é um estado válido, e é dela (FR8). */
  onAnswer: (status: FinishStatus | null) => void;
  onTechnique: (technique: FinishTechnique | null) => void;
}) {
  return (
    <Stack gap="sm">
      {/*
        Enquanto ela não respondeu, o título pergunta — é o que conduz. Respondida, ele vira o nome
        neutro da etapa: o fato já está dito pelo chip marcado, e repetir a pergunta ao lado da
        resposta pareceria cobrança de uma coisa que ela já fez (FR3/NG5).
      */}
      <Text variant="bodyStrong">{status === null ? 'Você finalizou?' : 'Finalização'}</Text>
      <Row gap="sm">
        {FINISH_STATUSES.map((value) => (
          <Chip
            key={value}
            label={FINISH_LABEL[value]}
            selected={status === value}
            disabled={blocked}
            onPress={() => onAnswer(status === value ? null : value)}
          />
        ))}
      </Row>
      {/*
        SPEC-048 (F38) — **qual**, e só depois de ela dizer que finalizou.
        ⚠️ Perguntar "qual" antes de "se" inverteria a ordem canônica (SPEC-039 FR2), e o banco
        recusa a combinação: técnica só existe com a etapa em `done`.
        ⚠️ **Pergunta, não indicação.** Nenhum item vem sugerido, marcado ou ordenado por perfil —
        "melhor para você" é D-26/D-70 e não está aqui.
      */}
      {status === 'done' ? (
        <Stack gap="sm">
          <Text variant="bodyStrong">{technique === null ? 'Qual finalização?' : 'Finalização feita'}</Text>
          <Row gap="sm">
            {FINISH_TECHNIQUES.map((value) => (
              <Chip
                key={value}
                label={FINISH_TECHNIQUE_LABEL[value]}
                selected={technique === value}
                disabled={blocked}
                onPress={() => onTechnique(technique === value ? null : value)}
              />
            ))}
          </Row>
        </Stack>
      ) : null}
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
  shelf,
  onShare,
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
  /**
   * SPEC-041 (F48) — as portas para mostrar o que ela já tem, **no momento do cuidado**. Ausente
   * quando a capability não está disponível: o cartão continua inteiro sem ela.
   */
  shelf?: { readonly washDays: WashDayPort; readonly products: ProductPort } | undefined;
  /** SPEC-045 (F46) — o cuidado que ela acabou de fazer vira card, dali mesmo. */
  onShare?: ((careLabel: string) => void) | undefined;
}) {
  const [choosingDate, setChoosingDate] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
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
        {/*
          SPEC-039 FR2 — a ordem canônica é `TRATAMENTO → FINALIZAÇÃO → RESULTADO`, e até aqui a
          tela fazia a última pergunta antes da penúltima. A finalização vem **acima** do check-in
          porque é isso que acontece no banheiro; e continua não bloqueando nada (NG4).
        */}
        {item.execution ? (
          <FinishPrompt
            status={washDay.finishOf(item.execution.id)}
            technique={washDay.finishTechniqueOf(item.execution.id)}
            onTechnique={(value) => onAct(item, { kind: 'finishTechnique', technique: value })}
            blocked={blocked}
            onAnswer={(status) => onAct(item, { kind: 'finish', status })}
          />
        ) : null}
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
          {/*
            SPEC-045 (F46) — **o momento de orgulho, onde ele acontece.** É uma oferta discreta ao
            lado do registro, nunca um passo do fluxo: o cuidado está concluído com ou sem ela.
          */}
          {onShare ? (
            <Button
              label="Compartilhar"
              variant="ghost"
              size="sm"
              onPress={() => onShare(CARE_TYPE_LABEL[item.careTypeCode])}
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
        {/*
          SPEC-041 FR2 (F48) — o que ela **já tem**, no momento do cuidado. Painel que abre, como
          "Como fazer": a informação está a um toque e não empurra as ações para baixo da dobra.

          ⚠️ Nunca bloqueado por uma transição em voo: é leitura, não escrita (mesma regra do guia).
        */}
        {shelf ? (
          <Button
            label="Meus produtos"
            variant="ghost"
            size="sm"
            accessibilityState={{ expanded: showProducts }}
            onPress={() => setShowProducts((v) => !v)}
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
      {showProducts && shelf ? (
        <CareProductsPanel
          careTypeCode={item.careTypeCode}
          washDays={shelf.washDays}
          products={shelf.products}
        />
      ) : null}
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
  shelf,
  onShare,
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  busy: boolean;
  blocked: boolean;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
  /** SPEC-041 (F48) — repassado até o cartão, que é onde o painel abre. */
  shelf?: { readonly washDays: WashDayPort; readonly products: ProductPort } | undefined;
  /** SPEC-045 (F46) — o cuidado que ela acabou de fazer vira card, dali mesmo. */
  onShare?: ((careLabel: string) => void) | undefined;
}) {
  const state = stateTagOf(item);
  const guide = CARE_GUIDES[item.careTypeCode];
  return (
    <Card tone="brand" style={styles.focus}>
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
          shelf={shelf}
          onShare={onShare}
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
  shelf,
  onShare,
  tone = 'surface',
}: {
  item: CareItem;
  today: LocalDate;
  now: Instant;
  busy: boolean;
  blocked: boolean;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
  /** SPEC-041 (F48) — repassado até o cartão, que é onde o painel abre. */
  shelf?: { readonly washDays: WashDayPort; readonly products: ProductPort } | undefined;
  /** SPEC-045 (F46) — o cuidado que ela acabou de fazer vira card, dali mesmo. */
  onShare?: ((careLabel: string) => void) | undefined;
  /**
   * SPEC-030 — a escada tonal da Hoje, e ela **significa** alguma coisa.
   *
   * A tela tinha um bloco tingido no topo e cartão branco em todo o resto: quatro seções, um único
   * tom, nenhuma pista de que uma é o passado. Agora a cor diz o estado — ameixa é a resposta do
   * dia, roxo é oferta, branco é o que ela ainda pode fazer, e bege é o que já aconteceu. Nenhum
   * elemento novo: a mesma quantidade de cartões, lendo em ordem.
   */
  tone?: 'surface' | 'muted';
}) {
  const state = stateTagOf(item);
  return (
    <Card tone={tone}>
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
        shelf={shelf}
        onShare={onShare}
      />
    </Card>
  );
}

function Section({
  title,
  items,
  showFirst,
  cardTone = 'surface',
  ...rest
}: {
  title: string;
  items: readonly CareItem[];
  /**
   * SPEC-030 — quantos itens a seção mostra antes de oferecer o resto.
   *
   * ⚠️ **Isto existe por uma medição.** A Hoje media **4,23 telas de rolagem** com um plano pequeno,
   * e quase tudo era "Próximos": nove cartões praticamente idênticos, ~155px cada, repetindo os
   * mesmos quatro botões para cuidados que só acontecem daqui a semanas. A pergunta que a seção
   * responde — *o que vem?* — se responde com os três primeiros.
   *
   * ⚠️ **E a razão de ser "ver mais" em vez de linha compacta é uma SPEC, não uma preferência.**
   * A primeira tentativa desta fatia trocou os cartões por linhas que abriam ao toque. Os testes
   * reprovaram na hora, e com motivo: aquilo escondia **"Contar esse cuidado"** — a entrada do Wash
   * Day (SPEC-024), que alimenta a Prateleira e a Hair Intelligence — e escondia **"Como fazer"**,
   * que a SPEC-007 AC5 promete em **todo** cuidado acionável. A SPEC-016 já tinha registrado
   * exatamente essa decisão: as seções ficam mais quietas, **nunca colapsadas**, por causa de AC5.
   *
   * Com "ver mais", cada cartão que aparece continua inteiro — nada muda no que um cuidado oferece.
   * O que muda é **quantos** aparecem de uma vez, que é o problema medido.
   */
  showFirst?: number;
  /** O tom dos cartões desta seção. O passado recua; o que ainda pode ser feito não. */
  cardTone?: 'surface' | 'muted';
  today: LocalDate;
  now: Instant;
  busyId: string | null;
  onAct: (item: CareItem, action: Action) => void;
  washDay: WashDayAccess;
  /** SPEC-041 (F48) — repassado até o cartão, que é onde o painel abre. */
  shelf?: { readonly washDays: WashDayPort; readonly products: ProductPort } | undefined;
  /** SPEC-045 (F46) — o cuidado que ela acabou de fazer vira card, dali mesmo. */
  onShare?: ((careLabel: string) => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const limit = showFirst ?? items.length;
  const hidden = Math.max(items.length - limit, 0);
  const shown = expanded || hidden === 0 ? items : items.slice(0, limit);

  return (
    <HomeSection title={title}>
      {shown.map((item) => (
        <CareCard
          key={item.id}
          item={item}
          today={rest.today}
          now={rest.now}
          busy={rest.busyId === item.id}
          blocked={rest.busyId !== null}
          onAct={rest.onAct}
          washDay={rest.washDay}
          shelf={rest.shelf}
          onShare={rest.onShare}
          tone={cardTone}
        />
      ))}
      {hidden > 0 && !expanded ? (
        /**
         * ⚠️ **O rótulo diz o número, e isso não é enfeite.** "Ver mais" esconde quanto falta; "Ver
         * mais 6" deixa ela decidir se vale a rolagem. E o contador é a prova de que nada sumiu — a
         * seção declara o que está guardando.
         */
        <Button
          label={`Ver mais ${hidden}`}
          variant="ghost"
          size="sm"
          accessibilityLabel={`Ver mais ${hidden} em ${title}`}
          accessibilityState={{ expanded: false }}
          onPress={() => setExpanded(true)}
          style={styles.sectionMore}
        />
      ) : null}
    </HomeSection>
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
  onOpenCycle,
  onOpenWashDay,
  washDays,
  products,
  oil,
  profile,
  productCount,
  onOpenShelf,
  onReassess,
  onOpenJourney,
  onShare,
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
  /**
   * SPEC-019 — a forma do mês, a partir da tela que mostra o dia.
   *
   * SPEC-026: **"Sua conta" saiu daqui.** A conta virou uma aba permanente, e uma saída para ela no
   * pé da Hoje passou a ser um caminho a mais para o mesmo lugar. Ver o ciclo continua, porque ler
   * o mês a partir do dia é um gesto do dia — mas leva à aba Cuidados, e não a um beco.
   */
  onOpenCycle: () => void;
  /**
   * SPEC-024 FR1 — abrir o registro do que ela usou naquela execução. A rota é quem monta a tela;
   * daqui sai só o par (execução, nome do cuidado) que ela precisa ver para saber de que dia se
   * trata.
   */
  onOpenWashDay: (input: { careExecutionId: string; careTitle: string }) => void;
  /**
   * SPEC-039 (F37) — a etapa de finalização é respondida **aqui**, no cartão do cuidado concluído,
   * e não só dentro do registro: é ali que o fluxo passa. A tela só escreve a etapa; produtos,
   * técnicas e couro continuam sendo da `WashDayScreen`.
   */
  washDays: WashDayPort;
  /**
   * SPEC-041 (F48) — a prateleira dela, para o painel "Meus produtos" no cartão do cuidado.
   * Opcional: sem ela o cartão não oferece o painel, e o resto da tela segue igual.
   */
  products?: ProductPort;
  /**
   * SPEC-040 (F39) — a rotina de óleo, quando ela tem uma. Opcional: a Hoje funciona inteira sem
   * ela, e uma leitura que não voltou simplesmente não aparece (o hook falha em silêncio).
   */
  oil?: {
    readonly view: OilRoutineView;
    readonly busy: boolean;
    readonly onDone: () => void;
    readonly onPostpone: () => void;
  };
  /**
   * SPEC-026 fatia 3 — quantos produtos ativos ela tem, ou `null` enquanto não se sabe.
   *
   * **`null` não é zero.** Uma leitura que não voltou não pode virar "sua prateleira está vazia",
   * que seria uma afirmação sobre ela feita a partir de nada. A rota lê isto em silêncio: se
   * falhar, a sugestão simplesmente não aparece — uma oferta ausente não é um erro a mostrar.
   */
  productCount: number | null;
  onOpenShelf: () => void;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
  /**
   * D-82 — the way out of a finished cycle. Present whenever there is an active plan, which is the
   * only situation this screen renders in; it is optional so a test can render the screen without
   * asserting on navigation.
   */
  onReassess?: () => void;
  /**
   * SPEC-043 — abre a Jornada. Opcional: a Hoje funciona inteira sem ela, e a capability é uma
   * camada de motivação, não parte do loop diário.
   */
  onOpenJourney?: () => void;
  /**
   * SPEC-045 (F46) — o cuidado que ela acabou de fazer vira card, **dali mesmo**. Opcional pela
   * mesma razão que a Jornada: o loop diário não depende disso.
   */
  onShare?: ((careLabel: string) => void) | undefined;
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
  /**
   * SPEC-026 FR7 — o dia que a tela está mostrando. Começa em hoje e só muda por toque dela.
   *
   * **Escopo de sessão, e é o certo.** Persistir isto faria ela reabrir o app olhando uma quinta-feira
   * de duas semanas atrás sem lembrar por quê. A Hoje se chama Hoje.
   */
  const [selected, setSelected] = useState<string>(today);
  /** FR15 — dispensada some, e não volta na mesma sessão. Escopo de sessão, e nada a persistir. */
  const [dismissed, setDismissed] = useState<readonly SuggestionKey[]>([]);

  const view = useMemo(
    () => buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn),
    [board, today],
  );
  const renderedNow = now();

  const allItems = useMemo(() => [...view.overdue, ...view.today, ...view.upcoming, ...view.history], [view]);
  // Ancorada no dia selecionado: navegar para outra semana é selecionar um dia dela. `today`
  // continua sendo quem decide o que é hoje e o que é passado (week.ts).
  const week = useMemo(() => buildWeek(allItems, today, selected as LocalDate), [allItems, today, selected]);
  const viewingToday = selected === today;
  /**
   * Os cuidados daquele dia. `rescheduled` fica de fora pela mesma razão que fica fora da faixa: um
   * cuidado que saiu dali não está acontecendo ali, e desenhá-lo diria algo falso sobre o dia.
   */
  const dayItems = useMemo(
    () => allItems.filter((i) => i.plannedDate === selected && i.outcome !== 'rescheduled'),
    [allItems, selected],
  );

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
  /**
   * SPEC-041 (F48) — as duas portas juntas, montadas uma vez: o painel precisa das duas, e passar
   * cada uma separada por três níveis de cartão seria dois prop-drillings em vez de um.
   */
  const shelf = products ? { washDays, products } : undefined;

  const washDay: WashDayAccess = {
    registered: (executionId) => board.washDayExecutionIds.includes(executionId),
    open: (item) => {
      if (!item.execution) return;
      onOpenWashDay({
        careExecutionId: item.execution.id,
        careTitle: CARE_TYPE_LABEL[item.careTypeCode],
      });
    },
    finishOf: (executionId) =>
      board.careFinishes.find((f) => f.careExecutionId === executionId)?.status ?? null,
    finishTechniqueOf: (executionId) =>
      board.careFinishes.find((f) => f.careExecutionId === executionId)?.technique ?? null,
  };

  const suggestions = useMemo(
    () =>
      buildSuggestions({
        view,
        washDayExecutionIds: board.washDayExecutionIds,
        productCount,
        dismissed,
      }),
    [view, board.washDayExecutionIds, productCount, dismissed],
  );

  const actOnSuggestion = (suggestion: Suggestion) => {
    if (suggestion.key === 'shelf_empty') return onOpenShelf();
    if (suggestion.careExecutionId && suggestion.careTitle) {
      onOpenWashDay({
        careExecutionId: suggestion.careExecutionId,
        careTitle: suggestion.careTitle,
      });
    }
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
        /**
         * SPEC-039 — a etapa de finalização. **Sem chave de idempotência**, ao contrário do
         * check-in: a PK é o hub, então o retry depois de uma resposta perdida cai na mesma linha
         * em vez de criar a segunda (FR6). Uma chave aqui não teria o que proteger.
         */
        case 'finish':
          return item.execution
            ? washDays.setFinishStatus({
                careExecutionId: item.execution.id,
                finishStatus: action.status,
              })
            : Promise.resolve();
        case 'finishTechnique':
          return item.execution
            ? washDays.setFinishTechnique({
                careExecutionId: item.execution.id,
                finishTechnique: action.technique,
              })
            : Promise.resolve();
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
      {/* A data é sempre a do dia que está na tela, e o título diz **em palavra** qual é (FR8):
          um destaque na faixa é uma pista, e uma pista não é uma resposta. */}
      {/*
        SPEC-032 — o título é a **data**, e não "Seus cuidados".
        O nome da tela já está na barra, e "Seus cuidados" ainda colidia com a aba **Cuidados** ao
        lado. O que esta tela tem de único é o dia que ela está mostrando — e ele responde sozinho
        se ela está em hoje ou em outro dia, sem precisar de uma segunda frase para dizer isso.
      */}
      <ScreenHeader title={formatLongDate(selected as LocalDate)} profile={profile} />

      <WeekStrip week={week} selected={selected} onSelect={setSelected} />

      {/*
        Outro dia: a tela inteira passa a ser sobre ele. Mostrar o dia selecionado **junto** com as
        seções de hoje seria duas respostas para a mesma pergunta na mesma tela — e a segunda, a
        errada, ficaria na parte de baixo, que é onde ninguém confere.

        As ações continuam inteiras: concluir, pular e reagendar valem para o cuidado, não para a
        data em que ela está olhando.
      */}
      {viewingToday ? null : (
        <Stack gap="md">
          {dayItems.length === 0 ? (
            // EC3 — um dia sem nada é um fato, não uma tela em branco.
            <Card tone="muted">
              <Text tone="muted">Nada marcado nesse dia.</Text>
            </Card>
          ) : (
            dayItems.map((item) => (
              <CareCard
                key={item.id}
                item={item}
                today={today}
                now={renderedNow}
                busy={busyId === item.id}
                blocked={busyId !== null}
                onAct={act}
                washDay={washDay}
                shelf={shelf}
                onShare={onShare}
              />
            ))
          )}
          {/*
            SPEC-030 — a volta ganha peso, e **só** isso.
            Olhando outro dia a tela terminava num link fantasma e sobrava meia tela de vazio. A
            primeira tentativa de resolver foi pôr "Ver meu ciclo" aqui — e o teste da SPEC-026
            reprovou, com razão: num outro dia **tudo o que fala de hoje some**, senão a tela dá
            duas respostas para a mesma pergunta. O vazio não justifica reabrir uma decisão; o que
            ele pede é que a saída pareça o fim da tela, e um botão secundário já é isso.
          */}
          <Row gap="sm">
            <Button label="Voltar para hoje" variant="secondary" onPress={() => setSelected(today)} />
          </Row>
        </Stack>
      )}

      {/* Pausada, a pausa vem **antes** do cuidado do dia: é o que explica por que nada está
          atrasado, e ler a explicação depois da consequência é ler ao contrário. Andando, ela fica
          no fim, quieta, perto das outras saídas. */}
      {viewingToday && paused ? (
        <PauseCard
          pausedOn={board.pausedOn}
          busy={busyId !== null}
          onPause={onPause}
          onPreviewResume={onPreviewResume}
          onResume={onResume}
        />
      ) : null}

      {!viewingToday ? null : focus ? (
        <FocusCard
          item={focus}
          today={today}
          now={renderedNow}
          busy={busyId === focus.id}
          blocked={busyId !== null}
          onAct={act}
          washDay={washDay}
          shelf={shelf}
          onShare={onShare}
        />
      ) : (
        /*
          SPEC-027 — o cartão de foco é **sempre** o cartão de marca, inclusive vazio. Ele era
          `muted` quando não havia nada a fazer, e o resultado é que o maior bloco da tela mais
          frequente do app era um retângulo cinza-bege: um dia sem cuidado parecia um dia em que o
          produto tinha desligado. Dia livre é uma resposta, não uma ausência — e a resposta mora no
          mesmo lugar, com a mesma cara, todos os dias.
        */
        <Card tone="brand" style={styles.focus}>
          <Text variant="title">
            {nothingLeft ? 'Seu cronograma chegou ao fim.' : 'Nenhum cuidado hoje.'}
          </Text>
          {nextUp ? (
            <Text tone="muted">
              {`Próximo: ${CARE_TYPE_LABEL[nextUp.careTypeCode]} · ${formatPlannedDate(nextUp.plannedDate)}`}
            </Text>
          ) : null}
          {/*
            SPEC-030 — um dia livre também oferece um passo.
            ⚠️ **E o passo é uma leitura, não uma tarefa.** O cartão vazio dizia o próximo cuidado e
            parava ali: a resposta certa, num beco. Oferecer "faça outra coisa" seria inventar
            tarefa num dia que o cronograma deixou livre — o que este produto recusa desde a
            SPEC-019. Ver o ciclo é o único convite honesto: mostra onde ela está sem pedir nada.
          */}
          {nothingLeft ? null : (
            <Button
              label="Ver meu ciclo"
              variant="secondary"
              onPress={onOpenCycle}
              style={styles.emptyAction}
            />
          )}
        </Card>
      )}

      {/*
        Tudo daqui para baixo é sobre **hoje** — o que está atrasado, o que vem, o histórico, a
        pausa. Num outro dia isso não some por estética: seria uma segunda resposta, na mesma tela,
        para a pergunta que a de cima já respondeu.
      */}
      {!viewingToday ? null : (
        <>
          {/*
            SPEC-040 FR6 (F39) — a rotina de óleo, **só quando vence ou está vencida** (EC6). Ela
            não é do cronograma e não entra nas seções: aparece, pede uma ação e sai.

            ⚠️ Nada aqui diz o que o óleo faz (BR4), e **adiar não é falha** (BR2/D-28): as duas
            ações têm o mesmo peso visual, e nenhuma frase cobra o que passou.
          */}
          {oil && (oil.view.state === 'due_today' || oil.view.state === 'overdue') ? (
            <Card>
              <Text variant="heading" accessibilityRole="header">
                Hora do seu óleo
              </Text>
              <Text tone="muted">
                {oil.view.state === 'due_today'
                  ? 'Você programou o óleo para hoje.'
                  : `Você programou o óleo para ${oil.view.daysLate === 1 ? 'ontem' : `há ${oil.view.daysLate} dias`}.`}
              </Text>
              <Row gap="sm">
                <Button
                  label="Passei óleo"
                  variant="secondary"
                  size="sm"
                  disabled={oil.busy}
                  onPress={oil.onDone}
                />
                <Button
                  label="Adiar um dia"
                  variant="ghost"
                  size="sm"
                  disabled={oil.busy}
                  onPress={oil.onPostpone}
                />
              </Row>
            </Card>
          ) : null}

          {/*
            SPEC-043 (F40/F41/F42) — a entrada da **Jornada**, quieta.

            ⚠️ **Superfície própria** (D-103): a Jornada é uma tela, não um bloco aqui. E a entrada
            **não é um crachá gritando por atenção** — nenhum "não perca sua sequência", nenhuma
            contagem regressiva, nenhum vermelho. Quem quiser olhar, olha.

            Mora na Hoje porque é aqui que o fato acontece: a consistência dela é feita de cuidados
            concluídos, e é aqui que ela acabou de concluir um.
          */}
          {onOpenJourney ? (
            <Button
              label="Sua jornada"
              variant="ghost"
              size="sm"
              onPress={onOpenJourney}
              style={styles.inlineStart}
            />
          ) : null}

          <SuggestionsCard
            suggestions={suggestions}
            onAct={actOnSuggestion}
            onDismiss={(s) => setDismissed((current) => [...current, s.key])}
          />

          {nothingLeft && onReassess ? (
            <Card tone="accent">
              <Text tone="muted">
                Não sobrou nenhum cuidado no seu cronograma atual. Reavaliar seu cabelo monta as próximas
                semanas a partir de como ele está agora — o que você já registrou continua salvo.
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
            shelf={shelf}
            onShare={onShare}
          />
          <Section
            title="Hoje"
            items={restToday}
            today={today}
            now={renderedNow}
            busyId={busyId}
            onAct={act}
            washDay={washDay}
            shelf={shelf}
            onShare={onShare}
          />
          <Section
            title="Próximos"
            showFirst={3}
            items={view.upcoming}
            today={today}
            now={renderedNow}
            busyId={busyId}
            onAct={act}
            washDay={washDay}
            shelf={shelf}
            onShare={onShare}
          />

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
            showFirst={3}
            cardTone="muted"
            items={history}
            today={today}
            now={renderedNow}
            busyId={busyId}
            onAct={act}
            washDay={washDay}
            shelf={shelf}
            onShare={onShare}
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

          {/* Uma saída quieta: a Hoje continua com uma única ação primária, que é o cuidado do dia. */}
          {paused ? null : (
            <PauseCard
              pausedOn={null}
              busy={busyId !== null}
              onPause={onPause}
              onPreviewResume={onPreviewResume}
              onResume={onResume}
            />
          )}

          {/*
            SPEC-030 — **uma** porta para o ciclo, e ela muda de lugar conforme o dia.
            Num dia livre a porta sobe para dentro do cartão de foco, que é onde a pergunta "e
            agora?" acontece; num dia com cuidado ela fica aqui embaixo, quieta, para não competir
            com a única ação primária da tela. Deixá-la nos dois lugares seria repetir o defeito
            que a SPEC-027 acabou de corrigir na navegação: dois caminhos para o mesmo destino.
          */}
          {focus || nothingLeft ? (
            <Row gap="sm">
              <Button label="Ver meu ciclo" variant="ghost" onPress={onOpenCycle} />
            </Row>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Um botão dentro do corpo não ocupa a linha inteira (mesma regra da SPEC-023/024). */
  inlineStart: { alignSelf: 'flex-start' },
  /** Não ocupa a linha: num dia livre nada aqui é a ação primária da tela. */
  emptyAction: { alignSelf: 'flex-start' },
  /** Alinhado à esquerda: "ver mais" é uma oferta da seção, não a ação principal da tela. */
  sectionMore: { alignSelf: 'flex-start' },
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
