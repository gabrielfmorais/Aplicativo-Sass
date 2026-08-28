-- NEGATIVE FIXTURE (SPEC-000 AC7): proves the guardrails actually detect violations.
-- Everything happens inside a transaction that is rolled back — nothing persists.
--
-- Determinism rule (SUPABASE-RLS-STRATEGY §1.3): platform default privileges may vary across
-- Supabase/Postgres versions, so this fixture NEVER asserts on a specific implicit privilege set.
-- It normalizes the fixture relation (REVOKE ALL) to a deterministic baseline of zero unapproved
-- grants, then injects exactly one explicit violation and asserts it by value.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- STEP A — initial baseline: nothing unapproved anywhere in public before the fixture exists.
select is(
  (select count(*)::int from tests.unapproved_grants()),
  0,
  'baseline: no unapproved grants in public before the fixture'
);

-- STEP B — create the fixture relation.
create table public.__fixture_no_rls (id int primary key);

-- RLS property 1: a table without RLS is detected.
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: table without RLS is detected'
);

-- RLS property 2: RLS enabled without FORCE is still detected.
alter table public.__fixture_no_rls enable row level security;
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: RLS enabled but not forced is detected'
);

-- RLS property 3: enabled + forced clears the finding.
alter table public.__fixture_no_rls force row level security;
select is(
  (select count(*)::int from tests.tables_without_rls() where table_name = '__fixture_no_rls'),
  0,
  'positive: RLS enabled and forced passes'
);

-- Platform-dependent implicit grants after CREATE TABLE: shown for the record, NOT asserted.
select diag('platform default privileges on __fixture_no_rls after CREATE TABLE (informational, version-dependent): '
  || coalesce((
    select string_agg(grantee || ':' || privilege || ' (by ' || grantor || ')', ', ' order by grantee, privilege)
    from tests.unapproved_grants() where table_name = '__fixture_no_rls'), '<none>'));

-- STEP C — normalize: the migration convention (revoke all before minimal grants) yields a
-- deterministic baseline of zero unapproved grants for the fixture.
revoke all on table public.__fixture_no_rls from anon, authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  0,
  'deterministic baseline: revoke all from anon/authenticated leaves no unapproved grant on the fixture'
);

-- STEP D — inject exactly one explicit violation; expect exactly one finding, asserted by value.
grant select on table public.__fixture_no_rls to authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  1,
  'negative fixture: a single unapproved grant produces exactly one finding'
);
select results_eq(
  $q$ select grantee, privilege from tests.unapproved_grants() where table_name = '__fixture_no_rls' $q$,
  $v$ values ('authenticated'::text, 'SELECT'::text) $v$,
  'negative fixture: the finding is exactly (authenticated, SELECT)'
);

-- STEP E — revoke the injected violation; the fixture returns to zero.
revoke select on table public.__fixture_no_rls from authenticated;
select is(
  (select count(*)::int from tests.unapproved_grants() where table_name = '__fixture_no_rls'),
  0,
  'positive: revoking the injected grant clears the finding'
);

-- SECURITY DEFINER property 1: an unapproved SECURITY DEFINER function is detected.
create function public.__fixture_definer() returns int language sql security definer set search_path = '' as 'select 1';
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  1,
  'negative fixture: unapproved SECURITY DEFINER function is detected'
);

-- SECURITY DEFINER property 2: allow-listing it clears the finding.
insert into tests.security_definer_allowlist values ('public.__fixture_definer()', 'SPEC-000', 'negative fixture only');
select is(
  (select count(*)::int from tests.unapproved_security_definer_functions() where function_signature = 'public.__fixture_definer()'),
  0,
  'positive: allow-listed SECURITY DEFINER function passes'
);

-- SECURITY DEFINER property 3: a DEFINER function with no pinned search_path is detected.
-- Note it is allow-listed below only for the *allowlist* check; the pin check is independent, which
-- is the whole point — review and safety are two different guarantees.
create function public.__fixture_unpinned() returns int language sql security definer as 'select 1';
select is(
  (select count(*)::int from tests.unpinned_security_definer_functions()
    where function_signature = 'public.__fixture_unpinned()'),
  1,
  'negative fixture: a DEFINER function without a pinned search_path is detected'
);
select results_eq(
  $q$ select reason from tests.unpinned_security_definer_functions()
       where function_signature = 'public.__fixture_unpinned()' $q$,
  $v$ values ('search_path is not pinned'::text) $v$,
  'negative fixture: the finding says the search_path is not pinned'
);

-- SECURITY DEFINER property 4: pinning it clears the finding.
alter function public.__fixture_unpinned() set search_path = '';
select is(
  (select count(*)::int from tests.unpinned_security_definer_functions()
    where function_signature = 'public.__fixture_unpinned()'),
  0,
  'positive: a pinned search_path passes'
);

-- SECURITY DEFINER property 5: a pin is not enough if it resolves through a caller-controlled
-- schema — "$user" is a pin on paper and a hijack in practice.
alter function public.__fixture_unpinned() set search_path = "$user", public;
select is(
  (select count(*)::int from tests.unpinned_security_definer_functions()
    where function_signature = 'public.__fixture_unpinned()'),
  1,
  'negative fixture: a search_path resolving through "$user" is still a finding'
);

select * from finish();
-- STEP F — rollback: nothing persists; 003_grants_allowlist.sql (baseline = 0) runs independently.
rollback;
