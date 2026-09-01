import type { ScheduledCare } from '../../schedule/index.ts';
import { addDays, diffDays, type LocalDate } from '../../shared/time/index.ts';
import { buildTodayView, type CareExecution, type CareItem, type CheckIn } from './care-tracking.ts';

/**
 * SPEC-019 — o ciclo: as quatro semanas dela, depois de começarem.
 *
 * Ela vê o **dia** (a Hoje) e vê as quatro semanas exatamente uma vez — no preview, antes de
 * confirmar. Depois disso o mês some. Isto devolve a forma do ciclo, e nada mais: é projeção de
 * leitura (DOMAIN-MAP §3.5), sem escrita, sem estado novo e sem uma linha de dado a mais.
 *
 * Tudo aqui é **derivado**. Feito, atrasado e "semana corrente" não são colunas e nunca serão
 * (D-69/BR2) — a mesma razão pela qual `buildTodayView` existe, e a razão pela qual esta função a
 * reusa em vez de repetir a derivação: dois lugares decidindo o que é "feito" divergiriam, e a
 * divergência apareceria como a Hoje e o ciclo discordando sobre o mesmo cuidado.
 */

export type PlanWeek<T> = {
  /** 1-based, para exibição. */
  readonly number: number;
  readonly items: readonly T[];
};

/**
 * Distribui itens em janelas consecutivas de 7 dias a partir de `startsOn`.
 *
 * Semanas vazias são **omitidas**: um cartão "Semana 3" sobre espaço em branco lê como algo faltando,
 * e um plano pode simplesmente não colocar cuidado em toda janela. Quem precisa das quatro semanas
 * sempre presentes é o ciclo (`buildCycleView`), que as completa por cima disto.
 *
 * Nasceu no app, para o preview do plano (SPEC-016 fatia 3), e mudou de casa quando o ciclo passou a
 * precisar exatamente da mesma regra: o ciclo que ela confirmou e o ciclo que ela revisita têm de ser
 * o mesmo objeto, e duas cópias de `floor(dias / 7)` são duas cópias que podem divergir (SPEC-019 BR1).
 */
export const groupIntoWeeks = <T extends { readonly plannedDate: string }>(
  items: readonly T[],
  startsOn: LocalDate,
): readonly PlanWeek<T>[] => {
  const byWeek = new Map<number, T[]>();
  for (const item of items) {
    // Um cuidado antes da data de início seria bug lá em cima, não algo a esconder: prende na
    // primeira semana para continuar visível em vez de sumir num índice negativo.
    const week = weekIndexOf(startsOn, item.plannedDate as LocalDate);
    const bucket = byWeek.get(week) ?? [];
    bucket.push(item);
    byWeek.set(week, bucket);
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, weekItems]) => ({ number: index + 1, items: weekItems }));
};

/** Índice 0-based da janela de 7 dias em que `date` cai. Nunca negativo — ver a nota acima. */
const weekIndexOf = (startsOn: LocalDate, date: LocalDate): number =>
  Math.floor(Math.max(diffDays(startsOn, date), 0) / 7);

/**
 * Quantas semanas um ciclo tem. Quatro, porque a janela do engine v1 é de 28 dias (D-67) — e é uma
 * constante daqui, não do calendário: se uma versão futura do engine planejar outra janela, o
 * ciclo passa a mentir e este número é o lugar onde isso é resolvido (SPEC-019 OQ1).
 */
export const CYCLE_WEEKS = 4;

export type CycleWeek = {
  /** 1..CYCLE_WEEKS. */
  readonly number: number;
  readonly startsOn: string;
  /** Inclusivo: o sétimo dia da semana. */
  readonly endsOn: string;
  /** Verdadeiro em no máximo uma semana, e em nenhuma quando hoje está fora do ciclo (FR4). */
  readonly isCurrent: boolean;
  readonly items: readonly CareItem[];
};

export type CycleView = {
  readonly startsOn: string;
  /** Inclusivo: o último dia da quarta semana. */
  readonly endsOn: string;
  /** Sempre `CYCLE_WEEKS` semanas, inclusive as vazias — a forma do mês é a informação (FR2). */
  readonly weeks: readonly CycleWeek[];
  /**
   * Cuidados que caem **depois** do ciclo. Só chegam aqui por reagendamento: a janela de reagendar
   * são 28 dias a partir de hoje, que pode passar do fim do plano. Ficam separados em vez de virarem
   * uma quinta semana — a tela mostra **este** ciclo, e inventar uma semana a mais seria desenhar um
   * ciclo que não existe (SPEC-019 EC4).
   */
  readonly beyond: readonly CareItem[];
  /**
   * Hoje não pertence a nenhuma das quatro semanas — plano ainda por começar ou já vencido e ainda
   * ativo. A tela precisa saber para **não** dizer que ela está numa semana (FR4).
   */
  readonly outsideWindow: boolean;
};

/**
 * O ciclo ativo, derivado do mesmo board que a Hoje já carrega.
 *
 * `today` é input, nunca relógio (ADR-008). `startsOn` vem do plano, não do dia de hoje: agrupar a
 * partir de hoje renomearia todas as semanas silenciosamente.
 */
/**
 * **Por que aqui um cuidado reagendado aparece, e na faixa da semana não.** A faixa desenha pontos:
 * um ponto no dia original diria "tem cuidado aqui" quando não tem, e ela não tem como dizer o
 * contrário. Esta tela escreve a palavra — "reagendada" — e é exatamente por escrevê-la que mostrar
 * as duas pontas conta a verdade em vez de escondê-la (SPEC-019 FR5). As duas telas seguem a mesma
 * regra: não afirmar o que é falso. Não "consertar" uma para parecer com a outra.
 */
export const buildCycleView = (
  cares: readonly ScheduledCare[],
  executions: readonly CareExecution[],
  startsOn: LocalDate,
  today: LocalDate,
  checkIns: readonly CheckIn[] = [],
): CycleView => {
  // Uma única passagem de derivação, a mesma da Hoje. `TodayView` separa por quando; aqui o que
  // interessa é o cuidado em si, então as quatro listas voltam a ser uma.
  const view = buildTodayView(cares, executions, today, checkIns);
  const items = [...view.overdue, ...view.today, ...view.upcoming, ...view.history];

  const endsOn = addDays(startsOn, CYCLE_WEEKS * 7 - 1);
  const inCycle: CareItem[] = [];
  const beyond: CareItem[] = [];
  for (const item of items) {
    (item.plannedDate > endsOn ? beyond : inCycle).push(item);
  }

  const grouped = new Map(groupIntoWeeks(inCycle, startsOn).map((w) => [w.number, w.items]));
  const currentWeek = today < startsOn || today > endsOn ? null : weekIndexOf(startsOn, today) + 1;

  const weeks: CycleWeek[] = Array.from({ length: CYCLE_WEEKS }, (_, i) => {
    const number = i + 1;
    const weekStart = addDays(startsOn, i * 7);
    return {
      number,
      startsOn: weekStart,
      endsOn: addDays(weekStart, 6),
      isCurrent: number === currentWeek,
      items: [...(grouped.get(number) ?? [])].sort(byPlannedDate),
    };
  });

  return {
    startsOn,
    endsOn,
    weeks,
    beyond: [...beyond].sort(byPlannedDate),
    outsideWindow: currentWeek === null,
  };
};

/** Dentro da semana, a ordem é a do calendário; `id` só desempata para o resultado ser estável. */
const byPlannedDate = (a: CareItem, b: CareItem): number =>
  a.plannedDate === b.plannedDate ? a.id.localeCompare(b.id) : a.plannedDate < b.plannedDate ? -1 : 1;
