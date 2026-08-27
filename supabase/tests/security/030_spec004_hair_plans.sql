-- SPEC-004 AC4–AC10/AC13 — hair_plans / scheduled_cares under a hostile client:
-- isolation, no direct writes, one active plan, idempotent RPC, ownership integrity.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a4@example.test'),
       ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b4@example.test');

-- hair_profiles is FORCE RLS with policies for `authenticated`: each user inserts her own snapshot.
select tests.as_user('00000000-0000-4000-8000-0000000000a4');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000a4', 'curly', 'medium', 'balanced', 'twice_weekly', array['coloring'], 'almost_daily', array['dryness'], 'softness_and_hydration');
select tests.as_user('00000000-0000-4000-8000-0000000000b4');
insert into public.hair_profiles
  (id, user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
values
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000b4', 'wavy', 'fine', 'balanced', 'twice_weekly', '{}', 'almost_never', array['no_major_concern'], 'maintain_healthy_hair');
reset role;

-- Foundation guardrails stay green with the new schema + RPC (AC10).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'new tables have RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants on the new tables are allow-listed (SPEC-004)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'create_plan_tx is allow-listed');

-- The advisory lock that serialises the first-plan race must be in the function (AC5, §12b).
select ok(
  (select prosrc like '%pg_advisory_xact_lock%' from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_plan_tx'),
  'create_plan_tx serialises per user with pg_advisory_xact_lock');

-- ---------------------------------------------------------------- server-enforced creation (AC4)
-- A client is `authenticated`: it may not create a plan by any direct means.
select tests.as_user('00000000-0000-4000-8000-0000000000a4');
select throws_ok(
  $$ insert into public.hair_plans (user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
     values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-01', 'v1', 'v1', 'active', gen_random_uuid()) $$,
  '42501', null, 'authenticated cannot INSERT a plan directly');
select throws_ok(
  $$ update public.hair_plans set status = 'superseded' $$,
  '42501', null, 'authenticated cannot UPDATE a plan');
select throws_ok(
  $$ delete from public.hair_plans $$,
  '42501', null, 'authenticated cannot DELETE a plan');
select throws_ok(
  $$ insert into public.scheduled_cares (plan_id, user_id, care_type_code, planned_date)
     values (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a4', 'hydration', '2026-09-01') $$,
  '42501', null, 'authenticated cannot INSERT a scheduled care directly');
-- ...nor by calling the RPC itself.
select throws_ok(
  $$ select public.create_plan_tx('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-01', 'v1', 'v1', gen_random_uuid(), '[]'::jsonb) $$,
  '42501', null, 'authenticated cannot EXECUTE create_plan_tx (service_role only)');

select tests.as_anon();
select throws_ok(
  $$ select * from public.hair_plans $$, '42501', null, 'anon cannot read hair_plans');
select throws_ok(
  $$ select * from public.scheduled_cares $$, '42501', null, 'anon cannot read scheduled_cares');

reset role;

-- ------------------------------------------------------------------ the server path (service_role)
set local role service_role;
select lives_ok(
  $$ select public.create_plan_tx('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-01', 'v1', 'v1', '00000000-0000-4000-8000-00000000c001', '[{"care_type_code":"hydration","planned_date":"2026-09-01"},{"care_type_code":"nutrition","planned_date":"2026-09-05"}]'::jsonb) $$,
  'service_role can create a plan through create_plan_tx');
reset role;

select is((select count(*)::int from public.hair_plans), 1, 'exactly one plan exists');
select is((select count(*)::int from public.scheduled_cares), 2, 'its two cares were inserted in the same transaction');

-- A plan for a profile that belongs to somebody else is rejected (never trust the id alone).
set local role service_role;
select throws_ok(
  $$ select public.create_plan_tx('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f2', '2026-09-01', 'v1', 'v1', gen_random_uuid(), '[]'::jsonb) $$,
  'P0002', null, 'a profile owned by another user is rejected');

-- Idempotency (AC9): the same client_request_id returns the same plan, creates nothing,
-- and does not supersede the active plan.
select is(
  (select public.create_plan_tx('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-01', 'v1', 'v1', '00000000-0000-4000-8000-00000000c001', '[{"care_type_code":"hydration","planned_date":"2026-09-01"}]'::jsonb)),
  (select id from public.hair_plans limit 1),
  'a retry with the same client_request_id returns the existing plan');
reset role;
select is((select count(*)::int from public.hair_plans), 1, 'the retry created no second plan');
select is((select count(*)::int from public.hair_plans where status = 'active'), 1, 'the retry caused no spurious supersede');
select is((select count(*)::int from public.scheduled_cares), 2, 'the retry inserted no extra cares');

-- Reassessment (AC6): a new request supersedes the previous plan and keeps its history.
set local role service_role;
select lives_ok(
  $$ select public.create_plan_tx('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-10', 'v1', 'v1', '00000000-0000-4000-8000-00000000c002', '[{"care_type_code":"hydration","planned_date":"2026-09-10"}]'::jsonb) $$,
  'a second request creates a new plan');
reset role;
select is((select count(*)::int from public.hair_plans where status = 'superseded'), 1, 'the previous plan is superseded, not deleted');
select is((select count(*)::int from public.scheduled_cares), 3, 'the old plan keeps its cares (immutable history)');

-- One active plan per user, enforced by the database itself (AC5).
select throws_ok(
  $$ insert into public.hair_plans (user_id, hair_profile_id, starts_on, assessment_algorithm_version, schedule_algorithm_version, status, client_request_id)
     values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000f1', '2026-09-20', 'v1', 'v1', 'active', gen_random_uuid()) $$,
  '23505', null, 'a second active plan is rejected by the partial unique index');

-- Ownership integrity independent of the RPC (AC13): user_id must match the plan owner.
select throws_ok(
  format($$ insert into public.scheduled_cares (plan_id, user_id, care_type_code, planned_date)
            values (%L, '00000000-0000-4000-8000-0000000000b4', 'hydration', '2026-09-01') $$,
         (select id from public.hair_plans where status = 'active')),
  '23503', null, 'a care whose user_id is not the plan owner is rejected by the composite FK');

-- Unknown care type codes are rejected (set approved by D-67).
select throws_ok(
  format($$ insert into public.scheduled_cares (plan_id, user_id, care_type_code, planned_date)
            values (%L, '00000000-0000-4000-8000-0000000000a4', 'protein_bomb', '2026-09-01') $$,
         (select id from public.hair_plans where status = 'active')),
  '23514', null, 'an unapproved care_type_code is rejected by CHECK');

-- ------------------------------------------------------------------------------ isolation (AC7)
select tests.as_user('00000000-0000-4000-8000-0000000000a4');
select is((select count(*)::int from public.hair_plans), 2, 'A reads her own plans (current + history)');
select is((select count(*)::int from public.scheduled_cares), 3, 'A reads her own cares');
select tests.as_user('00000000-0000-4000-8000-0000000000b4');
select is((select count(*)::int from public.hair_plans), 0, 'B sees none of A''s plans');
select is((select count(*)::int from public.scheduled_cares), 0, 'B sees none of A''s cares');

select * from finish();
rollback;
