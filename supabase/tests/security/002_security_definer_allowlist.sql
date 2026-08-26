-- Guardrail: no SECURITY DEFINER function in public outside the allowlist (SECURITY-BASELINE S5).
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select is(
  (select count(*)::int from tests.unapproved_security_definer_functions()),
  0,
  'no unapproved SECURITY DEFINER functions in public'
);

-- set_updated_at() must remain SECURITY INVOKER.
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'),
  false,
  'public.set_updated_at() is SECURITY INVOKER'
);

select * from finish();
rollback;
