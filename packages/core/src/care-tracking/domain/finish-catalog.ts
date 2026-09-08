import { FINISH_TECHNIQUES, type FinishTechnique } from './wash-day.ts';

/**
 * SPEC-056 (F38, fatia shell) — o catálogo de finalizações com a história dela.
 *
 * A SPEC-048 gravou **qual** finalização ela fez, num vocabulário aprovado. Esta camada devolve isso
 * como uma lista: as finalizações **nomeadas** e **quantas vezes** ela registrou cada uma.
 *
 * ⚠️ **Contagem, nunca julgamento** (D-103/D-26). *"Você registrou Plopping 3 vezes"* é fato dela;
 * *"Plopping é melhor para o seu cabelo"* seria alegação capilar, e *"sua finalização mais usada"*
 * seria o ranking `P7`. Não há média, nota nem ordem de mérito aqui — há **quantas vezes**, na ordem
 * do vocabulário.
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

/** Um fato de finalização: ela fez esta finalização (etapa `done`, técnica nomeada). */
export type FinishHistoryRecord = { readonly technique: FinishTechnique };

export type FinishCatalogEntry = {
  readonly technique: NamedFinishTechnique;
  /** Quantas vezes ela registrou esta finalização. `0` é um valor, não uma ausência. */
  readonly count: number;
};

/**
 * O catálogo: **sempre as nomeadas, na ordem do vocabulário** (BR3), com a contagem de cada uma.
 *
 * ⚠️ **A ordem é a do vocabulário, jamais a contagem.** Ordenar por "quantas vezes" seria um ranking
 * (`P7`), e ranking de finalização é o que o `F38` não faz sem sign-off (D-26/D-70). A contagem é
 * fato por item, não critério de ordem.
 *
 * Registros de `other`/`unknown` não casam com nenhum nome e simplesmente não contam (BR1) — não
 * somem do banco, só não têm entrada de catálogo.
 */
export const buildFinishCatalog = (
  records: readonly FinishHistoryRecord[],
): readonly FinishCatalogEntry[] => {
  const counts = new Map<FinishTechnique, number>();
  for (const r of records) counts.set(r.technique, (counts.get(r.technique) ?? 0) + 1);
  return NAMED_FINISH_TECHNIQUES.map((technique) => ({ technique, count: counts.get(technique) ?? 0 }));
};
