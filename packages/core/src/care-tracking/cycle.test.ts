import type { LocalDate } from '../shared/time/index.ts';
import { CYCLE_WEEKS, buildCycleView, groupIntoWeeks } from './domain/cycle.ts';
import type { CareExecution } from './domain/care-tracking.ts';
import type { ScheduledCare } from '../schedule/index.ts';

/**
 * SPEC-016 fatia 3 e SPEC-019 — o agrupamento por semana e a leitura do ciclo em cima dele.
 * O teste de tela afirma o que ela lê; isto fixa o balde por baixo, que é onde agrupamento por
 * semana erra: nos dias de fronteira.
 */

const care = (plannedDate: string) => ({ plannedDate });

describe('groupIntoWeeks', () => {
  const start = '2026-08-31' as LocalDate; // a Monday

  it('puts days 0 through 6 in week 1 and day 7 in week 2', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-06'), care('2026-09-07')], start);
    expect(weeks.map((w) => w.number)).toEqual([1, 2]);
    expect(weeks[0]?.items.map((i) => i.plannedDate)).toEqual(['2026-08-31', '2026-09-06']);
    expect(weeks[1]?.items.map((i) => i.plannedDate)).toEqual(['2026-09-07']);
  });

  it('numbers four weeks of a full plan in order', () => {
    const weeks = groupIntoWeeks(
      [care('2026-08-31'), care('2026-09-07'), care('2026-09-14'), care('2026-09-21')],
      start,
    );
    expect(weeks.map((w) => w.number)).toEqual([1, 2, 3, 4]);
    expect(weeks.every((w) => w.items.length === 1)).toBe(true);
  });

  /** A card saying "Semana 3" over blank space reads as something missing. */
  it('drops weeks with nothing in them instead of rendering them empty', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-14')], start);
    expect(weeks.map((w) => w.number)).toEqual([1, 3]);
  });

  it('keeps the order the engine placed them in, within a week', () => {
    const weeks = groupIntoWeeks([care('2026-09-02'), care('2026-08-31')], start);
    expect(weeks[0]?.items.map((i) => i.plannedDate)).toEqual(['2026-09-02', '2026-08-31']);
  });

  it('crosses a month boundary without renumbering', () => {
    const weeks = groupIntoWeeks([care('2026-08-31'), care('2026-09-01')], start);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.number).toBe(1);
  });

  /**
   * A care before the start date would be a bug upstream. Clamping keeps it on screen; dropping it
   * or letting it fall into a negative bucket would hide the very thing worth noticing.
   */
  it('clamps a care dated before the start into the first week rather than hiding it', () => {
    const weeks = groupIntoWeeks([care('2026-08-24'), care('2026-08-31')], start);
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.items).toHaveLength(2);
  });

  it('returns nothing for an empty plan', () => {
    expect(groupIntoWeeks([], start)).toEqual([]);
  });
});

/**
 * SPEC-019 — a leitura do ciclo. O que vale travar aqui não é a aparência: é que a forma do mês
 * apareça inteira, que "onde estou" nunca minta, e que nada suma por ter sido reagendado.
 */
describe('buildCycleView (SPEC-019)', () => {
  const START = '2026-08-31' as LocalDate; // segunda-feira

  const care = (
    id: string,
    plannedDate: string,
    status: ScheduledCare['status'] = 'planned',
  ): ScheduledCare =>
    ({
      id,
      careTypeCode: 'hydration',
      plannedDate,
      status,
      rescheduledToId: null,
    }) as ScheduledCare;

  const execution = (id: string, scheduledCareId: string, executedOn: string): CareExecution => ({
    id,
    scheduledCareId,
    executedAt: `${executedOn}T10:00:00Z`,
    executedOn,
    voidedAt: null,
  });

  it('mostra sempre as quatro semanas, inclusive as que não têm nada', () => {
    const view = buildCycleView([care('c1', '2026-08-31')], [], START, '2026-09-01' as LocalDate);
    expect(view.weeks.map((w) => w.number)).toEqual([1, 2, 3, 4]);
    expect(view.weeks[1]?.items).toEqual([]);
    // A forma do mês é a informação: uma semana vazia diz que nada foi planejado, e some seria pior.
    expect(view.weeks).toHaveLength(CYCLE_WEEKS);
  });

  it('dá a cada semana o seu intervalo de datas, e o ciclo termina no 28º dia', () => {
    const view = buildCycleView([], [], START, START);
    expect(view.weeks.map((w) => [w.startsOn, w.endsOn])).toEqual([
      ['2026-08-31', '2026-09-06'],
      ['2026-09-07', '2026-09-13'],
      ['2026-09-14', '2026-09-20'],
      ['2026-09-21', '2026-09-27'],
    ]);
    expect(view.endsOn).toBe('2026-09-27');
  });

  it('marca exatamente uma semana como a corrente', () => {
    const view = buildCycleView([], [], START, '2026-09-16' as LocalDate);
    expect(view.weeks.filter((w) => w.isCurrent).map((w) => w.number)).toEqual([3]);
    expect(view.outsideWindow).toBe(false);
  });

  /** FR4 — a tela não pode dizer que ela está numa semana quando ela não está em nenhuma. */
  it('não marca nenhuma semana quando hoje está fora do ciclo', () => {
    const before = buildCycleView([], [], START, '2026-08-30' as LocalDate);
    expect(before.weeks.some((w) => w.isCurrent)).toBe(false);
    expect(before.outsideWindow).toBe(true);

    const after = buildCycleView([], [], START, '2026-09-28' as LocalDate);
    expect(after.weeks.some((w) => w.isCurrent)).toBe(false);
    expect(after.outsideWindow).toBe(true);

    // O último dia ainda é dentro: a fronteira é inclusiva, e errá-la apagaria a semana 4 inteira.
    const last = buildCycleView([], [], START, '2026-09-27' as LocalDate);
    expect(last.weeks.filter((w) => w.isCurrent).map((w) => w.number)).toEqual([4]);
  });

  it('deriva o estado de cada cuidado exatamente como a Hoje deriva', () => {
    const cares = [
      care('done', '2026-08-31'),
      care('late', '2026-09-01'),
      care('skip', '2026-09-02', 'skipped'),
      care('next', '2026-09-10'),
    ];
    const view = buildCycleView(
      cares,
      [execution('e1', 'done', '2026-08-31')],
      START,
      '2026-09-05' as LocalDate,
    );
    const outcomes = Object.fromEntries(view.weeks.flatMap((w) => w.items).map((i) => [i.id, i.outcome]));
    expect(outcomes).toEqual({ done: 'done', late: 'overdue', skip: 'skipped', next: 'planned' });
  });

  /** D-12: desfazer devolve o cuidado ao estado pela data, sem apagar a linha da execução. */
  it('uma execução anulada não conta como feita', () => {
    const voided: CareExecution = {
      ...execution('e1', 'c1', '2026-08-31'),
      voidedAt: '2026-08-31T10:05:00Z',
    };
    const view = buildCycleView([care('c1', '2026-08-31')], [voided], START, '2026-09-05' as LocalDate);
    expect(view.weeks[0]?.items[0]?.outcome).toBe('overdue');
  });

  /**
   * FR5 — reagendar dentro do ciclo cria uma linha nova e marca a original; as duas aparecem, em
   * semanas diferentes, porque o histórico não é reescrito (D-69).
   */
  it('mostra a origem e o destino de um reagendamento, cada um na sua semana', () => {
    const view = buildCycleView(
      [care('origem', '2026-09-01', 'rescheduled'), care('destino', '2026-09-15')],
      [],
      START,
      '2026-09-05' as LocalDate,
    );
    expect(view.weeks[0]?.items.map((i) => [i.id, i.outcome])).toEqual([['origem', 'rescheduled']]);
    expect(view.weeks[2]?.items.map((i) => i.id)).toEqual(['destino']);
  });

  /** EC4 — reagendar pode passar do fim do plano; inventar uma quinta semana seria desenhar um ciclo que não existe. */
  it('separa o que caiu depois do ciclo em vez de criar uma quinta semana', () => {
    const view = buildCycleView(
      [care('dentro', '2026-09-27'), care('depois', '2026-09-28')],
      [],
      START,
      '2026-09-05' as LocalDate,
    );
    expect(view.weeks).toHaveLength(CYCLE_WEEKS);
    expect(view.weeks[3]?.items.map((i) => i.id)).toEqual(['dentro']);
    expect(view.beyond.map((i) => i.id)).toEqual(['depois']);
  });

  it('ordena por data dentro da semana, para a leitura seguir o calendário', () => {
    const view = buildCycleView(
      [care('b', '2026-09-03'), care('a', '2026-09-01')],
      [],
      START,
      '2026-09-05' as LocalDate,
    );
    expect(view.weeks[0]?.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('um ciclo recém-criado é quatro semanas de cuidados por vir, não uma tela vazia', () => {
    const view = buildCycleView([care('c1', '2026-08-31'), care('c2', '2026-09-08')], [], START, START);
    expect(view.weeks.flatMap((w) => w.items).every((i) => i.outcome === 'planned')).toBe(true);
    expect(view.beyond).toEqual([]);
  });
});
