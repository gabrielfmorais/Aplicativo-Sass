import { describe, expect, it } from 'vitest';

import { buildTodayView } from '../care-tracking/index.ts';
import { assertProductionRules } from '../shared/domain-rule.ts';
import { localDateFromString } from '../shared/time/index.ts';
import type { JourneyPoint } from './domain/journey.ts';
import { buildJourneyView } from './application/build-journey-view.ts';
import { JOURNEY_RULES_V1, LEVELS_V1, MILESTONES_V1, POINTS_V1 } from './rules/v1/rules.ts';

const TODAY = localDateFromString('2026-09-20');
const d = (iso: string) => localDateFromString(iso);

const care = (id: string, plannedDate: string, status = 'planned') => ({
  id,
  careTypeCode: 'hydration' as const,
  plannedDate: d(plannedDate),
  status: status as 'planned' | 'skipped' | 'rescheduled',
  rescheduledToId: null,
});

const execution = (id: string, careId: string, on: string) => ({
  id,
  scheduledCareId: careId,
  executedAt: `${on}T12:00:00.000Z` as never,
  executedOn: d(on),
  voidedAt: null,
});

const point = (points: number, awardedOn = '2026-09-10'): JourneyPoint => ({
  factKind: 'care_execution',
  points,
  rulesVersion: 'v1',
  awardedOn: d(awardedOn),
});

const view = (
  cares: ReturnType<typeof care>[],
  executions: ReturnType<typeof execution>[],
  points: JourneyPoint[] = [],
  pausedOn: string | null = null,
) =>
  buildJourneyView({
    points,
    items: [
      ...buildTodayView(cares, executions, TODAY, [], pausedOn).overdue,
      ...buildTodayView(cares, executions, TODAY, [], pausedOn).today,
      ...buildTodayView(cares, executions, TODAY, [], pausedOn).upcoming,
      ...buildTodayView(cares, executions, TODAY, [], pausedOn).history,
    ],
    today: TODAY,
    pausedOn,
  });

describe('Jornada — pontos e níveis (SPEC-043 F40)', () => {
  it('soma o que foi concedido, e não recalcula', () => {
    const v = view([], [], [point(10), point(5), point(5)]);
    expect(v.points).toBe(20);
  });

  /**
   * ⚠️ **A regra que impede o histórico de virar ficção** (D-103).
   *
   * Um ponto concedido pela régua v1 continua valendo 10 mesmo que a v2 diga outra coisa. Somar é
   * somar fatos datados; recalcular seria reescrever o passado dela.
   */
  it('um ponto de régua antiga vale o que valia quando foi concedido', () => {
    const antigo: JourneyPoint = {
      factKind: 'care_execution',
      points: 10,
      rulesVersion: 'v0-antiga',
      awardedOn: d('2026-01-01'),
    };
    expect(view([], [], [antigo, point(10)]).points).toBe(20);
  });

  it('sobe de nível pelos limiares da régua, e diz quanto falta', () => {
    expect(view([], [], [point(10)]).level.name).toBe('Começando');
    const emRitmo = view([], [], [point(60)]);
    expect(emRitmo.level.name).toBe('Em ritmo');
    expect(emRitmo.level.toNext).toBe(120);
    expect(emRitmo.level.nextName).toBe('Constante');
  });

  it('no último nível não há próximo a perseguir', () => {
    const v = view(
      [],
      [],
      [
        point(100),
        point(100),
        point(100),
        point(100),
        point(100),
        point(100),
        point(100),
        point(100),
        point(50),
      ],
    );
    expect(v.level.name).toBe('Inabalável');
    expect(v.level.toNext).toBeNull();
  });
});

describe('Jornada — a sequência NÃO é diária (SPEC-043 F41)', () => {
  /**
   * ⚠️ **A proibição central da D-103.** Um streak por dia num plano de 4 a 12 cuidados por mês só
   * se cumpre lavando mais. Aqui a sequência percorre **cuidados planejados**, e um mês inteiro sem
   * cuidado planejado não quebra nada.
   */
  it('dias sem cuidado planejado não quebram nada', () => {
    const v = view(
      [care('a', '2026-08-01'), care('b', '2026-09-01'), care('c', '2026-09-15')],
      [
        execution('e1', 'a', '2026-08-01'),
        execution('e2', 'b', '2026-09-01'),
        execution('e3', 'c', '2026-09-15'),
      ],
    );
    expect(v.streak).toBe(3);
  });

  it('pular quebra a sequência', () => {
    const v = view(
      [care('a', '2026-09-01'), care('b', '2026-09-08', 'skipped'), care('c', '2026-09-15')],
      [execution('e1', 'a', '2026-09-01'), execution('e3', 'c', '2026-09-15')],
    );
    expect(v.streak).toBe(1);
  });

  it('um cuidado atrasado quebra a sequência', () => {
    const v = view(
      [care('a', '2026-09-01'), care('b', '2026-09-08'), care('c', '2026-09-15')],
      [execution('e1', 'a', '2026-09-01'), execution('e3', 'c', '2026-09-15')],
    );
    expect(v.streak).toBe(1);
  });

  /** D-28 — o cuidado de hoje ainda pode acontecer; tratá-lo como falha seria cobrar o futuro. */
  it('o cuidado de hoje, ainda não feito, não quebra nada', () => {
    const v = view(
      [care('a', '2026-09-15'), care('hoje', '2026-09-20')],
      [execution('e1', 'a', '2026-09-15')],
    );
    expect(v.streak).toBe(1);
  });

  /** SPEC-022 — a pausa entra na derivação, não numa checagem de tela. */
  it('pausada, a sequência congela: não cresce e não quebra', () => {
    const cares = [care('a', '2026-09-01'), care('b', '2026-09-08'), care('c', '2026-09-15')];
    const executions = [execution('e1', 'a', '2026-09-01'), execution('e2', 'b', '2026-09-08')];
    const v = view(cares, executions, [], '2026-09-10');
    expect(v.frozen).toBe(true);
    expect(v.streak).toBe(2);
  });
});

describe('Jornada — marcos (SPEC-043 F42)', () => {
  it('marca o que ela alcançou, e nada além', () => {
    const cares = [care('a', '2026-09-01'), care('b', '2026-09-08'), care('c', '2026-09-15')];
    const executions = [
      execution('e1', 'a', '2026-09-01'),
      execution('e2', 'b', '2026-09-08'),
      execution('e3', 'c', '2026-09-15'),
    ];
    const v = view(cares, executions);
    expect(v.milestones.find((m) => m.key === 'first_care')?.reached).toBe(true);
    expect(v.milestones.find((m) => m.key === 'streak_3')?.reached).toBe(true);
    expect(v.milestones.find((m) => m.key === 'cares_5')?.reached).toBe(false);
  });

  /**
   * ⚠️ **"Nenhum marco se conquista fazendo mais do que o plano pede"** (D-103).
   *
   * Todo marco conta cuidados **planejados** atendidos, ou sequência deles — e as duas coisas têm
   * teto no plano. Um marco que contasse "vezes que ela lavou" seria o incentivo proibido.
   */
  it('todo marco conta cuidado planejado ou sequência — nunca quantidade avulsa', () => {
    for (const m of MILESTONES_V1) {
      expect(['cares', 'streak']).toContain(m.kind);
    }
  });
});

describe('Jornada — o que ela NÃO pode dizer (SPEC-043 / D-103)', () => {
  /**
   * ⚠️ A Jornada mede **aderência ao plano**. Dizer "seu cabelo está melhor" seria avaliação capilar
   * por outro nome — recusada em SPEC-009, SPEC-019 e SPEC-021, e exatamente o que a D-103 proíbe
   * quando diz que a pontuação não pode se disfarçar de leitura capilar.
   */
  it('nenhum nome de nível ou marco fala do cabelo dela', () => {
    const words = /cabelo|fio|hidrat|nutri|reconstru|saud|bonit|brilho|frizz|dano|melhor|pior/i;
    for (const level of LEVELS_V1) expect(level.name).not.toMatch(words);
    for (const m of MILESTONES_V1) expect(m.label).not.toMatch(words);
  });

  /** A régua não faz alegação de domínio — e é por isso que ela pode ser `validated` sem revisor. */
  it('as regras da Jornada passam no guardrail de produção', () => {
    expect(() => assertProductionRules(JOURNEY_RULES_V1)).not.toThrow();
  });

  /** D-83/D-103 — FREE participa integralmente, e Premium não tem multiplicador. */
  it('não existe multiplicador: o ponto vale o mesmo para todo mundo', () => {
    expect(Object.values(POINTS_V1).every((p) => Number.isInteger(p) && p > 0)).toBe(true);
    expect(JSON.stringify(POINTS_V1)).not.toMatch(/premium|multip|bonus|boost/i);
  });
});
