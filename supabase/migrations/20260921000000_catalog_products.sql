-- SPEC-054 §8/§10/§11 (F32) — o catálogo de produtos reais, e o vínculo com a prateleira dela.
--
-- > *"Quero a Minha Prateleira com: produto real; marca real; linha; variante/tamanho; categoria;
-- > foto REAL/OFICIAL; busca; adicionar à prateleira."* — dono, 2026-09-07
--
-- A SPEC-023 entregou a prateleira: ela cadastra o que tem, **do jeito que chama**. *"Máscara da
-- feira"* é um nome, não um produto — não tem marca, não tem foto, e não tem como aparecer igual na
-- execução. O catálogo é a cabeça da cadeia da D-104, e sem ele cada elo seguinte trabalha com um
-- texto que só significa alguma coisa para quem digitou.
--
-- ⚠️ **IDENTIDADE, NUNCA ALEGAÇÃO.** Todo campo aqui responde *"que produto é este?"*. Nenhum
-- responde *"o que ele faz?"* ou *"para quem serve?"* — composição, indicação e benefício são
-- conteúdo capilar substantivo ⇒ gate D-26/D-70, e um catálogo com campo de indicação atravessa esse
-- gate por dentro do schema.
--
-- ⚠️ **Aditiva por construção:** uma prateleira **sem** vínculo é o estado de todas as prateleiras
-- que existem hoje, e continua sendo o caminho completo (G3/FR4). Nenhuma linha é invalidada.

create table if not exists public.catalog_products (
  id uuid primary key default gen_random_uuid(),

  -- ---------------------------------------------------------------- identidade
  brand text not null,
  -- A linha da marca, quando existe ("Cachos", "Reconstrução Intensiva"). ⚠️ O nome da linha é
  -- **identidade comercial**, não indicação: ele diz como o produto se chama na prateleira da loja.
  line text null,
  name text not null,
  -- Variante ou tamanho: "300ml", "Refil", "Cabelos claros". Mesma regra — identifica, não indica.
  variant text null,
  -- O mesmo vocabulário fechado de `products` (SPEC-023): organização de prateleira, e é o que
  -- mantém as duas tabelas comparáveis sem que nenhuma delas afirme função.
  category text not null check (
    category in ('shampoo', 'conditioner', 'mask', 'leave_in', 'oil', 'styler', 'other')
  ),
  -- F33 — pronto para o scanner. `null` é a maioria dos casos: nem todo produto tem, e nem toda
  -- ingestão traz.
  ean text null,

  -- ---------------------------------------------------------------- imagem e o direito sobre ela
  image_url text null,
  /**
   * ⚠️ **De onde a imagem veio, e sob que direito ela está aqui — o coração desta migration.**
   *
   * O dono foi explícito: ⛔ *"não usar Google Images aleatório; scraping sem direito; imagem de
   * ecommerce sem autorização; embalagem inventada; imagem gerada fingindo ser produto real"*.
   *
   * ⚠️ **A engenharia NÃO consegue verificar se um direito é verdadeiro.** O que ela consegue é
   * tornar **impossível gravar uma imagem que não afirme qual é** — e deixar a afirmação rastreável
   * até a linha que a trouxe. Não existe valor no vocabulário para *"achei na internet"*, e não
   * existe caminho para gravar uma URL sem dizer de onde ela veio.
   */
  image_source text null,
  image_rights text null check (
    image_rights is null or image_rights in ('brand_authorized', 'licensed_feed', 'owned')
  ),
  image_credit text null,

  -- ---------------------------------------------------------------- procedência da linha
  source text not null check (
    source in ('brand_official', 'licensed_feed', 'manual_curation', 'fixture')
  ),
  -- O id da linha no feed ou no contrato de origem, para uma correção poder ser rastreada de volta.
  source_ref text null,
  -- Quando alguém conferiu. `null` é legítimo — e uma linha não conferida simplesmente não é
  -- publicada.
  verified_at timestamptz null,
  /**
   * ⚠️ **`published_at is null` NÃO EXISTE para o app** (FR2). É rascunho de ingestão, e a policy de
   * leitura o filtra — não a tela. Uma trava de aplicação seria contornada por qualquer cliente.
   */
  published_at timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint catalog_products_brand_not_blank check (btrim(brand) <> ''),
  constraint catalog_products_name_not_blank check (btrim(name) <> ''),
  /**
   * ⚠️ **A trava de direito de imagem (NG4/AC5).** URL preenchida obriga origem **e** direito. É
   * `CHECK` e não política de código porque política de código se esquece, e porque a ingestão
   * acontece **fora do app** — por `service_role`, onde nenhuma validação de cliente alcança.
   */
  constraint catalog_products_image_rights_declared check (
    image_url is null or (image_source is not null and image_rights is not null)
  )
);

comment on table public.catalog_products is
  'SPEC-054 (F32): produtos reais — marca, linha, nome, variante, categoria, EAN e imagem com direito declarado. IDENTIDADE, nunca alegação: nada aqui diz o que o produto faz ou para quem serve (D-26/D-70). Leitura pública para autenticadas apenas onde published_at is not null; escrita só fora de banda.';
comment on column public.catalog_products.image_rights is
  'Sob que direito a imagem está aqui. Não existe valor para origem não autorizada: o CHECK obriga a declaração, e a declaração é rastreável por source/source_ref.';

-- BR4 — EAN é único quando existe. Índice parcial porque `null` é a maioria.
create unique index if not exists catalog_products_ean_unique
  on public.catalog_products (ean) where ean is not null;

-- A busca da FR3: marca e nome, sobre o que está publicado.
create index if not exists catalog_products_published_brand_name
  on public.catalog_products (lower(brand), lower(name)) where published_at is not null;

alter table public.catalog_products enable row level security;
alter table public.catalog_products force row level security;

/**
 * ⛔ **O cliente só LÊ, e só o que está publicado.**
 *
 * A ingestão de produtos reais depende de contrato, feed e direito de imagem — **TRUE HUMAN GATE**
 * (SPEC-054 OQ1) —, e acontece fora de banda por `service_role`. Não dar grant de escrita não é
 * precaução: é o que garante que a única forma de uma marca real entrar no app seja passando por
 * quem tem o direito de colocá-la lá.
 */
revoke all on public.catalog_products from anon, authenticated;
grant select on public.catalog_products to authenticated;

drop policy if exists catalog_products_select_published on public.catalog_products;
create policy catalog_products_select_published on public.catalog_products
  for select to authenticated using (published_at is not null);

drop policy if exists catalog_products_owner_all on public.catalog_products;
create policy catalog_products_owner_all on public.catalog_products
  for all to postgres using (true) with check (true);

/**
 * SPEC-054 FR4 — o vínculo da prateleira dela com o catálogo.
 *
 * ⚠️ **Anulável, e `null` é o caminho completo, não a ausência de um.** A prateleira manual continua
 * inteira (G3): o catálogo chega **por cima** da mesma linha em `products`, nunca no lugar dela.
 *
 * ⚠️ **`on delete set null`, nunca cascade.** O catálogo **não é dono** da prateleira dela. Uma linha
 * removida do catálogo transforma o produto dela em manual — e ela nem percebe, que é o
 * comportamento certo (BR3): o registro é do momento em que foi feito, como o snapshot da SPEC-017.
 */
alter table public.products
  add column if not exists catalog_product_id uuid null
    references public.catalog_products (id) on delete set null;

comment on column public.products.catalog_product_id is
  'SPEC-054: de qual produto do catálogo esta linha veio. NULL = cadastro manual, que continua sendo o caminho completo. A linha dela mantém o próprio name e a própria category — o catálogo preenche na hora de adicionar e não manda depois (BR3/FR5).';

-- Rollback (sem dado de produção antes do release, SPEC-054 §22):
--   alter table public.products drop column if exists catalog_product_id;
--   drop table if exists public.catalog_products;
