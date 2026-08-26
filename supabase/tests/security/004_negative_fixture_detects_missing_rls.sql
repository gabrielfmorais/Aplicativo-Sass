-- NEGATIVE FIXTURE (SPEC-000 AC7): proves the guardrails actually detect violations.
-- Everything happens inside a transaction that is rolled back — nothing persists.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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

-- 4) An unapproved grant is detected.
grant select on public.__fixture_no_rls to authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: unapproved grant to authenticated is detected'
);

-- 5) An unapproved SECURITY DEFINER function is detected.
create function public.__fixture_definer() returns int language sql security definer set search_path = '' as 'select 1';
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  1,
  'negative fixture: unapproved SECURITY DEFINER function is detected'
);

-- 6) Allow-listing it clears the finding.
insert into tests.security_definer_allowlist values ('public.__fixture_definer()', 'SPEC-000', 'negative fixture only');
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  0,
  'positive: allow-listed SECURITY DEFINER function passes'
);

select * from finish();
rollback;
