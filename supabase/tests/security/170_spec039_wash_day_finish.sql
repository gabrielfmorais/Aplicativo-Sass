-- SPEC-039 §8/§10 (F37) — a etapa de finalização sob cliente hostil, e a **barreira de banco**
-- contra a fusão com as técnicas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000f11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f11@example.test'),
       ('00000000-0000-4000-8000-000000000f22', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f22@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000f11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000f31', '00000000-0000-4000-8000-000000000f11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000a31', '00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000f31',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000d3');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000b31', '00000000-0000-4000-8000-000000000a31', '00000000-0000-4000-8000-000000000f11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000e31', '00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000b31', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000e3');

-- Guardrails de fundação continuam verdes com a tabela nova (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'wash_day_finish tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os quatro grants de wash_day_finish estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'a etapa não trouxe SECURITY DEFINER');

select tests.as_user('00000000-0000-4000-8000-000000000f11');
insert into public.wash_days (id, user_id, care_execution_id)
values ('00000000-0000-4000-8000-000000000c31', '00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000e31');

-- ------------------------------------------------------------------ a etapa é dela
select lives_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'done', '00000000-0000-4000-8000-000000000f11') $q$,
  'ela diz que finalizou');

-- FR1/FR6 — uma resposta por Wash Day, e é a PK que garante. É também o que torna o retry depois de
-- uma resposta perdida inofensivo: ele cai na mesma linha, e não cria a segunda.
select throws_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'skipped', '00000000-0000-4000-8000-000000000f11') $q$,
  '23505', null, 'uma etapa por Wash Day, garantida pelo banco');

-- FR6 — trocar é UMA escrita. É por isso que o grant de UPDATE existe.
select lives_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'skipped', '00000000-0000-4000-8000-000000000f11')
      on conflict (wash_day_id) do update set finish_status = excluded.finish_status $q$,
  'trocar a resposta é uma escrita só');
select is(
  (select finish_status from public.wash_day_finish),
  'skipped',
  'e a última escolha dela é a que vale');

-- ------------------------------------------------------------- A BARREIRA (§8, trava 3)
-- ⚠️ **Os dois vocabulários não se aceitam, e quem recusa é o banco.**
--
-- A D-102 proibiu fundir finalização com técnica, e a proibição vivia só em prosa — enquanto seis
-- das catorze técnicas já são movimentos de finalização, e a lista aceitaria mais uma sem erro
-- nenhum. Estas duas linhas são o que reprova a fusão quando ela vier por SQL.
select throws_ok(
  $q$ insert into public.wash_day_techniques (wash_day_id, technique, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'done', '00000000-0000-4000-8000-000000000f11') $q$,
  '23514', null, 'a etapa não entra na lista de técnicas');
select throws_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'scrunched', '00000000-0000-4000-8000-000000000f11')
      on conflict (wash_day_id) do update set finish_status = excluded.finish_status $q$,
  '23514', null, 'e uma técnica não entra na etapa');
-- ⚠️ E o conteúdo do `F38` também não entra por aqui: nomear a finalização é conteúdo capilar
-- substantivo, atrás do gate D-26/D-70. A etapa diz **se aconteceu**, não **qual foi**.
select throws_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'fitagem', '00000000-0000-4000-8000-000000000f11')
      on conflict (wash_day_id) do update set finish_status = excluded.finish_status $q$,
  '23514', null, 'nome de técnica de finalização é recusado pelo banco (F38 está atrás do gate)');

-- ------------------------------------------------------------------ isolamento (AC7)
select tests.as_user('00000000-0000-4000-8000-000000000f22');
select is(
  (select count(*)::int from public.wash_day_finish),
  0,
  'F22 não enxerga a etapa de F11');
select lives_ok(
  $q$ update public.wash_day_finish set finish_status = 'done' $q$,
  'o UPDATE de F22 roda...');
select tests.as_user('00000000-0000-4000-8000-000000000f11');
select is(
  (select finish_status from public.wash_day_finish),
  'skipped',
  '...e não tocou em nada da F11');

-- ------------------------------------------------------------------ tirar a resposta (FR8)
select lives_ok(
  $q$ delete from public.wash_day_finish where wash_day_id = '00000000-0000-4000-8000-000000000c31' $q$,
  'ela tira a resposta e volta a "ainda não disse"');

-- ------------------------------------------------------------------ a FK composta, sozinha (FR7)
-- Com a PK livre, a única coisa entre F22 e o Wash Day de F11 é a FK composta: o `with check` valida
-- o dono da **linha** (e o `user_id` de F22 é legítimo), e quem valida o dono do **hub** é a FK.
-- Sem ela, F22 penduraria a própria etapa no registro de F11 — invisível para os dois, e contável
-- quando o `P8` agregasse por `wash_day_id`.
select tests.as_user('00000000-0000-4000-8000-000000000f22');
select throws_ok(
  $q$ insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
      values ('00000000-0000-4000-8000-000000000c31', 'done', '00000000-0000-4000-8000-000000000f22') $q$,
  '23503', null, 'com a chave livre, é a FK composta que recusa F22');
select tests.as_user('00000000-0000-4000-8000-000000000f11');

-- ------------------------------------------------------------------ anular leva junto (BR5/EC1)
insert into public.wash_day_finish (wash_day_id, finish_status, user_id)
values ('00000000-0000-4000-8000-000000000c31', 'done', '00000000-0000-4000-8000-000000000f11');
select tests.as_service();
delete from public.care_executions where id = '00000000-0000-4000-8000-000000000e31';
select tests.as_user('00000000-0000-4000-8000-000000000f11');
select is(
  (select count(*)::int from public.wash_day_finish),
  0,
  'anular a execução leva a etapa junto, por cascade e sem regra de aplicação');

select * from finish();
rollback;
