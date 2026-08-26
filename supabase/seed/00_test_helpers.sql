-- DEPENDS ON: supabase/security/allowlists.sql (tests.security_definer_allowlist, tests.grants_allowlist) must be
-- loaded first — see config.toml [db.seed].sql_paths order. The `language sql` functions below are validated at CREATE.
-- LOCAL-ONLY test helpers. Seed files run on `supabase db reset` (local) and are NEVER part of
-- `supabase db push`, so nothing here reaches staging/production.
-- Schema `tests` hosts the security-check functions used by supabase/tests/security/*.sql
-- and by CI. Do not put product data here.

create schema if not exists tests;

-- Tables in schema public that do not have RLS enabled AND forced (SECURITY-BASELINE S1).
create or replace function tests.tables_without_rls()
returns table(table_name text, rls_enabled boolean, rls_forced boolean)
language sql
stable
set search_path = ''
as $$
  select c.relname::text, c.relrowsecurity, c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (c.relrowsecurity = false or c.relforcerowsecurity = false)
  order by 1;
$$;

-- SECURITY DEFINER functions in public that are not in the approved allowlist
-- (supabase/security/allowlists.sql).
create or replace function tests.unapproved_security_definer_functions()
returns table(function_signature text)
language sql
stable
set search_path = ''
as $$
  select (n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')')::text
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and not exists (
      select 1 from tests.security_definer_allowlist a
      where a.function_signature = n.nspname || '.' || p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
    )
  order by 1;
$$;

-- Table privileges granted to anon/authenticated in public that are not in the allowlist.
create or replace function tests.unapproved_grants()
returns table(grantee text, table_name text, privilege text)
language sql
stable
set search_path = ''
as $$
  select g.grantee::text, g.table_name::text, g.privilege_type::text
  from information_schema.role_table_grants g
  where g.table_schema = 'public'
    and g.grantee in ('anon', 'authenticated')
    and not exists (
      select 1 from tests.grants_allowlist a
      where a.grantee = g.grantee and a.table_name = g.table_name and a.privilege = g.privilege_type
    )
  order by 1, 2, 3;
$$;

-- Impersonation helpers for future RLS tests (SUPABASE-RLS-STRATEGY §6).
create or replace function tests.as_user(user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.as_service()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;
