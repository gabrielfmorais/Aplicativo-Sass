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

-- SPEC-018 §10: profiles — authenticated may SELECT/INSERT/UPDATE its own row; no DELETE (the row
-- dies with the account by cascade, and clearing a name is an UPDATE to null). anon has nothing.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'profiles', 'SELECT', 'SPEC-018'),
  ('authenticated', 'profiles', 'INSERT', 'SPEC-018'),
  ('authenticated', 'profiles', 'UPDATE', 'SPEC-018');

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

-- SPEC-020 §10: hair_events — authenticated may only SELECT its own rows. Every write goes through
-- the two RPCs below, because the civil day and the idempotency are server invariants.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'hair_events', 'SELECT', 'SPEC-020');

insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.record_hair_event(p_event_type text, p_occurred_on date, p_client_event_id uuid, p_timezone text)',
    'SPEC-020',
    'Only write path into hair_events; the client holds no INSERT. user_id is never a parameter — it comes from auth.uid() via care_current_user(), so a tampered client cannot record an event for someone else. Two server invariants justify DEFINER: the civil day (an event cannot be in the future, checked against care_local_today, which validates and bounds the caller-supplied IANA timezone, T22) and idempotency by (user_id, client_event_id), so a double tap or a retry after a lost response yields one event, not two. The event type is revalidated by the table CHECK rather than restated here. search_path is pinned.'
  ),
  (
    'public.void_hair_event(p_event_id uuid)',
    'SPEC-020',
    'Only path that voids an event; the client holds no UPDATE on hair_events. Scoped to auth.uid() and to rows not already voided, so it can neither touch another user''s event nor re-void one. The row is preserved (voided_at) and never deleted (BR6/D-69). A foreign, missing or already-voided event all raise the same error, so the caller cannot probe for existence. search_path is pinned.'
  );

-- SPEC-022 §10: plan_pauses — authenticated may only SELECT its own rows. Pausing and resuming
-- change the schedule, and resuming moves several rows at once: that is a server transaction.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'plan_pauses', 'SELECT', 'SPEC-022');

insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.pause_plan(p_timezone text)',
    'SPEC-022',
    'Only way to open a pause; the client holds no INSERT on plan_pauses. user_id comes from auth.uid() via care_current_user(), never from a parameter, and the civil day comes from care_local_today, which validates and bounds the caller-supplied IANA timezone (T22). Idempotent: an already-open pause is returned rather than duplicated, and a partial unique index makes a second open pause impossible even under a race. Refuses when there is no active plan, so no orphan pause can exist. search_path is pinned.'
  ),
  (
    'public.resume_plan(p_timezone text, p_commit boolean)',
    'SPEC-022',
    'Only way to close a pause and the only path that shifts planned dates; the client holds no UPDATE on plan_pauses or scheduled_cares. Scoped to auth.uid(); locks the open pause FOR UPDATE so two concurrent resumes cannot shift the schedule twice. p_commit=false is a dry run that computes and returns the outcome without writing, so the screen can tell her what will happen before she confirms (FR4) without a second copy of the shift rule living in TypeScript. Only cares that are still planned, unexecuted and on or after the pause date move; executions are never touched. search_path is pinned.'
  );

-- SPEC-023 §10: products — authenticated may SELECT/INSERT/UPDATE its own rows; no DELETE
-- (archiving is an UPDATE, and the row dies with the account by cascade). No RPC: the row guards no
-- server invariant, and the partial unique index handles the double tap.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'products', 'SELECT', 'SPEC-023'),
  ('authenticated', 'products', 'INSERT', 'SPEC-023'),
  ('authenticated', 'products', 'UPDATE', 'SPEC-023');

-- SPEC-024 §10: wash_days is the hub (SELECT/INSERT; it dies with the execution by cascade, so no
-- DELETE). The two join tables also get DELETE: unchecking a product is her correcting what she
-- marked, not erasing history — the day's record stays, without that line. No SECURITY DEFINER: the
-- unique constraint on care_execution_id makes the client upsert idempotent on its own.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'wash_days', 'SELECT', 'SPEC-024'),
  ('authenticated', 'wash_days', 'INSERT', 'SPEC-024'),
  ('authenticated', 'wash_day_products', 'SELECT', 'SPEC-024'),
  ('authenticated', 'wash_day_products', 'INSERT', 'SPEC-024'),
  ('authenticated', 'wash_day_products', 'DELETE', 'SPEC-024'),
  ('authenticated', 'wash_day_techniques', 'SELECT', 'SPEC-024'),
  ('authenticated', 'wash_day_techniques', 'INSERT', 'SPEC-024'),
  ('authenticated', 'wash_day_techniques', 'DELETE', 'SPEC-024');

-- SPEC-025 §10: the scalp answer is one choice per Wash Day, so UPDATE is what makes changing it a
-- single atomic write (`on conflict do update`) instead of a delete+insert with a window in which
-- there is no answer. DELETE because taking the answer back is a valid state (EC2).
--
-- It is a join table rather than a column on `wash_days` for a security reason: a column-level
-- `grant update (scalp_feel)` lives in `pg_attribute.attacl`, and this guard reads
-- `pg_class.relacl` — the privilege would exist outside the allowlist's reach, which is worse than
-- one it rejects.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'wash_day_scalp', 'SELECT', 'SPEC-025'),
  ('authenticated', 'wash_day_scalp', 'INSERT', 'SPEC-025'),
  ('authenticated', 'wash_day_scalp', 'UPDATE', 'SPEC-025'),
  ('authenticated', 'wash_day_scalp', 'DELETE', 'SPEC-025');

-- SPEC-039 §7 (F37): the finish step is one answer per Wash Day, so UPDATE is what makes changing
-- it a single atomic write (`on conflict do update`) rather than a delete+insert with a window in
-- which there is no answer. DELETE because taking the answer back — going back to "hasn't said" —
-- is a valid state and is hers (FR8).
--
-- Same reason as the scalp answer for it being its own table rather than a column on `wash_days`: a
-- column-level `grant update (finish_status)` lives in `pg_attribute.attacl`, and this guard reads
-- `pg_class.relacl`.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'wash_day_finish', 'SELECT', 'SPEC-039'),
  ('authenticated', 'wash_day_finish', 'INSERT', 'SPEC-039'),
  ('authenticated', 'wash_day_finish', 'UPDATE', 'SPEC-039'),
  ('authenticated', 'wash_day_finish', 'DELETE', 'SPEC-039');

-- SPEC-040 §7 (F39): the oil routine. `authenticated` may read both tables and DELETE its own
-- routine — turning the routine off is hers, and deleting the routine never deletes the history
-- (FR2/BR5). Every write goes through the two RPCs below, for the same reason as SPEC-020: the
-- civil day depends on her IANA timezone (ADR-008) and `current_date` on the server is UTC, so
-- letting the client send the date would make the truth of her history depend on a clock it owns.
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'oil_routines', 'SELECT', 'SPEC-040'),
  ('authenticated', 'oil_routines', 'DELETE', 'SPEC-040'),
  ('authenticated', 'oil_events', 'SELECT', 'SPEC-040');

insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.set_oil_routine(p_every_days smallint, p_timezone text)',
    'SPEC-040',
    'Only write path into oil_routines; the client holds no INSERT or UPDATE. user_id is never a parameter — it comes from auth.uid() via care_current_user(). One server invariant justifies DEFINER: started_on is her civil day, taken from care_local_today, which validates and bounds the caller-supplied IANA timezone (T22); the server''s current_date is UTC and would be wrong for her. The interval range is revalidated by the table CHECK rather than restated here, so there is one source of truth. Re-running it changes the interval and leaves started_on alone: she started when she started. search_path is pinned.'
  ),
  (
    'public.record_oil_event(p_kind text, p_client_event_id uuid, p_timezone text)',
    'SPEC-040',
    'Only write path into oil_events; the client holds no INSERT. user_id comes from auth.uid(), so a tampered client cannot record an event for someone else. Two server invariants justify DEFINER: the civil day (care_local_today, validated timezone) and idempotency by (user_id, client_event_id), so a double tap or a retry after a lost response yields one event, not two — the ON CONFLICT DO NOTHING is what closes the race the preceding SELECT cannot. It refuses to record when she has no routine, so no history exists that no routine explains. The kind is revalidated by the table CHECK. search_path is pinned.'
  );

-- SPEC-043 §7 (F40/F41/F42): the Journey. `authenticated` may only SELECT its own points — no
-- INSERT, no UPDATE, no DELETE. Points are awarded by the server from the canonical facts it reads
-- itself, so a tampered client can neither forge consistency it did not have nor erase the
-- consistency it did. A point is a dated fact; rewriting it would falsify her history (D-103).
insert into tests.grants_allowlist (grantee, table_name, privilege, spec) values
  ('authenticated', 'journey_points', 'SELECT', 'SPEC-043');

insert into tests.security_definer_allowlist (function_signature, spec, justification) values
  (
    'public.award_journey_points(p_timezone text)',
    'SPEC-043',
    'Only write path into journey_points; the client holds no INSERT. Neither the points nor the fact to award are parameters — the function reads her own care_executions, checkins and wash_days and grants what has no row yet, so a tampered client cannot invent adherence it did not have. user_id comes from auth.uid() via care_current_user(). Two server invariants justify DEFINER: the civil day (care_local_today, which validates and bounds the caller-supplied IANA timezone, T22) and idempotency by (user_id, fact_kind, fact_id), so a second call, a retry or a reload grants nothing — the ON CONFLICT DO NOTHING closes the race the preceding read cannot. The ruler version is stamped on each row so a future v2 never rewrites points already granted. search_path is pinned.'
  );
