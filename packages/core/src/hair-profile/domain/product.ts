import { z } from 'zod';

import type { ProductCatalogIdentity } from './catalog-product.ts';
import type { ProductCategory } from './product-category.ts';

/**
 * O vocabulário de categoria mora em `./product-category.ts` — ele é compartilhado com o catálogo
 * (SPEC-054), e mantê-lo aqui criava um ciclo entre os dois arquivos. Reexportado para nenhum
 * consumidor precisar saber disso.
 */
export { PRODUCT_CATEGORIES, ProductCategorySchema, type ProductCategory } from './product-category.ts';

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
  /**
   * SPEC-054 (F32) — de qual produto do catálogo esta linha veio.
   *
   * ⚠️ **`null` é CADASTRO MANUAL, e manual é o caminho completo** (G3): o catálogo chega **por
   * cima** da mesma linha, nunca no lugar dela. Toda prateleira que existe hoje é `null`, e continua
   * funcionando sem ninguém fazer nada.
   *
   * ⚠️ **E o `name` acima continua sendo o DELA.** O catálogo preenche na hora de adicionar e **não
   * manda depois** (BR3/FR5): corrigir — ou apagar — uma linha do catálogo não muda o nome que ela
   * vê, pela mesma razão que a SPEC-017 explica um plano pelo snapshot que o gerou.
   */
  readonly catalog: ProductCatalogIdentity | null;
};
