-- SPEC-043 (F40/F41/F42) — a Jornada sob cliente hostil: quem concede, quem não apaga, e o teto.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000b11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b11@example.test'),
       ('00000000-0000-4000-8000-000000000b22', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b22@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000b11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000b31', '00000000-0000-4000-8000-000000000b11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000b41', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000b31',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000b4');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000b51', '00000000-0000-4000-8000-000000000b41', '00000000-0000-4000-8000-000000000b11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000b61', '00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000b51', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000b6');

-- Guardrails de fundação continuam verdes com a tabela e a função novas (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'journey_points tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'o único grant de journey_points está na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'award_journey_points está na allowlist');

select tests.as_user('00000000-0000-4000-8000-000000000b11');

-- ⚠️ **O cliente NÃO forja pontos, e NÃO apaga a história dela.** É a razão de a concessão ser RPC:
-- quem decide o que pontuou é o servidor, lendo os fatos canônicos.
select throws_ok(
  $q$ insert into public.journey_points (user_id, fact_kind, fact_id, points, rules_version, awarded_on)
      values ('00000000-0000-4000-8000-000000000b11', 'care_execution', '00000000-0000-4000-8000-000000000b61', 100, 'v1', current_date) $q$,
  '42501', null, 'o cliente não tem INSERT em journey_points');
select throws_ok(
  $q$ update public.journey_points set points = 100 $q$,
  '42501', null, 'e não tem UPDATE — ponto concedido não se reescreve');
select throws_ok(
  $q$ delete from public.journey_points $q$,
  '42501', null, 'e não tem DELETE — histórico falsificável é histórico inútil');

-- ------------------------------------------------------------------ conceder (FR3)
select lives_ok(
  $q$ select public.award_journey_points('America/Sao_Paulo') $q$,
  'a concessão roda');
select is(
  (select count(*)::int from public.journey_points where fact_kind = 'care_execution'),
  1,
  'e o cuidado atendido virou um ponto');
select is(
  (select awarded_on from public.journey_points limit 1),
  (now() at time zone 'America/Sao_Paulo')::date,
  'no dia civil dela, não em UTC');
select is(
  (select rules_version from public.journey_points limit 1),
  'v1',
  'com a régua que o concedeu gravada na linha');

-- ⚠️ **Idempotência pelo id do FATO** (D-103): chamar de novo não repontua nada.
select is(
  (select public.award_journey_points('America/Sao_Paulo')),
  0,
  'chamar de novo não concede nada — idempotente pelo id do fato');
select is(
  (select count(*)::int from public.journey_points),
  1,
  'e continua sendo uma linha só');

-- ------------------------------------------------------------------ isolamento
-- A usuária nunca é parâmetro: J22 chama a MESMA função e recebe os pontos dela, que são zero.
select tests.as_user('00000000-0000-4000-8000-000000000b22');
select is(
  (select count(*)::int from public.journey_points),
  0,
  'J22 não enxerga nem herda a jornada de J11');

select * from finish();
rollback;
