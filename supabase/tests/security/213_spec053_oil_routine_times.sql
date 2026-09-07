-- SPEC-053 §10/§11 (F39, evolução) — os horários da rotina de óleo sob cliente hostil.
--
-- ⚠️ **Esta tabela é a exceção deliberada ao "escrita só por RPC" do óleo**, e o que a torna segura
-- não é uma função: é a RLS nas duas pontas mais o índice único. O que segue prova as duas coisas
-- separadamente — que ela **alcança** só o que é dela, e que ela **deixa gravado** só o que é dela.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ot1@example.test'),
       ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ot2@example.test');

select is((select count(*)::int from tests.tables_without_rls()), 0, 'oil_routine_times tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os quatro grants da tabela estão na allowlist');
-- ⚠️ E nenhuma função DEFINER nova entrou: a fatia inteira não precisou de uma.
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'nenhuma RPC nova, nenhuma entrada nova de DEFINER');

select tests.as_user('00000000-0000-4000-8000-0000000000a1');
select public.set_oil_routine(3::smallint, 'America/Sao_Paulo');

-- ------------------------------------------------------------------ ela cadastra os dela (FR1/FR2)
select lives_ok(
  $q$ insert into public.oil_routine_times (user_id, time_local)
      values ('00000000-0000-4000-8000-0000000000a1', '08:00') $q$,
  'ela cadastra um horário');

-- ⛔ *"Se quiser 10, pode"* — nada no banco impõe um teto de produto.
select lives_ok(
  $q$ insert into public.oil_routine_times (user_id, time_local)
      select '00000000-0000-4000-8000-0000000000a1', make_time(h, 0, 0)
        from generate_series(9, 17) as h $q$,
  'e mais nove: nenhum teto de quantidade no banco');
select is((select count(*)::int from public.oil_routine_times), 10, 'dez horários, todos gravados');

-- FR7 — o mesmo horário duas vezes não são dois lembretes.
select throws_ok(
  $q$ insert into public.oil_routine_times (user_id, time_local)
      values ('00000000-0000-4000-8000-0000000000a1', '08:00') $q$,
  '23505', null, 'horário repetido é recusado pelo índice único');

-- ------------------------------------------------------------------ posse, nas duas pontas (§10)
-- `with check` no INSERT: ela não grava linha em nome de outra pessoa.
select throws_ok(
  $q$ insert into public.oil_routine_times (user_id, time_local)
      values ('00000000-0000-4000-8000-0000000000a2', '06:00') $q$,
  '42501', null, 'user_id forjado é recusado no INSERT');

-- ⚠️ E `with check` no UPDATE, que é a ponta que a SPEC-024 mediu: sem ele, ela **moveria** a
-- própria linha para outra dona, e a linha sumiria do alcance dela sem ninguém notar.
select throws_ok(
  $q$ update public.oil_routine_times
         set user_id = '00000000-0000-4000-8000-0000000000a2'
       where time_local = '08:00' $q$,
  '42501', null, 'ela não consegue mover um horário para outra pessoa');

-- ------------------------------------------------------------------ isolamento entre usuárias
select tests.as_user('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.oil_routine_times), 0, 'a outra usuária não enxerga nenhum horário alheio');

-- ⚠️ **A RLS FILTRA, não falha** — e é isso que precisa ser medido. Um `DELETE` mirando as linhas
-- alheias não levanta erro: ele simplesmente não alcança nada. Testar só o erro deixaria passar o
-- caso em que a policy some e o comando volta a apagar de verdade.
delete from public.oil_routine_times where user_id = '00000000-0000-4000-8000-0000000000a1';

select tests.as_user('00000000-0000-4000-8000-0000000000a1');
select is(
  (select count(*)::int from public.oil_routine_times),
  10,
  'o DELETE da outra usuária não apagou nada: os dez horários dela continuam lá');

-- ------------------------------------------------------------------ o histórico é independente
-- ⚠️ **Os horários são CONFIGURAÇÃO; os eventos são HISTÓRIA**, e as duas coisas não se apagam.
select public.record_oil_event('done', gen_random_uuid(), 'America/Sao_Paulo');
delete from public.oil_routine_times where time_local = '08:00';
select is((select count(*)::int from public.oil_routine_times), 9, 'remover um horário remove só ele');
select is((select count(*)::int from public.oil_events), 1, 'e não toca no que ela já registrou (D-69)');

-- ⚠️ **E o cliente continua sem escrever `oil_events`** — a tabela é append-only e a única escrita é
-- a RPC. É por isso que `routine_time_id` **não** entrou nesta fatia: a coluna não teria quem a
-- escrevesse (D-47/D-48), e schema morto num contrato de dados é dívida, não preparo.
select throws_ok(
  $q$ update public.oil_events set happened_on = current_date $q$,
  '42501', null, 'o cliente não tem UPDATE em oil_events, então registrar por horário precisa da RPC');

-- ------------------------------------------------------------------ desligar a rotina (FR8)
-- Os horários vão junto — são configuração —, e o histórico fica.
delete from public.oil_routines;
select is((select count(*)::int from public.oil_routine_times), 0, 'desligar a rotina leva os horários junto');
select is((select count(*)::int from public.oil_events), 1, 'e NÃO leva o histórico (BR5 da SPEC-040)');

select * from finish();
rollback;
