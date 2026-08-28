-- SPEC-006 §8/§9/§10 — check-ins: how the hair felt after a care.
--
-- Additive: one new table, one new UNIQUE on care_executions (already true by construction, since
-- `id` is the primary key — it exists to be the target of a composite ownership FK), one new
-- function. No column altered or dropped, no backfill, no data touched.
--
-- A check-in belongs to an EXECUTION, never to a scheduled care and never to a day. That is what
-- makes undo (D-12) behave: voiding an execution leaves its check-in attached to the voided row —
-- history, not fraud — and the replacement execution starts without one.

-- Target of the composite ownership FK below (same pattern as scheduled_cares in SPEC-005).
alter table public.care_executions
  add constraint care_executions_id_user_unique unique (id, user_id);

create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  care_execution_id uuid not null,
  -- One question, 1..5 (SPEC-006 §8.2). The other dimensions of DATA-MODEL §3.8 are deferred to
  -- SPEC-009 as nullable columns; free text is deferred because it is PII with no consumer.
  overall_feel smallint not null check (overall_feel between 1 and 5),
  client_checkin_id uuid not null,
  created_at timestamptz not null default now(),
  -- BR1: one check-in per execution, enforced here rather than in the UI.
  constraint checkins_execution_unique unique (care_execution_id),
  -- FR6: a retry after a lost response returns the same row instead of writing a second one.
  constraint checkins_client_unique unique (user_id, client_checkin_id),
  -- BR6: the database refuses a check-in whose user_id differs from the execution's owner.
  constraint checkins_execution_owner_fk
    foreign key (care_execution_id, user_id) references public.care_executions (id, user_id)
    on delete cascade
);

comment on table public.checkins is
  'SPEC-006: the user''s perception after a care, anchored to one effective care_execution. Append-only: no UPDATE, no DELETE, no client grant.';

alter table public.checkins enable row level security;
alter table public.checkins force row level security;

-- SPEC-006 §10: the client may only READ its own rows. The only write path is submit_checkin.
revoke all on public.checkins from anon, authenticated;
grant select on public.checkins to authenticated;

drop policy if exists checkins_select_own on public.checkins;
create policy checkins_select_own on public.checkins
  for select to authenticated
  using (user_id = (select auth.uid()));

-- FORCE row level security applies to the table owner too, and the DEFINER function runs as it.
drop policy if exists checkins_definer_all on public.checkins;
create policy checkins_definer_all on public.checkins
  for all to postgres using (true) with check (true);

/*
 * Records how the care went.
 *
 * SECURITY DEFINER justification (SECURITY-BASELINE S5, allow-listed): the client holds no INSERT
 * privilege on checkins, so a tampered client cannot forge one. EXECUTE is granted to
 * `authenticated` — safe for the same reason as the SPEC-005 RPCs and unlike create_plan_tx: the
 * parameters are an id that already belongs to the caller, a 1..5 rating and an idempotency key.
 * The user comes from auth.uid(), never from a parameter, so there is nothing to forge.
 */
create or replace function public.submit_checkin(
  p_care_execution_id uuid,
  p_overall_feel smallint,
  p_client_checkin_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_checkin_id uuid;
  v_execution public.care_executions;
begin
  if p_client_checkin_id is null then
    raise exception 'submit_checkin: client_checkin_id is required' using errcode = '22023';
  end if;

  -- Idempotent replay: same intent, same row, no second write (FR6/EC3).
  select id into v_checkin_id from public.checkins
   where user_id = v_user and client_checkin_id = p_client_checkin_id;
  if v_checkin_id is not null then
    return v_checkin_id;
  end if;

  -- Validated before touching a row, and again by the CHECK constraint (EC5).
  if p_overall_feel is null or p_overall_feel < 1 or p_overall_feel > 5 then
    raise exception 'submit_checkin: overall_feel must be between 1 and 5' using errcode = '22023';
  end if;

  -- Ownership re-verified server-side. A foreign or missing execution is the same answer, so the
  -- error never reveals which one it was (EC6).
  select * into v_execution from public.care_executions
   where id = p_care_execution_id and user_id = v_user
   for update;
  if not found then
    raise exception 'execution not found' using errcode = 'P0002';
  end if;

  if v_execution.voided_at is not null then
    raise exception 'execution was undone' using errcode = '23514'; -- BR2
  end if;

  -- FOR UPDATE above serialises two devices racing on the same execution; the UNIQUE index is the
  -- backstop if anything ever reaches the insert concurrently (BR1/EC2).
  if exists (select 1 from public.checkins where care_execution_id = p_care_execution_id) then
    raise exception 'execution already has a check-in' using errcode = '23514';
  end if;

  insert into public.checkins (user_id, care_execution_id, overall_feel, client_checkin_id)
  values (v_user, p_care_execution_id, p_overall_feel, p_client_checkin_id)
  returning id into v_checkin_id;

  return v_checkin_id;
end;
$$;

revoke all on function public.submit_checkin(uuid, smallint, uuid) from public, anon;
grant execute on function public.submit_checkin(uuid, smallint, uuid) to authenticated;
