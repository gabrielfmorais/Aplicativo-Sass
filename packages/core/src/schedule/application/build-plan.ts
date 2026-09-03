import { CURRENT_ASSESSMENT_VERSION, assess, type AssessmentOutput } from '../../diagnostic/index.ts';
import type { HairProfileSnapshot } from '../../hair-profile/index.ts';
import type { LocalDate } from '../../shared/time/index.ts';
import {
  PLAN_WINDOW_DAYS,
  SCHEDULE_ALGORITHM_VERSION_V1,
  generateScheduleV1,
} from '../engine/v1/generate-schedule.ts';
import { generateScheduleV2 } from '../engine/v2/generate-schedule.ts';
import { applyPreferredWeekdays, type PlanPreferences } from '../placement/preferred-weekdays.ts';
import type { HairPlanDraft, ScheduledCareDraft } from '../domain/plan.ts';
import type { EvidenceCode } from '../../diagnostic/index.ts';

export type PlanDraft = {
  readonly assessment: AssessmentOutput;
  readonly plan: HairPlanDraft;
  readonly cares: readonly ScheduledCareDraft[];
  /** Assessment + schedule codes, in that order, deduplicated. UI copy lives in the app. */
  readonly evidenceCodes: readonly EvidenceCode[];
  /**
   * SPEC-015 — null unless preferences were applied. `fullyHonoured: false` means her cadence
   * needs more days per week than she chose, so some cares kept their engine day (EC1).
   */
  readonly weekdayPlacement: { readonly fullyHonoured: boolean } | null;
};

/**
 * SPEC-038 — as versões de motor que este processo sabe executar.
 *
 * ⚠️ **Ela existe para que um plano antigo continue explicável.** A SPEC-017 reproduz a evidência
 * chamando `buildPlan` de novo; com uma versão nova como padrão, todo plano gerado pela anterior
 * perderia a explicação — a tela se calaria, corretamente, mas por um motivo que era evitável.
 * Reproduzir com a engine **que gerou o plano** é o que mantém a promessa: a explicação é daquele
 * plano, não do plano que ele seria hoje.
 */
const SCHEDULE_ENGINES = {
  v1: generateScheduleV1,
  v2: generateScheduleV2,
} as const;

export type ScheduleVersion = keyof typeof SCHEDULE_ENGINES;

export const isKnownScheduleVersion = (version: string): version is ScheduleVersion =>
  Object.hasOwn(SCHEDULE_ENGINES, version);

/**
 * A versão com que todo plano **novo** é gerado (ADR-007).
 *
 * Mora aqui, ao lado da tabela de despacho, e não no barril: escolha e despacho separados foi um
 * defeito real desta rodada — a constante passou a apontar para a v2 enquanto o padrão do
 * `buildPlan` continuava na v1, e o app gerava planos da versão que ninguém tinha escolhido.
 *
 * ⚠️ **SPEC-038 (F36): a v2 está pronta, testada e ligada ao despacho — e a versão corrente segue
 * sendo a v1.** Não é hesitação: **ligar a v2 exige duas ações de ambiente que não são do agente.**
 *
 * 1. A migration `20260911000000_care_type_restoration.sql` precisa estar aplicada no ambiente,
 *    senão um plano com Restauração é recusado pelo CHECK de `scheduled_cares`.
 * 2. A Edge Function `generate-plan` precisa ser **redeployada** com este bundle. Sem isso o preview
 *    do cliente usa a v2 e o plano gravado usa a v1 — as duas leituras do mesmo cronograma passam a
 *    discordar, que é exatamente o que `buildPlan` como caminho único existe para impedir. Deploy é
 *    ação §4: decisão humana, nunca efeito colateral de um merge.
 *
 * Feitas as duas, ligar é trocar esta linha para `SCHEDULE_ALGORITHM_VERSION_V2`.
 */
export const CURRENT_SCHEDULE_VERSION: ScheduleVersion = SCHEDULE_ALGORITHM_VERSION_V1;

/**
 * The one authoritative path from a profile snapshot to a plan (SPEC-004 AC3).
 *
 * The client preview and the `generate-plan` Edge Function both call this, so an instant preview
 * and the persisted plan cannot drift. Pure: `startsOn` is an input, never `today` read here.
 *
 * `preferences` is the premium `plan_customization` layer (SPEC-015). It is applied **after** the
 * engine and only ever moves dates — the assessment, the care types and their count are the
 * engine's alone, whether or not preferences are passed (G3/AC4). Passing them is not what grants
 * the capability: the server decides that (`has_entitlement`, FR3) and simply omits them when she
 * is not entitled.
 */
export const buildPlan = (
  snapshot: HairProfileSnapshot,
  startsOn: LocalDate,
  preferences?: PlanPreferences,
  /** Omitida = a versão corrente. A SPEC-017 passa a versão que o plano registrou. */
  scheduleVersion: ScheduleVersion = CURRENT_SCHEDULE_VERSION,
): PlanDraft => {
  const assessment = assess(snapshot);
  const schedule = SCHEDULE_ENGINES[scheduleVersion](assessment, {
    snapshot,
    startsOn,
    assessmentAlgorithmVersion: CURRENT_ASSESSMENT_VERSION,
  });
  const placement = preferences
    ? applyPreferredWeekdays(schedule.cares, startsOn, PLAN_WINDOW_DAYS, preferences)
    : null;
  return {
    assessment,
    plan: schedule.plan,
    cares: placement?.cares ?? schedule.cares,
    evidenceCodes: [...new Set([...assessment.evidenceCodes, ...schedule.evidenceCodes])],
    weekdayPlacement: placement ? { fullyHonoured: placement.fullyHonoured } : null,
  };
};
