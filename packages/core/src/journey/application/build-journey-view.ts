import type { CareItem } from '../../care-tracking/index.ts';
import type { LocalDate } from '../../shared/time/index.ts';
import type { JourneyMilestone, JourneyPoint, JourneyView } from '../domain/journey.ts';
import { LEVELS_V1, MILESTONES_V1 } from '../rules/v1/rules.ts';

/**
 * SPEC-043 — a Jornada, derivada.
 *
 * **Puro e total:** os pontos entram prontos (são fatos gravados, com a régua que os concedeu), e os
 * cuidados entram como `CareItem` — **a mesma leitura que a Hoje e o ciclo usam**. É isso que impede
 * a segunda verdade: a Jornada não reconta o que aconteceu, ela lê o que o produto já decidiu que
 * aconteceu.
 *
 * ⚠️ **A soma dos pontos NÃO é recalculada aqui.** Ela soma o que foi concedido — inclusive por
 * réguas antigas. Recalcular com a régua de hoje reescreveria o passado, que é exatamente o que a
 * D-103 proíbe: *histórico falsificável é histórico inútil*.
 */

/**
 * A sequência: cuidados planejados atendidos, **em ordem de data**, contando de trás para frente a
 * partir do mais recente que já passou.
 *
 * ⚠️ **Percorre CUIDADOS, não dias** (D-103). Um dia sem cuidado planejado não aparece nesta lista e
 * portanto não quebra nada — e é essa escolha que impede o incentivo de lavar mais para "não perder
 * a sequência".
 *
 * **`rescheduled` não quebra e não conta:** ela moveu o compromisso, não faltou a ele — a linha
 * antiga existe só para preservar o histórico (D-69), e o cuidado real é a linha nova. **`skipped`
 * quebra**, porque pular é a decisão de não fazer aquele cuidado.
 *
 * ⚠️ **A sequência é do PLANO ATIVO, e isso é deliberado** — ao contrário de `caresAttended`, que é
 * cumulativa. Os dois são coerentes com o que cada um afirma: um plano novo é um plano novo, e a
 * frase na tela diz *"cuidados do seu plano em sequência"*. Estender a sequência por cima de planos
 * substituídos exigiria decidir o que os cuidados **cancelados** pela reavaliação significam — nem
 * feitos nem pulados por ela —, o que é modelagem nova, não conserto. Os dois marcos de sequência
 * (3 e 7) cabem dentro de um ciclo, então nada fica inalcançável.
 */
const streakOf = (items: readonly CareItem[], today: LocalDate): number => {
  const past = items
    /**
     * ⚠️ **Um cuidado FEITO conta, mesmo antes da data dele.** A Hoje deixa ela adiantar um cuidado
     * do plano, e filtrar só por `plannedDate <= today` descartava exatamente esses: no DEV real,
     * cinco cuidados atendidos apareciam como sequência **1**, porque quatro estavam adiantados.
     * Ela fez; a data não desfaz isso — e a subcontagem só se corrigia sozinha quando o calendário
     * alcançasse cada um.
     *
     * Um cuidado **futuro e não feito** continua fora: ele ainda não venceu, e portanto não quebra
     * nem soma nada.
     */
    .filter((item) => item.plannedDate <= today || item.outcome === 'done')
    .filter((item) => item.outcome !== 'rescheduled')
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.id.localeCompare(b.id));

  let streak = 0;
  for (let i = past.length - 1; i >= 0; i -= 1) {
    const item = past[i];
    if (!item) break;
    if (item.outcome === 'done') {
      streak += 1;
      continue;
    }
    // Ainda dá tempo: um cuidado de hoje que ela não fez **ainda** não quebrou nada. Tratá-lo como
    // falha antes de o dia acabar seria cobrar o que ainda pode acontecer (D-28).
    if (item.plannedDate === today && item.outcome === 'planned') continue;
    break;
  }
  return streak;
};

const levelOf = (points: number) => {
  const reached = [...LEVELS_V1].reverse().find((l) => points >= l.from) ?? LEVELS_V1[0];
  const next = LEVELS_V1.find((l) => l.from > points) ?? null;
  return {
    level: reached.level,
    name: reached.name,
    toNext: next ? next.from - points : null,
    nextName: next ? next.name : null,
  };
};

export const buildJourneyView = (input: {
  points: readonly JourneyPoint[];
  items: readonly CareItem[];
  today: LocalDate;
  /** SPEC-022 — o dia em que ela pausou, ou `null`. Pausada, a sequência **congela**. */
  pausedOn?: string | null;
}): JourneyView => {
  const { points, items, today, pausedOn = null } = input;
  const total = points.reduce((sum, p) => sum + p.points, 0);
  /**
   * ⚠️ **Sai do fato concedido, NÃO do board.** O board é o **plano ativo** e só ele (`getBoard`
   * filtra por `status = 'active'`), então contar `items` aqui zerava os cuidados atendidos toda vez
   * que um plano fosse substituído — e substituir plano é o que a reavaliação faz, oferecida pelo
   * próprio produto depois de um `hair_event` (SPEC-014/SPEC-020).
   *
   * Dois defeitos vinham daí, e o segundo é estrutural:
   * 1. A tela mostrava **125 pontos** ao lado de **4 cuidados até aqui** — dois números sobre o
   *    mesmo histórico, computados em universos diferentes, impossíveis de reconciliar.
   * 2. Os marcos de **10** e **25** cuidados eram **inalcançáveis por construção**: um ciclo tem 8 a
   *    12 cuidados, então nenhum plano isolado chega a 25.
   *
   * `journey_points` já é a verdade canônica e cumulativa — uma linha por cuidado atendido, para
   * sempre. Contar dali é a mesma leitura que produz os pontos, e não há segunda verdade (BR1).
   */
  const caresAttended = points.filter((p) => p.factKind === 'care_execution').length;

  /**
   * ⚠️ **A pausa entra na DERIVAÇÃO, não numa checagem de tela** (SPEC-022 BR1, e foi assim que o
   * `F22` impediu o progresso de continuar contando). Pausada, a sequência é a que ela tinha: os
   * cuidados que venceram durante a pausa não a quebram, porque durante a pausa não havia
   * compromisso vigente.
   */
  const frozen = pausedOn !== null;
  const streak = streakOf(
    frozen ? items.filter((item) => item.plannedDate < (pausedOn as LocalDate)) : items,
    frozen ? ((pausedOn as LocalDate) ?? today) : today,
  );

  const milestones: readonly JourneyMilestone[] = MILESTONES_V1.map((m) => ({
    key: m.key,
    label: m.label,
    reached: (m.kind === 'cares' ? caresAttended : streak) >= m.at,
  }));

  return { points: total, level: levelOf(total), streak, caresAttended, milestones, frozen };
};
