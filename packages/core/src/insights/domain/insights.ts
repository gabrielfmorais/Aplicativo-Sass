import type { CheckInMark, FinishTechnique, WashDayTechnique } from '../../care-tracking/index.ts';

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

/**
 * Um cuidado atendido, com o que ela registrou nele. Tudo aqui é **fato dela**.
 *
 * ⚠️ **`careTypeCode` e `executedOn` saíram daqui, e a ausência é a decisão.** Os dois eram lidos
 * do banco, atravessavam a porta e o tipo, e **nenhuma linha os consumia** — regra de necessidade
 * (§0.2, D-47/D-48): *future possibility ≠ current requirement*. Voltam no dia em que ganharem
 * consumidor de verdade — **tipo de cuidado** quando a observação for segmentada (`P8`), e **data**
 * quando entrar recência (`P17`) —, e voltar é uma linha no adapter e uma no tipo.
 */
export type InsightFact = {
  /** A identidade do fato: um cuidado atendido, uma entrada. */
  readonly careExecutionId: string;
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
  /**
   * SPEC-048 (`F38`) — **qual** finalização ela fez naquele cuidado. `null` = não disse qual.
   *
   * ⚠️ **Um valor, não uma lista** — ao contrário de produtos e técnicas. A finalização é uma
   * escolha única por cuidado (`wash_day_finish` tem uma linha por hub), e tratá-la como lista
   * abriria a porta para "duas finalizações no mesmo cuidado", que o modelo não representa.
   *
   * ⚠️ **Observar o que ela registrou não é o conteúdo do `F38`.** *"Você finalizou assim em 3 dos
   * 5"* é contagem nos registros dela; *"fitagem é a melhor finalização para o seu cabelo"* é
   * recomendação capilar e continua bloqueada por D-26/D-70 (SPEC-048 §8).
   */
  readonly finishTechnique: FinishTechnique | null;
  /**
   * SPEC-051 (`P13`) — **o que ela notou** naquele cuidado.
   *
   * ⚠️ **Isto é um RESULTADO, não uma entrada — e a diferença decide tudo o que pode ser dito.**
   * Produto, técnica e finalização são coisas que ela **fez**; a marca é o que ela **observou**.
   * Contar uma marca dentro dos *"cuidados que você avaliou bem"* seria contar um resultado dentro
   * de outro, e atribuí-la a um produto (*"com a Máscara X você notou maciez em 4 de 5"*) **nomeia
   * um efeito capilar** — não importa a redação. Isso é D-26/D-70, e está fora.
   */
  readonly marks: readonly CheckInMark[];
};

/**
 * SPEC-048 OQ3 — **as duas respostas que NÃO viram observação**, e o motivo é diferente em cada uma.
 *
 * - `other` é *"fiz uma finalização fora desta lista"*. Três cuidados marcados com `other` podem ser
 *   **três técnicas diferentes**; dizer *"Outra finalização — você finalizou assim em 3 dos 5"*
 *   afirmaria uma repetição que talvez não exista. Seria inventar insight, que é a recusa que abre
 *   esta SPEC.
 * - `unknown` é *"fiz, e não sei o nome"*. É **ausência de identificação**, não uma identificação
 *   que se repete — a mesma distinção entre ausência e resposta que o `F35` teve de fazer.
 *
 * As duas continuam sendo **respostas legítimas** e continuam gravadas: o que elas não fazem é virar
 * padrão. Um dia, com sign-off, `other` pode ganhar desdobramento; `unknown` não tem como ganhar.
 */
export const FINISH_TECHNIQUES_NOT_OBSERVABLE = [
  'other',
  'unknown',
] as const satisfies readonly FinishTechnique[];

/**
 * Uma repetição observada. **A frase inteira vem pronta**, e é de propósito: espalhar a redação por
 * dentro da tela é como uma afirmação causal entraria sem ninguém notar.
 */
export type Observation = {
  readonly key: string;
  /**
   * O que se repetiu: um produto dela, uma técnica do vocabulário aprovado, um par de produtos, ou
   * a **finalização** que ela registrou (SPEC-048).
   */
  readonly kind: 'product' | 'technique' | 'combo' | 'finish' | 'noticed';
  readonly subject: string;
  /** O que se repetiu, em número. Nunca "porque", nunca "melhora". */
  readonly detail: string;
};

/**
 * SPEC-050 (`P8`) — **A partir de quantos cuidados avaliados um par vale ser mostrado.**
 *
 * Guarda de exibição, não significância estatística — a mesma natureza declarada de
 * `MIN_RATED_CARES`. Com dois cuidados, "padrão" é coincidência com cara de descoberta.
 */
export const MIN_PATTERN_CARES = 3;

/**
 * SPEC-050 — **quantos daqueles cuidados ela precisa ter avaliado bem para o padrão existir.**
 *
 * ⚠️ **Um, e isto é uma RECUSA, não um filtro de vaidade.** Um par que apareceu em 4 cuidados e em
 * **nenhum** deles ela avaliou bem produziria o cartão *"apareceram juntos em 4 cuidados que você
 * avaliou, e em 0 deles você avaliou bem"* — que não é observação, é **acusação**: a leitura
 * inevitável é *"essa combinação não funciona"*, o espelho exato de *"essa combinação é ideal para
 * você"* e igualmente uma alegação capilar (D-26/D-70).
 *
 * A direção negativa — o que evitar — é `P18`, atrás do próprio gate. Esta camada só conta o que
 * andou junto em cuidados que ela **avaliou bem**, que é o que as observações de item já fazem.
 *
 * ⚠️ **O corte é só no zero.** *"…e em 1 deles você avaliou bem"* continua aparecendo, com o número
 * honesto: esconder isso seria escolher a versão bonita do histórico dela.
 */
export const MIN_PATTERN_WELL_RATED = 1;

/**
 * SPEC-050 — **Quantos padrões cabem na tela.**
 *
 * ⚠️ **Teto de exibição, e está dito.** Não é significância e não finge ser: é a decisão do dono de
 * que *"poucos padrões realmente informativos"* vale mais que cobertura. Uma tela cheia de
 * combinações é uma tela estatística, e esta camada não é isso.
 */
export const MAX_PATTERNS = 3;

/**
 * SPEC-050 (`P8`) — **duas coisas que ela registrou no mesmo cuidado, e como ela avaliou aqueles
 * cuidados.**
 *
 * ⚠️ **Co-ocorrência com resultado, nunca efeito.** *"Apareceram juntos em 5 cuidados que você
 * avaliou, e em 4 deles você avaliou bem"* é contagem nos registros dela. *"Máscara X funciona
 * melhor com Fitagem"*, *"Plopping melhorou seu cabelo"* e *"essa combinação é ideal para você"*
 * são alegação capilar (D-26/D-70) e não existem em caminho de código nenhum.
 *
 * ⚠️ **Não é ranking** (`P7`): a ordem é por **contagem absoluta**, nunca por proporção. Ordenar
 * por *"qual proporção foi melhor avaliada"* seria construir um ranking com amostra de três.
 */
export type Pattern = {
  readonly key: string;
  /** Os dois, pelo nome que a tela usa — em ordem alfabética, para não depender do banco. */
  readonly subject: string;
  /** Em quantos cuidados **avaliados** os dois apareceram juntos. É o denominador. */
  readonly cares: number;
  /** Em quantos **desses** ela avaliou bem. Nunca maior que `cares`. */
  readonly wellRated: number;
  /** A frase pronta — pelo mesmo motivo de `Observation`: redação espalhada é como a causa entra. */
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
   * Quantos dos cuidados avaliados têm **algum registro** — produto, técnica ou finalização.
   *
   * ⚠️ **É o número que explica um silêncio que parecia bug.** Avaliar diz *como ficou*; marcar diz
   * *o que ela fez*. Sem o segundo não há o que comparar, e a tela precisa saber a diferença: dizer
   * "avalie mais" a quem já avaliou doze é mandá-la fazer o que ela já fez.
   */
  readonly ratedCaresWithRecord: number;
  readonly observations: readonly Observation[];
  /**
   * SPEC-050 (`P8`) — os pares de **tipos diferentes** que andaram juntos, no máximo
   * `MAX_PATTERNS`. Lista vazia = *"A Huna ainda está conhecendo suas combinações"*, que é um
   * estado honesto e não um erro.
   */
  readonly patterns: readonly Pattern[];
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
