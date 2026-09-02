-- SPEC-025 §11 — o couro cabeludo sob cliente hostil: posse do hub, isolamento, uma resposta por
-- Wash Day, o vocabulário fechado e a cascata da anulação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000e11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e11@example.test'),
       ('00000000-0000-4000-8000-000000000e22', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e22@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000e11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000f21', '00000000-0000-4000-8000-000000000e11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000a21', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000f21',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000d2');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000b21', '00000000-0000-4000-8000-000000000a21', '00000000-0000-4000-8000-000000000e11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000e21', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000b21', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000e2');

-- Guardrails de fundação continuam verdes com a tabela nova (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'wash_day_scalp tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os quatro grants de wash_day_scalp estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'o couro cabeludo não trouxe SECURITY DEFINER');

select tests.as_user('00000000-0000-4000-8000-000000000e11');
insert into public.wash_days (id, user_id, care_execution_id)
values ('00000000-0000-4000-8000-000000000c21', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000e21');

-- ------------------------------------------------------------------ a resposta é dela
select lives_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'oily_quickly', '00000000-0000-4000-8000-000000000e11') $q$,
  'ela diz como o couro esteve');

-- FR4 — uma resposta por Wash Day: a PK é o hub, então não há segunda linha a desempatar.
select throws_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'balanced', '00000000-0000-4000-8000-000000000e11') $q$,
  '23505', null, 'uma resposta por Wash Day, garantida pelo banco');

-- FR3 — trocar é UMA escrita. É por isso que o grant de UPDATE existe: um delete+insert deixaria
-- uma janela sem resposta se a segunda metade falhasse.
select lives_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'dry_tendency', '00000000-0000-4000-8000-000000000e11')
      on conflict (wash_day_id) do update set scalp_feel = excluded.scalp_feel $q$,
  'trocar a resposta é uma escrita só');
select is(
  (select scalp_feel from public.wash_day_scalp),
  'dry_tendency',
  'e a última escolha dela é a que vale');

-- ⚠️ NG1/OQ2 — sintoma clínico é recusado **pelo banco**, não por uma checagem de tela. Nomear
-- coceira ou descamação mudaria a natureza do dado para saúde: base legal LGPD (D-32) e sign-off de
-- domínio (D-26), duas chaves que não são do agente. A linha abaixo é a barreira desenhada.
select throws_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'itchy', '00000000-0000-4000-8000-000000000e11')
      on conflict (wash_day_id) do update set scalp_feel = excluded.scalp_feel $q$,
  '23514', null, 'sintoma fora do vocabulário é recusado pelo banco');

-- ------------------------------------------------------------------ isolamento (AC6)
select tests.as_user('00000000-0000-4000-8000-000000000e22');
select is(
  (select count(*)::int from public.wash_day_scalp),
  0,
  'E22 não enxerga a resposta de E11');
-- Com o hub já respondido, quem barra primeiro é a **PK** — que é o `wash_day_id`. A FK composta
-- nem chega a ser consultada, e escrever este teste esperando `23503` foi o que revelou isso: o
-- ataque falha, mas por um motivo que não é o que se queria provar. As duas camadas são testadas,
-- e a da FK só aparece com a PK livre (mais abaixo, depois de ela tirar a resposta).
select throws_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'balanced', '00000000-0000-4000-8000-000000000e22') $q$,
  '23505', null, 'com o hub já respondido, a PK barra E22 antes de a FK ser consultada');
-- E não alcança a linha alheia por UPDATE nem por DELETE: a RLS não a devolve para começo de conversa.
select lives_ok(
  $q$ update public.wash_day_scalp set scalp_feel = 'balanced' $q$,
  'o UPDATE de E22 roda...');
select tests.as_user('00000000-0000-4000-8000-000000000e11');
select is(
  (select scalp_feel from public.wash_day_scalp),
  'dry_tendency',
  '...e não tocou em nada da E11');

-- ------------------------------------------------------------------ tirar a resposta (EC2)
select lives_ok(
  $q$ delete from public.wash_day_scalp where wash_day_id = '00000000-0000-4000-8000-000000000c21' $q$,
  'ela tira a resposta');
select is(
  (select count(*)::int from public.wash_days),
  1,
  'e o registro do dia continua lá — um Wash Day sem resposta é um estado válido');

-- ------------------------------------------------------------------ a FK composta, sozinha (AC6)
-- Agora a PK está livre, e a única coisa entre E22 e o Wash Day de E11 é a FK composta. É aqui que
-- ela é realmente exercitada: `with check` valida o dono da **linha** (e o `user_id` de E22 é
-- legítimo), enquanto quem valida o dono do **hub** é a FK — sem ela, E22 penduraria a própria
-- resposta no registro de E11, invisível para os dois e contável por `P2`.
select tests.as_user('00000000-0000-4000-8000-000000000e22');
select throws_ok(
  $q$ insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
      values ('00000000-0000-4000-8000-000000000c21', 'balanced', '00000000-0000-4000-8000-000000000e22') $q$,
  '23503', null, 'com a chave livre, é a FK composta que recusa E22');
select tests.as_user('00000000-0000-4000-8000-000000000e11');

-- ------------------------------------------------------------------ anular leva junto (BR4)
insert into public.wash_day_scalp (wash_day_id, scalp_feel, user_id)
values ('00000000-0000-4000-8000-000000000c21', 'balanced', '00000000-0000-4000-8000-000000000e11');
select tests.as_service();
delete from public.care_executions where id = '00000000-0000-4000-8000-000000000e21';
select tests.as_user('00000000-0000-4000-8000-000000000e11');
select is(
  (select count(*)::int from public.wash_day_scalp),
  0,
  'anular a execução leva a resposta junto, por cascade e sem regra de aplicação');

select * from finish();
rollback;
