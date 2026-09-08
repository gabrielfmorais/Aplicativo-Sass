-- SPEC-058 (F32) — a busca do catálogo em tempo real (RPC catalog_search).
--
-- O que este arquivo guarda: a RPC só devolve o **publicado** (SECURITY INVOKER + RLS), é
-- **acento/maiúscula-insensível**, ranqueia **marca exata na frente**, e o cliente pode executá-la
-- mas continua sem escrever no catálogo.

begin;
select plan(7);

-- Semear: duas linhas publicadas (uma Wella, uma com acento) + um rascunho. `search_text` é gerado.
insert into public.catalog_products
  (id, brand, name, category, source, source_ref, source_url, data_license, published_at)
values
  ('00000000-0000-4000-8000-0000000000e1', 'Wella', 'Invigo Nutri-Enrich', 'shampoo',
   'open_beauty_facts', '1', 'https://world.openbeautyfacts.org/product/1', 'ODbL-1.0', now()),
  ('00000000-0000-4000-8000-0000000000e2', 'Lolá Acentuada', 'Máscara Hidratação', 'mask',
   'open_beauty_facts', '2', 'https://world.openbeautyfacts.org/product/2', 'ODbL-1.0', now()),
  ('00000000-0000-4000-8000-0000000000e3', 'Wella', 'Rascunho Não Publicado', 'shampoo',
   'open_beauty_facts', '3', 'https://world.openbeautyfacts.org/product/3', 'ODbL-1.0', null);

-- O texto de busca é gerado, minúsculo e sem acento (robusto a espaçamento e ean nulo).
select ok(
  (select search_text from public.catalog_products where id = '00000000-0000-4000-8000-0000000000e2')
    like '%lola acentuada%'
  and (select search_text from public.catalog_products where id = '00000000-0000-4000-8000-0000000000e2')
    like '%mascara hidratacao%',
  'search_text é gerado: minúsculo e sem acento');

select tests.as_user('00000000-0000-4000-8000-0000000000f1');

-- Busca por marca devolve o produto publicado…
select is(
  (select count(*)::int from public.catalog_search('wella')),
  1,
  'catalog_search("wella") devolve só o publicado — o rascunho não conta');

-- …e o rascunho NUNCA aparece (SECURITY INVOKER + RLS).
select is(
  (select count(*)::int from public.catalog_search('rascunho')),
  0,
  'rascunho não publicado não é buscável pelo cliente');

-- Acento/maiúscula-insensível: "MASCARA" (sem acento, maiúsculo) acha "Máscara".
select is(
  (select count(*)::int from public.catalog_search('MASCARA')),
  1,
  'busca é acento e maiúscula-insensível');

-- Acento no termo também casa o sem-acento do dado ("Lolá" ~ "lola").
select is(
  (select count(*)::int from public.catalog_search('lolá')),
  1,
  'termo acentuado casa o texto normalizado');

-- Ranking: marca exata "wella" vem antes de qualquer outra coisa.
select is(
  (select brand from public.catalog_search('wella') limit 1),
  'Wella',
  'ranking põe a marca exata na frente');

-- O cliente pode BUSCAR, mas continua sem poder ESCREVER no catálogo (grant inalterado).
select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source)
      values ('Pirata', 'Produto', 'other', 'fixture') $q$,
  '42501', null, 'buscar não dá ao cliente o direito de escrever no catálogo');

select * from finish();
rollback;
