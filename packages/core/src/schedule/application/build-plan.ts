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
  /**
   * SPEC-046 — **a versão que ESTE rascunho usou**, e não a que o processo considera corrente.
   *
   * ⚠️ Existe para que quem previu possa dizer **com o que previu**. A alternativa — a tela ler a
   * constante por conta própria — é exatamente o defeito que a SPEC-038 já cometeu uma vez: escolha
   * e despacho em módulos diferentes, e a constante apontando para uma versão enquanto o padrão
   * executava outra. Aqui a versão sai de dentro da mesma chamada que produziu os cuidados, então
   * não há como as duas discordarem.
   */
  readonly scheduleVersion: ScheduleVersion;
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
 * ⚠️ **SPEC-038 (F36): a v2 está pronta e a corrente segue sendo a v1 — e agora isso é MEDIDO, não
 * precaução.** A troca foi ligada, exercida no DEV real e revertida, porque a medição mostrou a
 * deriva que ela causa:
 *
 * ```
 * preview do cliente (v2):  HID NUT HID REC NUT REC HID RES
 * plano gravado (v1):       HID NUT HID NUT REC NUT HID NUT     ← engine=v1
 * ```
 *
 * O app roda o bundle local; a Edge Function roda o **bundle deployado**. Enquanto os dois não
 * forem a mesma coisa, ela confirma um cronograma e recebe outro — exatamente o que `buildPlan`
 * como caminho único existe para impedir (SPEC-004 AC3).
 *
 * ⚠️ **E em produção isso não é transitório: é estrutural.** O app é binário de loja e a Edge
 * Function versiona à parte, então uma usuária com app antigo sempre pode prever com uma engine e
 * receber outra. **Ligar a v2 sem resolver isso é embutir a deriva no produto** — a decisão está em
 * SPEC-038 OQ4, e a saída provável é o cliente **mandar a versão que ele previu** e o servidor
 * validá-la contra esta mesma allowlist.
 *
 * As regras da v2 continuam `candidate`: **PUBLIC RELEASE segue bloqueado** (D-26/D-70/OQ-REL).
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
    scheduleVersion,
    evidenceCodes: [...new Set([...assessment.evidenceCodes, ...schedule.evidenceCodes])],
    weekdayPlacement: placement ? { fullyHonoured: placement.fullyHonoured } : null,
  };
};
