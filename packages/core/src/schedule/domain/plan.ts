import type { LocalDate } from '../../shared/time/index.ts';

/**
 * SPEC-004 §10 — the plan and its scheduled cares, as produced by the engine (not yet persisted).
 *
 * `careTypeCode` is a plain code here and a `text` + CHECK in Postgres: the `care_types` table,
 * its FK and the pt-BR content belong to SPEC-007 (§9). Codes are approved by D-67.
 */
/**
 * SPEC-038 (F36) fatia 1 — **`restoration` é o quarto tipo**, por decisão do dono (D-102).
 *
 * ⚠️ **Acrescentar o valor aqui NÃO muda cronograma nenhum.** O motor v1 é imutável (ADR-001 §2) e
 * continua produzindo três tipos; quem vai poder emitir o quarto é o v2, e há um teste que trava
 * isso — se o v1 um dia emitir `restoration`, ele reprova. Vocabulário e comportamento são coisas
 * separadas, e esta fatia mexe só no primeiro.
 *
 * O que o quarto valor **significa** em termos capilares é conteúdo de domínio: o guia dele nasce
 * `candidate` com fonte "hipótese de engenharia", como os outros três (SPEC-007), e **PUBLIC
 * RELEASE segue bloqueado** até sign-off (D-26/D-70/OQ-REL).
 */
export const CARE_TYPE_CODES = ['hydration', 'nutrition', 'reconstruction', 'restoration'] as const;
export type CareTypeCode = (typeof CARE_TYPE_CODES)[number];

export type ScheduledCareDraft = {
  readonly careTypeCode: CareTypeCode;
  /** The user's local day (ADR-008) — the engine never reads a clock; `startsOn` is an input. */
  readonly plannedDate: LocalDate;
};

/**
 * Provenance of a persisted plan is `hairProfileId` + both algorithm versions (§9/§11):
 * the engines are deterministic and released versions are immutable, so no input snapshot is copied.
 */
export type HairPlanDraft = {
  readonly hairProfileId: string;
  readonly startsOn: LocalDate;
  readonly assessmentAlgorithmVersion: string;
  readonly scheduleAlgorithmVersion: string;
};
