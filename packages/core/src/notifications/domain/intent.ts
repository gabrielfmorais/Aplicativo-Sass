// ADR-006 / `core-context-isolation`: another context is entered only through its public index.
// Care Tracking → Notifications is a published-language read model (DOMAIN-MAP §4).
import { canCheckIn, type CareItem, type TodayView } from '../../care-tracking/index.ts';
import { addDays, type LocalDate } from '../../shared/index.ts';

/**
 * How far ahead local notifications are scheduled (ADR-009).
 * With the 2/day cap that is at most 28 pending notifications — well under the iOS limit of 64.
 */
export const NOTIFICATION_HORIZON_DAYS = 14;

/** Central volume policy (ADR-009). A constant, not a column: no UI changes it (SPEC-008 §8.2). */
export const MAX_NOTIFICATIONS_PER_DAY = 2;

/**
 * SPEC-053 BR5 — ⚠️ **o teto que a PLATAFORMA impõe, e não um teto de produto.**
 *
 * O iOS mantém no máximo **64** notificações locais pendentes por app. Com o teto diário de 2 num
 * horizonte de 14 dias, o resto do app já ocupa até 28 — sobram estas para o óleo.
 *
 * ⚠️ **Ele nunca recusa um horário dela.** O dono foi explícito: *"se quiser 10, pode"*, e *"não
 * criar teto arbitrário baixo"*. O que este número faz é **encurtar o horizonte**: com três
 * horários, agenda-se doze dias; com dez, três. A reconciliação a cada abertura repõe o resto, que é
 * exatamente para isso que ela existe. **Ela escolhe quantos horários; o app escolhe quantos dias
 * cabem** — e o que não cabe é o mais distante, nunca o mais próximo.
 *
 * Sem isto, dez horários gerariam 140 agendamentos, o sistema descartaria o excedente **em
 * silêncio**, e ninguém saberia quais sobraram: o pior desfecho possível.
 */
export const OIL_NOTIFICATION_BUDGET = 64 - NOTIFICATION_HORIZON_DAYS * MAX_NOTIFICATIONS_PER_DAY;

/**
 * Highest priority first — this order is what FR6 drops by when a day is over the cap.
 * `reassessment_due` is last on purpose: it is the only one that is not about today.
 */
export const NOTIFICATION_INTENT_TYPES = [
  'care_overdue',
  'care_today',
  'checkin_pending',
  'reassessment_due',
  /**
   * SPEC-040 (F39) — o **quinto** intent. Entra por último de propósito: a ordem desta lista é a
   * prioridade quando o teto diário aperta (FR6), e um cuidado do cronograma vem antes de uma
   * rotina paralela que ela pode fazer a qualquer hora.
   */
  'oil_due',
] as const;
export type NotificationIntentType = (typeof NOTIFICATION_INTENT_TYPES)[number];

export type NotificationPreferences = {
  readonly enabled: boolean;
  /** Local wall-clock time, `HH:MM`. */
  readonly reminderTimeLocal: string;
  readonly checkinReminderEnabled: boolean;
};

/** Nothing is scheduled until she asks for it (BR1). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  reminderTimeLocal: '19:00',
  checkinReminderEnabled: false,
};

/**
 * SPEC-040 FR8 + SPEC-053 — tudo o que os lembretes de óleo precisam saber, **num parâmetro só e
 * obrigatório**.
 *
 * ⚠️ **Os três campos vieram juntos por causa de um defeito real, e o pior tipo deles.** Antes, a
 * data era um parâmetro **opcional** — e o app **nunca a passava**. O resultado: o `oil_due` existia
 * no domínio, tinha teste no core, estava documentado como entregue… e **nunca tocou uma vez**. Uma
 * capability inteira inerte, com tudo verde, porque esquecer um campo opcional não é erro de nada.
 *
 * Obrigatório, esquecer **não compila**. E os três juntos porque passar a data sem os horários teria
 * a mesma forma de falha uma camada adiante: os lembretes que ela cadastrou um a um simplesmente não
 * tocariam, e nada acusaria.
 *
 * ⚠️ **Os horários chegam como `HH:MM`, não como o tipo do outro contexto.** Notifications lê Care
 * Tracking por linguagem publicada (DOMAIN-MAP §4), e um horário não precisa de mais que isso.
 */
export type OilReminderInput = {
  /** A data da próxima ocorrência, ou `null` quando ela não tem rotina (EC6). */
  readonly dueOn: string | null;
  /** Os horários **com lembrete ligado**. Vazio = a rotina da SPEC-040: um lembrete, no horário global. */
  readonly times: readonly string[];
  /** O intervalo dela, para projetar as próximas ocorrências (FR9). */
  readonly everyDays: number | null;
};

export type NotificationIntent = {
  /** Deterministic (FR9/ADR-009): the same state always yields the same id, so reconciling is idempotent. */
  readonly id: string;
  readonly type: NotificationIntentType;
  /** The user's civil day the notification fires on. */
  readonly date: string;
  /** Local wall-clock time, `HH:MM`. */
  readonly time: string;
  readonly title: string;
  readonly body: string;
};

/**
 * Fixed catalogue (BR4). The only variable is a count — never a name, a note, a product or
 * anything else the user typed, so a notification cannot leak her data onto a lock screen.
 */
const copyFor = (type: NotificationIntentType, careCount: number): { title: string; body: string } => {
  switch (type) {
    case 'care_overdue':
      return {
        title: 'Cuidado atrasado',
        body:
          careCount > 1
            ? `Você tem ${careCount} cuidados atrasados. Dá para fazer hoje, reagendar ou pular.`
            : 'Você tem um cuidado atrasado. Dá para fazer hoje, reagendar ou pular.',
      };
    case 'care_today':
      return {
        title: 'Cuidado de hoje',
        body:
          careCount > 1
            ? `Você tem ${careCount} cuidados no cronograma hoje.`
            : 'Você tem um cuidado no cronograma hoje.',
      };
    case 'checkin_pending':
      return { title: 'Como ficou?', body: 'Conta rapidinho como o cabelo ficou depois do cuidado.' };
    case 'reassessment_due':
      return {
        title: 'Seu cronograma chegou ao fim',
        body: 'Reavalie seu cabelo para montar as próximas semanas.',
      };
    /**
     * SPEC-040 — o texto diz **o que ela programou**, e nada sobre o que o óleo faz (BR4/NG2/NG3).
     * "Hidrata as pontas" ou "sela os fios" seria afirmação capilar na tela de bloqueio, sem
     * sign-off e sem contexto (D-26/D-70).
     */
    case 'oil_due':
      return { title: 'Hora do seu óleo', body: 'Você programou o óleo para hoje.' };
  }
};

/**
 * ⚠️ **O id ganhou um `slot`, e sem ele a SPEC-053 seria silenciosamente impossível.**
 *
 * O id determinístico era `tipo:data` — o que significa **um por tipo por dia**. Com vários
 * horários de óleo no mesmo dia, o segundo e o terceiro teriam o **mesmo id** do primeiro, e a
 * reconciliação (que substitui por id) manteria **um**. Ela pediria três lembretes, receberia um, e
 * nada acusaria o erro. O `slot` é o horário, então o id volta a identificar **uma** notificação.
 */
const intent = (
  type: NotificationIntentType,
  date: string,
  time: string,
  careCount: number,
  slot?: string,
): NotificationIntent => ({
  id: slot ? `${type}:${date}:${slot}` : `${type}:${date}`,
  type,
  date,
  time,
  ...copyFor(type, careCount),
});

/** A care still worth reminding about: planned or overdue, never one already resolved (BR2). */
const isActionable = (item: CareItem): boolean => item.outcome === 'planned' || item.outcome === 'overdue';

/**
 * The last day the plan covers — the anchor for `reassessment_due` (SPEC-008 §9.1, D-82).
 *
 * Deliberately every care in the view, whatever became of it: a plan's last day is a fact about the
 * plan, not about how she got through it. Anchoring on what is still *actionable* would move the
 * reminder every time she completed or skipped something, and would delete it entirely the moment
 * she finished the last care — which is exactly the moment she needs it.
 */
const lastPlannedDate = (view: TodayView): string | null => {
  let last: string | null = null;
  for (const item of [...view.overdue, ...view.today, ...view.upcoming, ...view.history]) {
    if (last === null || item.plannedDate > last) last = item.plannedDate;
  }
  return last;
};

/**
 * The complete set of local notifications that should exist right now (SPEC-008 §9.1).
 *
 * Pure and total: it never reads a clock. `today` and `nowLocalTime` are inputs (ADR-008), which is
 * what lets "do not schedule something already past" be a tested rule rather than a runtime accident.
 *
 * The caller replaces everything it has scheduled with this exact set, so correctness here is the
 * whole feature: a stale intent means reminding her about a care she already did (G4).
 */
export const buildNotificationIntents = (input: {
  view: TodayView;
  preferences: NotificationPreferences;
  today: LocalDate;
  /** Local wall-clock time now, `HH:MM` — used only to skip today's slot once it has passed (FR7). */
  nowLocalTime: string;
  /**
   * SPEC-022 — cronograma pausado. Lembrar alguém de um compromisso que ela **suspendeu** é a forma
   * mais direta de transformar uma pausa em cobrança, e o Blueprint §5 pede exatamente o contrário.
   *
   * Parâmetro, e não uma porta dos fundos na tela: o estado pausado é real, não simulado, e quem
   * agenda tem de enxergar a mesma pausa que a Hoje enxerga (BR2).
   */
  paused?: boolean;
  /**
   * SPEC-040 FR8 — a data da próxima ocorrência da rotina de óleo, ou `null` quando ela não tem
   * rotina (EC6).
   *
   * Parâmetro **derivado**, e não a rotina crua: quem decide quando é a próxima vez é
   * `buildOilRoutineView`, e uma segunda contagem aqui divergiria dela na primeira mudança de regra.
   *
   * ⚠️ **Pausada, isto também se cala** — o `return` de `paused` acontece antes, de propósito. A
   * rotina de óleo **não é o cronograma** e continua contando (a Hoje segue mostrando), mas
   * "pausada, nada toca" é garantia da SPEC-022 já validada, e um lembrete novo que passasse por
   * cima dela a enfraqueceria. Pausa é ela dizendo *não me cobre esta semana*, e o aparelho não
   * sabe distinguir qual cobrança ela quis suspender.
   */
  oil: OilReminderInput;
}): readonly NotificationIntent[] => {
  const { view, preferences, today, nowLocalTime, paused = false, oil } = input;
  const { dueOn: oilDueOn, times: oilTimes, everyDays: oilEveryDays } = oil;
  if (paused) return []; // FR2 — pausada, nada toca
  if (!preferences.enabled) return []; // BR1: opt-in, and the only way to get an empty set for free

  const time = preferences.reminderTimeLocal;
  const horizonEnd = addDays(today, NOTIFICATION_HORIZON_DAYS);
  const todaySlotPassed = nowLocalTime >= time; // 'HH:MM' compares correctly as a string
  const usableToday = (date: string): boolean => date !== today || !todaySlotPassed;

  const intents: NotificationIntent[] = [];

  if (view.overdue.length > 0 && usableToday(today)) {
    intents.push(intent('care_overdue', today, time, view.overdue.length));
  }

  // One reminder per day, not one per care (EC6): grouped by the day it is planned for.
  const byDate = new Map<string, number>();
  for (const item of [...view.today, ...view.upcoming]) {
    if (!isActionable(item)) continue;
    if (item.plannedDate < today || item.plannedDate > horizonEnd) continue;
    if (!usableToday(item.plannedDate)) continue;
    byDate.set(item.plannedDate, (byDate.get(item.plannedDate) ?? 0) + 1);
  }
  for (const [date, count] of byDate) intents.push(intent('care_today', date, time, count));

  if (
    preferences.checkinReminderEnabled &&
    usableToday(today) &&
    view.today.some((item) => item.outcome === 'done' && canCheckIn(item))
  ) {
    intents.push(intent('checkin_pending', today, time, 0));
  }

  // D-82 — the day after her plan's last day, she is told the cycle is over instead of the app
  // simply going quiet. Anchored to a date that does not move, so it fires once: as soon as that
  // day is behind her the intent stops being produced, and there is no daily nagging to suppress.
  // A new plan re-anchors it, because the view it is derived from is the new plan's.
  /**
   * SPEC-040 FR8 — a rotina de óleo, quando vence dentro do horizonte.
   *
   * **Uma só, na data em que vence**, e nunca uma por dia de atraso: uma rotina vencida há uma
   * semana não vira sete notificações. Vencida antes de hoje, o lembrete cabe **hoje** — é o
   * primeiro dia em que ela ainda pode agir.
   */
  /**
   * SPEC-053 — ⚠️ **os intents de óleo saem daqui e NÃO passam pelo teto diário** (ver o final).
   */
  const oilIntents: NotificationIntent[] = [];
  if (oilDueOn !== null) {
    const due = (oilDueOn < today ? today : oilDueOn) as LocalDate;
    if (oilTimes.length === 0) {
      // SPEC-040 intacta: sem horários, **um** lembrete, no horário global do app (FR4).
      if (due <= horizonEnd && usableToday(due)) oilIntents.push(intent('oil_due', due, time, 0));
    } else {
      /**
       * SPEC-053 FR9 — as próximas ocorrências, uma por horário.
       *
       * ⚠️ **Projetar a agenda que ELA configurou não é supor comportamento.** A SPEC-040 emitia um
       * lembrete só, na data de vencimento, e estava certa quando não havia horários: a próxima data
       * depende de ela fazer. Com horários que ela cadastrou um a um, dar só hoje deixaria quem não
       * abre o app amanhã sem os lembretes que pediu.
       *
       * ⚠️ **Um horário só é usável hoje se ainda não passou** — e o que decide isso é o horário
       * **dele**, não o global. Sem isso, um lembrete das 08:00 seria agendado às 14:00.
       */
      const step = oilEveryDays && oilEveryDays > 0 ? oilEveryDays : 1;
      const ordenados = [...oilTimes].sort();
      for (let date = due; date <= horizonEnd; date = addDays(date, step)) {
        for (const at of ordenados) {
          if (date === today && nowLocalTime >= at) continue;
          oilIntents.push(intent('oil_due', date, at, 0, at));
        }
      }
    }
  }

  const last = lastPlannedDate(view);
  if (last !== null) {
    const due = addDays(last as LocalDate, 1);
    if (due >= today && due <= horizonEnd && usableToday(due)) {
      intents.push(intent('reassessment_due', due, time, 0));
    }
  }

  // FR6: at most MAX_NOTIFICATIONS_PER_DAY on any day, dropping the least important first.
  const rank = (type: NotificationIntentType): number => NOTIFICATION_INTENT_TYPES.indexOf(type);
  const kept = new Map<string, NotificationIntent[]>();
  for (const candidate of [...intents].sort(
    (a, b) => a.date.localeCompare(b.date) || rank(a.type) - rank(b.type),
  )) {
    const sameDay = kept.get(candidate.date) ?? [];
    if (sameDay.length < MAX_NOTIFICATIONS_PER_DAY) {
      sameDay.push(candidate);
      kept.set(candidate.date, sameDay);
    }
  }

  /**
   * SPEC-053 BR6 — ⚠️ **os lembretes de óleo NÃO entram no teto diário, e isso é decisão, não
   * esquecimento.**
   *
   * O teto de 2 existe para o que o **app** decide cutucar: cuidado de hoje, atrasado, check-in,
   * reavaliação. Estes são **alarmes que ela programou um a um** — aplicar o teto significaria
   * descartar em silêncio o segundo horário que ela pediu, que é a definição do *"teto arbitrário
   * baixo"* que o dono proibiu.
   *
   * O que os limita é o **orçamento da plataforma**, e o corte é pelo tempo: ordena por quando
   * tocam e mantém o que cabe, então o que se perde é sempre o **mais distante** — o que a
   * reconciliação da próxima abertura repõe.
   */
  const oilKept = oilIntents
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, OIL_NOTIFICATION_BUDGET);

  return [...[...kept.values()].flat(), ...oilKept];
};
