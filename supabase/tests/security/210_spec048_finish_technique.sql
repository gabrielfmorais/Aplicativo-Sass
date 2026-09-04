-- SPEC-048 (F38) — QUAL finalização: o vocabulário fechado e a coerência com a etapa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000d11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd11@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000d11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000d21', '00000000-0000-4000-8000-000000000d11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000d31', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000d21',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000d3');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000d41', '00000000-0000-4000-8000-000000000d31', '00000000-0000-4000-8000-000000000d11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000d51', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000d41', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000d5');
insert into public.wash_days (id, user_id, care_execution_id)
values ('00000000-0000-4000-8000-000000000d61', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000d51');

select tests.as_user('00000000-0000-4000-8000-000000000d11');

-- ------------------------------------------------------------------ o vocabulário é FECHADO
select lives_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, finish_technique, user_id)
      values ('00000000-0000-4000-8000-000000000d61', 'done', 'fitagem_tradicional', '00000000-0000-4000-8000-000000000d11') $q$,
  'uma finalização do vocabulário entra');

select is(
  (select finish_technique from public.wash_day_finish),
  'fitagem_tradicional',
  'e fica gravada como ela disse');

-- ⚠️ **Sem texto livre** (SPEC-024): `other` cobre o que está fora da lista, `unknown` é "não sei o
-- nome". Texto livre não se compara nem se agrega, e destruiria P5/P6/P7/P8.
select throws_ok(
  $q$ update public.wash_day_finish set finish_technique = 'fitagem que eu inventei' $q$,
  '23514', null, 'o banco recusa qualquer valor fora do vocabulário');

select throws_ok(
  $q$ update public.wash_day_finish set finish_technique = 'day_after' $q$,
  '23514', null, 'day_after ficou de fora desta versão, por decisão do dono');

-- ⚠️ **Nenhuma técnica de LAVAGEM atravessa para cá.** É a TRAVA 4 da SPEC-039 §8 medida no banco:
-- os vocabulários são disjuntos, e a fusão que a D-102 proibiu não recomeça por esta porta.
select throws_ok(
  $q$ update public.wash_day_finish set finish_technique = 'diffuser' $q$,
  '23514', null, 'uma técnica da SPEC-024 não é uma finalização, nem aqui');

select throws_ok(
  $q$ update public.wash_day_finish set finish_technique = 'done' $q$,
  '23514', null, 'e a etapa também não');

-- ------------------------------------------------------------------ técnica exige etapa `done`
-- ⚠️ "Pulei a finalização, e a técnica foi fitagem" é estado impossível — e o banco é o único lugar
-- onde ele fica impossível de verdade: uma checagem de aplicação seria contornada por outro caminho.
select throws_ok(
  $q$ update public.wash_day_finish set finish_status = 'skipped' $q$,
  '23514', null, 'pular com técnica gravada é recusado');

select lives_ok(
  $q$ update public.wash_day_finish set finish_status = 'skipped', finish_technique = null $q$,
  'pular limpando a técnica junto é o caminho coerente');

select * from finish();
rollback;
