-- Guardrail: every table in schema public must have RLS enabled AND forced (SECURITY-BASELINE S1).
-- Fails as soon as the first product table is created without RLS.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is(
  (select count(*)::int from tests.tables_without_rls()),
  0,
  'all public tables have RLS enabled and forced'
);

select * from finish();
rollback;
