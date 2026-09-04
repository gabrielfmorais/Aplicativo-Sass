import type { WashDayTechnique } from '../../care-tracking/index.ts';
import type { CareTypeCode } from '../../schedule/index.ts';
import type { LocalDate } from '../../shared/time/index.ts';

/**
 * SPEC-047 (P2) — **Hair Intelligence, a camada determinística.**
 *
 * > A pergunta que ela precisa responder: **"O que funciona comigo?"** — Blueprint §12
 *
 * ⚠️ **Observação, nunca causa.** É a regra mais dura do produto inteiro, e ela é a diferença entre
 * a capability existir e ser irresponsável:
 *
 * - ✅ *"A Máscara X esteve em 4 dos seus 6 cuidados mais bem avaliados."*
 * - ⛔ *"A Máscara X recuperou seu cabelo."*
 *
 * A primeira conta o que **ela** registrou. A segunda é alegação capilar, precisaria de revisor
 * (D-26/D-70) — e nenhuma quantidade de dado dela transforma co-ocorrência em causa.
 *
 * ⚠️ **Nada é inventado para preencher a tela.** Abaixo do volume mínimo a resposta é dizer que a
 * Huna **ainda está conhecendo a rotina dela** — tela honestamente vazia é melhor que tela cheia de
 * nada, e esse estado é a maior parte da vida útil da capability para quem começou agora.
 */

/**
 * A partir de quantos cuidados **avaliados** vale falar em repetição.
 *
 * Guarda de exibição, não afirmação estatística — e deliberadamente documentada como arbitrária,
 * na mesma linha do `MIN_CHECKINS_FOR_AVERAGE` da SPEC-009. Abaixo disto, qualquer "padrão" seria
 * ruído com cara de descoberta.
 */
export const MIN_RATED_CARES = 5;

/** Quantas vezes um produto precisa aparecer para ser nomeado. Duas vezes é coincidência. */
export const MIN_OCCURRENCES = 3;

/** A partir de quanto uma avaliação dela conta como "bem avaliado". A escala é de 1 a 5. */
export const HIGH_FEEL = 4;

/** Um cuidado atendido, com o que ela registrou nele. Tudo aqui é **fato dela**. */
export type InsightFact = {
  readonly careExecutionId: string;
  readonly careTypeCode: CareTypeCode;
  readonly executedOn: LocalDate;
  /** A resposta do check-in, 1..5. `null` = ela não respondeu, que **não** é zero. */
  readonly feel: number | null;
  /** Os produtos que ela marcou naquele cuidado, com o nome que **ela** deu. */
  readonly products: readonly { readonly id: string; readonly name: string }[];
  /**
   * As técnicas que ela marcou (SPEC-024).
   *
   * ⚠️ **Vocabulário já aprovado, e é isso que a mantém fora do gate.** São as catorze da SPEC-024 —
   * seis delas movimentos de finalização (`air_dried`, `blow_dried`, `diffuser`, `scrunched`,
   * `heat_protectant`, `protective_style`). Observar o que ela marcou **não** é o `F38`: nomear
   * finalizações novas (fitagem, dedoliss, day after) continua sendo conteúdo capilar substantivo,
   * atrás do gate D-26/D-70, com barreira viva na SPEC-039 §8.
   */
  readonly techniques: readonly WashDayTechnique[];
};

/**
 * Uma repetição observada. **A frase inteira vem pronta**, e é de propósito: espalhar a redação por
 * dentro da tela é como uma afirmação causal entraria sem ninguém notar.
 */
export type Observation = {
  readonly key: string;
  /** O que se repetiu: um produto dela, ou uma técnica do vocabulário aprovado. */
  readonly kind: 'product' | 'technique' | 'combo';
  readonly subject: string;
  /** O que se repetiu, em número. Nunca "porque", nunca "melhora". */
  readonly detail: string;
};

export type InsightsView = {
  /** `false` = a Huna ainda está conhecendo a rotina dela. Não é erro, é o começo. */
  readonly enoughData: boolean;
  /** Quantos cuidados ela **avaliou** — o denominador de tudo aqui, e o que falta crescer. */
  readonly ratedCares: number;
  /** Quantos ainda faltam para a Huna começar a comparar. `0` quando já dá. */
  readonly ratedCaresMissing: number;
  /**
   * Quantos dos cuidados avaliados têm **algum registro** — produto ou técnica marcada.
   *
   * ⚠️ **É o número que explica um silêncio que parecia bug.** Avaliar diz *como ficou*; marcar diz
   * *o que ela fez*. Sem o segundo não há o que comparar, e a tela precisa saber a diferença: dizer
   * "avalie mais" a quem já avaliou doze é mandá-la fazer o que ela já fez.
   */
  readonly ratedCaresWithRecord: number;
  readonly observations: readonly Observation[];
};

/**
 * SPEC-049 (P6) — a prateleira dela, contada pelo uso.
 *
 * ⚠️ **Sem média, sem nota, sem ordem de mérito.** Ordenar por "melhor" seria o **ranking pessoal**
 * (`P7`), que é outra capability e outra decisão. Aqui a ordem é **quantas vezes**, que os
 * registros dela respondem sozinhos.
 */
export type ShelfUsage = {
  readonly totalProducts: number;
  /** Cuidados em que ela marcou algum produto — o denominador honesto de "em N registros". */
  readonly recordedCares: number;
  readonly used: readonly { readonly id: string; readonly name: string; readonly cares: number }[];
  /**
   * O que está na prateleira e **não aparece em registro nenhum**.
   *
   * ⚠️ Fato, não acusação: pode ser novo, sazonal, ou simplesmente não ter sido marcado. Sugerir
   * descarte, troca ou compra é `P18`, atrás do próprio gate.
   */
  readonly neverUsed: readonly { readonly id: string; readonly name: string }[];
};
