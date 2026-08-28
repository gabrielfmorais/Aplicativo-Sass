-- SPEC-008 AC1–AC5 — notification preferences under a hostile client: opt-out by default, her own
-- row and nothing else, no DELETE for anyone, and `with check` stopping a forged user_id.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a8@example.test'),
       ('00000000-0000-4000-8000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b8@example.test');

-- ------------------------------------------------------------------ foundation guardrails (AC5)
select is((select count(*)::int from tests.tables_without_rls()), 0,
          'notification_preferences has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0,
          'grants are allow-listed (SPEC-008)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0,
          'SPEC-008 adds no SECURITY DEFINER function');
select is((select count(*)::int from tests.unpinned_security_definer_functions()), 0,
          'every DEFINER function still pins its search_path');

-- No DELETE for anyone: turning reminders off is `enabled = false`, so there is nothing to delete.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'notification_preferences'
      and grantee in ('anon', 'authenticated') and privilege_type = 'DELETE'),
  0,
  'neither role holds DELETE on notification_preferences');

-- ------------------------------------------------------------------------ opt-out defaults (AC4)
select tests.as_user('00000000-0000-4000-8000-0000000000a8');
select lives_ok(
  $$insert into public.notification_preferences (user_id) values ('00000000-0000-4000-8000-0000000000a8')$$,
  'a user can create her own preference row');
select results_eq(
  $$select enabled, checkin_reminder_enabled, reminder_time_local::text
      from public.notification_preferences$$,
  $$values (false, false, '19:00:00')$$,
  'defaults are opt-out: nothing is enabled until she asks (AC4)');

select lives_ok(
  $$update public.notification_preferences set enabled = true, reminder_time_local = '08:00'$$,
  'she can turn her own reminders on');

-- --------------------------------------------------------------- a forged user_id is refused (AC3)
select throws_ok(
  $$insert into public.notification_preferences (user_id, enabled)
    values ('00000000-0000-4000-8000-0000000000b8', true)$$,
  '42501', null, 'A cannot insert a preference carrying B''s user_id (with check)');

select tests.as_user('00000000-0000-4000-8000-0000000000b8');
select lives_ok(
  $$insert into public.notification_preferences (user_id) values ('00000000-0000-4000-8000-0000000000b8')$$,
  'B creates her own row');

-- ----------------------------------------------------------------------------- isolation (AC2)
select is((select count(*)::int from public.notification_preferences), 1,
          'B sees only her own row, never A''s (AC2)');
select is((select enabled from public.notification_preferences), false,
          'B''s row is untouched by A having enabled hers');

-- An UPDATE aimed at A's row is filtered by the policy rather than raising: it simply matches
-- nothing. Asserted by A's row still being what A left it.
select lives_ok(
  $$update public.notification_preferences set enabled = false
     where user_id = '00000000-0000-4000-8000-0000000000a8'$$,
  'B''s update aimed at A''s row runs but matches nothing');
select tests.as_user('00000000-0000-4000-8000-0000000000a8');
select is((select enabled from public.notification_preferences), true,
          'A''s preference survived B''s attempt to change it (AC2)');

-- --------------------------------------------------------------------------------- anon (AC1)
select tests.as_anon();
select throws_ok($$select count(*) from public.notification_preferences$$, '42501',
                 null, 'anon cannot read notification_preferences at all');

select * from finish();
rollback;
