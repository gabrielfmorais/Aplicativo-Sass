-- SPEC-057 (F32, ingestão) — o catálogo ganha uma fonte de dados aberta e legalmente reutilizável.
--
-- A SPEC-054 deixou `catalog_products` pronto e a ingestão como TRUE HUMAN GATE (contrato/feed/direito
-- de imagem). Esta migration remove o gate de **licença** para uma fonte específica — **Open Beauty
-- Facts (OBF)**, sob **ODbL 1.0** (banco) + **DbCL 1.0** (conteúdo) + **CC BY-SA 3.0** (imagens), com
-- uso **comercial permitido** — acrescentando o que a conformidade exige: de onde a linha veio, sob
-- que licença, e a origem rastreável de cada linha e de cada imagem.
--
-- A pesquisa jurídica está em `docs/legal/OPEN-BEAUTY-FACTS-COMPLIANCE.md`: sem contrato, sem
-- pagamento, sem aceite; o share-alike do ODbL alcança os **fatos do catálogo** (identidade pública de
-- produto), nunca o app nem o dado da usuária.
--
-- ⚠️ **ADITIVA E IDEMPOTENTE.** Só acrescenta colunas e valores de vocabulário; nenhuma linha é
-- invalidada, e rodar de novo é seguro — a ingestão é `workflow_dispatch` e reexecuta.

-- ---------------------------------------------------------------- vocabulário: procedência da linha
-- OBF é **dado aberto**, não feed contratado nem curadoria manual: valor próprio, rastreável.
alter table public.catalog_products
  drop constraint if exists catalog_products_source_check;
alter table public.catalog_products
  add constraint catalog_products_source_check check (
    source in ('brand_official', 'licensed_feed', 'manual_curation', 'fixture', 'open_beauty_facts')
  );

-- ---------------------------------------------------------------- vocabulário: direito da imagem
-- CC BY-SA é **licença aberta** — não é "autorizado pela marca", "feed" nem "nosso".
alter table public.catalog_products
  drop constraint if exists catalog_products_image_rights_check;
alter table public.catalog_products
  add constraint catalog_products_image_rights_check check (
    image_rights is null
    or image_rights in ('brand_authorized', 'licensed_feed', 'owned', 'open_licensed')
  );

-- ---------------------------------------------------------------- conformidade rastreável, por linha
alter table public.catalog_products
  add column if not exists source_url text null,    -- a página do produto na fonte (atribuição + ODbL)
  add column if not exists data_license text null,  -- a licença dos FATOS da linha (ex.: 'ODbL-1.0')
  add column if not exists image_license text null; -- a licença da IMAGEM (ex.: 'CC-BY-SA-3.0')

comment on column public.catalog_products.source_url is
  'SPEC-057: a página do produto na fonte aberta (OBF), para atribuição e rastreabilidade ODbL.';
comment on column public.catalog_products.data_license is
  'SPEC-057: a licença dos fatos da linha (ex.: ODbL-1.0). Gravada por linha para a tabela se descrever com fontes mistas.';
comment on column public.catalog_products.image_license is
  'SPEC-057: a licença da imagem (ex.: CC-BY-SA-3.0). Obrigatória quando image_rights = open_licensed.';

-- ⚠️ **Regra do dono, no banco: nenhuma imagem aberta entra sem licença, crédito E origem rastreável.**
alter table public.catalog_products
  drop constraint if exists catalog_products_open_image_traceable;
alter table public.catalog_products
  add constraint catalog_products_open_image_traceable check (
    image_rights is distinct from 'open_licensed'
    or (image_credit is not null and image_license is not null and source_url is not null)
  );

-- ⚠️ **Dado aberto exige a fonte rastreável:** de OBF, sem `source_url` e `data_license` não grava —
-- é o que satisfaz a atribuição e o share-alike do ODbL (o dado volta à fonte aberta).
alter table public.catalog_products
  drop constraint if exists catalog_products_open_data_traceable;
alter table public.catalog_products
  add constraint catalog_products_open_data_traceable check (
    source <> 'open_beauty_facts'
    or (source_url is not null and data_license is not null)
  );

-- Rollback (sem dado de produção antes do release):
--   alter table public.catalog_products
--     drop constraint if exists catalog_products_open_data_traceable,
--     drop constraint if exists catalog_products_open_image_traceable,
--     drop column if exists image_license,
--     drop column if exists data_license,
--     drop column if exists source_url;
--   (e reverter os dois CHECK de vocabulário para a lista da SPEC-054)
