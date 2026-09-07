import { z } from 'zod';

/**
 * ⚠️ **O vocabulário de categoria mora sozinho porque pertence a DOIS donos.**
 *
 * A prateleira dela (SPEC-023) e o catálogo de produtos reais (SPEC-054) usam **a mesma** lista — é
 * o que os torna comparáveis sem que nenhum dos dois afirme função. Deixá-lo dentro de um deles
 * criava uma dependência circular real: o produto precisa da identidade do catálogo, e o catálogo
 * precisa da categoria do produto. Um vocabulário compartilhado por dois contextos é do meio, não
 * de um dos lados.
 */
/**
 * SPEC-023 (F26) — a prateleira dela.
 *
 * **O app guarda o que ela digitou e mais nada.** Nunca composição, indicação, preço, marca,
 * benefício ou link: ele não sabe nada disso, e inventar seria pior que não ter (§1.3 do Blueprint).
 *
 * **Categoria é organização de prateleira, não afirmação capilar.** Nenhum valor diz para que serve
 * ou o que faz — "máscara" é um tipo de vidro no banheiro, não uma promessa. É essa contenção que
 * mantém a capability fora do gate de domínio (D-26/D-70), e ela se perde na primeira palavra a
 * mais: "reconstrutor" já seria outra coisa.
 */
export const PRODUCT_CATEGORIES = [
  'shampoo',
  'conditioner',
  'mask',
  'leave_in',
  'oil',
  'styler',
  'other',
] as const;

export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
