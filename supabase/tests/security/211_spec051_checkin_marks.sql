-- SPEC-051 (P13) — o vocabulário fechado, a posse nas duas pontas, e o check-in ainda imutável.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-8000-000000000e11', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e11@example.test'),
  ('00000000-0000-4000-8000-000000000e12', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e12@example.test');

select tests.as_user('00000000-0000-4000-8000-000000000e11');
insert into public.hair_profiles (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values ('00000000-0000-4000-8000-000000000e21', '00000000-0000-4000-8000-000000000e11', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
reset role;

insert into public.hair_plans (id, user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
values ('00000000-0000-4000-8000-000000000e31', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000e21',
        current_date, 'v1', 'v1', 'active', '00000000-0000-4000-8000-0000000000e3');
insert into public.scheduled_cares (id, plan_id, user_id, care_type_code, planned_date, status)
values ('00000000-0000-4000-8000-000000000e41', '00000000-0000-4000-8000-000000000e31', '00000000-0000-4000-8000-000000000e11', 'hydration', current_date, 'planned');
insert into public.care_executions (id, user_id, scheduled_care_id, care_type_code, executed_at, executed_on, client_execution_id)
values ('00000000-0000-4000-8000-000000000e51', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000e41', 'hydration', now(), current_date, '00000000-0000-4000-8000-0000000000e5');
insert into public.checkins (id, user_id, care_execution_id, overall_feel, client_checkin_id)
values ('00000000-0000-4000-8000-000000000e61', '00000000-0000-4000-8000-000000000e11', '00000000-0000-4000-8000-000000000e51', 4, '00000000-0000-4000-8000-0000000000e6');

select tests.as_user('00000000-0000-4000-8000-000000000e11');

-- ------------------------------------------------------------------ o vocabulário é FECHADO
select lives_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'frizz', '00000000-0000-4000-8000-000000000e11') $q$,
  'uma marcação do vocabulário entra');

select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'cabelo ressecadinho', '00000000-0000-4000-8000-000000000e11') $q$,
  '23514', null, 'o banco recusa qualquer valor fora do vocabulário — não há texto livre por esta porta');

/*
 * ⛔ **A metade `couro` do Blueprint §8 NÃO entra aqui** — D-32 (base legal) + D-26 (sign-off), a
 * OQ2 da SPEC-025. Se alguém trouxer sintoma por esta porta, o banco recusa antes da revisão.
 */
select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'itching', '00000000-0000-4000-8000-000000000e11') $q$,
  '23514', null, 'coceira é sintoma, e sintoma não entra nesta fatia');

select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'oily_quickly', '00000000-0000-4000-8000-000000000e11') $q$,
  '23514', null, 'o vocabulário do couro (SPEC-025) é outro, e continua sendo');

select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'diffuser', '00000000-0000-4000-8000-000000000e11') $q$,
  '23514', null, 'e uma técnica de lavagem também não é uma coisa que ela notou no resultado');

-- ------------------------------------------------------------------ duplo toque
select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'frizz', '00000000-0000-4000-8000-000000000e11') $q$,
  '23505', null, 'o duplo toque é violação de unicidade, nunca uma segunda linha');

-- ------------------------------------------------------------------ posse nas duas pontas
select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'shine', '00000000-0000-4000-8000-000000000e12') $q$,
  '42501', null, 'user_id forjado é recusado pela policy');

/*
 * ⚠️ A ponta que só a FK composta pega: o `user_id` é o dela, mas o check-in é de outra pessoa.
 * Sem esta constraint a linha entraria — invisível para as duas e contável por `P8`.
 */
select tests.as_user('00000000-0000-4000-8000-000000000e12');
select throws_ok(
  $q$ insert into public.checkin_marks (checkin_id, mark, user_id)
      values ('00000000-0000-4000-8000-000000000e61', 'shine', '00000000-0000-4000-8000-000000000e12') $q$,
  '23503', null, 'pendurar a própria marcação no check-in alheio é recusado pela FK composta');

select is_empty(
  $q$ select 1 from public.checkin_marks $q$,
  'e a outra usuária não enxerga marcação nenhuma dela');

-- ------------------------------------------------------------------ desmarcar é dela; a nota não é
select tests.as_user('00000000-0000-4000-8000-000000000e11');
select lives_ok(
  $q$ delete from public.checkin_marks where mark = 'frizz' $q$,
  'desmarcar é corrigir o que ela marcou, e a junção aceita DELETE');

/*
 * ⚠️ **`checkins` continua APPEND-ONLY** (SPEC-006). A nota de 1 a 5 é o fato âncora e permanece
 * imutável — é a mesma divisão que a SPEC-025 fez entre o check-in e o couro no hub.
 */
select throws_ok(
  $q$ update public.checkins set overall_feel = 1 $q$,
  '42501', null, 'a nota de 1 a 5 continua imutável: a fatia nova não afrouxou nada');

select * from finish();
rollback;
