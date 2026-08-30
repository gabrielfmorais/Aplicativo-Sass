-- SPEC-010 Parte 1 (D-78) §8/§9/§10 — Subscription & Entitlements: state, idempotent webhook
-- audit, the single server-side write path, and the entitlement functions.
--
-- Additive. Two tables and three functions. The provider never leaks into the schema (BR6): there is
-- no provider vocabulary here beyond a `provider` enum for portability/debugging. Entitlement is a
-- FUNCTION, never a table (NG6) — `has_entitlement`/`get_my_entitlements` decide from the row.
--
-- The write path mirrors create_plan_tx (SPEC-004 §12b): no client role holds INSERT/UPDATE on either
-- table, and every write goes through one allow-listed SECURITY DEFINER function (`apply_billing_event`)
-- whose EXECUTE is granted to `service_role` only. Idempotency (by event_id), out-of-order rejection
-- (by the provider's occurred_at) and the state upsert are one atomic act, not three round-trips.

-- ------------------------------------------------------------------ subscriptions: current state
-- One row per user (1:1 — the MVP has exactly one paid plan, NG2). `user_id` is the natural key, so
-- there is no synthetic id and no `provider_subscription_id`: the provider correlates on the
-- app_user_id we send it (= auth.users.id). Divergences from DATA-MODEL §3.12 are deliberate and
-- documented there (this SPEC is the newer version): no raw payload, no separate trial/cancelled
-- dates, idempotency moved out of the state row into billing_events.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null
    check (status in ('trial', 'active', 'grace', 'expired', 'cancelled', 'refunded')),
  product_code text not null,
  current_period_ends_at timestamptz,
  provider text not null check (provider in ('revenuecat', 'apple', 'google', 'manual')),
  updated_at timestamptz not null default now()
);

comment on table public.subscriptions is
  'SPEC-010: current subscription state, one row per user. Written only by apply_billing_event (service_role); the client may only SELECT its own row. Absence of a row = free (BR1).';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

-- SPEC-010 §10: the client may only READ its own row. No INSERT/UPDATE/DELETE grant at all, so a
-- tampered client is denied by privilege (42501), not merely by policy. The server write enters
-- through the DEFINER function, owned by postgres.
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- FORCE row level security applies to the owner too, and the DEFINER function runs as it.
drop policy if exists subscriptions_owner_all on public.subscriptions;
create policy subscriptions_owner_all on public.subscriptions
  for all to postgres using (true) with check (true);

-- --------------------------------------------------------- billing_events: idempotency + audit
-- Append-only. The primary key IS the idempotency guard (FR8): a redelivered event_id conflicts and
-- is a no-op. We keep NO raw provider payload — only a hash — so this table carries no PII or secret
-- (§12). It replaces the never-built `audit_log` for this one producer (amends ADR-011, D-78).
create table if not exists public.billing_events (
  event_id text primary key,
  -- Null when the event cannot be mapped to a known user (EC4): recorded for audit, applied to no one.
  user_id uuid references auth.users (id) on delete set null,
  type text not null,
  -- The provider's own timestamp — the ordering key that rejects stale events (EC3), not received_at.
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload_hash text
);

comment on table public.billing_events is
  'SPEC-010: append-only webhook audit. PK = idempotency (FR8). occurred_at is the provider clock, used to reject out-of-order events (EC3). No raw payload — no PII/secrets (§12).';

-- The EC3 ordering guard queries (user_id, occurred_at) on every applied event.
create index if not exists billing_events_user_occurred
  on public.billing_events (user_id, occurred_at);

alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

-- A server-only table: no verb for any client role. Every write is the DEFINER function's.
revoke all on public.billing_events from anon, authenticated;

drop policy if exists billing_events_owner_all on public.billing_events;
create policy billing_events_owner_all on public.billing_events
  for all to postgres using (true) with check (true);

-- ---------------------------------------------------------------------------------------- RPCs
/*
 * SECURITY DEFINER justification (SECURITY-BASELINE S5, allow-listed): the only write path into
 * subscriptions/billing_events. No client role holds INSERT/UPDATE on either, so a tampered client
 * cannot forge a subscription (T04) or a webhook effect (T18). Unlike the SPEC-005 RPCs, EXECUTE is
 * granted to `service_role` ONLY (same as create_plan_tx): the caller is the trusted billing-webhook
 * Edge Function, which authenticates the provider by HMAC and passes the resolved app_user_id.
 * search_path is pinned.
 *
 * Idempotency, out-of-order rejection and the upsert are one transaction:
 *   1. Insert the event; a duplicate event_id conflicts → no-op → false (FR8/EC2).
 *   2. No mapped user → recorded for audit, nothing applied → true (EC4/AC12).
 *   3. A strictly newer event already recorded for this user → this one is stale → audit only, state
 *      does not regress → true (EC3/AC10).
 *   4. Otherwise upsert the state row → true.
 */
create or replace function public.apply_billing_event(
  p_event_id text,
  p_user_id uuid,
  p_type text,
  p_occurred_at timestamptz,
  p_provider text,
  p_status text,
  p_product_code text,
  p_current_period_ends_at timestamptz,
  p_payload_hash text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted int;
begin
  if p_event_id is null or p_occurred_at is null then
    raise exception 'apply_billing_event: event_id and occurred_at are required' using errcode = '22023';
  end if;

  -- A user_id we do not recognise — one that never existed, or a user who has since deleted her
  -- account (on delete cascade removed her subscription) — is treated as unmapped (EC4): the event is
  -- still audited, with a null user_id, and applied to no one. Without this, a well-formed id for a
  -- gone user would hit billing_events' FK, abort the transaction (losing the audit row) and make the
  -- provider redeliver the same event forever on the 5xx.
  if p_user_id is not null and not exists (select 1 from auth.users where id = p_user_id) then
    p_user_id := null;
  end if;

  insert into public.billing_events (event_id, user_id, type, occurred_at, payload_hash)
  values (p_event_id, p_user_id, p_type, p_occurred_at, p_payload_hash)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false; -- duplicate delivery (FR8/EC2): nothing changes
  end if;

  if p_user_id is null then
    return true; -- audited, but there is no subscription to apply it to (EC4/AC12)
  end if;

  -- The current row already reflects a newer provider event: keep this one only as audit (EC3/AC10).
  if exists (
    select 1 from public.billing_events
     where user_id = p_user_id and occurred_at > p_occurred_at
  ) then
    return true;
  end if;

  -- Apply the state. A mapped event that cannot form a valid subscription — a missing field or an
  -- enum the CHECK rejects — must NOT abort the transaction: that would roll back the audit row we
  -- just wrote (it can then never win the on-conflict guard, because it was never committed) and the
  -- provider would redeliver forever on the resulting 5xx. The subtransaction rolls back only the
  -- upsert, so the event stays audited, the state is left untouched, and the webhook still returns
  -- 200. PR-C's zod is the real validator on the provider contract; this is fail-closed defence in
  -- depth (a malformed event never changes a subscription — §16).
  begin
    insert into public.subscriptions (user_id, status, product_code, current_period_ends_at, provider)
    values (p_user_id, p_status, p_product_code, p_current_period_ends_at, p_provider)
    on conflict (user_id) do update set
      status = excluded.status,
      product_code = excluded.product_code,
      current_period_ends_at = excluded.current_period_ends_at,
      provider = excluded.provider,
      updated_at = now();
  exception when check_violation or not_null_violation or foreign_key_violation then
    -- Malformed provider event (bad enum / missing field), or the user was deleted between the check
    -- above and here: audited, state untouched, no 5xx loop.
    return true;
  end;

  return true;
end;
$$;

/*
 * has_entitlement — the server's answer to "may she use this capability?" (FR5/G2).
 *
 * SECURITY INVOKER: it reads subscriptions under the caller's RLS, so it only ever sees the caller's
 * own row; auth.uid() is stated explicitly as defence in depth. STABLE, usable inside a policy or an
 * RPC of a premium feature (SUPABASE-RLS-STRATEGY §2). Fail-closed by construction: no row, or a
 * non-granting status, yields false — an error never opens a paid capability (§16).
 *
 * The status set and the code set are MIRRORED by packages/core/src/subscription/entitlements/catalog.ts
 * and checked by scripts/check-entitlement-catalog-parity.mjs (AC6). One paid plan (NG2), so any
 * granting status grants every code in the catalogue.
 */
create or replace function public.has_entitlement(p_code text)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p_code in ('advanced_insights', 'plan_customization', 'premium_content')
     and exists (
       select 1 from public.subscriptions
        where user_id = (select auth.uid())
          and status in ('trial', 'active', 'grace')
     );
$$;

/*
 * get_my_entitlements — the codes granted to the current user; empty for free. The app's source of
 * truth for what to show/unlock (G3). Enumerates the catalogue and defers the decision to
 * has_entitlement, so the granting logic lives in exactly one place.
 */
create or replace function public.get_my_entitlements()
returns setof text
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select code
    from unnest(array['advanced_insights', 'plan_customization', 'premium_content']) as code
   where public.has_entitlement(code);
$$;

revoke all on function public.apply_billing_event(text, uuid, text, timestamptz, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.apply_billing_event(text, uuid, text, timestamptz, text, text, text, timestamptz, text)
  to service_role;

revoke all on function public.has_entitlement(text) from public, anon;
grant execute on function public.has_entitlement(text) to authenticated;

revoke all on function public.get_my_entitlements() from public, anon;
grant execute on function public.get_my_entitlements() to authenticated;

-- ROLLBACK (no production data before release — §22):
--   drop function if exists public.get_my_entitlements();
--   drop function if exists public.has_entitlement(text);
--   drop function if exists public.apply_billing_event(text, uuid, text, timestamptz, text, text, text, timestamptz, text);
--   drop table if exists public.billing_events;
--   drop table if exists public.subscriptions;
