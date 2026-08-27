-- SPEC-004 §10/§12/§14 — hair_plans + scheduled_cares + the transactional create_plan_tx RPC.
--
-- Additive. Plans are historical: reassessing creates a new plan and supersedes the previous one;
-- nothing is ever regenerated in place (G3). Reproducibility of a plan is `hair_profile_id` +
-- the two algorithm versions (§9/§11) — no input snapshot, no strategy blob, no diagnostic_results.
-- Care type codes are approved by D-67; the `care_types` catalogue and its FK belong to SPEC-007 (§9).

create table if not exists public.hair_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hair_profile_id uuid not null references public.hair_profiles (id) on delete cascade,
  starts_on date not null,
  assessment_algorithm_version text not null check (assessment_algorithm_version <> ''),
  schedule_algorithm_version text not null check (schedule_algorithm_version <> ''),
  status text not null check (status in ('active', 'superseded')),
  -- Idempotency key sent by the client and persisted; no idempotency table (§12b).
  client_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint hair_plans_client_request_unique unique (user_id, client_request_id),
  -- Target of the composite ownership FK of scheduled_cares (§10).
  constraint hair_plans_id_user_unique unique (id, user_id)
);

comment on table public.hair_plans is
  'SPEC-004: generated care plans. At most one active plan per user (partial unique index); reassessment supersedes, never rewrites. Created server-side only, through create_plan_tx.';

-- Server-side guarantee of the one-active-plan invariant (§10, AC5).
create unique index if not exists hair_plans_one_active_per_user
  on public.hair_plans (user_id) where status = 'active';
create index if not exists hair_plans_user_recent on public.hair_plans (user_id, created_at desc);

create table if not exists public.scheduled_cares (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Set approved by D-67. Mirrors CARE_TYPE_CODES in packages/core/src/schedule/domain/plan.ts.
  care_type_code text not null check (care_type_code in ('hydration', 'nutrition', 'reconstruction')),
  planned_date date not null,
  created_at timestamptz not null default now(),
  -- Ownership integrity enforced by the database, not by the RPC (§10, AC13): a care can never
  -- carry a user_id different from the owner of its plan.
  constraint scheduled_cares_plan_owner_fk
    foreign key (plan_id, user_id) references public.hair_plans (id, user_id) on delete cascade
);

comment on table public.scheduled_cares is
  'SPEC-004: the items of a plan (what and when). Execution/transition columns belong to SPEC-005.';

create index if not exists scheduled_cares_plan_date on public.scheduled_cares (plan_id, planned_date);
-- Also serves the auth.users cascade on account deletion.
create index if not exists scheduled_cares_user_date on public.scheduled_cares (user_id, planned_date);

alter table public.hair_plans enable row level security;
alter table public.hair_plans force row level security;
alter table public.scheduled_cares enable row level security;
alter table public.scheduled_cares force row level security;

-- Remove Supabase implicit default privileges (SUPABASE-RLS-STRATEGY §1.3). SPEC-004 §14: the
-- client may only READ its own plan; every write goes through create_plan_tx. Nothing for anon.
revoke all on public.hair_plans from anon, authenticated;
revoke all on public.scheduled_cares from anon, authenticated;
grant select on public.hair_plans to authenticated;
grant select on public.scheduled_cares to authenticated;

drop policy if exists hair_plans_select_own on public.hair_plans;
create policy hair_plans_select_own on public.hair_plans
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists scheduled_cares_select_own on public.scheduled_cares;
create policy scheduled_cares_select_own on public.scheduled_cares
  for select to authenticated
  using (user_id = (select auth.uid()));

-- FORCE row level security also applies to the table owner, and create_plan_tx runs SECURITY DEFINER
-- as that owner. These policies make the RPC's work explicit instead of depending on the platform
-- role carrying BYPASSRLS. They grant nothing to anon/authenticated, who additionally hold no write
-- privilege at all (see the grants above).
drop policy if exists hair_plans_definer_all on public.hair_plans;
create policy hair_plans_definer_all on public.hair_plans
  for all to postgres using (true) with check (true);

drop policy if exists scheduled_cares_definer_all on public.scheduled_cares;
create policy scheduled_cares_definer_all on public.scheduled_cares
  for all to postgres using (true) with check (true);

-- create_plan_tx must be able to verify that the profile belongs to the same user (SPEC-002 table
-- is FORCE RLS with policies for `authenticated` only). Read-only, owner role only.
drop policy if exists hair_profiles_definer_select on public.hair_profiles;
create policy hair_profiles_definer_select on public.hair_profiles
  for select to postgres using (true);

/*
 * SPEC-004 §12/§12b — the only write path into hair_plans / scheduled_cares.
 *
 * Atomic: supersede the active plan + insert the new plan + insert its cares, or nothing.
 * Concurrency: a transaction-scoped advisory lock keyed on the user serialises every creation,
 * including the very first plan (a `SELECT ... FOR UPDATE` locks nothing when there is no row yet).
 * Idempotency: `client_request_id` + UNIQUE (user_id, client_request_id); a retry returns the
 * existing plan and performs no second supersede. The nested BEGIN/EXCEPTION block is a subtransaction,
 * so a unique violation rolls back the supersede too — never a spurious supersede (AC9).
 *
 * SECURITY DEFINER justification (SECURITY-BASELINE S5, allow-listed in supabase/security/allowlists.sql):
 * clients hold no INSERT/UPDATE privilege on either table, so plan creation cannot be forged by a
 * tampered client (G2/P10). EXECUTE is granted to service_role only: the `generate-plan` Edge Function
 * verifies the caller's JWT and passes the resolved user id. `auth.uid()` is still validated when a
 * user JWT is present. `search_path` is pinned.
 */
create or replace function public.create_plan_tx(
  p_user_id uuid,
  p_hair_profile_id uuid,
  p_starts_on date,
  p_assessment_algorithm_version text,
  p_schedule_algorithm_version text,
  p_client_request_id uuid,
  p_cares jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id uuid;
begin
  if p_user_id is null or p_client_request_id is null or p_hair_profile_id is null then
    raise exception 'create_plan_tx: user, profile and request id are required' using errcode = '22023';
  end if;

  -- Defence in depth: when invoked with an end-user JWT the identity must match the argument.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'create_plan_tx: forbidden' using errcode = '42501';
  end if;

  -- The profile must exist AND belong to this user (never trust the id alone).
  if not exists (
    select 1 from public.hair_profiles hp where hp.id = p_hair_profile_id and hp.user_id = p_user_id
  ) then
    raise exception 'create_plan_tx: hair profile not found for user' using errcode = 'P0002';
  end if;

  -- Serialise plan creation for this user, first plan included (§12b). Released at commit.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  select hp.id into v_plan_id
    from public.hair_plans hp
   where hp.user_id = p_user_id and hp.client_request_id = p_client_request_id;
  if v_plan_id is not null then
    return v_plan_id; -- idempotent retry: no new plan, no supersede
  end if;

  begin
    update public.hair_plans
       set status = 'superseded'
     where user_id = p_user_id and status = 'active';

    insert into public.hair_plans (
      user_id, hair_profile_id, starts_on,
      assessment_algorithm_version, schedule_algorithm_version, status, client_request_id
    ) values (
      p_user_id, p_hair_profile_id, p_starts_on,
      p_assessment_algorithm_version, p_schedule_algorithm_version, 'active', p_client_request_id
    ) returning id into v_plan_id;
  exception when unique_violation then
    -- Safety net for any path outside the advisory lock: the whole subtransaction (supersede
    -- included) is rolled back; return the plan the concurrent request already created.
    select hp.id into v_plan_id
      from public.hair_plans hp
     where hp.user_id = p_user_id and hp.client_request_id = p_client_request_id;
    if v_plan_id is null then raise; end if;
    return v_plan_id;
  end;

  insert into public.scheduled_cares (plan_id, user_id, care_type_code, planned_date)
  select v_plan_id, p_user_id, c.care_type_code, c.planned_date
    from jsonb_to_recordset(p_cares) as c(care_type_code text, planned_date date);

  return v_plan_id;
end;
$$;

comment on function public.create_plan_tx is
  'SPEC-004 §12b: the only write path into hair_plans/scheduled_cares. Atomic, idempotent by (user_id, client_request_id), serialised per user by an advisory transaction lock. service_role only.';

-- Never callable by a client: plan creation is server-enforced (G2/P10).
revoke all on function public.create_plan_tx(uuid, uuid, date, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_plan_tx(uuid, uuid, date, text, text, uuid, jsonb) to service_role;

-- ROLLBACK:
--   drop function if exists public.create_plan_tx(uuid, uuid, date, text, text, uuid, jsonb);
--   drop policy if exists hair_profiles_definer_select on public.hair_profiles;
--   drop table if exists public.scheduled_cares;
--   drop table if exists public.hair_plans;
