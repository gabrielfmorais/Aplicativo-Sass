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

-- Relation privileges (tables, partitioned tables, views, materialized views in public) held by
-- anon/authenticated that are not in the allowlist.
--
-- Reads the ACL directly from pg_catalog via aclexplode(relacl): deterministic and independent of the
-- role running the test (information_schema.role_table_grants only lists rows visible to the
-- *current* role's memberships, which makes counts depend on who runs the harness).
--
-- NOTE — Supabase platform baseline: `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES
-- TO anon, authenticated, service_role` means every NEW relation in public silently receives ALL
-- privileges for anon/authenticated. Those implicit grants are reported here as unapproved (fail
-- closed): every migration must `revoke all ... from anon, authenticated` before granting minimally.
create or replace function tests.unapproved_grants()
returns table(grantee text, table_name text, privilege text, grantor text)
language sql
stable
set search_path = ''
as $$
  select r.grantee_name, r.relname, r.privilege, r.grantor_name
  from (
    select c.relname::text as relname,
           gr.rolname::text as grantee_name,
           go.rolname::text as grantor_name,
           acl.privilege_type::text as privilege
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral pg_catalog.aclexplode(c.relacl) acl
    join pg_catalog.pg_roles gr on gr.oid = acl.grantee
    join pg_catalog.pg_roles go on go.oid = acl.grantor
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm')
  ) r
  where r.grantee_name in ('anon', 'authenticated')
    and not exists (
      select 1 from tests.grants_allowlist a
      where a.grantee = r.grantee_name and a.table_name = r.relname and a.privilege = r.privilege
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
