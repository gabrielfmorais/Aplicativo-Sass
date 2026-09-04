-- SPEC-042 (F34) — a marca da Huna que ela escolhe, sob cliente hostil.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a1@example.test'),
       ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2@example.test');

-- A coluna entra debaixo da RLS e dos grants que `profiles` já tinha (SPEC-018 §10): nenhum
-- privilégio novo, e por isso os guardrails de fundação têm de continuar verdes sem nada a mais.
select is((select count(*)::int from tests.tables_without_rls()), 0, 'profiles continua com RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'a coluna nova não trouxe grant nenhum');

select tests.as_user('00000000-0000-4000-8000-0000000000a1');
insert into public.profiles (user_id, display_name) values ('00000000-0000-4000-8000-0000000000a1', 'Ana');

-- ------------------------------------------------------------------ a escolha é dela
select is(
  (select avatar_key from public.profiles),
  null,
  'sem escolha, a coluna é nula — e o app cai na inicial do nome');

select lives_ok(
  $q$ update public.profiles set avatar_key = 'flow_berry' $q$,
  'ela escolhe uma marca');
select is((select avatar_key from public.profiles), 'flow_berry', 'e a escolha vale');

-- Tirar a escolha é voltar à inicial: um estado válido, e dela.
select lives_ok(
  $q$ update public.profiles set avatar_key = null $q$,
  'ela tira a escolha');

-- ⚠️ Vocabulário fechado, recusado **pelo banco**. Uma chave livre aqui abriria a porta para um
-- cliente adulterado gravar qualquer string numa coluna que a tela desenha.
select throws_ok(
  $q$ update public.profiles set avatar_key = 'flow_neon' $q$,
  '23514', null, 'marca fora da lista é recusada pelo banco');
-- 🔒 E o que a SPEC-036 proíbe também não entra por aqui: as marcas são abstratas, sem figura
-- humana, por decisão do dono. Uma "foto" muito menos — foto é a `P24`, atrás do D-32.
select throws_ok(
  $q$ update public.profiles set avatar_key = 'photo' $q$,
  '23514', null, 'foto não é um valor desta coluna (P24 / D-32)');

-- ------------------------------------------------------------------ isolamento
select tests.as_user('00000000-0000-4000-8000-0000000000a2');
select lives_ok(
  $q$ update public.profiles set avatar_key = 'flow_wine' $q$,
  'o UPDATE de A2 roda, e a RLS não devolve a linha de A1');
select tests.as_user('00000000-0000-4000-8000-0000000000a1');
select is(
  (select avatar_key from public.profiles),
  null,
  'a escolha de A1 continua sendo dela');

select * from finish();
rollback;
