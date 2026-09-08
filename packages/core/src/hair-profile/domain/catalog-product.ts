import { z } from 'zod';

import type { ProductCategory } from './product-category.ts';

/**
 * SPEC-054 (F32) — **o produto real**, a cabeça da cadeia da D-104.
 *
 * A SPEC-023 entregou a prateleira e ela funciona: *"Máscara da feira"* é dela, e é o suficiente para
 * o Wash Day, a Smart Shelf e a Hair Intelligence contarem. O que aquele texto **não** tem é marca,
 * foto e identidade — e sem isso o mesmo produto não aparece igual na execução, e duas usuárias não
 * têm como falar da mesma coisa.
 *
 * ⚠️ **IDENTIDADE, NUNCA ALEGAÇÃO — a regra que define este tipo.** Todo campo aqui responde *"que
 * produto é este?"*. **Nenhum** responde *"o que ele faz?"* ou *"para quem serve?"*: composição,
 * indicação e benefício são conteúdo capilar substantivo ⇒ **gate D-26/D-70**, e um catálogo com
 * campo de indicação atravessa esse gate por dentro do schema, onde ninguém olha.
 *
 * ⚠️ **`line` e `variant` são identidade comercial, não indicação.** *"Cachos"* como nome de linha
 * diz **como o produto se chama na prateleira da loja**; *"para cabelos cacheados"* diria para quem
 * ele serve. A diferença parece pequena e é a fronteira inteira.
 */
export type CatalogProduct = {
  readonly id: string;
  readonly brand: string;
  /** A linha da marca, quando existe. Identidade comercial. */
  readonly line: string | null;
  readonly name: string;
  /** Variante ou tamanho: "300ml", "Refil". */
  readonly variant: string | null;
  readonly category: ProductCategory;
  /** `F33` — pronto para o scanner. `null` é a maioria: nem todo produto tem. */
  readonly ean: string | null;
  /**
   * ⚠️ **`null` é caminho normal, não estado de erro** (FR7). Um produto de catálogo pode não ter
   * imagem, e um sem imagem tem de ficar tão utilizável quanto um com — senão a capability passa a
   * depender de um asset que é justamente a parte bloqueada por direito de uso.
   */
  readonly imageUrl: string | null;
};

/**
 * O que a prateleira dela guarda **do** catálogo: só o necessário para o produto aparecer igual na
 * prateleira e na execução (FR6/G4).
 *
 * ⚠️ **É um objeto opcional inteiro, e não campos soltos em `Product`.** Com `brand?` e `imageUrl?`
 * avulsos, *"tem marca mas não tem vínculo"* seria representável — e essa combinação não significa
 * nada. Aqui, `null` é **manual**, e manual é o caminho completo (G3).
 */
export type ProductCatalogIdentity = Omit<CatalogProduct, 'ean'>;

export const CatalogSearchSchema = z.object({
  /** Texto livre: marca, linha ou nome. **Min 1** para o autocomplete (SPEC-058): a busca começa a
   * sugerir com a primeira letra, e o ranking do servidor põe a marca certa na frente. */
  text: z.string().trim().min(1).max(80).optional(),
  /** `F33` — busca exata. O scanner ainda não existe; a busca por código já. */
  ean: z
    .string()
    .trim()
    .regex(/^[0-9]{8,14}$/)
    .optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export type CatalogSearch = z.input<typeof CatalogSearchSchema>;

/**
 * Como o produto se chama por extenso, quando ele vem do catálogo.
 *
 * ⚠️ **A marca vem JUNTO do nome, nunca no lugar dele.** O nome é o que ela reconhece na prateleira
 * do banheiro; a marca é o que torna o produto o mesmo para todo mundo. Trocar um pelo outro faria a
 * prateleira dela deixar de parecer a prateleira dela.
 */
export const catalogFullName = (p: {
  brand: string;
  line: string | null;
  name: string;
  variant: string | null;
}): string => [p.brand, p.line, p.name, p.variant].filter(Boolean).join(' · ');
