import type { LocalDate } from '../../shared/time/local-date.ts';
import { CHECKIN_MARKS, type CheckInMark } from './care-tracking.ts';
import { FINISH_TECHNIQUES, type FinishTechnique } from './wash-day.ts';

/**
 * SPEC-056 (F38, fatia shell) + SPEC-070 (F38, a biblioteca) — o catálogo de finalizações com a
 * história dela.
 *
 * A SPEC-048 gravou **qual** finalização ela fez, num vocabulário aprovado. Esta camada devolve isso
 * como uma biblioteca: as finalizações **nomeadas**, **quantas vezes** ela registrou cada uma,
 * **quando foi a última**, e — por técnica — o que ela **notou** nesses cuidados.
 *
 * ⚠️ **Contagem, nunca julgamento** (D-103/D-26). *"Você registrou Plopping 3 vezes"* é fato dela;
 * *"Plopping é melhor para o seu cabelo"* seria alegação capilar, e *"sua finalização mais usada"*
 * seria o ranking `P7`. Não há média, nota nem ordem de mérito aqui — há **quantas vezes**, na ordem
 * do vocabulário.
 *
 * ⚠️ **Observação, nunca causa** (SPEC-070 BR5). *"Você notou definição em 3 dos 4 cuidados com
 * Plopping que você avaliou"* é contagem nos registros dela. *"Plopping melhora sua definição"*
 * seria a alegação que o `F38` não faz sem sign-off (D-26/D-70).
 */

/**
 * As finalizações **nomeadas** — as que a área apresenta como catálogo.
 *
 * ⚠️ `other` e `unknown` ficam de fora: são saídas de registro (*"fiz uma fora da lista"* / *"não sei
 * o nome"*), não finalizações que se descobre pelo nome. É a mesma exclusão que a SPEC-047/050 fazem
 * ao nunca torná-las observação. Derivado de {@link FINISH_TECHNIQUES} para não precisar ser reescrito
 * quando o vocabulário aprovado crescer.
 */
export type NamedFinishTechnique = Exclude<FinishTechnique, 'other' | 'unknown'>;

export const NAMED_FINISH_TECHNIQUES: readonly NamedFinishTechnique[] = FINISH_TECHNIQUES.filter(
  (t): t is NamedFinishTechnique => t !== 'other' && t !== 'unknown',
);

/**
 * Um fato de finalização: ela fez esta finalização, neste dia, e foi isto que ela notou depois.
 *
 * ⚠️ **`marks: null` e `marks: []` são coisas DIFERENTES, e a distinção decide o denominador.**
 * `null` é *"ela não avaliou aquele cuidado"* — sem check-in não há resultado registrado, e o
 * cuidado fica fora da conta (BR6). `[]` é *"avaliou e não marcou nada"*, que **conta**: ela olhou e
 * não notou nenhuma daquelas qualidades. Achatar as duas em lista vazia encolheria a fração por um
 * silêncio e inflaria a repetição das marcas que existem.
 */
export type FinishHistoryRecord = {
  readonly technique: FinishTechnique;
  /** O dia civil dela, como o banco guardou (ADR-008): string `YYYY-MM-DD`, nunca `Date`. */
  readonly executedOn: LocalDate;
  readonly marks: readonly CheckInMark[] | null;
};

export type FinishCatalogEntry = {
  readonly technique: NamedFinishTechnique;
  /** Quantas vezes ela registrou esta finalização. `0` é um valor, não uma ausência. */
  readonly count: number;
  /**
   * Quando foi a última vez. `null` quando ela nunca registrou.
   *
   * ⚠️ **Aparece e NÃO ordena nada** (BR2): ordenar por recência escolheria um critério de
   * importância, e critério de importância é a `P7`. A ordem continua sendo a do vocabulário.
   */
  readonly lastUsedOn: LocalDate | null;
};

/**
 * SPEC-070 BR7 — **a partir de quantos cuidados AVALIADOS com a técnica uma marca vale ser mostrada.**
 *
 * Guarda de exibição, não significância estatística — a mesma natureza declarada de
 * `MIN_RATED_CARES` na SPEC-047. ⚠️ *"Você notou em 1 de 1"* não é observação: é uma coincidência com
 * forma de regra, e um único cuidado moveria a fração inteira.
 */
export const MIN_FINISH_RATED_CARES = 3;

/** Quantas ocorrências recentes a tela mostra. Nomeado na tela como "suas últimas vezes". */
export const RECENT_FINISH_OCCURRENCES = 6;

/** O que ela notou nos cuidados em que usou esta finalização. */
export type FinishNoticed = {
  readonly mark: CheckInMark;
  /** Em quantos daqueles cuidados ela marcou isto. ⚠️ Nunca `0` — ver BR8. */
  readonly count: number;
  /** De quantos. O denominador é o cuidado com esta finalização **que ela avaliou** (BR6). */
  readonly of: number;
  /** Como a marca se chama na tela. */
  readonly subject: string;
  /**
   * A frase pronta — **pelo mesmo motivo da SPEC-047**: espalhar a redação por dentro da tela é como
   * uma afirmação causal entraria sem ninguém notar. ⚠️ Ela diz *"você notou … em N dos M cuidados
   * com X que você avaliou"* — co-ocorrência contada, com o denominador nomeado. *"X melhora sua
   * definição"* seria alegação capilar (D-26/D-70), e não existe caminho de código que a produza.
   */
  readonly detail: string;
};

export type FinishDetail = {
  readonly count: number;
  readonly lastUsedOn: LocalDate | null;
  /** As ocorrências mais recentes, da mais nova para a mais velha. */
  readonly recent: readonly LocalDate[];
  /**
   * Só o que ela **notou**, e só com amostra suficiente (BR7/BR8).
   *
   * ⚠️ **A marca com zero não entra**, e isso é recusa, não filtro de vaidade: *"…em 0 dos 4"* não é
   * observação, é **acusação** — a leitura inevitável é *"essa finalização não funciona"*, o espelho
   * exato de *"essa finalização é ideal para você"* e igualmente alegação capilar (SPEC-050 BR).
   */
  readonly noticed: readonly FinishNoticed[];
  /**
   * Quantos cuidados avaliados ainda faltam para haver observação. `null` quando já há amostra.
   *
   * ⚠️ Existe para a tela **dizer o que falta** em vez de ficar calada — o estado honesto da
   * SPEC-047, que é a maior parte da vida útil desta área para quem começou agora.
   */
  readonly ratedMissing: number | null;
};

/** ⚠️ Máximo, nunca "a última da lista": a ordem é promessa do adapter, e domínio não se acopla a ela. */
const latestOf = (dates: readonly LocalDate[]): LocalDate | null =>
  dates.length === 0 ? null : dates.reduce((a, b) => (b > a ? b : a));

const recordsOf = (
  records: readonly FinishHistoryRecord[],
  technique: FinishTechnique,
): readonly FinishHistoryRecord[] => records.filter((r) => r.technique === technique);

/**
 * O catálogo: **sempre as nomeadas, na ordem do vocabulário** (BR1), com a contagem e a última vez.
 *
 * ⚠️ **A ordem é a do vocabulário, jamais a contagem nem a recência.** Ordenar por "quantas vezes"
 * ou por "mais recente" seria um ranking (`P7`), e ranking de finalização é o que o `F38` não faz sem
 * sign-off (D-26/D-70). As duas são fato por item, não critério de ordem.
 *
 * Registros de `other`/`unknown` não casam com nenhum nome e simplesmente não contam (BR9) — não
 * somem do banco, só não têm entrada de catálogo.
 */
export const buildFinishCatalog = (records: readonly FinishHistoryRecord[]): readonly FinishCatalogEntry[] =>
  NAMED_FINISH_TECHNIQUES.map((technique) => {
    const mine = recordsOf(records, technique);
    return {
      technique,
      count: mine.length,
      lastUsedOn: latestOf(mine.map((r) => r.executedOn)),
    };
  });

/**
 * O detalhe de uma finalização: a história dela com aquela técnica.
 *
 * ⚠️ **Tudo aqui é contagem sobre o que ela registrou.** Nada descreve a técnica, ensina a fazer,
 * indica para quem serve ou afirma efeito — isso é conteúdo capilar substantivo e continua atrás do
 * gate D-26/D-70 (SPEC-070 §3).
 */
export const buildFinishDetail = (
  technique: NamedFinishTechnique,
  records: readonly FinishHistoryRecord[],
  /**
   * Como cada finalização e cada marca se chamam **na tela**. Vêm de fora porque o rótulo é cópia de
   * interface e já mora no app (SPEC-024/048/051) — duplicá-lo aqui criaria duas listas que divergem
   * na primeira renomeação, que é a classe de defeito que o `check:label-owners` guarda.
   */
  finishLabel: (t: NamedFinishTechnique) => string = (t) => t,
  markLabel: (m: CheckInMark) => string = (m) => m,
): FinishDetail => {
  const mine = recordsOf(records, technique);
  const dates = mine.map((r) => r.executedOn);
  // ⚠️ Ordenado aqui, e não confiando na ordem do adapter: `YYYY-MM-DD` é cronológico por
  // construção (ADR-008), então isto é comparação de string e nenhum `Date` entra.
  const recent = [...dates].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).slice(0, RECENT_FINISH_OCCURRENCES);

  // BR6 — o denominador é o cuidado com esta finalização **que ela avaliou**. `null` é ausência de
  // check-in e fica de fora; `[]` é uma avaliação sem marca e conta.
  const rated = mine.filter(
    (r): r is FinishHistoryRecord & { marks: readonly CheckInMark[] } => r.marks !== null,
  );

  const enough = rated.length >= MIN_FINISH_RATED_CARES;
  const noticed: FinishNoticed[] = enough
    ? CHECKIN_MARKS.flatMap((mark) => {
        const count = rated.filter((r) => r.marks.includes(mark)).length;
        // BR8 — zero não vira observação.
        if (count === 0) return [];
        return [
          {
            mark,
            count,
            of: rated.length,
            subject: markLabel(mark),
            /**
             * ⚠️ **"você notou", e o denominador dito por extenso.** O verbo é o da SPEC-047 para
             * resultado — ela **observou**, não fez —, e nomear *"que você avaliou"* é o que impede
             * a fração de parecer sobre todos os cuidados com a técnica.
             */
            /**
             * ⚠️ **"dos N cuidados" concorda com o DENOMINADOR, não com a contagem.** A primeira
             * versão escrevia *"em 1 do 3 cuidados"*, porque flexionava pelo numerador. E o
             * denominador nunca é singular aqui — abaixo de {@link MIN_FINISH_RATED_CARES} não há
             * observação nenhuma —, então não existe ramo para um cuidado só.
             */
            detail: `você notou em ${count} dos ${rated.length} cuidados com ${finishLabel(
              technique,
            )} que você avaliou`,
          },
        ];
      })
    : [];

  return {
    count: mine.length,
    lastUsedOn: latestOf(dates),
    recent,
    noticed,
    ratedMissing: enough ? null : MIN_FINISH_RATED_CARES - rated.length,
  };
};
