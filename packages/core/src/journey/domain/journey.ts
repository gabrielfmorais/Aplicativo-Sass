import type { LocalDate } from '../../shared/time/index.ts';

/**
 * SPEC-043 — a Jornada Huna.
 *
 * > A Huna recompensa **consistência com o plano**, não **quantidade de tratamentos**. — D-103
 *
 * ⚠️ **Ela diz "minha consistência na jornada", nunca "quão saudável está meu cabelo".** A segunda
 * frase seria avaliação capilar, precisaria de revisor (D-26) e o produto já a recusou três vezes
 * (SPEC-009, SPEC-019, SPEC-021). O que a Jornada mede é **aderência ao plano** — outro objeto,
 * verificável, que não afirma nada sobre cabelo.
 */

export const JOURNEY_FACT_KINDS = ['care_execution', 'checkin', 'wash_day'] as const;

export type JourneyFactKind = (typeof JOURNEY_FACT_KINDS)[number];

/** Um ponto concedido: **fato datado**, com a régua que o concedeu gravada nele. */
export type JourneyPoint = {
  readonly factKind: JourneyFactKind;
  readonly points: number;
  readonly rulesVersion: string;
  readonly awardedOn: LocalDate;
};

export type JourneyLevel = {
  readonly level: number;
  readonly name: string;
  /** Quantos pontos faltam para o próximo, ou `null` no último. */
  readonly toNext: number | null;
  readonly nextName: string | null;
  /**
   * SPEC-059 — a progressão dentro da faixa do nível atual, para a barra da tela.
   *
   * `pointsIntoLevel` são os pontos já feitos **desde que entrou neste nível**; `levelSpan` é a
   * largura da faixa (deste limiar ao próximo). A barra é `pointsIntoLevel / levelSpan`. **Não é
   * cobrança:** é a mesma progressão que a frase *"faltam X para Y"* já dizia, agora também vista —
   * e no último nível `levelSpan` é `null`, então não há barra a perseguir (D-103: nada de meta).
   */
  readonly pointsIntoLevel: number;
  readonly levelSpan: number | null;
};

export type JourneyMilestone = {
  readonly key: string;
  readonly label: string;
  readonly reached: boolean;
};

export type JourneyView = {
  readonly points: number;
  readonly level: JourneyLevel;
  /**
   * Cuidados planejados atendidos **em sequência**, na ordem das datas.
   *
   * ⚠️ **Não é diária, e isso é a regra** (D-103). Um streak por dia num plano de 4 a 12 cuidados por
   * mês só se cumpre lavando mais — o incentivo proibido. Dia sem cuidado planejado não quebra nada.
   */
  readonly streak: number;
  readonly caresAttended: number;
  readonly milestones: readonly JourneyMilestone[];
  /** SPEC-022 — pausada, a sequência **congela**: não cresce e não quebra. */
  readonly frozen: boolean;
};
