import type { DomainRule } from '../../../shared/domain-rule.ts';

/**
 * SPEC-043 (F40) — a régua **v1** da Jornada.
 *
 * ⚠️ **Versão liberada é imutável** (ADR-001 §2). Mudar o valor de um ponto, um limiar de nível ou um
 * marco **não** se faz editando este arquivo: cria-se `rules/v2`. É o que faz *"mudar a régua não
 * reescreve o passado"* ser verdade — cada ponto já concedido guarda a versão que o concedeu.
 *
 * ⚠️ **Nada aqui é regra capilar.** Aderência não afirma nada sobre cabelo, e por isso a Jornada
 * fica fora do gate D-26/D-70 (D-103). O preço dessa isenção é não se disfarçar: nenhum nome de
 * nível, marco ou frase pode sugerir que o cabelo dela está melhor ou pior.
 */
export const JOURNEY_RULES_VERSION_V1 = 'v1';

/**
 * O que vale ponto — e o teto é **o plano**, sempre.
 *
 * Cada um destes é **por cuidado planejado**: a execução efetiva daquele cuidado, o check-in daquele
 * cuidado, o registro daquele cuidado. Não existe caminho que pague por lavar mais, por fazer mais
 * reconstrução ou por usar mais produto — fazer além do plano não gera cuidado planejado nenhum, e
 * portanto não gera ponto (D-103, a proibição central).
 */
export const POINTS_V1 = {
  care_execution: 10,
  checkin: 5,
  wash_day: 5,
} as const;

/**
 * Os níveis. Os nomes falam da **constância dela**, nunca do cabelo.
 *
 * "Firme" descreve quem manteve a rotina; "cabelo firme" seria avaliação capilar por outro nome, que
 * é exatamente o que a D-103 proíbe quando diz que a pontuação não pode se disfarçar de leitura
 * capilar.
 */
export const LEVELS_V1 = [
  { level: 1, name: 'Começando', from: 0 },
  { level: 2, name: 'Em ritmo', from: 60 },
  { level: 3, name: 'Constante', from: 180 },
  { level: 4, name: 'Firme', from: 400 },
  { level: 5, name: 'Inabalável', from: 800 },
] as const;

/**
 * Os marcos (`F42`). **Nenhum se conquista fazendo mais do que o plano pede** — todos contam
 * cuidados planejados atendidos, ou sequência deles, e as duas coisas têm teto no plano.
 */
export const MILESTONES_V1 = [
  { key: 'first_care', label: 'Primeiro cuidado', kind: 'cares', at: 1 },
  { key: 'cares_5', label: '5 cuidados do seu plano', kind: 'cares', at: 5 },
  { key: 'cares_10', label: '10 cuidados do seu plano', kind: 'cares', at: 10 },
  { key: 'cares_25', label: '25 cuidados do seu plano', kind: 'cares', at: 25 },
  { key: 'streak_3', label: '3 seguidos', kind: 'streak', at: 3 },
  { key: 'streak_7', label: '7 seguidos', kind: 'streak', at: 7 },
] as const;

/**
 * O registro da régua (ADR-007 A1).
 *
 * `validation_status: 'validated'` **não é um atalho pelo gate capilar** — é a afirmação de que esta
 * régua não faz alegação de domínio nenhuma. Ela conta o que ela fez com o próprio plano, e contar
 * não precisa de revisor de cabelo. Uma régua que precisasse seria uma régua escrita errado.
 */
export const JOURNEY_RULES_V1: readonly DomainRule[] = [
  {
    rule_id: 'journey.points.plan_adherence',
    version: 1,
    description:
      'Pontos por cuidado planejado atendido, check-in respondido e registro feito. Teto no plano.',
    inputs: ['care_executions', 'checkins', 'wash_days'],
    output: 'points',
    rationale_source: 'D-103 — a Huna recompensa consistência com o plano, não quantidade',
    validation_status: 'validated',
  },
  {
    rule_id: 'journey.streak.planned_cares',
    version: 1,
    description:
      'Sequência de cuidados planejados atendidos, em ordem de data. Dia sem cuidado planejado não quebra; pausa congela.',
    inputs: ['scheduled_cares', 'care_executions', 'plan_pauses'],
    output: 'streak',
    rationale_source: 'D-103 — a sequência não é diária',
    validation_status: 'validated',
  },
];
