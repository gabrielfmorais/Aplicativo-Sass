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

-- allowlist tables are read by tests.* check functions, which may run while the role is authenticated/anon.
grant select on all tables in schema tests to anon, authenticated;

truncate tests.security_definer_allowlist;
truncate tests.grants_allowlist;

-- SPEC-000: no SECURITY DEFINER functions.
-- SPEC-001 §18: account_deletion_requests — authenticated may SELECT/INSERT/DELETE own rows; no UPDATE; anon nothing.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'account_deletion_requests', 'SELECT', 'SPEC-001'),
  ('authenticated', 'account_deletion_requests', 'INSERT', 'SPEC-001'),
  ('authenticated', 'account_deletion_requests', 'DELETE', 'SPEC-001');

-- SPEC-002 §13: hair_profiles — authenticated may SELECT/INSERT own rows; no UPDATE/DELETE (immutable); anon nothing.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'hair_profiles', 'SELECT', 'SPEC-002'),
  ('authenticated', 'hair_profiles', 'INSERT', 'SPEC-002');

-- SPEC-004 §14: hair_plans / scheduled_cares — authenticated may only SELECT its own rows.
-- Every write goes through create_plan_tx (service_role only); anon has nothing.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'hair_plans', 'SELECT', 'SPEC-004'),
  ('authenticated', 'scheduled_cares', 'SELECT', 'SPEC-004');

-- SPEC-004 §12b/§14: the single server-enforced write path into the plan tables.
insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.create_plan_tx(p_user_id uuid, p_hair_profile_id uuid, p_starts_on date, p_assessment_algorithm_version text, p_schedule_algorithm_version text, p_client_request_id uuid, p_cares jsonb)',
    'SPEC-004',
    'Only write path into hair_plans/scheduled_cares. Clients hold no INSERT/UPDATE privilege, so plan creation cannot be forged by a tampered client (G2/P10). Needs DEFINER to write tables no caller may write, and to keep supersede+insert+cares atomic with a per-user advisory lock. EXECUTE granted to service_role only; the generate-plan Edge Function verifies the JWT and passes the resolved user id; auth.uid() is validated when present; search_path is pinned; profile ownership is re-checked server-side.'
  );
