-- SPEC-052 — a execução avulsa: a posse, o vocabulário, a idempotência, e o que ela NÃO faz.
--
-- ⚠️ O que este arquivo guarda é a metade da fonte de verdade que **só o banco** pode garantir:
-- tipo obrigatório e fechado, dono impossível de forjar, e — a mais importante — **nenhum ponto**,
-- porque `journey_points` chaveia o fato no cuidado planejado e uma avulsa não tem um.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000f11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f11@example.test'),
  ('00000000-0000-4000-8000-000000000f12', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f12@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000f11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000f21', '00000000-0000-4000-8000-000000000f11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000f31', '00000000-0000-4000-8000-000000000f11', '00000000-0000-4000-8000-000000000f21',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000f3');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000f41', '00000000-0000-4000-8000-000000000f31', '00000000-0000-4000-8000-000000000f11', 'hydration', current_date, 'planned');

select tests.as_user('00000000-0000-4000-8000-000000000f11');

-- ------------------------------------------------------------------------- a avulsa nasce
select lives_ok(
  $q$ select public.record_ad_hoc_care('nutrition', '00000000-0000-4000-8000-0000000000a1', 'America/Sao_Paulo') $q$,
  'ela registra um cuidado que o plano não pediu');

select is(
  (select count(*)::int from public.care_executions
    where user_id = '00000000-0000-4000-8000-000000000f11' and scheduled_care_id is null),
  1,
  'uma linha, com scheduled_care_id NULL — e nenhuma tabela nova para isso');

select is(
  (select care_type_code from public.care_executions
    where client_execution_id = '00000000-0000-4000-8000-0000000000a1'),
  'nutrition',
  'o tipo que ela escolheu é o que ficou gravado: sem cuidado planejado, é ele que carrega a identidade');

-- ⚠️ **O cronograma não é tocado** — nenhuma linha nasce, some ou muda de data (D-28).
select is(
  (select count(*)::int from public.scheduled_cares where user_id = '00000000-0000-4000-8000-000000000f11'),
  1,
  'o cronograma continua com o que tinha: registrar não é planejar');

-- ------------------------------------------------------------- AC8 — o vocabulário é fechado
select throws_ok(
  $q$ select public.record_ad_hoc_care('detox', '00000000-0000-4000-8000-0000000000a2', 'America/Sao_Paulo') $q$,
  '23514', null,
  'um tipo de cuidado fora do CHECK é recusado — inventar tipo capilar é D-26, e o banco não deixa passar');

-- ------------------------------------------------------- FR2 — idempotência por chave de intenção
select is(
  (select public.record_ad_hoc_care('nutrition', '00000000-0000-4000-8000-0000000000a1', 'America/Sao_Paulo')),
  (select id from public.care_executions where client_execution_id = '00000000-0000-4000-8000-0000000000a1'),
  'a mesma chave devolve o mesmo fato — o duplo toque não vira dois cuidados');

select is(
  (select count(*)::int from public.care_executions where client_execution_id = '00000000-0000-4000-8000-0000000000a1'),
  1,
  'e continua havendo uma linha só');

-- ⚠️ **EC3 — dois avulsos no mesmo dia são DOIS fatos.** O teto de "0 ou 1 execução efetiva" é do
-- cuidado planejado, e a chave dele nunca é nula; NULL não colide com NULL em índice único.
select lives_ok(
  $q$ select public.record_ad_hoc_care('hydration', '00000000-0000-4000-8000-0000000000a3', 'America/Sao_Paulo') $q$,
  'dois cuidados avulsos no mesmo dia convivem — são duas coisas que ela fez');

-- ⚠️ E o teto do PLANO continua inteiro: o mesmo cuidado planejado não aceita a segunda execução.
select public.complete_care('00000000-0000-4000-8000-000000000f41', '00000000-0000-4000-8000-0000000000a4', 'America/Sao_Paulo');
select is(
  (select count(*)::int from public.care_executions
    where scheduled_care_id = '00000000-0000-4000-8000-000000000f41' and voided_at is null),
  1,
  'AC9 — o cuidado planejado continua com no máximo uma execução efetiva (D-69/D-35)');

-- ---------------------------------------------------------------- AC1 — nenhum ponto, e por quê
--
-- ⚠️ `award_journey_points` concede por **cuidado planejado**; a avulsa não tem um, então não há o
-- que conceder — a proibição que abre a D-103.
--
-- ⚠️ **A PRIMEIRA asserção é que a função CONCLUI, e ela existe porque a versão anterior deste
-- arquivo passou com o sistema quebrado.** Ela perguntava apenas *"quantos pontos apontam para uma
-- avulsa?"* e recebia **zero** — verdade, porque `award_journey_points` **abortava com 23502**
-- (`fact_id` nulo) antes de inserir qualquer coisa. Medido no DEV real: **um** registro avulso
-- fazia ela parar de ganhar pontos pelos cuidados do **plano** também. Uma asserção que passa
-- quando o sistema falha é pior que nenhuma.
select lives_ok(
  $q$ select public.award_journey_points('America/Sao_Paulo') $q$,
  'a Jornada continua funcionando com uma execução avulsa no histórico — ela não quebra a função');

select is(
  (select count(*)::int from public.journey_points
    where user_id = '00000000-0000-4000-8000-000000000f11'
      and fact_id in (select id from public.care_executions where scheduled_care_id is null)),
  0,
  'nenhum ponto aponta para uma execução avulsa: fazer mais cuidados não é recompensado');

-- ⚠️ E o cuidado do PLANO continua pagando — sem isto, "zero ponto de avulsa" seria compatível com
-- "zero ponto nenhum", que é exatamente o defeito que passou despercebido.
select cmp_ok(
  (select count(*)::int from public.journey_points
    where user_id = '00000000-0000-4000-8000-000000000f11'
      and fact_id = '00000000-0000-4000-8000-000000000f41'),
  '>', 0,
  'o cuidado planejado que ela concluiu continua sendo pago, com a avulsa presente');

-- ------------------------------------------------------------------- AC7 — cliente adulterado
--
-- ⚠️ O `user_id` nunca vem do parâmetro: sai de `auth.uid()` dentro do DEFINER. Não há por onde
-- forjar dono — e o `INSERT` direto é recusado pelo grant que o cliente não tem.
select throws_ok(
  $q$ insert into public.care_executions (user_id, scheduled_care_id, care_type_code, client_execution_id, executed_on)
      values ('00000000-0000-4000-8000-000000000f12', null, 'hydration', '00000000-0000-4000-8000-0000000000a5', current_date) $q$,
  '42501', null,
  'AC7 — cliente não escreve em care_executions, então não forja execução de outra usuária');

select tests.as_user('00000000-0000-4000-8000-000000000f12');
select is(
  (select count(*)::int from public.care_executions where scheduled_care_id is null),
  0,
  'e a outra usuária não enxerga uma linha sequer — RLS igual para a avulsa');

-- ------------------------------------------------------------------------- FR7 — desfazer
select tests.as_user('00000000-0000-4000-8000-000000000f11');
select lives_ok(
  $q$ select public.void_execution(
        (select id from public.care_executions where client_execution_id = '00000000-0000-4000-8000-0000000000a3')) $q$,
  'FR7 — desfazer a avulsa segue as mesmas regras: mesma janela, mesma função, e a linha fica no histórico');

select * from finish();
rollback;
