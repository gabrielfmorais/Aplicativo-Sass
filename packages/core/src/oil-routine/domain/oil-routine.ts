import { z } from 'zod';

import { addDays, diffDays, type LocalDate } from '../../shared/time/index.ts';

/**
 * SPEC-040 (F39) — a rotina de óleo.
 *
 * > *"Lembrar do óleo. Simples assim."* — Blueprint §23
 *
 * ⚠️ **Nada aqui diz o que o óleo faz.** O intervalo é um número de dias que **ela** escolhe, como o
 * `wash_frequency` do perfil. Com que frequência ela deveria passar óleo, onde, como, qual e por quê
 * é conteúdo capilar substantivo ⇒ gate D-26/D-70.
 */

/**
 * Os intervalos oferecidos — **nenhum é recomendado** (BR6/NG2).
 *
 * São marcas de calendário, não conselho: marcar um deles como "ideal" ou "para o seu cabelo" seria
 * exatamente a afirmação que esta SPEC não pode fazer. A lista existe para ela escolher rápido, e a
 * barreira de teste garante que nenhum rótulo a transforme em orientação.
 *
 * ⚠️ **O diário abre a lista, e não é detalhe.** O banco sempre aceitou `1` (`between 1 and 60`) e a
 * derivação nunca soube o que é uma semana — mas **a lista não oferecia**, então quem passa óleo
 * todo dia não conseguia dizer isso. Uma capability que aceita um valor no schema e o esconde da
 * tela **não tem** aquele valor.
 *
 * ⚠️ E ele entra como **escolha dela**, nunca como sugestão: nenhuma opção é marcada, ordenada por
 * mérito ou apresentada como o certo. Com que frequência ela **deveria** passar óleo continua sendo
 * conteúdo capilar substantivo ⇒ D-26/D-70.
 */
export const OIL_INTERVAL_OPTIONS = [1, 2, 3, 7, 15] as const;

export const OIL_EVENT_KINDS = ['done', 'postponed'] as const;

export const OilEventKindSchema = z.enum(OIL_EVENT_KINDS);

export type OilEventKind = z.infer<typeof OilEventKindSchema>;

export type OilRoutine = {
  /** De quantos em quantos dias, escolhido por ela. */
  readonly everyDays: number;
  /** Quando ela começou. Não reseta ao trocar o intervalo — a história é dela. */
  readonly startedOn: LocalDate;
};

export type OilEvent = {
  readonly id: string;
  readonly kind: OilEventKind;
  readonly happenedOn: LocalDate;
};

/**
 * SPEC-053 (F39, evolução) — **um horário do dia em que ela quer lembrar do óleo.**
 *
 * ⚠️ **Um `time` civil, não um instante.** "12:00" é 12:00 onde ela estiver; quem o converte em
 * instante é o agendador, com o fuso dela (ADR-008). É a mesma escolha do `reminderTimeLocal` da
 * SPEC-008, e é o que faz a rotina sobreviver a uma viagem sem virar outra rotina.
 *
 * ⛔ **Nenhum horário é recomendado, sugerido ou ordenado por mérito.** Com que frequência ela
 * deveria passar óleo é conteúdo capilar substantivo ⇒ D-26/D-70.
 */
export type OilRoutineTime = {
  readonly id: string;
  /** `HH:MM`, o horário civil dela. */
  readonly at: string;
  /** Desligado, ele **continua na rotina** e continua registrável — só não toca (FR3). */
  readonly reminderEnabled: boolean;
};

/**
 * `none` só acontece sem rotina. Com rotina, sempre há uma próxima data — o que muda é se ela já
 * chegou.
 */
export type OilRoutineState = 'none' | 'upcoming' | 'due_today' | 'overdue';

export type OilRoutineView = {
  readonly state: OilRoutineState;
  readonly everyDays: number | null;
  /** A próxima vez, ou `null` sem rotina. */
  readonly dueOn: LocalDate | null;
  /** Quantos dias venceu. Zero fora de `overdue` — é um fato, não uma nota (NG3). */
  readonly daysLate: number;
  readonly lastDoneOn: LocalDate | null;
  readonly doneCount: number;
  /**
   * SPEC-053 — os horários dela, **em ordem cronológica**, com ou sem lembrete.
   *
   * ⚠️ **Vazia é o estado de toda rotina anterior a esta SPEC**, e é o que faz a evolução não pedir
   * nada de quem já usava: sem horários, tudo se comporta exatamente como antes (FR4).
   */
  readonly times: readonly OilRoutineTime[];
};

const EMPTY: OilRoutineView = {
  state: 'none',
  everyDays: null,
  dueOn: null,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
  times: [],
};

/**
 * Quando é a próxima vez, e onde ela está em relação a hoje (FR5).
 *
 * **Puro e total:** `today` é entrada, nunca um relógio lido aqui (ADR-008). É o que permite que
 * "vencida há três dias" seja regra testada em vez de acidente de execução.
 *
 * **BR1 — a próxima data deriva do último feito**, não de uma contagem desde o começo: quem passou
 * óleo ontem tem a próxima daqui a `everyDays`, independentemente de quantas ocorrências passaram em
 * branco. Contar a partir de `startedOn` acumularia uma fila de ocorrências perdidas, que é
 * exatamente o que a D-28 proíbe — o app mostra o estado e pede ação, não cobra o que passou.
 *
 * **BR2 — adiar empurra um dia, e só a ocorrência corrente.** Adiamentos anteriores ao último feito
 * pertencem a ocorrências que já foram resolvidas; contá-los faria um adiamento de março empurrar a
 * data de hoje.
 */
export const buildOilRoutineView = (input: {
  routine: OilRoutine | null;
  events: readonly OilEvent[];
  today: LocalDate;
  /**
   * SPEC-053 — os horários dela. Ausente = rotina sem horários, que é o estado de toda rotina
   * anterior a esta SPEC e o comportamento da SPEC-040 inteiro (FR4).
   */
  times?: readonly OilRoutineTime[];
}): OilRoutineView => {
  const { routine, events, today, times = [] } = input;
  if (!routine) return EMPTY;

  /**
   * ⚠️ **BR1 — o DIA continua sendo a unidade da ocorrência; o horário é quando lembrar.**
   *
   * A alternativa — cada horário com a própria cadência — cria **N séries independentes** que
   * dessincronizam na primeira vez que ela pula uma: quem faz o das 12:00 e esquece o das 17:00
   * passaria a ter duas rotinas andando em datas diferentes, e a tela teria de explicar isso. Por
   * isso nada abaixo desta linha olha para `times`: a derivação da próxima data é **exatamente** a
   * da SPEC-040, com teste de regressão provando que uma rotina sem horários não mudou nada.
   */
  const ordenados = [...times].sort((a, b) => a.at.localeCompare(b.at));

  let lastDoneOn: LocalDate | null = null;
  let doneCount = 0;
  for (const event of events) {
    if (event.kind !== 'done') continue;
    doneCount += 1;
    if (lastDoneOn === null || event.happenedOn > lastDoneOn) lastDoneOn = event.happenedOn;
  }

  let dueOn: LocalDate = lastDoneOn ? addDays(lastDoneOn, routine.everyDays) : routine.startedOn;

  for (const event of events) {
    if (event.kind !== 'postponed') continue;
    // Da ocorrência corrente apenas: um adiamento anterior ao último feito já foi resolvido por ele.
    if (lastDoneOn !== null && event.happenedOn <= lastDoneOn) continue;
    const pushed = addDays(event.happenedOn, 1);
    if (pushed > dueOn) dueOn = pushed;
  }

  const state: OilRoutineState = dueOn > today ? 'upcoming' : dueOn === today ? 'due_today' : 'overdue';

  return {
    state,
    everyDays: routine.everyDays,
    dueOn,
    daysLate: state === 'overdue' ? diffDays(dueOn, today) : 0,
    lastDoneOn,
    doneCount,
    times: ordenados,
  };
};

/**
 * SPEC-071 (F39) — **o próximo momento da rotina**: o dia e, se ela tiver horários, a hora.
 *
 * A entrada em Cuidados dizia *"Próxima: qui, 10/09"*, e a SPEC-053 deu a ela **horários** —
 * inclusive vários no mesmo dia. Uma linha que diz o dia e cala a hora esconde metade do que ela
 * configurou.
 *
 * **Puro e total:** `today` e `nowTime` são **entrada**, nunca relógio lido aqui (ADR-008, e o mesmo
 * contrato do `buildNotificationIntents`). É o que permite testar "todos os horários de hoje já
 * passaram" sem esperar anoitecer.
 *
 * ⚠️ **`at: null` é uma resposta, não uma falha.** Acontece em dois casos honestos: rotina **sem
 * horários** (o estado de toda rotina anterior à SPEC-053, e aí a linha volta a ser exatamente a da
 * SPEC-040), e **hoje com todos os horários já passados** — a ocorrência continua sendo hoje, e
 * dizer *"hoje, 07:30"* às 20:00 seria apontar um horário que não existe mais.
 *
 * ⚠️ **Horário com lembrete DESLIGADO conta.** Ele continua fazendo parte da rotina dela e continua
 * registrável (SPEC-053 FR3) — o que a chave desliga é a notificação, não o horário. Por isso a
 * linha se chama *"Próximo"* e nunca *"Lembrete"*: ela descreve a rotina, não promete um toque.
 */
export type OilNextMoment = {
  readonly on: LocalDate;
  readonly at: string | null;
};

export const nextOilMoment = (
  view: OilRoutineView,
  today: LocalDate,
  /** O relógio de parede dela, `HH:MM`. */
  nowTime: string,
): OilNextMoment | null => {
  if (view.state === 'none' || view.dueOn === null) return null;
  const times = view.times;
  if (times.length === 0) return { on: view.dueOn, at: null };
  // `times` já vem em ordem cronológica do `buildOilRoutineView`; não reordenar aqui evita duas
  // regras de ordem para a mesma lista.
  const first = times[0]!.at;
  if (view.dueOn !== today) return { on: view.dueOn, at: first };
  // É hoje: o próximo horário que ainda não passou. `HH:MM` compara como string (24h, zero à
  // esquerda), então nenhum `Date` entra.
  const ahead = times.find((t) => t.at >= nowTime);
  return { on: today, at: ahead ? ahead.at : null };
};
