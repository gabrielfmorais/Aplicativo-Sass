import type { AssessmentOutput, EvidenceCode } from '../../../diagnostic/index.ts';
import type { HairProfileSnapshot } from '../../../hair-profile/index.ts';
import { addDays } from '../../../shared/time/index.ts';
import { CARE_TYPE_CODES, type CareTypeCode, type ScheduledCareDraft } from '../../domain/plan.ts';
import type { ScheduleContext, ScheduleResult } from '../v1/generate-schedule.ts';

/**
 * Schedule engine v2 — **necessidade em vez de sequência** (SPEC-038, F36).
 *
 * O v1 alterna hidratação e nutrição e troca **um** cuidado por reconstrução no primeiro dia a
 * partir do 14º. O perfil escolhe qual eixo abre e quantas sessões por semana, mas não escolhe
 * **quanto de cada tipo** — duas pessoas muito diferentes recebem a mesma proporção.
 *
 * Aqui cada tipo ganha um **peso de necessidade**, e as vagas do ciclo são distribuídas por esse
 * peso. Um perfil sem sinal de dano recebe **zero** reconstruções; um com todos os sinais recebe
 * mais de uma e pode receber restauração.
 *
 * ⚠️ **Todo número deste arquivo é hipótese de engenharia, registrada em `./rules.ts` como
 * `candidate`.** Frequência capilar é conteúdo de domínio (D-26): o que a engenharia projeta é o
 * mecanismo — contar sinais já aprovados (D-62), virar peso, distribuir. PUBLIC RELEASE segue
 * bloqueado até `validated`.
 *
 * ⚠️ **O que este motor NÃO lê, por decisão explícita do dono:**
 * - `routineAvailability` — cruzá-la com a duração do cuidado produz *"este cuidado cabe no seu
 *   tempo"*, que é recomendação capilar e está vetada sem sign-off.
 * - `perceivedPorosity` — traduzir porosidade percebida em frequência é a alegação mais substantiva
 *   do conjunto, e a engenharia não a inventa.
 *
 * As duas ficam coletadas (SPEC-037) esperando revisor, e há **teste** provando que o plano é
 * invariante a elas: se alguém ligar o fio, a barreira cai antes da tela.
 *
 * Puro e determinístico (ADR-007, D-06): `startsOn` é entrada, sem relógio e sem aleatório.
 */
export const SCHEDULE_ALGORITHM_VERSION_V2 = 'v2' as const;

/** Igual ao v1 (worksheet §5/§6/§9): a cadência observada não é conselho de lavagem. */
const SESSIONS_PER_WEEK: Record<HairProfileSnapshot['washFrequency'], 1 | 2 | 3> = {
  once_or_less_weekly: 1,
  twice_weekly: 2,
  three_to_four_weekly: 3,
  five_or_more_weekly: 3,
  varies: 2,
};

const OFFSETS: Record<1 | 2 | 3, readonly number[]> = {
  1: [0, 7, 14, 21],
  2: [0, 4, 7, 11, 14, 18, 21, 25],
  3: [0, 2, 5, 7, 9, 12, 14, 16, 19, 21, 23, 26],
};

/** Os cuidados que não abrem o ciclo e não ficam colados um no outro. */
const STRONG: readonly CareTypeCode[] = ['reconstruction', 'restoration'];

const HIGH_HEAT: readonly string[] = ['three_to_four_weekly', 'almost_daily'];
const DAMAGE_GOALS: readonly string[] = ['reduce_breakage_and_strengthen', 'recover_chemical_or_heat_damage'];

/**
 * Os sinais de dano, contados a partir de entradas **já aprovadas** (D-62) e já usadas pelo v1 para
 * a mesma decisão binária. O que muda no v2 é o que se faz com a contagem: ela vira quantidade, em
 * vez de um sim/não.
 */
const damageSignals = (profile: HairProfileSnapshot) => {
  const chemical = profile.chemicalTreatments.length > 0;
  const heat = HIGH_HEAT.includes(profile.heatUsage);
  const damage = DAMAGE_GOALS.includes(profile.primaryGoal) || profile.currentConcerns.includes('breakage');
  return { chemical, heat, damage, count: [chemical, heat, damage].filter(Boolean).length };
};

type Weights = Record<CareTypeCode, number>;

const needWeights = (
  profile: HairProfileSnapshot,
  assessment: AssessmentOutput,
): { weights: Weights; evidence: readonly EvidenceCode[] } => {
  const evidence: EvidenceCode[] = [];
  const signals = damageSignals(profile);

  // Condicionamento: base igual, e a ênfase pesa um a mais no eixo que ela indica (não os dois).
  const weights: Weights = {
    hydration: 3 + (assessment.emphasis === 'hydration' ? 1 : 0),
    nutrition: 3 + (assessment.emphasis === 'nutrition' ? 1 : 0),
    reconstruction: signals.count >= 3 ? 2 : signals.count === 2 ? 1 : 0,
    // A ramificação mais conservadora do motor: só com todos os sinais presentes, e nunca repete.
    restoration: signals.count === 3 ? 1 : 0,
  };

  // Evidência **só para o que disparou** (BR4/FR10): é o que mantém a SPEC-017 mostrando influência
  // real. Um código emitido "por completude" viraria uma explicação que o plano não sustenta.
  if (weights.reconstruction > 0 || weights.restoration > 0) {
    if (signals.chemical) evidence.push('chemical_exposure');
    if (signals.heat) evidence.push('frequent_heat');
    if (signals.damage) {
      evidence.push(
        profile.currentConcerns.includes('breakage') ? 'concern_breakage' : 'goal_damage_recovery',
      );
    }
  }

  return { weights, evidence };
};

/**
 * Distribuição por maior resto: cada tipo recebe a parte inteira da sua fatia, e as vagas que sobram
 * vão para os maiores restos. **A soma bate com o número de vagas por construção** — a alternativa,
 * arredondar cada um por conta própria, produz um total que não fecha e um ciclo com buraco.
 */
const quotaFromWeights = (weights: Weights, slots: number): Record<CareTypeCode, number> => {
  const total = CARE_TYPE_CODES.reduce((sum, type) => sum + weights[type], 0);
  const quota = Object.fromEntries(CARE_TYPE_CODES.map((t) => [t, 0])) as Record<CareTypeCode, number>;
  if (total === 0) return quota;

  const remainders: { type: CareTypeCode; rest: number }[] = [];
  let assigned = 0;
  for (const type of CARE_TYPE_CODES) {
    const exact = (weights[type] / total) * slots;
    const floor = Math.floor(exact);
    quota[type] = floor;
    assigned += floor;
    remainders.push({ type, rest: exact - floor });
  }

  // Empate resolvido pela ordem de `CARE_TYPE_CODES`: determinismo importa mais que a escolha.
  remainders.sort(
    (a, b) => b.rest - a.rest || CARE_TYPE_CODES.indexOf(a.type) - CARE_TYPE_CODES.indexOf(b.type),
  );
  for (let i = 0; assigned < slots; i += 1, assigned += 1) {
    const pick = remainders[i % remainders.length];
    if (pick) quota[pick.type] += 1;
  }
  return quota;
};

/**
 * Onde cada cuidado forte cai.
 *
 * ⚠️ **Nunca na abertura e nunca colado em outro forte.** Um ciclo que começa pelo cuidado mais
 * pesado é um ciclo que começa cobrando; dois fortes seguidos concentram a carga na mesma semana.
 * As posições são escolhidas espalhando pelas vagas restantes, e o resultado é determinístico.
 */
const placeStrong = (slots: number, strongCount: number): number[] => {
  if (strongCount <= 0 || slots <= 1) return [];
  const candidates: number[] = [];
  // Da última vaga para trás, pulando de duas em duas: separa ao máximo sem sair do ciclo.
  for (let i = slots - 1; i >= 1 && candidates.length < strongCount; i -= 2) candidates.push(i);
  return candidates.sort((a, b) => a - b);
};

export const generateScheduleV2 = (
  assessment: AssessmentOutput,
  { snapshot, startsOn, assessmentAlgorithmVersion }: ScheduleContext,
): ScheduleResult => {
  const sessionsPerWeek = SESSIONS_PER_WEEK[snapshot.washFrequency];
  const offsets = OFFSETS[sessionsPerWeek];
  const slots = offsets.length;

  const { weights, evidence } = needWeights(snapshot, assessment);
  const quota = quotaFromWeights(weights, slots);

  const strongTypes: CareTypeCode[] = [];
  for (const type of STRONG) for (let i = 0; i < (quota[type] ?? 0); i += 1) strongTypes.push(type);
  const strongAt = placeStrong(slots, strongTypes.length);

  /**
   * O condicionamento sai da **quota**, não de uma alternância fixa.
   *
   * ⚠️ **A primeira versão calculava a quota e a ignorava aqui**: as vagas leves alternavam
   * `hidratação, nutrição, hidratação…` sempre, então a ênfase não mudava proporção nenhuma — dois
   * perfis com objetivos opostos recebiam exatamente o mesmo ciclo, que é o defeito que o F36 existe
   * para consertar. Nenhum teste pegou; apareceu ao **imprimir o plano e olhar**.
   *
   * A escolha a cada vaga é "quem tem mais a colocar", com desempate no que não veio por último:
   * respeita a quota exatamente e ainda distribui, em vez de agrupar tudo de um tipo no fim.
   */
  const opening: CareTypeCode = weights.nutrition > weights.hydration ? 'nutrition' : 'hydration';
  const alternate: CareTypeCode = opening === 'hydration' ? 'nutrition' : 'hydration';
  const left: Record<CareTypeCode, number> = { ...quota };

  const types: CareTypeCode[] = [];
  let previousSoft: CareTypeCode | null = null;
  for (let i = 0; i < slots; i += 1) {
    const strongIndex = strongAt.indexOf(i);
    if (strongIndex !== -1 && strongTypes[strongIndex]) {
      types.push(strongTypes[strongIndex] as CareTypeCode);
      continue;
    }
    // Alternar é o padrão; a quota só quebra a alternância quando um dos dois acaba.
    const preferred: CareTypeCode =
      previousSoft === null ? opening : previousSoft === opening ? alternate : opening;
    const fallback: CareTypeCode = preferred === opening ? alternate : opening;
    const pick: CareTypeCode = (left[preferred] ?? 0) > 0 ? preferred : fallback;
    types.push(pick);
    left[pick] = (left[pick] ?? 0) - 1;
    previousSoft = pick;
  }

  const cares: ScheduledCareDraft[] = offsets.map((offset, i) => ({
    careTypeCode: types[i] as CareTypeCode,
    plannedDate: addDays(startsOn, offset),
  }));

  return {
    plan: {
      hairProfileId: snapshot.hairProfileId,
      startsOn,
      assessmentAlgorithmVersion,
      scheduleAlgorithmVersion: SCHEDULE_ALGORITHM_VERSION_V2,
    },
    cares,
    evidenceCodes: ['wash_frequency_baseline', ...evidence],
  };
};

/** Exposto para teste: a distribuição é a decisão central do v2 e merece ser verificável sozinha. */
export const __testing = { needWeights, quotaFromWeights, placeStrong };
