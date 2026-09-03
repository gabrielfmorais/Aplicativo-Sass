import { describe, expect, it } from 'vitest';

import { localDateFromString } from '../shared/time/index.ts';
import {
  OIL_EVENT_KINDS,
  OIL_INTERVAL_OPTIONS,
  buildOilRoutineView,
  type OilEvent,
} from './domain/oil-routine.ts';

const d = (iso: string) => localDateFromString(iso);
const done = (iso: string, id = iso): OilEvent => ({ id, kind: 'done', happenedOn: d(iso) });
const postponed = (iso: string, id = `p${iso}`): OilEvent => ({
  id,
  kind: 'postponed',
  happenedOn: d(iso),
});

const view = (routine: { everyDays: number; startedOn: string } | null, events: OilEvent[], today: string) =>
  buildOilRoutineView({
    routine: routine ? { everyDays: routine.everyDays, startedOn: d(routine.startedOn) } : null,
    events,
    today: d(today),
  });

describe('rotina de óleo — a próxima vez (SPEC-040 FR5)', () => {
  it('sem rotina, não há nada — e nada é diferente de zero (EC6)', () => {
    const v = view(null, [], '2026-09-10');
    expect(v.state).toBe('none');
    expect(v.dueOn).toBeNull();
    expect(v.everyDays).toBeNull();
  });

  /** EC1 — a rotina começa quando ela diz que começou, e não daqui a `everyDays`. */
  it('sem nenhum feito, a primeira ocorrência é o dia em que ela ligou', () => {
    const v = view({ everyDays: 7, startedOn: '2026-09-10' }, [], '2026-09-10');
    expect(v.dueOn).toBe('2026-09-10');
    expect(v.state).toBe('due_today');
  });

  /** BR1 — a próxima deriva do ÚLTIMO FEITO, não de uma contagem desde o começo. */
  it('depois de um feito, a próxima é o feito mais o intervalo', () => {
    const v = view({ everyDays: 3, startedOn: '2026-09-01' }, [done('2026-09-09')], '2026-09-10');
    expect(v.dueOn).toBe('2026-09-12');
    expect(v.state).toBe('upcoming');
    expect(v.lastDoneOn).toBe('2026-09-09');
    expect(v.doneCount).toBe(1);
  });

  /**
   * D-28/BR3/EC2 — **nada se acumula.** Quem sumiu três semanas volta com **uma** ocorrência
   * vencida, não com sete em fila. Contar a partir de `startedOn` produziria a fila, e cobrar o que
   * passou é exatamente o que a D-28 proíbe.
   */
  it('sumir por semanas deixa UMA ocorrência vencida, nunca uma fila', () => {
    const v = view({ everyDays: 3, startedOn: '2026-08-01' }, [done('2026-08-20')], '2026-09-10');
    expect(v.dueOn).toBe('2026-08-23');
    expect(v.state).toBe('overdue');
    expect(v.daysLate).toBe(18);
  });

  it('o último feito é o mais recente, mesmo fora de ordem', () => {
    const v = view(
      { everyDays: 2, startedOn: '2026-09-01' },
      [done('2026-09-03'), done('2026-09-08'), done('2026-09-05')],
      '2026-09-10',
    );
    expect(v.lastDoneOn).toBe('2026-09-08');
    expect(v.dueOn).toBe('2026-09-10');
    expect(v.doneCount).toBe(3);
  });
});

describe('rotina de óleo — adiar (SPEC-040 BR2)', () => {
  it('empurra um dia, e não é falha', () => {
    const v = view({ everyDays: 7, startedOn: '2026-09-10' }, [postponed('2026-09-10')], '2026-09-10');
    expect(v.dueOn).toBe('2026-09-11');
    expect(v.state).toBe('upcoming');
    expect(v.daysLate).toBe(0);
  });

  it('adiar duas vezes empurra dois dias', () => {
    const v = view(
      { everyDays: 7, startedOn: '2026-09-10' },
      [postponed('2026-09-10'), postponed('2026-09-11')],
      '2026-09-11',
    );
    expect(v.dueOn).toBe('2026-09-12');
  });

  /**
   * A barreira que o desenho ingênuo quebraria: um adiamento de março não pode empurrar a data de
   * hoje. Adiamentos anteriores ao último feito pertencem a ocorrências já resolvidas por ele.
   */
  it('um adiamento anterior ao último feito não empurra nada', () => {
    const v = view(
      { everyDays: 3, startedOn: '2026-03-01' },
      [postponed('2026-03-02'), done('2026-09-09')],
      '2026-09-10',
    );
    expect(v.dueOn).toBe('2026-09-12');
  });

  it('adiar não conta como feito', () => {
    const v = view({ everyDays: 7, startedOn: '2026-09-10' }, [postponed('2026-09-10')], '2026-09-10');
    expect(v.doneCount).toBe(0);
    expect(v.lastDoneOn).toBeNull();
  });
});

describe('rotina de óleo — o que ela NÃO diz (SPEC-040 NG2/BR4/BR6)', () => {
  /**
   * ⚠️ **Barreira do D-26/D-70.** O intervalo é uma marca de calendário que ela escolhe, como o
   * `wash_frequency` do perfil. No dia em que alguém marcar um deles como recomendado, ideal ou
   * "para o seu cabelo", isto vira afirmação capilar sem sign-off — e é engenharia inventando regra
   * de domínio, que é a coisa que o D-26 existe para impedir.
   */
  it('as opções de intervalo são números, sem nenhuma marcada como recomendada', () => {
    expect([...OIL_INTERVAL_OPTIONS]).toEqual([1, 2, 3, 7, 15]);
    for (const option of OIL_INTERVAL_OPTIONS) {
      expect(typeof option).toBe('number');
    }
  });

  it('a rotina tem duas respostas, e nenhuma delas é uma nota', () => {
    expect([...OIL_EVENT_KINDS]).toEqual(['done', 'postponed']);
  });

  /** NG3 — `daysLate` é um fato, e fora de `overdue` não existe nota nenhuma a exibir. */
  it('não existe atraso fora do estado vencido', () => {
    expect(view({ everyDays: 7, startedOn: '2026-09-10' }, [], '2026-09-09').daysLate).toBe(0);
    expect(view({ everyDays: 7, startedOn: '2026-09-10' }, [], '2026-09-10').daysLate).toBe(0);
  });
});

/**
 * SPEC-040 EC7 — **medido no DEV real**, e não previsto quando a SPEC foi escrita.
 *
 * Ela adia hoje, desliga a rotina e liga de novo no mesmo dia. A rotina nova nasce com
 * `startedOn = hoje`, mas o adiamento de hoje **continua valendo**: a próxima é amanhã.
 *
 * É o comportamento certo, e por isso está fixado aqui em vez de "corrigido": ela disse *hoje não*,
 * e um religar no mesmo dia não desdiz aquilo — mostrar "é hoje" logo depois seria cobrar o que ela
 * acabou de recusar. E não há vazamento do passado: um adiamento antigo tem `happenedOn + 1` menor
 * que a data nova, então não empurra nada.
 */
describe('rotina de óleo — desligar e ligar de novo (SPEC-040 EC4/EC7)', () => {
  it('o adiamento de HOJE sobrevive ao religar no mesmo dia', () => {
    const v = view({ everyDays: 7, startedOn: '2026-09-03' }, [postponed('2026-09-03')], '2026-09-03');
    expect(v.dueOn).toBe('2026-09-04');
    expect(v.state).toBe('upcoming');
  });

  it('um adiamento antigo não empurra a rotina nova', () => {
    const v = view({ everyDays: 7, startedOn: '2026-09-03' }, [postponed('2026-03-01')], '2026-09-03');
    expect(v.dueOn).toBe('2026-09-03');
    expect(v.state).toBe('due_today');
  });

  /** BR2 — depois de um feito, o adiamento do mesmo dia deixa de contar: a ocorrência foi resolvida. */
  it('depois de um feito, o adiamento do mesmo dia não conta mais', () => {
    const v = view(
      { everyDays: 7, startedOn: '2026-09-03' },
      [postponed('2026-09-03'), done('2026-09-03')],
      '2026-09-03',
    );
    expect(v.dueOn).toBe('2026-09-10');
    expect(v.lastDoneOn).toBe('2026-09-03');
  });
});

/**
 * SPEC-040 — **a rotina diária** (decisão do dono, 2026-09-03).
 *
 * O banco sempre aceitou `1` (`every_days between 1 and 60`) e a derivação nunca soube o que é uma
 * semana — mas a **lista oferecida** ia de dois em diante, e uma capability que aceita um valor no
 * schema e o esconde da tela **não tem** aquele valor. Estes testes fixam o diário como caminho de
 * primeira classe, e não como caso de borda.
 */
describe('rotina de óleo — diária (SPEC-040)', () => {
  it('1 dia é uma opção oferecida, e a primeira da lista', () => {
    expect(OIL_INTERVAL_OPTIONS[0]).toBe(1);
    expect(OIL_INTERVAL_OPTIONS).toContain(1);
  });

  it('feito hoje com intervalo diário: a próxima é AMANHÃ', () => {
    const v = view({ everyDays: 1, startedOn: '2026-09-01' }, [done('2026-09-03')], '2026-09-03');
    expect(v.dueOn).toBe('2026-09-04');
    expect(v.state).toBe('upcoming');
  });

  it('e amanhã ela vence de novo — todo dia é todo dia', () => {
    const v = view({ everyDays: 1, startedOn: '2026-09-01' }, [done('2026-09-03')], '2026-09-04');
    expect(v.state).toBe('due_today');
  });

  it('adiar continua funcionando no diário', () => {
    const v = view(
      { everyDays: 1, startedOn: '2026-09-03' },
      [done('2026-09-02'), postponed('2026-09-03')],
      '2026-09-03',
    );
    expect(v.dueOn).toBe('2026-09-04');
    expect(v.state).toBe('upcoming');
  });

  it('faltar dias no diário continua sendo UMA ocorrência vencida, não uma fila (D-28)', () => {
    const v = view({ everyDays: 1, startedOn: '2026-08-01' }, [done('2026-08-20')], '2026-09-03');
    expect(v.dueOn).toBe('2026-08-21');
    expect(v.state).toBe('overdue');
    expect(v.daysLate).toBe(13);
  });

  /**
   * ⚠️ **Nada na derivação sabe o que é uma semana.** A regra é `último feito + intervalo`, e o
   * intervalo é um número dela — sete não tem nenhum privilégio no código. Este teste percorre a
   * lista inteira e confere que cada opção se comporta como o próprio número.
   */
  it('nenhuma frequência é privilegiada: cada opção anda exatamente o próprio número', () => {
    for (const days of OIL_INTERVAL_OPTIONS) {
      const v = view({ everyDays: days, startedOn: '2026-09-01' }, [done('2026-09-03')], '2026-09-03');
      const expected = new Date(Date.UTC(2026, 8, 3 + days)).toISOString().slice(0, 10);
      expect(v.dueOn).toBe(expected);
    }
  });
});
