-- SPEC-058 (F32) — busca do catálogo em tempo real (autocomplete), preparada para crescer.
--
-- A SPEC-054/057 buscava com `brand.ilike.%t% or name.ilike.%t%` — sem acento-insensível, sem índice,
-- e ordenado por marca/nome, não por relevância. Com milhares de produtos hoje e dezenas de milhares
-- amanhã, isso é filtro ruim. Esta migration põe a busca no servidor, indexada e relevante.
--
-- ⚠️ **Identidade, nunca mérito.** O ranking ordena por CORRESPONDÊNCIA TEXTUAL (marca exata → prefixo
-- → contém) e presença de foto — nunca por "melhor para o cabelo" (P18/D-26) nem por comissão (T2).

-- Acento-insensível (unaccent) e busca por trecho indexada (pg_trgm), no schema padrão do Supabase.
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ⚠️ `unaccent` é STABLE; fixamos o dicionário para ter uma versão IMMUTABLE — o que permite indexar
-- e usar numa coluna gerada. É o padrão recomendado para busca acento-insensível.
create or replace function public.f_unaccent(text)
  returns text language sql immutable parallel safe
  set search_path = extensions, public, pg_temp
  as $$ select extensions.unaccent('extensions.unaccent', $1) $$;

-- Texto de busca normalizado (minúsculo, sem acento), **gerado no servidor** — uma verdade só, para
-- qualquer fonte (não depende do JS da ingestão). Inclui marca, linha, nome, variante e EAN.
alter table public.catalog_products
  add column if not exists search_text text
    generated always as (
      lower(
        public.f_unaccent(
          coalesce(brand, '') || ' ' || coalesce(line, '') || ' ' || coalesce(name, '') || ' ' ||
          coalesce(variant, '') || ' ' || coalesce(ean, '')
        )
      )
    ) stored;

-- GIN trigram sobre o texto de busca, só do que é público (é o que o cliente lê). Suporta `like '%q%'`.
create index if not exists catalog_products_search_trgm
  on public.catalog_products using gin (search_text extensions.gin_trgm_ops)
  where published_at is not null;

-- ⚠️ **SECURITY INVOKER: a RLS decide.** A função roda como a usuária, então só devolve o publicado —
-- não há como um cliente adulterado ler rascunho de ingestão por aqui.
create or replace function public.catalog_search(q text, lim int default 24)
  returns setof public.catalog_products
  language sql
  stable
  security invoker
  set search_path = public, extensions, pg_temp
  as $$
    with n as (select lower(public.f_unaccent(btrim(coalesce(q, '')))) as qn)
    select c.*
    from public.catalog_products c, n
    where c.published_at is not null
      and length(n.qn) >= 1
      and c.search_text like '%' || n.qn || '%'
    order by
      (lower(public.f_unaccent(c.brand)) = n.qn) desc,            -- marca exata primeiro
      (lower(public.f_unaccent(c.brand)) like n.qn || '%') desc,  -- marca começa com
      (c.search_text like n.qn || '%') desc,                      -- texto começa com
      (c.image_url is not null) desc,                             -- com foto antes de sem foto
      c.brand asc,
      length(c.name) asc
    limit least(greatest(coalesce(lim, 24), 1), 50);
  $$;

comment on function public.catalog_search(text, int) is
  'SPEC-058: busca do catálogo em tempo real. Acento/maiúscula-insensível, ranking por correspondência textual + foto (nunca por mérito capilar — D-26 — nem comissão — T2). SECURITY INVOKER: só devolve published.';

revoke all on function public.catalog_search(text, int) from public;
grant execute on function public.catalog_search(text, int) to authenticated;

-- Rollback (sem dado de produção antes do release):
--   drop function if exists public.catalog_search(text, int);
--   drop index if exists public.catalog_products_search_trgm;
--   alter table public.catalog_products drop column if exists search_text;
--   drop function if exists public.f_unaccent(text);
