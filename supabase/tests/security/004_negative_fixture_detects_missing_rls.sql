-- NEGATIVE FIXTURE (SPEC-000 AC7): proves the guardrails actually detect violations.
-- Everything happens inside a transaction that is rolled back — nothing persists.
--
-- Grant model under test (SUPABASE-RLS-STRATEGY §1.3):
--   observed relation ACL (pg_catalog, aclexplode)
--     minus project allowlist (tests.grants_allowlist, human-approved)
--   = unapproved grants  → must be 0.
-- There is deliberately NO "platform baseline" subtraction: the Supabase default privileges
-- (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES TO anon, authenticated) are exactly the silent
-- exposure this harness exists to catch. Migrations must REVOKE them before granting minimally.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- 0) Baseline BEFORE any fixture: nothing unapproved anywhere in public.
select is(
  (select count(*)::int from tests.unapproved_grants()),
  0,
  'baseline: no unapproved grants before the fixture'
);

-- 1) A table without RLS is detected.
create table public.__fixture_no_rls (id int primary key);
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: table without RLS is detected'
);

-- 2) Enabling RLS without FORCE is still detected.
alter table public.__fixture_no_rls enable row level security;
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: RLS enabled but not forced is detected'
);

-- 3) Enabling + forcing clears the finding.
alter table public.__fixture_no_rls force row level security;
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  0,
  'positive: RLS enabled and forced passes'
);

-- 4) Creating a table in public silently grants privileges to anon/authenticated through the
--    Supabase default privileges. The detector must report them (no explicit GRANT was issued).
select diag('implicit grants on __fixture_no_rls after CREATE TABLE: ' || coalesce((
  select string_agg(grantee || ':' || privilege || ' (by ' || grantor || ')', ', ' order by grantee, privilege)
  from tests.unapproved_grants() where table_name = '__fixture_no_rls'), '<none>'));
select is(
  (select count(*)::int from tests.unapproved_grants()
    where table_name = '__fixture_no_rls' and grantee = 'authenticated' and privilege = 'SELECT'),
  1,
  'negative fixture: implicit default-privilege SELECT for authenticated is detected'
);
select is(
  (select count(*)::int from tests.unapproved_grants()
    where table_name = '__fixture_no_rls' and grantee = 'anon' and privilege = 'SELECT'),
  1,
  'negative fixture: implicit default-privilege SELECT for anon is detected'
);

-- 5) The migration convention (revoke all before minimal grants) clears the implicit grants.
revoke all on public.__fixture_no_rls from anon, authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  0,
  'positive: revoke all from anon/authenticated leaves no unapproved grant'
);

-- 6) Exactly ONE explicit unapproved grant is detected as exactly one finding.
grant select on public.__fixture_no_rls to authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: a single unapproved grant produces exactly one finding'
);
select results_eq(
  $q$ select grantee, privilege from tests.unapproved_grants() where table_name = '__fixture_no_rls' $q$,
  $v$ values ('authenticated', 'SELECT') $v$,
  'negative fixture: the finding is (authenticated, SELECT)'
);

-- 7) An unapproved SECURITY DEFINER function is detected.
create function public.__fixture_definer() returns int language sql security definer set search_path = '' as 'select 1';
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  1,
  'negative fixture: unapproved SECURITY DEFINER function is detected'
);

-- 8) Allow-listing it clears the finding.
insert into tests.security_definer_allowlist values ('public.__fixture_definer()', 'SPEC-000', 'negative fixture only');
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  0,
  'positive: allow-listed SECURITY DEFINER function passes'
);

select * from finish();
rollback;
-- After ROLLBACK nothing persists: 003_grants_allowlist.sql (baseline = 0) runs independently.
