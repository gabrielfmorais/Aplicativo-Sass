-- SPEC-005 AC2–AC12/AC16–AC20 — care transitions under a hostile client: no direct writes,
-- planned vs executed kept apart, idempotency, the 0-or-1 effective execution invariant,
-- the 15-minute undo window, and isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a5@example.test'),
       ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b5@example.test');

select tests.as_user('00000000-0000-4000-8000-0000000000a5');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a5', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
select tests.as_user('00000000-0000-4000-8000-0000000000b5');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000b5', 'wavy', 'fine', 'balanced', 'twice_weekly', '{}', 'almost_never', array['no_major_concern'], 'maintain_healthy_hair');
-- `reset role` restores the role but NOT request.jwt.claims, and create_plan_tx refuses a
-- p_user_id that disagrees with a present auth.uid() (SPEC-004 defence in depth). Clear the
-- impersonation before acting as service_role, otherwise the setup creates A's plan while still
-- carrying B's identity.
select tests.as_anon();
reset role;

-- A plan for each user, created the only way it can be (SPEC-004).
set local role service_role;
select public.create_plan_tx(
  '00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000e1', current_date, 'v1', 'v1',
  '00000000-0000-4000-8000-00000000d001',
  jsonb_build_array(
    jsonb_build_object('care_type_code', 'hydration',  'planned_date', (current_date - 3)::text),
    jsonb_build_object('care_type_code', 'nutrition',  'planned_date', current_date::text),
    jsonb_build_object('care_type_code', 'hydration',  'planned_date', (current_date + 4)::text)
  ));
select public.create_plan_tx(
  '00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000e2', current_date, 'v1', 'v1',
  '00000000-0000-4000-8000-00000000d002',
  jsonb_build_array(jsonb_build_object('care_type_code', 'hydration', 'planned_date', current_date::text)));
reset role;

-- Handles used throughout.
create temp table t_ids as
  select
    (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000a5' and planned_date = current_date - 3) as overdue_care,
    (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000a5' and planned_date = current_date)     as today_care,
    (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000a5' and planned_date = current_date + 4) as future_care,
    (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000b5') as b_care;
grant select on t_ids to authenticated, anon;

-- Foundation guardrails stay green with the new table and the four RPCs (AC11).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'care_executions has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants are allow-listed (SPEC-005)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'the four RPCs are allow-listed');

-- AC12: "overdue" and "completed" are derived, so neither may exist as a column.
select is((select count(*)::int from information_schema.columns
            where table_schema = 'public' and table_name = 'scheduled_cares'
              and column_name in ('completed', 'completed_at', 'is_overdue', 'overdue')),
          0, 'scheduled_cares stores neither completion nor overdue');
select ok(not exists (select 1 from pg_constraint c
                      where c.conname = 'scheduled_cares_status_check'
                        and pg_get_constraintdef(c.oid) like '%completed%'),
          'the status enum has no `completed` value (D-69 §8.2)');

-- ------------------------------------------------------------- no direct writes ever (AC4/AC20)
select tests.as_user('00000000-0000-4000-8000-0000000000a5');
select throws_ok(
  format($$ update public.scheduled_cares set status = 'skipped' where id = %L $$, (select today_care from t_ids)),
  '42501', null, 'authenticated cannot UPDATE a scheduled care');
select throws_ok(
  format($$ insert into public.care_executions (user_id, scheduled_care_id, care_type_code, client_execution_id, executed_on)
            values ('00000000-0000-4000-8000-0000000000a5', %L, 'hydration', gen_random_uuid(), current_date) $$,
         (select today_care from t_ids)),
  '42501', null, 'authenticated cannot INSERT an execution directly');
select throws_ok(
  $$ update public.care_executions set voided_at = now() $$,
  '42501', null, 'authenticated cannot UPDATE an execution directly (no forged undo)');
select throws_ok(
  $$ delete from public.care_executions $$,
  '42501', null, 'authenticated cannot DELETE an execution (history is not erasable)');
select throws_ok(
  format($$ select public.care_lock_actionable(%L, '00000000-0000-4000-8000-0000000000a5') $$, (select today_care from t_ids)),
  '42501', null, 'the internal lock helper is not callable by a client');

-- ------------------------------------------------------------------------- complete (AC2/AC3)
select lives_ok(
  format($$ select public.complete_care(%L, '00000000-0000-4000-8000-00000000f001', 'America/Sao_Paulo') $$,
         (select today_care from t_ids)),
  'a care can be completed through the RPC');
select is((select count(*)::int from public.care_executions), 1, 'exactly one execution exists');

-- AC2: the planned row is untouched — the fact does not rewrite the intention.
select is(
  (select status || '|' || planned_date::text from public.scheduled_cares where id = (select today_care from t_ids)),
  'planned|' || current_date::text,
  'completing leaves the scheduled care exactly as planned');

-- AC3: same key, same fact.
select is(
  (select public.complete_care((select today_care from t_ids), '00000000-0000-4000-8000-00000000f001', 'America/Sao_Paulo')),
  (select id from public.care_executions limit 1),
  'a retry with the same client_execution_id returns the existing execution');
select is((select count(*)::int from public.care_executions), 1, 'the retry created no second execution');

-- AC18: a *different* key on an already-completed care is refused.
select throws_ok(
  format($$ select public.complete_care(%L, gen_random_uuid(), 'America/Sao_Paulo') $$, (select today_care from t_ids)),
  '23514', null, 'a second effective execution is refused (D-69/D-35)');

-- AC19: completing does not change `status`, so skip/reschedule must check the execution too.
select throws_ok(
  format($$ select public.skip_care(%L) $$, (select today_care from t_ids)),
  '23514', null, 'an already-completed care cannot be skipped');
select throws_ok(
  format($$ select public.reschedule_care(%L, current_date + 1, 'America/Sao_Paulo') $$, (select today_care from t_ids)),
  '23514', null, 'an already-completed care cannot be rescheduled');

-- ------------------------------------------------------------------- timezone (AC9 / T22)
select throws_ok(
  format($$ select public.complete_care(%L, gen_random_uuid(), 'Mars/Olympus') $$, (select future_care from t_ids)),
  '22023', null, 'an invalid timezone is rejected');
select throws_ok(
  format($$ select public.complete_care(%L, gen_random_uuid(), '') $$, (select future_care from t_ids)),
  '22023', null, 'an empty timezone is rejected');
select ok(abs(public.care_local_today('UTC') - public.care_local_today('Pacific/Kiritimati')) <= 1,
  'a real timezone (UTC+14) resolves to a civil day within the plausible range');

-- --------------------------------------------------------------------- undo (AC16/AC17)
select lives_ok(
  $$ select public.void_execution((select id from public.care_executions limit 1)) $$,
  'an execution can be undone inside the window');
select is((select count(*)::int from public.care_executions where voided_at is not null), 1,
  'the undone execution is kept and marked, not deleted (AC16)');
select is((select count(*)::int from public.care_executions), 1, 'no row was removed');
select throws_ok(
  $$ select public.void_execution((select id from public.care_executions limit 1)) $$,
  '23514', null, 'undoing twice is refused');

-- After undo the care is actionable again, and a new execution is accepted (AC18 second half).
select lives_ok(
  format($$ select public.complete_care(%L, '00000000-0000-4000-8000-00000000f002', 'America/Sao_Paulo') $$,
         (select today_care from t_ids)),
  'after undo the same care can be completed again');
select is((select count(*)::int from public.care_executions where voided_at is null), 1,
  'still exactly one effective execution');
select is((select count(*)::int from public.care_executions), 2, 'and the undone one remains in history');

-- AC17: outside the 15-minute window the undo is refused.
reset role;
update public.care_executions
   set executed_at = now() - interval '16 minutes'
 where voided_at is null;
select tests.as_user('00000000-0000-4000-8000-0000000000a5');
select throws_ok(
  $$ select public.void_execution((select id from public.care_executions where voided_at is null)) $$,
  '23514', null, 'undo after 15 minutes is refused');
select is((select count(*)::int from public.care_executions where voided_at is null), 1,
  'the refused undo changed nothing');

-- ------------------------------------------------------------------- skip / reschedule (AC5–AC8)
select lives_ok(
  format($$ select public.skip_care(%L) $$, (select future_care from t_ids)),
  'a planned care can be skipped');
select is(
  (select count(*)::int from public.care_executions ce
     join t_ids on ce.scheduled_care_id = t_ids.future_care),
  0, 'skipping creates no execution (AC5)');

select lives_ok(
  format($$ select public.reschedule_care(%L, current_date + 2, 'America/Sao_Paulo') $$, (select overdue_care from t_ids)),
  'an overdue care can be rescheduled (D-28)');
-- AC6: the original keeps its date and points at its replacement.
select is(
  (select o.status || '|' || o.planned_date::text || '|' || (n.planned_date)::text
     from public.scheduled_cares o
     join public.scheduled_cares n on n.id = o.rescheduled_to_id
    where o.id = (select overdue_care from t_ids)),
  'rescheduled|' || (current_date - 3)::text || '|' || (current_date + 2)::text,
  'the original keeps its planned_date and links to the new row');
select throws_ok(
  format($$ select public.reschedule_care(%L, current_date + 2, 'America/Sao_Paulo') $$, (select overdue_care from t_ids)),
  '23514', null, 'a rescheduled care is terminal (AC7)');

-- AC8: the window is enforced server-side.
--
-- These two boundaries are measured in **the caller's timezone**, not in UTC, because that is the
-- frame `reschedule_care` enforces: it compares against `care_local_today(p_timezone)`, which is
-- `(now() at time zone p_timezone)::date`. Written against `current_date` these tests were wrong
-- for three hours every day — between 00:00 and 03:00 UTC it is still yesterday in São Paulo, so
-- "UTC yesterday" is the caller's *today*, which the window allows and must allow. The lower bound
-- failed exactly there on 2026-09-01T01:24Z and blocked every merge until it passed 03:00.
--
-- The lesson is general: a date assertion has to use the same clock the code under test uses.
select throws_ok(
  format($$ select public.reschedule_care(%L, '%s'::date, 'America/Sao_Paulo') $$,
         (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000a5' and planned_date = current_date + 2),
         ((now() at time zone 'America/Sao_Paulo')::date - 1)::text),
  '22023', null, 'rescheduling into the past is refused');
select throws_ok(
  format($$ select public.reschedule_care(%L, '%s'::date, 'America/Sao_Paulo') $$,
         (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000a5' and planned_date = current_date + 2),
         ((now() at time zone 'America/Sao_Paulo')::date + 29)::text),
  '22023', null, 'rescheduling beyond today+28 is refused');

-- --------------------------------------------------------------------------- isolation (AC10)
select throws_ok(
  format($$ select public.skip_care(%L) $$, (select b_care from t_ids)),
  'P0002', null, 'A cannot transition a care belonging to B');
select tests.as_user('00000000-0000-4000-8000-0000000000b5');
select is((select count(*)::int from public.care_executions), 0, 'B sees none of A''s executions');
select tests.as_anon();
select throws_ok(
  $$ select * from public.care_executions $$, '42501', null, 'anon cannot read executions');
select throws_ok(
  $$ select public.complete_care(gen_random_uuid(), gen_random_uuid(), 'UTC') $$,
  '42501', null, 'anon cannot complete anything');

select * from finish();
rollback;
