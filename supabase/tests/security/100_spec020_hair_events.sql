-- SPEC-020 §11 — `hair_events` sob cliente hostil: posse, isolamento, dia civil e idempotência.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd1@example.test'),
       ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd2@example.test');

-- Guardrails de fundação continuam verdes com a tabela e as duas funções novas (SPEC-000).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'hair_events tem RLS habilitada e forçada');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'os grants de hair_events estão na allowlist');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'as RPCs de hair_events estão na allowlist');
select is((select count(*)::int from tests.unpinned_security_definer_functions()), 0, 'as RPCs de hair_events têm search_path fixado');

-- ------------------------------------------------------------------ o cliente não escreve direto
select tests.as_user('00000000-0000-4000-8000-0000000000d1');
-- Sem INSERT concedido: a única porta é a RPC. É isto que impede forjar user_id ou data futura.
select throws_ok(
  $$ insert into public.hair_events (user_id, event_type, occurred_on, client_event_id)
     values ('00000000-0000-4000-8000-0000000000d1', 'coloring', current_date, gen_random_uuid()) $$,
  '42501', null, 'o cliente não tem INSERT direto em hair_events');

-- ------------------------------------------------------------------ registrar (FR1/FR7)
select lives_ok(
  $$ select public.record_hair_event('bleaching_or_highlights', (now() at time zone 'America/Sao_Paulo')::date, '00000000-0000-4000-8000-00000000ee01', 'America/Sao_Paulo') $$,
  'ela registra o próprio evento pela RPC');
select is(
  (select event_type from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01'),
  'bleaching_or_highlights',
  'e o evento fica gravado com o tipo que ela escolheu');

-- Mesma intenção duas vezes: um evento, não dois (FR7/EC3/EC4).
select is(
  (select public.record_hair_event('bleaching_or_highlights', (now() at time zone 'America/Sao_Paulo')::date, '00000000-0000-4000-8000-00000000ee01', 'America/Sao_Paulo')),
  (select id from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01'),
  'repetir a mesma intenção devolve o mesmo evento');
select is(
  (select count(*)::int from public.hair_events where user_id = '00000000-0000-4000-8000-0000000000d1'),
  1,
  'e não cria uma segunda linha');

-- ------------------------------------------------------------------ um evento aconteceu (AC2)
select throws_ok(
  $$ select public.record_hair_event('haircut', (now() at time zone 'America/Sao_Paulo')::date + 1, gen_random_uuid(), 'America/Sao_Paulo') $$,
  '22023', null, 'uma data futura é recusada pelo servidor, não só pela tela');

-- O tipo é enum fechado; o CHECK da tabela é quem recusa, e isso é deliberado (uma lista só).
select throws_ok(
  $$ select public.record_hair_event('inventei_um_tipo', (now() at time zone 'America/Sao_Paulo')::date, gen_random_uuid(), 'America/Sao_Paulo') $$,
  '23514', null, 'um tipo fora da lista fechada é recusado pelo banco');

-- ------------------------------------------------------------------ isolamento (AC7)
select tests.as_user('00000000-0000-4000-8000-0000000000d2');
select is(
  (select count(*)::int from public.hair_events),
  0,
  'D2 não enxerga o evento de D1');
-- Anular evento alheio e anular evento inexistente dão a mesma resposta: não dá para sondar.
select throws_ok(
  $$ select public.void_hair_event((select id from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01')) $$,
  'P0002', null, 'D2 não anula o evento de D1');

-- ------------------------------------------------------------------ anular preserva (FR6/BR6)
select tests.as_user('00000000-0000-4000-8000-0000000000d1');
select lives_ok(
  $$ select public.void_hair_event((select id from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01')) $$,
  'ela anula o próprio evento');
select is(
  (select count(*)::int from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01' and voided_at is not null),
  1,
  'e a linha continua no banco, marcada — histórico não é apagado');
select throws_ok(
  $$ select public.void_hair_event((select id from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01')) $$,
  'P0002', null, 'anular duas vezes não muda nada');

-- Sem DELETE, para ninguém e nunca: a linha morre com a conta, por cascade.
select throws_ok(
  $$ delete from public.hair_events where client_event_id = '00000000-0000-4000-8000-00000000ee01' $$,
  '42501', null, 'ninguém apaga um evento');

select * from finish();
rollback;
