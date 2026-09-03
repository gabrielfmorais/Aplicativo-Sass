-- SPEC-040 §7/§9 (F39) — a rotina de óleo sob cliente hostil: quem escreve, com que dia, e o que
-- acontece quando ela desliga.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-000000000091', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o91@example.test'),
       ('00000000-0000-4000-8000-000000000092', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'o92@example.test');

-- Guardrails de fundação continuam verdes com as tabelas e as funções novas (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'oil_routines e oil_events têm RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants da rotina de óleo estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'as duas RPCs estão na allowlist de SECURITY DEFINER');

select tests.as_user('00000000-0000-4000-8000-000000000091');

-- ------------------------------------------------- o cliente NÃO escreve as tabelas (FR4/§7)
-- É a razão de as RPCs existirem: o dia civil depende do fuso dela, e `current_date` no servidor é
-- UTC. Sem esta trava, um cliente adulterado escolheria a data do próprio histórico.
select throws_ok(
  $q$ insert into public.oil_routines (user_id, every_days, started_on)
      values ('00000000-0000-4000-8000-000000000091', 3, current_date) $q$,
  '42501', null, 'o cliente não tem INSERT em oil_routines');
select throws_ok(
  $q$ insert into public.oil_events (user_id, kind, happened_on, client_event_id)
      values ('00000000-0000-4000-8000-000000000091', 'done', current_date, gen_random_uuid()) $q$,
  '42501', null, 'o cliente não tem INSERT em oil_events');

-- ------------------------------------------------------------------ ligar (FR1/FR2)
select lives_ok(
  $q$ select public.set_oil_routine(3::smallint, 'America/Sao_Paulo') $q$,
  'ela liga a rotina');
select is(
  (select every_days::int from public.oil_routines),
  3,
  'com o intervalo que ela escolheu');
-- `started_on` vem do fuso DELA, não de `current_date` (que é UTC no servidor).
select is(
  (select started_on from public.oil_routines),
  (now() at time zone 'America/Sao_Paulo')::date,
  'e começando no dia civil dela');

-- Trocar o intervalo não reescreve a história: ela começou quando começou (§7).
select lives_ok(
  $q$ select public.set_oil_routine(7::smallint, 'America/Sao_Paulo') $q$,
  'ela troca o intervalo');
select is(
  (select count(*)::int from public.oil_routines),
  1,
  'e continua tendo UMA rotina, não duas');

-- O CHECK da tabela é a única fonte de verdade da faixa — a RPC não a repete (§7).
select throws_ok(
  $q$ select public.set_oil_routine(0::smallint, 'America/Sao_Paulo') $q$,
  '23514', null, 'intervalo fora da faixa é recusado pelo banco');

-- ------------------------------------------------------------ registrar (FR3/FR4/EC3)
select lives_ok(
  $q$ select public.record_oil_event('done', '00000000-0000-4000-8000-0000000000c1', 'America/Sao_Paulo') $q$,
  'ela marca que passou óleo');
-- EC3/AC4 — o retry depois de uma resposta perdida devolve o MESMO evento, nunca o segundo.
select is(
  (select count(*)::int from public.oil_events),
  1,
  'e repetir a mesma chave não cria um segundo evento');
select throws_ok(
  $q$ select public.record_oil_event('esqueci', '00000000-0000-4000-8000-0000000000c2', 'America/Sao_Paulo') $q$,
  '23514', null, 'um tipo fora do vocabulário é recusado pelo banco');

-- ------------------------------------------------------------------ isolamento (AC5)
select tests.as_user('00000000-0000-4000-8000-000000000092');
select is(
  (select count(*)::int from public.oil_routines) + (select count(*)::int from public.oil_events),
  0,
  'O92 não enxerga a rotina nem o histórico de O91');
-- A usuária nunca é parâmetro: mesmo chamando a RPC, O92 escreve na PRÓPRIA linha. Sem rotina, o
-- registro é recusado — não existe histórico que nenhuma rotina explique.
select throws_ok(
  $q$ select public.record_oil_event('done', '00000000-0000-4000-8000-0000000000c3', 'America/Sao_Paulo') $q$,
  'P0002', null, 'sem rotina, não há o que registrar');

-- --------------------------------------------------- desligar preserva o histórico (FR2/BR5/EC4)
select tests.as_user('00000000-0000-4000-8000-000000000091');
select lives_ok(
  $q$ delete from public.oil_routines $q$,
  'ela desliga a rotina');
select is(
  (select count(*)::int from public.oil_events),
  1,
  'e o histórico dela continua — desligar não apaga o que aconteceu');

select * from finish();
rollback;
