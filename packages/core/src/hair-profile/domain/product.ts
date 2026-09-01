import { z } from 'zod';

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

export const PRODUCT_NAME_MAX_LENGTH = 80;

/**
 * O nome é dela. Normalizamos **espaço**, e só: apara as pontas e colapsa repetições, porque
 * "  Máscara  da   feira " e "Máscara da feira" são o mesmo vidro. Corrigir grafia, capitalizar ou
 * completar a partir de catálogo nenhum — o produto se chama como ela chama.
 */
export const ProductNameSchema = z
  .string()
  .transform((raw) => raw.trim().replace(/\s+/g, ' '))
  .pipe(z.string().min(1).max(PRODUCT_NAME_MAX_LENGTH));

export type Product = {
  readonly id: string;
  readonly name: string;
  readonly category: ProductCategory;
};
