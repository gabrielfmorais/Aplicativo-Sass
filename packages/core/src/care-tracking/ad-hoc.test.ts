import type { ScheduledCare } from '../schedule/index.ts';
import { buildCycleView } from './domain/cycle.ts';
import { buildJourneyView } from '../journey/index.ts';
import { buildProgress } from '../progress/index.ts';
import { localDateFromString } from '../shared/index.ts';
import {
  buildAdHocHistory,
  buildTodayView,
  isAdHoc,
  type CareExecution,
  type CareItem,
  type CheckIn,
} from './index.ts';

/**
 * SPEC-052 — **a execução avulsa: ela fez, e o plano não tinha pedido.**
 *
 * ⚠️ O que estes testes guardam é a fonte de verdade do dono, palavra por palavra: a avulsa
 * **não altera o cronograma**, **não conta como aderência**, **não paga ponto nem sequência**,
 * **não aparece como cuidado planejado** — e ainda assim **alimenta o histórico e a inteligência**.
 *
 * ⚠️ **Nem tudo isso vira teste aqui, e é de propósito.** A proibição do tipo de cuidado ausente
 * numa avulsa é **do compilador** (união discriminada em `CareExecution`) e a dos pontos é **da
 * chave** de `journey_points` — as duas com o seu teste no arquivo de quem as guarda.
 */

const TODAY = localDateFromString('2026-09-10');

const care = (over: Partial<ScheduledCare> & { id: string; plannedDate: string }): ScheduledCare => ({
  careTypeCode: 'hydration',
  status: 'planned',
  rescheduledToId: null,
  ...over,
});

const planejada = (
  over: Partial<CareExecution> & { id: string; scheduledCareId: string },
): CareExecution => ({
  executedAt: '2026-09-10T12:00:00.000Z',
  executedOn: '2026-09-10',
  voidedAt: null,
  ...over,
});

/** A avulsa. ⚠️ Sem `careTypeCode` isto **não compila** — a barreira mora no tipo. */
type Avulsa = Extract<CareExecution, { scheduledCareId: null }>;
const avulsa = (over: Partial<Avulsa> & { id: string }): Avulsa => ({
  executedAt: '2026-09-08T12:00:00.000Z',
  executedOn: '2026-09-08',
  voidedAt: null,
  careTypeCode: 'nutrition',
  ...over,
  scheduledCareId: null,
});

const PLANO = [
  care({ id: 'c1', plannedDate: '2026-09-09' }),
  care({ id: 'c2', plannedDate: '2026-09-10' }),
  care({ id: 'c3', plannedDate: '2026-09-12', careTypeCode: 'nutrition' }),
];

/** O histórico como a tela o monta: o do plano mais o que ela registrou por conta. */
const historico = (
  executions: readonly CareExecution[],
  checkIns: readonly CheckIn[] = [],
): readonly CareItem[] =>
  buildAdHocHistory(buildTodayView(PLANO, executions, TODAY, checkIns).history, executions, checkIns);

describe('SPEC-052 — a avulsa aparece no histórico, e em lugar nenhum mais', () => {
  /** **AC4** — ela registrou, e consegue ver que registrou. */
  it('cai no histórico, com o tipo que ela escolheu e o dia em que fez', () => {
    const item = historico([avulsa({ id: 'x1' })]).find((i) => i.id === 'x1');
    expect(item).toBeDefined();
    expect(item?.careTypeCode).toBe('nutrition');
    expect(item?.plannedDate).toBe('2026-09-08');
    expect(item?.outcome).toBe('done');
    expect(item?.execution?.id).toBe('x1');
  });

  /**
   * **AC3** — a proibição mais importante da fatia. Os três buckets de cima **são o cronograma**;
   * pôr ali o que o plano não pediu diria a ela que o app planejou algo que ele não planejou.
   */
  it('NUNCA aparece como planejada — nem hoje, nem atrasada, nem próxima', () => {
    // O dia da avulsa é hoje, e mesmo assim ela não entra em `today`.
    const execucoes = [avulsa({ id: 'x1', executedOn: '2026-09-10' })];
    const v = buildTodayView(PLANO, execucoes, TODAY);
    for (const bucket of [v.overdue, v.today, v.upcoming]) {
      expect(bucket.some((i) => i.id === 'x1')).toBe(false);
    }
    // ⚠️ E nem no histórico do `TodayView`: ele é o cronograma inteiro, e nada além dele.
    expect(v.history.some((i) => i.id === 'x1')).toBe(false);
    // Ela aparece quando alguém **pede** por ela — e é a tela que pede.
    expect(historico(execucoes).some((i) => i.id === 'x1')).toBe(true);
  });

  /** ⚠️ Dois avulsos no mesmo dia são **dois fatos** (BR2/EC3): o teto de 1 é do cuidado planejado. */
  it('dois avulsos no mesmo dia são dois registros', () => {
    const h = historico([avulsa({ id: 'x1' }), avulsa({ id: 'x2' })]);
    expect(h.filter((i) => i.id === 'x1' || i.id === 'x2')).toHaveLength(2);
  });

  /** **AC6** — anulada é anulada, e não vale só para os insights. */
  it('anulada some do histórico como qualquer execução desfeita', () => {
    const h = historico([avulsa({ id: 'x1', voidedAt: '2026-09-08T13:00:00.000Z' })]);
    expect(h.some((i) => i.id === 'x1')).toBe(false);
  });

  it('`isAdHoc` separa a avulsa da concluída do plano — e é derivado, não um campo', () => {
    const execucoes = [
      planejada({ id: 'e1', scheduledCareId: 'c1', executedOn: '2026-09-09' }),
      avulsa({ id: 'x1' }),
    ];
    const h = historico(execucoes);
    expect(isAdHoc(h.find((i) => i.id === 'x1')!)).toBe(true);
    expect(isAdHoc(h.find((i) => i.id === 'c1')!)).toBe(false);
    // E um cuidado ainda não feito não é avulso: sem execução, não há o que ser.
    expect(buildTodayView(PLANO, execucoes, TODAY).upcoming.every((i) => !isAdHoc(i))).toBe(true);
  });

  /** ⚠️ O check-in pendura na **execução**, então o da avulsa chega ao cartão sem nada novo. */
  it('o check-in da avulsa chega junto, pelo mesmo caminho', () => {
    const checkIn: CheckIn = { id: 'ck1', careExecutionId: 'x1', overallFeel: 5 };
    const h = historico([avulsa({ id: 'x1' })], [checkIn]);
    expect(h.find((i) => i.id === 'x1')?.checkIn?.overallFeel).toBe(5);
  });
});

describe('SPEC-052 — a ordem do histórico misturado', () => {
  it('do mais recente para o mais antigo, sem separar plano de avulso', () => {
    const h = historico([
      planejada({ id: 'e1', scheduledCareId: 'c1', executedOn: '2026-09-09' }),
      avulsa({ id: 'x-antigo', executedOn: '2026-09-05' }),
      avulsa({ id: 'x-novo', executedOn: '2026-09-10' }),
    ]);
    expect(h.map((i) => i.plannedDate)).toEqual([...h.map((i) => i.plannedDate)].sort().reverse());
    expect(h[0]?.id).toBe('x-novo');
  });
});

describe('SPEC-052 — a avulsa não toca o cronograma nem a aderência (AC2)', () => {
  const executions = [planejada({ id: 'e1', scheduledCareId: 'c1', executedOn: '2026-09-09' })];

  /**
   * ⚠️ **A barreira é a mais importante da SPEC depois da AC3**, e ela é estrutural: `Progress` e o
   * ciclo iteram `cares`, e uma execução sem cuidado planejado não está lá. O teste existe para que
   * isso continue verdade se alguém um dia resolver "melhorar" a contagem.
   */
  it('o Progresso é idêntico com e sem execução avulsa', () => {
    const comAvulsas = [...executions, avulsa({ id: 'x1' }), avulsa({ id: 'x2' })];
    const sem = buildProgress(buildTodayView(PLANO, executions, TODAY), 7);
    const com = buildProgress(buildTodayView(PLANO, comAvulsas, TODAY), 7);
    expect(com).toEqual(sem);
    // ⚠️ Explicitamente: nem "feitos", nem o total do ciclo, nem a média de como ela se sentiu.
    expect(com.done).toBe(sem.done);
    expect(com.total).toBe(sem.total);
    expect(com.averageFeel).toBe(sem.averageFeel);
  });

  /**
   * **AC1** — ⚠️ **a proibição que abre a D-103: nenhum incentivo a fazer mais cuidados.**
   *
   * A garantia real é **dupla e estrutural**: os pontos saem de `journey_points`, que chaveia o
   * fato no **cuidado planejado** (SPEC-043) e portanto não tem o que conceder a uma avulsa; e a
   * sequência sai dos buckets do `TodayView`, onde a avulsa não está. Este teste fixa a segunda —
   * a primeira é do banco, e tem o pgTAP dela.
   */
  it('a Jornada é idêntica com e sem execução avulsa — nem ponto, nem sequência, nem marco', () => {
    const comAvulsas = [...executions, avulsa({ id: 'x1' }), avulsa({ id: 'x2', executedOn: '2026-09-10' })];
    const itensDe = (execs: readonly CareExecution[]) => {
      const v = buildTodayView(PLANO, execs, TODAY);
      return [...v.overdue, ...v.today, ...v.upcoming, ...v.history];
    };
    const pontos = [
      {
        factKind: 'care_execution' as const,
        points: 10,
        rulesVersion: 'v1',
        awardedOn: localDateFromString('2026-09-09'),
      },
    ];
    const sem = buildJourneyView({ points: pontos, items: itensDe(executions), today: TODAY });
    const com = buildJourneyView({ points: pontos, items: itensDe(comAvulsas), today: TODAY });
    expect(com).toEqual(sem);
    expect(com.points).toBe(sem.points);
    expect(com.streak).toBe(sem.streak);
    expect(com.caresAttended).toBe(sem.caresAttended);
  });

  it('a visão de ciclo é idêntica com e sem execução avulsa', () => {
    const INICIO = localDateFromString('2026-09-07');
    const sem = buildCycleView(PLANO, executions, INICIO, TODAY);
    const com = buildCycleView(PLANO, [...executions, avulsa({ id: 'x1' })], INICIO, TODAY);
    expect(com).toEqual(sem);
  });

  /**
   * **AC9** — o que já funcionava continua igual, com a avulsa no meio das execuções.
   *
   * ⚠️ **O `TodayView` INTEIRO é idêntico, histórico incluído** — e é essa igualdade que garante
   * `Progress` e ciclo de graça, porque os dois derivam dele. A avulsa só existe para quem chama
   * `buildAdHocHistory`, e a linha a mais aparece lá.
   */
  it('o TodayView é idêntico com e sem execução avulsa', () => {
    const sem = buildTodayView(PLANO, executions, TODAY);
    const com = buildTodayView(PLANO, [...executions, avulsa({ id: 'x1' })], TODAY);
    expect(com).toEqual(sem);
    expect(buildAdHocHistory(com.history, [...executions, avulsa({ id: 'x1' })])).toHaveLength(
      sem.history.length + 1,
    );
  });
});
