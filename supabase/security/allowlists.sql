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

-- SPEC-005 §10: care_executions — authenticated may only SELECT its own rows.
-- Every write goes through the care-tracking RPCs below; anon has nothing.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'care_executions', 'SELECT', 'SPEC-005');

-- SPEC-006 §10: checkins — authenticated may only SELECT its own rows.
-- The only write path is submit_checkin; append-only, so no UPDATE/DELETE for anyone.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'checkins', 'SELECT', 'SPEC-006');

-- SPEC-008 §10: notification_preferences — the user's own preference about her own device.
-- It guards no server-side invariant, so there is no RPC: SELECT/INSERT/UPDATE of her own row,
-- bounded by RLS and `with check`. No DELETE — turning reminders off is `enabled = false`.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'notification_preferences', 'SELECT', 'SPEC-008'),
  ('authenticated', 'notification_preferences', 'INSERT', 'SPEC-008'),
  ('authenticated', 'notification_preferences', 'UPDATE', 'SPEC-008');

-- SPEC-015 §10: plan_preferences — the weekdays she prefers, her own row only.
-- Same shape as notification_preferences: no server-side invariant, so no RPC. Holding the
-- preference grants nothing; applying it is gated by has_entitlement at generation time (D-81).
-- No DELETE — "no preference" is the empty array, not a missing row.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'plan_preferences', 'SELECT', 'SPEC-015'),
  ('authenticated', 'plan_preferences', 'INSERT', 'SPEC-015'),
  ('authenticated', 'plan_preferences', 'UPDATE', 'SPEC-015');

-- SPEC-010 §10: subscriptions — authenticated may only SELECT its own row.
-- Every write goes through apply_billing_event (service_role only); billing_events has no client
-- grant at all; anon has nothing. has_entitlement/get_my_entitlements are INVOKER (not DEFINER).
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'subscriptions', 'SELECT', 'SPEC-010');

-- SPEC-005 §9/§10: the only write path for care transitions. EXECUTE is granted to `authenticated`
-- (unlike create_plan_tx) because these take only an id that already belongs to the caller, an
-- idempotency key and a timezone — the user comes from auth.uid(), never from a parameter, so there
-- is nothing to forge. DEFINER is needed because the client holds no write privilege on
-- scheduled_cares / care_executions. search_path is pinned on all four.
insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.complete_care(p_scheduled_care_id uuid, p_client_execution_id uuid, p_timezone text)',
    'SPEC-005',
    'Records a care as done. Writes care_executions, which no client may write. Idempotent by (user_id, client_execution_id) so a retry cannot create a second fact; executed_on is computed server-side from the IANA timezone with a plausibility check (T22); ownership re-verified against auth.uid().'
  ),
  (
    'public.skip_care(p_scheduled_care_id uuid)',
    'SPEC-005',
    'Marks a planned care as skipped. Updates scheduled_cares, which no client may update. Only acts on a care that is planned AND has no effective execution, so an already-completed care cannot be skipped; ownership re-verified against auth.uid().'
  ),
  (
    'public.reschedule_care(p_scheduled_care_id uuid, p_new_date date, p_timezone text)',
    'SPEC-005',
    'Ends the original care and creates its replacement in one transaction, never rewriting the original planned_date (D-28). Updates/inserts scheduled_cares, which no client may write. Target date bounded to [today, today+28] using the server-computed local day; ownership re-verified against auth.uid().'
  ),
  (
    'public.void_execution(p_execution_id uuid)',
    'SPEC-005',
    'Undo of an accidental execution within 15 minutes (D-69/D-12). Sets voided_at on care_executions, which no client may update; the row is kept, never deleted. The window is measured by the server clock, so the client cannot extend it; ownership re-verified against auth.uid().'
  );

-- SPEC-006 §9.1: the only write path into checkins. EXECUTE is granted to `authenticated` for the
-- same reason as the SPEC-005 RPCs: the parameters are an execution id that already belongs to the
-- caller, a 1..5 rating and an idempotency key — the user comes from auth.uid(), never a parameter.
insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.submit_checkin(p_care_execution_id uuid, p_overall_feel smallint, p_client_checkin_id uuid)',
    'SPEC-006',
    'Records how a care went. Writes checkins, which no client may write. Idempotent by (user_id, client_checkin_id) so a retry cannot create a second check-in; one check-in per execution enforced by a unique constraint and re-checked under FOR UPDATE; refuses a voided execution; overall_feel validated in the function and by a CHECK; ownership re-verified against auth.uid(), and a foreign execution is indistinguishable from a missing one.'
  );

-- SPEC-004 §12b/§14: the single server-enforced write path into the plan tables.
insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.create_plan_tx(p_user_id uuid, p_hair_profile_id uuid, p_starts_on date, p_assessment_algorithm_version text, p_schedule_algorithm_version text, p_client_request_id uuid, p_cares jsonb)',
    'SPEC-004',
    'Only write path into hair_plans/scheduled_cares. Clients hold no INSERT/UPDATE privilege, so plan creation cannot be forged by a tampered client (G2/P10). Needs DEFINER to write tables no caller may write, and to keep supersede+insert+cares atomic with a per-user advisory lock. EXECUTE granted to service_role only; the generate-plan Edge Function verifies the JWT and passes the resolved user id; auth.uid() is validated when present; search_path is pinned; profile ownership is re-checked server-side.'
  );

-- SPEC-010 §9/§10: the only write path into subscriptions/billing_events. EXECUTE is granted to
-- service_role only (like create_plan_tx, unlike the SPEC-005 RPCs): the trusted caller is the
-- billing-webhook Edge Function, which authenticates the provider by HMAC and passes the resolved
-- app_user_id. has_entitlement/get_my_entitlements are SECURITY INVOKER, so they are not DEFINER
-- functions and need no entry here.
insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.apply_billing_event(p_event_id text, p_user_id uuid, p_type text, p_occurred_at timestamp with time zone, p_provider text, p_status text, p_product_code text, p_current_period_ends_at timestamp with time zone, p_payload_hash text)',
    'SPEC-010',
    'Only write path into subscriptions/billing_events. Clients hold no INSERT/UPDATE privilege on either, so a subscription (T04) or a webhook effect (T18) cannot be forged by a tampered client. Idempotent by billing_events.event_id (PK) so a redelivered event is a no-op; a strictly newer provider event blocks a stale one so state never regresses (EC3); an event with no mapped user is audited but applied to no one (EC4). EXECUTE granted to service_role only; the billing-webhook Edge Function authenticates the provider by HMAC; search_path is pinned.'
  );
