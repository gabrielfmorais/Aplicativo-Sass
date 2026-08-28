-- SPEC-006 AC1–AC10 — check-ins under a hostile client: no direct writes, one check-in per
-- execution, idempotency, a voided execution refused, a foreign execution indistinguishable from a
-- missing one, and the 1..5 range enforced twice.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a6@example.test'),
       ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b6@example.test');

select tests.as_user('00000000-0000-4000-8000-0000000000a6');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a6', 'curly', 'medium', 'balanced', 'twice_weekly', '{}', 'almost_never', array['dryness'], 'softness_and_hydration');
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000b6', 'wavy', 'fine', 'balanced', 'twice_weekly', '{}', 'almost_never', array['no_major_concern'], 'maintain_healthy_hair');

-- `reset role` restores the role but NOT request.jwt.claims, and create_plan_tx refuses a p_user_id
-- that disagrees with a present auth.uid() (SPEC-004 defence in depth). Same reason as 030/040.
select tests.as_anon();
reset role;

set local role service_role;
select public.create_plan_tx(
  '00000000-0000-4000-8000-0000000000a6', '00000000-0000-4000-8000-0000000000f1', current_date, 'v1', 'v1',
  '00000000-0000-4000-8000-00000000d006',
  jsonb_build_array(
    jsonb_build_object('care_type_code', 'hydration', 'planned_date', current_date::text),
    jsonb_build_object('care_type_code', 'nutrition', 'planned_date', (current_date + 3)::text)
  ));
select public.create_plan_tx(
  '00000000-0000-4000-8000-0000000000b6', '00000000-0000-4000-8000-0000000000f2', current_date, 'v1', 'v1',
  '00000000-0000-4000-8000-00000000d007',
  jsonb_build_array(jsonb_build_object('care_type_code', 'hydration', 'planned_date', current_date::text)));
reset role;

-- A completes today's care and B completes hers, so both have an effective execution to check in on.
select tests.as_user('00000000-0000-4000-8000-0000000000a6');
select public.complete_care(
  (select id from public.scheduled_cares
    where user_id = '00000000-0000-4000-8000-0000000000a6' and planned_date = current_date),
  '00000000-0000-4000-8000-00000000e001', 'UTC');
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select public.complete_care(
  (select id from public.scheduled_cares where user_id = '00000000-0000-4000-8000-0000000000b6'),
  '00000000-0000-4000-8000-00000000e002', 'UTC');
select tests.as_anon();
reset role;

create temp table t_ck as
  select
    (select id from public.care_executions where user_id = '00000000-0000-4000-8000-0000000000a6') as a_exec,
    (select id from public.care_executions where user_id = '00000000-0000-4000-8000-0000000000b6') as b_exec,
    (select id from public.scheduled_cares
      where user_id = '00000000-0000-4000-8000-0000000000a6' and planned_date = current_date + 3) as a_future_care;
grant select on t_ck to authenticated, anon;

-- ------------------------------------------------------------------- foundation guardrails (AC1/AC10)
select is((select count(*)::int from tests.tables_without_rls()), 0, 'checkins has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants are allow-listed (SPEC-006)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'submit_checkin is allow-listed');
select ok((select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'submit_checkin'),
          'submit_checkin is SECURITY DEFINER');
-- tests.unapproved_security_definer_functions() checks the allowlist but NOT the search_path pin,
-- so this assertion is the only thing proving it for this function (SECURITY-BASELINE S5).
select ok((select array_to_string(p.proconfig, ' ') like 'search_path=%pg_temp%'
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'submit_checkin'),
          'submit_checkin pins its search_path');

-- BR1/BR6 are database constraints, not conventions.
select ok(exists (select 1 from pg_constraint where conname = 'checkins_execution_unique'),
          'one check-in per execution is a UNIQUE constraint (BR1)');
select ok(exists (select 1 from pg_constraint where conname = 'checkins_client_unique'),
          'idempotency is a UNIQUE constraint (FR6)');
select ok(exists (select 1 from pg_constraint where conname = 'checkins_execution_owner_fk'),
          'ownership is a composite FK, so user_id cannot diverge from the execution owner (BR6)');

-- ------------------------------------------------------------------ no direct writes ever (AC3)
select tests.as_user('00000000-0000-4000-8000-0000000000a6');

select throws_ok(
  format($$insert into public.checkins (user_id, care_execution_id, overall_feel, client_checkin_id)
           values ('00000000-0000-4000-8000-0000000000a6', %L, 4, '00000000-0000-4000-8000-00000000c999')$$,
         (select a_exec from t_ck)),
  '42501', null, 'authenticated cannot INSERT into checkins directly');
select throws_ok($$update public.checkins set overall_feel = 1$$, '42501',
                 null, 'authenticated cannot UPDATE a check-in (append-only, BR5)');
select throws_ok($$delete from public.checkins$$, '42501',
                 null, 'authenticated cannot DELETE a check-in (append-only, BR5)');

-- ------------------------------------------------------------------------- happy path (AC4/AC9)
select throws_ok(
  format($$select public.submit_checkin(%L, 0::smallint, '00000000-0000-4000-8000-00000000c001')$$,
         (select a_exec from t_ck)),
  '22023', null, 'overall_feel = 0 is refused (AC9)');
select throws_ok(
  format($$select public.submit_checkin(%L, 6::smallint, '00000000-0000-4000-8000-00000000c002')$$,
         (select a_exec from t_ck)),
  '22023', null, 'overall_feel = 6 is refused (AC9)');
select throws_ok(
  format($$select public.submit_checkin(%L, null::smallint, '00000000-0000-4000-8000-00000000c003')$$,
         (select a_exec from t_ck)),
  '22023', null, 'a null rating is refused (AC9)');
select throws_ok(
  format($$select public.submit_checkin(%L, 4::smallint, null)$$, (select a_exec from t_ck)),
  '22023', null, 'a missing idempotency key is refused');

select lives_ok(
  format($$select public.submit_checkin(%L, 4::smallint, '00000000-0000-4000-8000-00000000c010')$$,
         (select a_exec from t_ck)),
  'submit_checkin records the check-in (AC4)');
select is((select overall_feel::int from public.checkins where user_id = '00000000-0000-4000-8000-0000000000a6'),
          4, 'the rating is stored and readable under RLS (AC4)');

-- ------------------------------------------------------------------------- idempotency (AC5)
select is(
  (select public.submit_checkin((select a_exec from t_ck), 4::smallint, '00000000-0000-4000-8000-00000000c010')),
  (select id from public.checkins where client_checkin_id = '00000000-0000-4000-8000-00000000c010'),
  'a replay with the same key returns the same check-in (AC5)');
select is((select count(*)::int from public.checkins where user_id = '00000000-0000-4000-8000-0000000000a6'),
          1, 'the replay created no second row (AC5)');

-- --------------------------------------------------------------- one per execution (AC6/EC2)
select throws_ok(
  format($$select public.submit_checkin(%L, 2::smallint, '00000000-0000-4000-8000-00000000c011')$$,
         (select a_exec from t_ck)),
  '23514', null, 'a second check-in on the same execution is refused (AC6/BR1)');

-- ------------------------------------------------------------- a care with no execution (FR3)
select throws_ok(
  format($$select public.submit_checkin(%L, 3::smallint, '00000000-0000-4000-8000-00000000c012')$$,
         (select a_future_care from t_ck)),
  'P0002', null, 'a scheduled care id is not an execution id — refused, not silently accepted');

-- ------------------------------------------------------------------ someone else's data (AC8/AC2)
select throws_ok(
  format($$select public.submit_checkin(%L, 5::smallint, '00000000-0000-4000-8000-00000000c013')$$,
         (select b_exec from t_ck)),
  'P0002', null, 'B''s execution is indistinguishable from a missing one (AC8/EC6)');

select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select is((select count(*)::int from public.checkins), 0, 'B cannot read A''s check-in (AC2)');
select tests.as_anon();
-- anon holds no grant at all on checkins, so it is refused at the privilege level and never even
-- reaches RLS — a stronger guarantee than "returns no rows" (same shape as 010/020 for anon).
select throws_ok($$select count(*) from public.checkins$$, '42501',
                 null, 'anon cannot read checkins at all');

-- ------------------------------------------------------------------- voided execution (AC7/BR2)
select tests.as_user('00000000-0000-4000-8000-0000000000b6');
select public.void_execution((select b_exec from t_ck));
select throws_ok(
  format($$select public.submit_checkin(%L, 5::smallint, '00000000-0000-4000-8000-00000000c014')$$,
         (select b_exec from t_ck)),
  '23514', null, 'a check-in on an undone execution is refused (AC7/BR2)');

-- BR3: A's check-in stays attached to its own execution; nothing migrated.
select tests.as_user('00000000-0000-4000-8000-0000000000a6');
select is((select care_execution_id from public.checkins), (select a_exec from t_ck),
          'the check-in stays anchored to the execution it was made for (BR3)');

select * from finish();
rollback;
