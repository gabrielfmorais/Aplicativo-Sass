-- SPEC-054 §10/§11 (F32) — o catálogo de produtos reais sob cliente hostil.
--
-- ⚠️ **A asserção que mais importa neste arquivo é a do DIREITO DE IMAGEM.** O dono foi explícito:
-- ⛔ *"não usar Google Images aleatório; scraping sem direito; imagem de ecommerce sem autorização;
-- embalagem inventada; imagem gerada fingindo ser produto real"*. A engenharia **não consegue
-- verificar se um direito é verdadeiro** — o que ela consegue é tornar **impossível gravar uma
-- imagem que não afirme qual é**, e é isso que está medido aqui.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cat1@example.test');

select is((select count(*)::int from tests.tables_without_rls()), 0, 'catalog_products tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'o único grant do catálogo (SELECT) está na allowlist');
-- ⚠️ Nenhuma função DEFINER nova: a fatia inteira não precisou de uma.
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'nenhuma RPC nova');

-- ------------------------------------------------------------------ a trava de direito de imagem
-- ⛔ **URL sem origem e sem direito declarados NÃO ENTRA.** É `CHECK` e não política de código
-- porque política de código se esquece — e porque a ingestão acontece **fora do app**, por
-- service_role, onde nenhuma validação de cliente alcança.
select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source, image_url)
      values ('Marca Fictícia', 'Shampoo de Teste', 'shampoo', 'fixture', 'https://exemplo.test/p.jpg') $q$,
  '23514', null, 'imagem sem origem nem direito declarados é recusada pelo banco');

select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source, image_url, image_source)
      values ('Marca Fictícia', 'Shampoo de Teste', 'shampoo', 'fixture', 'https://exemplo.test/p.jpg', 'site oficial') $q$,
  '23514', null, 'origem sem direito também é recusada — as duas coisas, ou nenhuma');

-- ⛔ E o vocabulário de direito é fechado: não existe valor para "achei na internet".
select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source, image_url, image_source, image_rights)
      values ('Marca Fictícia', 'Shampoo', 'shampoo', 'fixture', 'https://exemplo.test/p.jpg', 'google', 'found_online') $q$,
  '23514', null, 'não existe direito "achei na internet": o vocabulário é fechado');

select lives_ok(
  $q$ insert into public.catalog_products
        (id, brand, line, name, variant, category, ean, source, image_url, image_source, image_rights, published_at)
      values ('00000000-0000-4000-8000-0000000000c1', 'Marca Fictícia', 'Linha Teste', 'Shampoo de Teste',
              '300ml', 'shampoo', '7891234567895', 'fixture',
              'https://exemplo.test/p.jpg', 'kit de imprensa da marca', 'brand_authorized', now()) $q$,
  'com origem e direito declarados, a linha entra');

-- FR7 — produto **sem** imagem é caminho normal, e não precisa declarar direito nenhum.
select lives_ok(
  $q$ insert into public.catalog_products (id, brand, name, category, source, published_at)
      values ('00000000-0000-4000-8000-0000000000c2', 'Marca Fictícia', 'Creme sem foto', 'mask', 'fixture', now()) $q$,
  'produto sem imagem entra sem declarar direito — sem foto é caminho normal');

-- BR4 — EAN é único quando existe.
select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source, ean)
      values ('Outra Fictícia', 'Outro', 'other', 'fixture', '7891234567895') $q$,
  '23505', null, 'EAN duplicado é recusado');

-- Rascunho de ingestão: existe no banco, e não existe para o cliente (FR2).
insert into public.catalog_products (id, brand, name, category, source)
values ('00000000-0000-4000-8000-0000000000c3', 'Marca Fictícia', 'Rascunho', 'other', 'fixture');

-- ------------------------------------------------------------------ o que o cliente pode fazer
select tests.as_user('00000000-0000-4000-8000-0000000000b1');

select is((select count(*)::int from public.catalog_products), 2, 'ela enxerga só o publicado — o rascunho não existe para ela (FR2)');

-- ⛔ **Nenhuma escrita, e é o que garante que uma marca real só entre por quem tem o direito.**
select throws_ok(
  $q$ insert into public.catalog_products (brand, name, category, source)
      values ('Inventada', 'Produto', 'other', 'fixture') $q$,
  '42501', null, 'o cliente não cria produto no catálogo');
select throws_ok(
  $q$ update public.catalog_products set brand = 'Outra' $q$,
  '42501', null, 'o cliente não edita o catálogo');
select throws_ok(
  $q$ delete from public.catalog_products $q$,
  '42501', null, 'o cliente não apaga o catálogo');

-- ------------------------------------------------------------------ a prateleira dela é dela (BR3)
select lives_ok(
  $q$ insert into public.products (user_id, name, category, catalog_product_id)
      values ('00000000-0000-4000-8000-0000000000b1', 'Meu shampoo', 'shampoo',
              '00000000-0000-4000-8000-0000000000c1') $q$,
  'ela adiciona do catálogo, com o vínculo');

-- ⚠️ **Apagar a linha do catálogo NÃO muda o produto dela** — `on delete set null`, nunca cascade.
-- O catálogo não é dono da prateleira dela: o registro é do momento em que foi feito (D-69).
select tests.as_service();
delete from public.catalog_products where id = '00000000-0000-4000-8000-0000000000c1';
select tests.as_user('00000000-0000-4000-8000-0000000000b1');
select is(
  (select name from public.products where name = 'Meu shampoo'),
  'Meu shampoo',
  'apagar a linha do catálogo não muda o nome que ela vê');
select is(
  (select catalog_product_id from public.products where name = 'Meu shampoo'),
  null,
  'o produto dela vira manual, sem perda — e manual é o caminho completo');

select * from finish();
rollback;
