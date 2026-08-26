-- Guardrail: anon/authenticated hold no table privileges in public beyond the allowlist.
begin;
create extension if not exists pgtap with schema extensions;
select plan(1);

select is(
  (select count(*)::int from tests.unapproved_grants()),
  0,
  'no unapproved grants to anon/authenticated on public tables'
);

select * from finish();
rollback;
