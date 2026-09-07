import type {
  CatalogProduct,
  Instant,
  Product,
  ProductCatalogIdentity,
  ProductCatalogPort,
  ProductCategory,
  ProductPort,
} from '@app/core';
import { CatalogSearchSchema, InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * SPEC-054 — o `select` embutido do catálogo. ⚠️ **A prateleira dela continua mandando no `name` e
 * na `category`**: o que vem do catálogo é só a **identidade** que o produto tem no mundo (FR5/BR3).
 */
const CATALOG_FIELDS = 'id, brand, line, name, variant, category, image_url';

/**
 * ⚠️ **Um `select` só, exportado, e não uma string repetida em cada adapter.**
 *
 * O Wash Day lê os produtos marcados por outro caminho (SPEC-024), e a execução tem de mostrar **a
 * mesma marca e a mesma imagem** que a prateleira (SPEC-054 G4/AC9). Duas listas de colunas
 * divergiriam na primeira que ganhasse um campo — e a divergência apareceria como o produto
 * aparecendo com foto num lugar e sem foto no outro.
 */
export const PRODUCT_WITH_CATALOG_SELECT = `id, name, category, catalog_products ( ${CATALOG_FIELDS} )`;

type CatalogRow = {
  id: string;
  brand: string;
  line: string | null;
  name: string;
  variant: string | null;
  category: ProductCategory;
  image_url: string | null;
};

type Row = {
  id: string;
  name: string;
  category: ProductCategory;
  /**
   * ⚠️ **Objeto OU array, e tratar só um dos dois é uma falha silenciosa.**
   *
   * Numa relação para-um o PostgREST devolve **objeto** (ou `null`); mas isso depende de ele
   * detectar a cardinalidade pela FK, e a tipagem gerada do supabase-js afirma **array**. Se a
   * detecção mudar — ou se a FK for lida de outro jeito — a marca simplesmente **nunca apareceria**,
   * e a prateleira ficaria idêntica à de um produto manual: nada quebraria, nada acusaria.
   *
   * Aceitar as duas formas custa três linhas e elimina a classe inteira.
   */
  catalog_products: CatalogRow | CatalogRow[] | null;
};

const toIdentity = (embedded: CatalogRow | CatalogRow[] | null): ProductCatalogIdentity | null => {
  const row = Array.isArray(embedded) ? (embedded[0] ?? null) : embedded;
  return row
    ? {
        id: row.id,
        brand: row.brand,
        line: row.line,
        name: row.name,
        variant: row.variant,
        category: row.category,
        imageUrl: row.image_url,
      }
    : null;
};

export const toProductWithCatalog = (row: unknown): Product => toProduct(row as Row);

const toProduct = (row: Row): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  catalog: toIdentity(row.catalog_products),
});

const TABLE = 'products';
const fail = (code: string, e: { message: string }) => new InfrastructureError(code, e.message);

/** Violação de unicidade no Postgres. Aqui não é falha: é "você já tem esse produto" (EC2). */
const UNIQUE_VIOLATION = '23505';

/**
 * SPEC-023 §10 — tabela direta, sem RPC.
 *
 * Ao contrário de `hair_events` e `plan_pauses`, esta linha não guarda invariante de servidor: não
 * há dia civil a decidir nem idempotência a garantir. A posse é RLS mais `with check`, e o duplo
 * toque cai no índice único parcial — que é o servidor decidindo, sem precisar de função.
 *
 * `user_id` só aparece no `insert`, onde o `with check` o valida. Nas leituras e nos updates ele
 * nunca vai como filtro: `auth.uid()` decide, e um cliente adulterado que peça a prateleira inteira
 * recebe a dela.
 */
export const createProductAdapter = (
  client: SupabaseClient,
  userId: () => string,
  /**
   * ADR-008 — o instante vem injetado, nunca de `new Date()` aqui dentro. O lint recusa, e recusa
   * com razão: um adapter que lê o relógio ambiente é um adapter que os testes não conseguem fixar.
   */
  now: () => Instant,
): ProductPort => ({
  async list(): Promise<readonly Product[]> {
    const { data, error } = await client
      .from(TABLE)
      /**
       * SPEC-054 — a identidade do catálogo vem **na mesma leitura**, não numa segunda depois.
       *
       * ⚠️ Uma leitura à parte faria a prateleira existir por um instante **sem marca e sem foto** —
       * que é exatamente o estado de um produto manual —, e piscar nele seria mostrar uma coisa
       * falsa antes da verdadeira. Com o catálogo vazio, o embedding volta `null` para todo mundo e
       * a leitura custa o mesmo de antes.
       */
      .select(PRODUCT_WITH_CATALOG_SELECT)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    if (error) throw fail('hair_profile.product_list_failed', error);
    return (data as unknown as Row[]).map(toProduct);
  },

  async add({ name, category, catalogProductId }): Promise<Product> {
    const { data, error } = await client
      .from(TABLE)
      .insert({
        user_id: userId(),
        name,
        category,
        // SPEC-054 FR4 — ausente = ela digitou, que continua sendo o caminho completo. O campo não
        // vai como `undefined`: numa serialização isso vira uma chave presente.
        ...(catalogProductId ? { catalog_product_id: catalogProductId } : {}),
      })
      .select(PRODUCT_WITH_CATALOG_SELECT)
      .single();
    if (!error) return toProduct(data as unknown as Row);
    /**
     * Um código de erro do Postgres não é uma mensagem para ela. Traduzido aqui, na fronteira, para
     * a tela poder dizer "você já tem esse produto" em vez de mostrar a falha crua — e para o
     * caminho de duplicata não se parecer com o de rede.
     */
    throw fail(
      error.code === UNIQUE_VIOLATION ? 'hair_profile.product_duplicate' : 'hair_profile.product_add_failed',
      error,
    );
  },

  async rename({ id, name }): Promise<void> {
    const { error } = await client.from(TABLE).update({ name }).eq('id', id);
    if (!error) return;
    throw fail(
      error.code === UNIQUE_VIOLATION
        ? 'hair_profile.product_duplicate'
        : 'hair_profile.product_rename_failed',
      error,
    );
  },

  async archive(id: string): Promise<void> {
    // Nunca `delete`: a linha precisa continuar existindo para o uso registrado continuar fazendo
    // sentido quando o Wash Day (`F25`) chegar — e o cliente nem tem o privilégio.
    const { error } = await client.from(TABLE).update({ archived_at: now() }).eq('id', id);
    if (error) throw fail('hair_profile.product_archive_failed', error);
  },
});

/**
 * SPEC-054 (F32) — a leitura do catálogo.
 *
 * ⚠️ **Só leitura, e o cliente nem tem grant de escrita.** A ingestão de produtos reais depende de
 * contrato, feed e direito de imagem — **TRUE HUMAN GATE** (OQ1) — e acontece fora de banda por
 * `service_role`. Não existe superfície para escrever, e é isso que garante que uma marca real só
 * entre no app passando por quem tem o direito de colocá-la lá.
 *
 * ⚠️ **A policy filtra o não publicado, não esta função.** `published_at is null` é rascunho de
 * ingestão e simplesmente não existe para o cliente — uma trava de aplicação seria contornada por
 * qualquer cliente adulterado.
 */
export const createProductCatalogAdapter = (client: SupabaseClient): ProductCatalogPort => ({
  async isAvailable(): Promise<boolean> {
    // Uma linha, sem colunas de conteúdo: a pergunta é "existe?", e a policy é quem responde.
    const { data, error } = await client.from('catalog_products').select('id').limit(1);
    if (error) throw fail('hair_profile.catalog_search_failed', error);
    return (data as unknown[]).length > 0;
  },

  async search(input): Promise<readonly CatalogProduct[]> {
    const { text, ean, limit } = CatalogSearchSchema.parse(input);
    if (!text && !ean) return [];

    let query = client.from('catalog_products').select(`${CATALOG_FIELDS}, ean`);
    if (ean) {
      query = query.eq('ean', ean);
    } else if (text) {
      // ⚠️ Escapa `%` e `_` e a vírgula: sem isso, um nome com vírgula quebraria o `or` do
      // PostgREST em dois filtros, e um `%` digitado viraria curinga silencioso.
      const termo = text.replace(/[%_,()]/g, ' ').trim();
      if (!termo) return [];
      query = query.or(`brand.ilike.%${termo}%,name.ilike.%${termo}%,line.ilike.%${termo}%`);
    }

    /**
     * ⛔ **A ordem é por identidade, nunca por mérito** (NG3). Ordenar por popularidade seria a
     * `P18` entrando pela porta dos fundos; por patrocínio, o `T2` — e os dois têm gate próprio.
     */
    const { data, error } = await query
      .order('brand', { ascending: true })
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw fail('hair_profile.catalog_search_failed', error);

    return (data as unknown as (CatalogRow & { ean: string | null })[]).map((row) => ({
      ...(toIdentity(row) as ProductCatalogIdentity),
      ean: row.ean,
    }));
  },
});
