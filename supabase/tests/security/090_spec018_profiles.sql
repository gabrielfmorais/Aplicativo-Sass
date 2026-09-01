-- SPEC-018 §10/§11 — `profiles` sob cliente hostil: posse, isolamento e os limites do nome.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c1@example.test'),
       ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c2@example.test');

-- Guardrails de fundação continuam verdes com a tabela nova (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'profiles tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants de profiles estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'profiles não trouxe SECURITY DEFINER');

-- ------------------------------------------------------------------ a linha é dela (AC/§10)
select tests.as_user('00000000-0000-4000-8000-0000000000c1');
select lives_ok(
  $$ insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-0000000000c1', 'Gabriela') $$,
  'a usuária escreve o próprio nome');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-0000000000c1'),
  'Gabriela',
  'e lê de volta o que escreveu');

-- `with check` é o que impede um cliente adulterado de escrever para outra pessoa.
select throws_ok(
  $$ insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-0000000000c2', 'Invasora') $$,
  '42501', null, 'não consegue criar o perfil de outra usuária');

-- ------------------------------------------------------------------ nulo é uma resposta
select tests.as_user('00000000-0000-4000-8000-0000000000c2');
select lives_ok(
  $$ insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-0000000000c2', null) $$,
  'pular a pergunta é permitido: a linha existe com display_name nulo');
-- A distinção que faz o app não perguntar de novo: linha existe = já perguntamos.
select is(
  (select count(*)::int from public.profiles where user_id = '00000000-0000-4000-8000-0000000000c2'),
  1,
  'a linha existe mesmo sem nome — é assim que "já perguntamos" fica registrado');

-- ------------------------------------------------------------------ isolamento (§10)
select is(
  (select count(*)::int from public.profiles),
  1,
  'C2 enxerga apenas a própria linha, nunca a de C1');
-- Não lança: sob RLS a linha alheia é **invisível**, então o UPDATE encontra zero linhas e volta em
-- silêncio. O que importa não é o erro — é que nada mudou do outro lado, verificado por quem enxerga.
select lives_ok(
  $$ update public.profiles set display_name = 'Sequestrada' where user_id = '00000000-0000-4000-8000-0000000000c1' $$,
  'renomear outra usuária não falha: simplesmente não encontra linha nenhuma');

select tests.as_user('00000000-0000-4000-8000-0000000000c1');
select is(
  (select display_name from public.profiles where user_id = '00000000-0000-4000-8000-0000000000c1'),
  'Gabriela',
  'e a linha de C1 continua exatamente como ela deixou');

-- ------------------------------------------------------------------ limites do nome (§11)
-- Um apelido, não um texto: o limite protege contra PII em massa num campo de uma palavra.
select throws_ok(
  $$ update public.profiles set display_name = repeat('a', 61) where user_id = '00000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'um nome acima de 60 caracteres é recusado pelo banco');
-- Só espaço em branco parece preenchido e cumprimentaria o vazio.
select throws_ok(
  $$ update public.profiles set display_name = '   ' where user_id = '00000000-0000-4000-8000-0000000000c1' $$,
  '23514', null, 'um nome só de espaços é recusado pelo banco');
-- Apagar o nome é UPDATE para nulo, não remoção da linha: a linha guarda o fato de já termos perguntado.
select lives_ok(
  $$ update public.profiles set display_name = null where user_id = '00000000-0000-4000-8000-0000000000c1' $$,
  'ela pode apagar o próprio nome, e a linha continua existindo');

select * from finish();
rollback;
