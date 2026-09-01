-- SPEC-024 §11 — o Wash Day sob cliente hostil: posse, isolamento, unicidade e a cascata da anulação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000d11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd11@example.test'),
       ('00000000-0000-4000-8000-000000000d22', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd22@example.test');

-- Perfil como a usuária (FORCE RLS sem policy para o dono da tabela); plano, cuidado e execução
-- como dono, porque o cliente não tem INSERT em nenhum dos três.
select tests.as_user('00000000-0000-4000-8000-000000000d11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000d11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
-- A prateleira dela: o cliente **tem** INSERT em products (SPEC-023), então isto entra como ela.
insert into public.products (id, user_id, name, category)
values ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000d11', 'Máscara da feira', 'mask');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000f11',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000d1');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000b11', '00000000-0000-4000-8000-000000000a11', '00000000-0000-4000-8000-000000000d11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000b11', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000e1');

-- Guardrails de fundação continuam verdes com as três tabelas novas (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'as três tabelas do Wash Day têm RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants do Wash Day estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'o Wash Day não trouxe SECURITY DEFINER');

select tests.as_user('00000000-0000-4000-8000-000000000d11');

-- ------------------------------------------------------------------ o registro é dela
select lives_ok(
  $q$ insert into public.wash_days (id, user_id, care_execution_id)
      values ('00000000-0000-4000-8000-000000000c11', '00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000e11') $q$,
  'ela registra o Wash Day da própria execução');

-- FR4 — um registro por execução: voltar ao mesmo cuidado edita, nunca cria o segundo.
select throws_ok(
  $q$ insert into public.wash_days (user_id, care_execution_id)
      values ('00000000-0000-4000-8000-000000000d11', '00000000-0000-4000-8000-000000000e11') $q$,
  '23505', null, 'um registro por execução, garantido pelo banco');

-- ------------------------------------------------------------------ produtos e técnicas
select lives_ok(
  $q$ insert into public.wash_day_products (wash_day_id, product_id, user_id)
      values ('00000000-0000-4000-8000-000000000c11', '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000d11') $q$,
  'ela marca um produto da própria prateleira');
select throws_ok(
  $q$ insert into public.wash_day_products (wash_day_id, product_id, user_id)
      values ('00000000-0000-4000-8000-000000000c11', '00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000d11') $q$,
  '23505', null, 'marcar duas vezes o mesmo produto não cria duas linhas');

select lives_ok(
  $q$ insert into public.wash_day_techniques (wash_day_id, technique, user_id)
      values ('00000000-0000-4000-8000-000000000c11', 'pre_wash_oil', '00000000-0000-4000-8000-000000000d11') $q$,
  'ela marca uma técnica da lista fechada');
-- O vocabulário nomeia o que ela faz. Qualquer coisa fora da lista é recusada pelo banco.
select throws_ok(
  $q$ insert into public.wash_day_techniques (wash_day_id, technique, user_id)
      values ('00000000-0000-4000-8000-000000000c11', 'selar_as_cuticulas', '00000000-0000-4000-8000-000000000d11') $q$,
  '23514', null, 'uma técnica fora da lista fechada é recusada pelo banco');

-- Desmarcar é ela corrigindo o que marcou: a linha da junção sai, o registro do dia fica.
select lives_ok(
  $q$ delete from public.wash_day_techniques where technique = 'pre_wash_oil' $q$,
  'ela desmarca uma técnica');
select is(
  (select count(*)::int from public.wash_days),
  1,
  'e o registro do dia continua lá');

-- ------------------------------------------------------------------ isolamento (AC6)
select tests.as_user('00000000-0000-4000-8000-000000000d22');
select is(
  (select count(*)::int from public.wash_days),
  0,
  'D22 não enxerga o Wash Day de D11');
select is(
  (select count(*)::int from public.wash_day_products),
  0,
  'nem os produtos que D11 marcou');
-- `with check` valida o dono da **linha**; quem valida o dono do **hub** é a FK composta. Sem ela,
-- D22 penduraria a própria linha no Wash Day de D11: ninguém leria — nem a vítima — mas ela
-- contaria quando `P8` agregasse por `wash_day_id`.
select throws_ok(
  $q$ insert into public.wash_day_techniques (wash_day_id, technique, user_id)
      values ('00000000-0000-4000-8000-000000000c11', 'co_wash', '00000000-0000-4000-8000-000000000d22') $q$,
  '23503', null, 'D22 não pendura nada no Wash Day de D11: a FK composta recusa');

-- ------------------------------------------------------------------ produto arquivado (BR3)
select tests.as_user('00000000-0000-4000-8000-000000000d11');
select lives_ok(
  $q$ update public.products set archived_at = now() where id = '00000000-0000-4000-8000-000000000901' $q$,
  'ela tira o produto da prateleira');
select is(
  (select count(*)::int from public.wash_day_products),
  1,
  'e o uso registrado continua: o uso aconteceu, e arquivar não é apagar');

-- ------------------------------------------------------------------ anular leva o registro junto (BR5)
-- Não é regra de aplicação: é o `on delete cascade` da FK composta fazendo sozinho.
select tests.as_service();
delete from public.care_executions where id = '00000000-0000-4000-8000-000000000e11';
select tests.as_user('00000000-0000-4000-8000-000000000d11');
select is(
  (select count(*)::int from public.wash_days),
  0,
  'apagar a execução leva o Wash Day junto');
select is(
  (select count(*)::int from public.wash_day_products),
  0,
  'e as marcações dele também — nada fica órfão');

select * from finish();
rollback;
