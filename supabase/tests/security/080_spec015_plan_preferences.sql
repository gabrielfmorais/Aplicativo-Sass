-- SPEC-015 §10 (D-81) — plan_preferences under a hostile client: her own row and nothing else,
-- no DELETE for anyone, a forged user_id refused by `with check`, and a weekday set that cannot be
-- filled with nonsense. Also pins the decision that holding a preference is NOT the premium gate:
-- a user with no subscription may write one, and it grants her nothing (has_entitlement stays false).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000af', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'af@example.test'),
       ('00000000-0000-4000-8000-0000000000bf', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bf@example.test');

-- ------------------------------------------------------------------ foundation guardrails (AC5)
select is((select count(*)::int from tests.tables_without_rls()), 0,
          'plan_preferences has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0,
          'grants are allow-listed (SPEC-015)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0,
          'SPEC-015 adds no SECURITY DEFINER function');
select is((select count(*)::int from tests.unpinned_security_definer_functions()), 0,
          'every DEFINER function still pins its search_path');

-- No DELETE for anyone: "no preference" is the empty array, so there is nothing to delete.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'plan_preferences'
      and grantee in ('anon', 'authenticated') and privilege_type = 'DELETE'),
  0,
  'neither role holds DELETE on plan_preferences');

-- --------------------------------------------------------------------- default is no preference
select tests.as_user('00000000-0000-4000-8000-0000000000af');
select lives_ok(
  $$insert into public.plan_preferences (user_id) values ('00000000-0000-4000-8000-0000000000af')$$,
  'a user can create her own preference row');
select results_eq(
  $$select preferred_weekdays from public.plan_preferences$$,
  $$values ('{}'::smallint[])$$,
  'the default is the empty set: no preference, engine placement, identical to free');

select lives_ok(
  $$update public.plan_preferences set preferred_weekdays = '{1,4}'$$,
  'she can say she prefers Mondays and Thursdays');

-- ------------------------------------------------------------ the weekday set cannot be nonsense
select throws_ok(
  $$update public.plan_preferences set preferred_weekdays = '{7}'$$,
  '23514', null, 'weekday 7 does not exist and is refused by the CHECK');
select throws_ok(
  $$update public.plan_preferences set preferred_weekdays = '{-1}'$$,
  '23514', null, 'a negative weekday is refused by the CHECK');
select throws_ok(
  $$update public.plan_preferences set preferred_weekdays = '{0,1,2,3,4,5,6,0}'$$,
  '23514', null, 'more than seven entries is refused, so the column cannot be used as a bucket');
select throws_ok(
  $$update public.plan_preferences set preferred_weekdays = null$$,
  '23502', null, 'the column is NOT NULL: absence of preference is the empty array, not null');

-- --------------------------------------------------------------- a forged user_id is refused (G2)
select throws_ok(
  $$insert into public.plan_preferences (user_id, preferred_weekdays)
    values ('00000000-0000-4000-8000-0000000000bf', '{6}')$$,
  '42501', null, 'A cannot insert a preference carrying B''s user_id (with check)');

-- --------------------------------------------------------- holding a preference grants nothing
-- A has no subscription row at all. She may still state a routine; the capability stays denied.
select is((select public.has_entitlement('plan_customization')), false,
          'writing a preference does not grant plan_customization — the gate is at generation (FR3)');

select tests.as_user('00000000-0000-4000-8000-0000000000bf');
select lives_ok(
  $$insert into public.plan_preferences (user_id, preferred_weekdays)
    values ('00000000-0000-4000-8000-0000000000bf', '{2}')$$,
  'B creates her own row');

-- --------------------------------------------------------------------------------- isolation
select is((select count(*)::int from public.plan_preferences), 1,
          'B sees only her own row, never A''s');

-- An UPDATE aimed at A's row is filtered by the policy rather than raising: it matches nothing.
select lives_ok(
  $$update public.plan_preferences set preferred_weekdays = '{0}'
     where user_id = '00000000-0000-4000-8000-0000000000af'$$,
  'B''s update aimed at A''s row runs but matches nothing');
select tests.as_user('00000000-0000-4000-8000-0000000000af');
select results_eq(
  $$select preferred_weekdays from public.plan_preferences$$,
  $$values ('{1,4}'::smallint[])$$,
  'A''s routine survived B''s attempt to change it');

-- --------------------------------------------------------------------------------------- anon
select tests.as_anon();
select throws_ok($$select count(*) from public.plan_preferences$$, '42501',
                 null, 'anon cannot read plan_preferences at all');

select * from finish();
rollback;
