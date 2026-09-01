-- SPEC-022 §11 — a pausa sob cliente hostil: posse, isolamento, idempotência e o deslocamento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e1@example.test'),
       ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e2@example.test');

-- Um perfil e um plano ativo para E1, com três cuidados dentro da janela de 28 dias.
-- `hair_profiles` é FORCE RLS **sem** policy para o dono da tabela: cada usuária insere o próprio
-- snapshot, então o seed entra como ela (mesmo padrão do 030).
select tests.as_user('00000000-0000-4000-8000-0000000000e1');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000e1', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

-- Plano e cuidados entram como dono da tabela: o cliente não tem INSERT em nenhuma das duas, e é
-- justamente isso que dois dos testes abaixo verificam.
insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1',
        (now() at time zone 'America/Sao_Paulo')::date - 2, 'v1', 'v1', 'active', '00000000-0000-4000-8000-00000000cc01');

insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1', 'hydration', (now() at time zone 'America/Sao_Paulo')::date - 2, 'planned'),
       ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1', 'nutrition', (now() at time zone 'America/Sao_Paulo')::date + 3, 'planned'),
       ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000e1', 'hydration', (now() at time zone 'America/Sao_Paulo')::date + 10, 'planned');

-- Guardrails de fundação continuam verdes com a tabela e as duas funções novas (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'plan_pauses tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants de plan_pauses estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'as RPCs da pausa estão na allowlist');
select is((select count(*)::int from tests.unpinned_security_definer_functions()), 0, 'as RPCs da pausa têm search_path fixado');

select tests.as_user('00000000-0000-4000-8000-0000000000e1');

-- ------------------------------------------------------------------ o cliente não escreve direto
select throws_ok(
  $q$ insert into public.plan_pauses (user_id, plan_id, paused_on)
      values ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', current_date) $q$,
  '42501', null, 'o cliente não tem INSERT direto em plan_pauses');
-- Deslocar é a única coisa que mexe em planned_date, e é do servidor.
select throws_ok(
  $q$ update public.scheduled_cares set planned_date = planned_date + 1 $q$,
  '42501', null, 'o cliente não tem UPDATE em scheduled_cares');

-- ------------------------------------------------------------------ pausar (FR1/EC6)
select lives_ok(
  $q$ select public.pause_plan('America/Sao_Paulo') $q$,
  'ela pausa o cronograma ativo');
select is(
  (select count(*)::int from public.plan_pauses where resumed_on is null),
  1,
  'e existe exatamente uma pausa aberta');
-- Dois toques no mesmo botão são um pedido só.
select is(
  (select public.pause_plan('America/Sao_Paulo')),
  (select id from public.plan_pauses where resumed_on is null),
  'pausar de novo devolve a mesma pausa, sem criar a segunda');
select is(
  (select count(*)::int from public.plan_pauses),
  1,
  'e continua havendo uma linha só');

-- ------------------------------------------------------------------ a previsão não escreve (FR4)
select is(
  (select action from public.resume_plan('America/Sao_Paulo', false)),
  'shifted',
  'a previsão diz o que vai acontecer');
select is(
  (select count(*)::int from public.plan_pauses where resumed_on is null),
  1,
  'e a pausa continua aberta — previsão não é retomada');
select is(
  (select planned_date from public.scheduled_cares where id = '00000000-0000-4000-8000-0000000000b2'),
  (now() at time zone 'America/Sao_Paulo')::date + 3,
  'e nenhum cuidado se moveu');

-- ------------------------------------------------------------------ isolamento (AC6)
select tests.as_user('00000000-0000-4000-8000-0000000000e2');
select is(
  (select count(*)::int from public.plan_pauses),
  0,
  'E2 não enxerga a pausa de E1');
-- Sem plano ativo, E2 não pausa — e não cria pausa órfã no plano de ninguém.
select throws_ok(
  $q$ select public.pause_plan('America/Sao_Paulo') $q$,
  'P0002', null, 'E2 não pausa: não tem plano ativo');
select is(
  (select action from public.resume_plan('America/Sao_Paulo', true)),
  'not_paused',
  'retomar sem pausa aberta é no-op, não erro');

-- ------------------------------------------------------------------ retomar desloca (FR5/AC4)
select tests.as_user('00000000-0000-4000-8000-0000000000e1');
-- A pausa foi aberta hoje, então o deslocamento é de zero dias. O que importa aqui é que a
-- retomada fecha a pausa e não toca no que já aconteceu.
select is(
  (select action from public.resume_plan('America/Sao_Paulo', true)),
  'shifted',
  'retomar desloca o que sobrou');
select is(
  (select count(*)::int from public.plan_pauses where resumed_on is null),
  0,
  'e a pausa se fecha');
select is(
  (select count(*)::int from public.plan_pauses),
  1,
  'a linha da pausa fica — histórico não é apagado');

-- ------------------------------------------------------------------ o ciclo como limite (D-98)
-- Uma pausa longa faria o último cuidado passar do fim do ciclo: a volta oferece ciclo novo.
select tests.as_service();
update public.plan_pauses set resumed_on = null, paused_on = (now() at time zone 'America/Sao_Paulo')::date - 30
 where user_id = '00000000-0000-4000-8000-0000000000e1';
select tests.as_user('00000000-0000-4000-8000-0000000000e1');
select is(
  (select action from public.resume_plan('America/Sao_Paulo', false)),
  'new_cycle',
  'quando o deslocamento não cabe no ciclo, a volta oferece o próximo em vez de uma quinta semana');

-- ------------------------------------------------------------------ EC5: reavaliar durante a pausa
-- Ela pausa, reavalia, e o plano pausado vira `superseded`. A pausa não pode sobreviver ao plano
-- que ela pausou: deslocar cuidados de um plano morto moveria linhas que ninguém mais vê, e manter
-- a pausa aberta faria a Hoje dizer "pausado" sobre um cronograma novo em folha.
select tests.as_service();
update public.plan_pauses set resumed_on = null, paused_on = (now() at time zone 'America/Sao_Paulo')::date
 where user_id = '00000000-0000-4000-8000-0000000000e1';
update public.hair_plans set status = 'superseded' where id = '00000000-0000-4000-8000-0000000000a1';
select tests.as_user('00000000-0000-4000-8000-0000000000e1');
select is(
  (select action from public.resume_plan('America/Sao_Paulo', true)),
  'not_paused',
  'a pausa termina com o plano que a tinha: nada a deslocar num plano substituído');
select is(
  (select count(*)::int from public.plan_pauses where resumed_on is null),
  0,
  'e ela não fica pausada para sempre depois de reavaliar');

select * from finish();
rollback;
