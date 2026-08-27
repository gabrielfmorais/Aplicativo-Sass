-- SPEC-001 AC9 / AC10 — account_deletion_requests isolation and ownership under a hostile client.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- Two users. auth.users is managed by Supabase Auth; we insert the minimum for FK purposes.
insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
       ('00000000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');

-- Guardrails still hold with the new table (AC12).
select is((select count(*)::int from tests.tables_without_rls()), 0, 'new table has RLS enabled and forced');
select is((select count(*)::int from tests.unapproved_grants()), 0, 'grants on account_deletion_requests are allow-listed (SPEC-001)');
select is((select count(*)::int from tests.unapproved_security_definer_functions()), 0, 'SPEC-001 introduces no SECURITY DEFINER function');

-- A requests deletion for herself.
select tests.as_user('00000000-0000-4000-8000-00000000000a');
insert into public.account_deletion_requests (user_id) values ('00000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.account_deletion_requests), 1, 'A sees her own request');

-- Duplicate request is rejected by the PK (AC10).
select throws_ok(
  $$ insert into public.account_deletion_requests (user_id) values ('00000000-0000-4000-8000-00000000000a') $$,
  '23505', null, 'duplicate request for the same user is rejected (PK)');

-- A cannot request on behalf of B (RLS with check), even with a forged user_id.
select throws_ok(
  $$ insert into public.account_deletion_requests (user_id) values ('00000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'A cannot insert a request with B''s user_id');

-- A cannot UPDATE anything (no grant).
select throws_ok(
  $$ update public.account_deletion_requests set requested_at = now() $$,
  '42501', null, 'authenticated has no UPDATE privilege');

-- B sees nothing and cannot delete A's request.
select tests.as_user('00000000-0000-4000-8000-00000000000b');
select is((select count(*)::int from public.account_deletion_requests), 0, 'B cannot see A''s request (0 rows, no error)');
delete from public.account_deletion_requests where user_id = '00000000-0000-4000-8000-00000000000a';
select tests.as_user('00000000-0000-4000-8000-00000000000a');
select is((select count(*)::int from public.account_deletion_requests), 1, 'B''s delete did not affect A''s request');

-- anon has no access at all.
select tests.as_anon();
select throws_ok(
  $$ select * from public.account_deletion_requests $$,
  '42501', null, 'anon cannot read account_deletion_requests');
select throws_ok(
  $$ insert into public.account_deletion_requests (user_id) values ('00000000-0000-4000-8000-00000000000b') $$,
  '42501', null, 'anon cannot insert');

-- A cancels: deleting her own row.
select tests.as_user('00000000-0000-4000-8000-00000000000a');
delete from public.account_deletion_requests where user_id = '00000000-0000-4000-8000-00000000000a';
select is((select count(*)::int from public.account_deletion_requests), 0, 'A cancelled her request (row removed)');
delete from public.account_deletion_requests where user_id = '00000000-0000-4000-8000-00000000000a';
select pass('cancelling twice is a no-op');

select * from finish();
rollback;
