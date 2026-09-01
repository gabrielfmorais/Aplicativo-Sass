-- SPEC-023 §11 — a prateleira sob cliente hostil: posse, isolamento e os limites do nome.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000c81', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c8@example.test'),
       ('00000000-0000-4000-8000-000000000c92', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c9@example.test');

-- Guardrails de fundação continuam verdes com a tabela nova (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'products tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants de products estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'products não trouxe SECURITY DEFINER');

select tests.as_user('00000000-0000-4000-8000-000000000c81');

-- ------------------------------------------------------------------ a prateleira é dela
select lives_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', 'Máscara da feira', 'mask') $q$,
  'ela cadastra um produto na própria prateleira');
select is(
  (select category from public.products where name = 'Máscara da feira'),
  'mask',
  'e ele fica lá com a categoria que ela escolheu');

-- `with check` é o que impede um cliente adulterado de escrever na prateleira de outra pessoa.
select throws_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c92', 'Invasor', 'other') $q$,
  '42501', null, 'não consegue cadastrar na prateleira de outra usuária');

-- ------------------------------------------------------------------ um ativo por nome (FR5/EC5)
select throws_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', 'máscara DA FEIRA', 'mask') $q$,
  '23505', null, 'o mesmo nome, em qualquer caixa, não vira dois produtos ativos');

select lives_ok(
  $q$ update public.products set archived_at = now() where name = 'Máscara da feira' $q$,
  'ela arquiva o que não usa mais');
select is(
  (select count(*)::int from public.products where archived_at is not null),
  1,
  'e a linha continua no banco — arquivar não apaga');
-- Depois de arquivar, o mesmo nome pode voltar: o índice único só vale entre os ativos.
select lives_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', 'Máscara da feira', 'mask') $q$,
  'e o mesmo nome pode ser recadastrado depois de arquivado');

-- ------------------------------------------------------------------ limites do nome (§8)
select throws_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', repeat('a', 81), 'other') $q$,
  '23514', null, 'um nome acima de 80 caracteres é recusado pelo banco');
select throws_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', '   ', 'other') $q$,
  '23514', null, 'um nome só de espaços é recusado pelo banco');
-- Categoria é enum fechado: organização de prateleira, nunca afirmação capilar.
select throws_ok(
  $q$ insert into public.products (user_id, name, category)
      values ('00000000-0000-4000-8000-000000000c81', 'Qualquer', 'reconstrutor_milagroso') $q$,
  '23514', null, 'uma categoria fora da lista fechada é recusada pelo banco');

-- ------------------------------------------------------------------ isolamento e ausência de DELETE
select tests.as_user('00000000-0000-4000-8000-000000000c92');
select is(
  (select count(*)::int from public.products),
  0,
  'C9 não enxerga a prateleira de C8');

select tests.as_user('00000000-0000-4000-8000-000000000c81');
select throws_ok(
  $q$ delete from public.products $q$,
  '42501', null, 'ninguém apaga um produto: arquivar é UPDATE, e a linha morre com a conta');

select * from finish();
rollback;
