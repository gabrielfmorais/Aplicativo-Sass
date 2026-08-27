-- SPEC-002 AC2–AC8 — hair_profiles isolation, immutability, domain constraints and history
-- under a hostile client. RLS/grants only (no RPC/trigger/DEFINER — D-63/D-64).
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Two users. auth.users is managed by Supabase Auth; insert the minimum for FK purposes.
insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
       ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');

-- Guardrails still hold with the new table (AC8).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'hair_profiles has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants on hair_profiles are allow-listed (SPEC-002)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'SPEC-002 introduces no SECURITY DEFINER function');

-- Helper values for a valid snapshot.
-- A creates her own valid snapshot (AC1).
select tests.as_user('00000000-0000-4000-8000-00000000000a');
insert into public.hair_profiles
  (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal, created_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'curly', 'medium', 'balanced', 'twice_weekly', array['coloring'], 'one_to_two_weekly', array['frizz', 'dryness'], 'definition_and_frizz_control', '2026-08-27T10:00:00Z');
select is((select count(*)::int from public.hair_profiles), 1, 'A sees her own snapshot');

-- Empty chemical_treatments (= none) is valid.
insert into public.hair_profiles
  (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal, created_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'wavy', 'fine', 'oily_quickly', 'varies', '{}', 'almost_never', array['no_major_concern'], 'maintain_healthy_hair', '2026-08-27T11:00:00Z');
select is((select count(*)::int from public.hair_profiles), 2, 'A created a second snapshot (history preserved, AC4)');

-- Current snapshot = most recent (created_at desc, id desc): the 11:00 row.
select is(
  (select primary_goal from public.hair_profiles order by created_at desc, id desc limit 1),
  'maintain_healthy_hair',
  'current snapshot is the most recent one (AC4)');
-- Previous snapshot is untouched (AC4).
select is(
  (select count(*)::int from public.hair_profiles where primary_goal = 'definition_and_frizz_control'),
  1, 'previous snapshot is preserved unchanged');

-- Domain CHECKs reject invalid values (AC6).
select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000a', 'afro', 'medium', 'balanced', 'twice_weekly', 'almost_never', array['frizz'], 'maintain_healthy_hair') $$,
  '23514', null, 'invalid hair_pattern is rejected by CHECK');

select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000a', 'curly', 'medium', 'balanced', 'twice_weekly', 'almost_never', '{}', 'maintain_healthy_hair') $$,
  '23514', null, 'empty current_concerns is rejected (>= 1)');

select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000a', 'curly', 'medium', 'balanced', 'twice_weekly', 'almost_never', array['no_major_concern', 'frizz'], 'maintain_healthy_hair') $$,
  '23514', null, 'no_major_concern is exclusive (cannot coexist with other concerns)');

select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, chemical_treatments, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000a', 'curly', 'medium', 'balanced', 'twice_weekly', array['tint'], 'almost_never', array['frizz'], 'maintain_healthy_hair') $$,
  '23514', null, 'unsupported chemical_treatments element is rejected');

-- A cannot INSERT with B's user_id (RLS with check) — forged ownership (AC2).
select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000b', 'curly', 'medium', 'balanced', 'twice_weekly', 'almost_never', array['frizz'], 'maintain_healthy_hair') $$,
  '42501', null, 'A cannot insert a snapshot with B''s user_id');

-- A cannot UPDATE or DELETE (no grant — immutable, AC3).
select throws_ok(
  $$ update public.hair_profiles set primary_goal = 'softness_and_hydration' $$,
  '42501', null, 'authenticated has no UPDATE privilege (immutable)');
select throws_ok(
  $$ delete from public.hair_profiles $$,
  '42501', null, 'authenticated has no DELETE privilege (immutable)');

-- B sees nothing of A's (AC2).
select tests.as_user('00000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.hair_profiles), 0, 'B cannot see A''s snapshots (0 rows, no error)');

-- anon has no access at all (AC2).
select tests.as_anon();
select throws_ok(
  $$ select * from public.hair_profiles $$,
  '42501', null, 'anon cannot read hair_profiles');
select throws_ok(
  $$ insert into public.hair_profiles (user_id, hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, current_concerns, primary_goal)
     values ('00000000-0000-4000-8000-00000000000a', 'curly', 'medium', 'balanced', 'twice_weekly', 'almost_never', array['frizz'], 'maintain_healthy_hair') $$,
  '42501', null, 'anon cannot insert');

-- A's history is intact after all hostile attempts.
select tests.as_user('00000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.hair_profiles), 2, 'A still has exactly her two snapshots');

select * from finish();
rollback;
