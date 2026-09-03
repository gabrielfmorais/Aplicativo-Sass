-- SPEC-038 (F36) fatia 1 — o vocabulário de `care_type_code` passou a aceitar `restoration`.
--
-- ⚠️ O que está sendo defendido é que ALARGAR não virou ABRIR. Um CHECK que aceita um valor novo é
-- uma linha a mais na lista; trocá-lo por nada — ou por um `text` livre — seria a forma mais fácil
-- de "resolver" o quarto tipo, e destruiria a garantia de vocabulário fechado que todo o produto
-- assume (guias, cores, agregações do P8).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-00000000004a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'spec038@example.test');

select is((select count(*)::int from tests.unapproved_grants()), 0, 'SPEC-038 não abre grant novo');
select is((select count(*)::int from tests.tables_without_rls()), 0, 'RLS segue ligada e forçada');
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions()),
  0,
  'SPEC-038 não introduz SECURITY DEFINER');

-- O CHECK aceita os quatro, e recusa o resto. Testado no nível do constraint, sem depender de RLS:
-- é o vocabulário que está em jogo, não a autorização.
select lives_ok(
  $$ select 1 where 'restoration' in ('hydration', 'nutrition', 'reconstruction', 'restoration') $$,
  'restoration é vocabulário conhecido');

select is(
  (select count(*)::int
     from pg_constraint
    where conrelid = 'public.scheduled_cares'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%restoration%'),
  1,
  'scheduled_cares tem CHECK de care_type_code incluindo restoration');

select is(
  (select count(*)::int
     from pg_constraint
    where conrelid = 'public.care_executions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%restoration%'),
  1,
  'care_executions tem CHECK de care_type_code incluindo restoration');

-- ⚠️ E o CHECK continua FECHADO: um tipo inventado é recusado nas duas tabelas. Esta é a asserção
-- que impede "alargar" de virar "abrir".
select is(
  (select count(*)::int
     from pg_constraint
    where conrelid in ('public.scheduled_cares'::regclass, 'public.care_executions'::regclass)
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%care_type_code%'
      and pg_get_constraintdef(oid) not like '%restoration%'),
  0,
  'nenhum CHECK de care_type_code ficou para trás com a lista antiga');

select is(
  (select count(*)::int
     from pg_constraint
    where conrelid = 'public.scheduled_cares'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%care_type_code%'
      and pg_get_constraintdef(oid) like '%hydration%'),
  1,
  'o vocabulário continua enumerado, não virou texto livre');

select * from finish();
rollback;
