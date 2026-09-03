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
 */
export const OIL_INTERVAL_OPTIONS = [2, 3, 7, 15] as const;

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
};

const EMPTY: OilRoutineView = {
  state: 'none',
  everyDays: null,
  dueOn: null,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
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
}): OilRoutineView => {
  const { routine, events, today } = input;
  if (!routine) return EMPTY;

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
  };
};
