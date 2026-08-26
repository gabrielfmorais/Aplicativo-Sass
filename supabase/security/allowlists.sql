-- Security allowlists (SUPABASE-RLS-STRATEGY §7, SECURITY-BASELINE S5/S6).
-- Loaded as a LOCAL seed (config.toml [db.seed].sql_paths). Used by tests.* checks and CI.
-- Every addition requires: SPEC reference + justification + human review (CODEOWNERS).

create schema if not exists tests;

create table if not exists tests.security_definer_allowlist (
  function_signature text primary key,   -- e.g. public.request_account_deletion()
  spec text not null,                    -- e.g. SPEC-001
  justification text not null
);

create table if not exists tests.grants_allowlist (
  grantee text not null check (grantee in ('anon', 'authenticated')),
  table_name text not null,
  privilege text not null check (privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
  spec text not null,
  primary key (grantee, table_name, privilege)
);

-- SPEC-000: no SECURITY DEFINER functions, no product tables, therefore no grants.
truncate tests.security_definer_allowlist;
truncate tests.grants_allowlist;
