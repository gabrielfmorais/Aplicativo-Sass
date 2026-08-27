-- SPEC-005 §8/§9/§10 — care tracking: transitions on scheduled_cares + care_executions + RPCs.
--
-- Additive. The intention (scheduled_cares) and the fact (care_executions) stay separate: completing
-- a care inserts a fact and never rewrites the planned row, and rescheduling ends the original row
-- and creates a new one instead of moving a date (D-28, SPEC-005 BR1/BR2).
--
-- There is NO `status = 'completed'` (D-69, §8.2): completion is derived from the existence of an
-- effective execution. One fact, one source of truth.

-- ---------------------------------------------------------------- scheduled_cares: transitions
alter table public.scheduled_cares
  add column if not exists status text not null default 'planned',
  add column if not exists rescheduled_to_id uuid;

alter table public.scheduled_cares
  add constraint scheduled_cares_status_check check (status in ('planned', 'skipped', 'rescheduled'));

-- Target of the composite ownership FK of care_executions and of the reschedule link.
alter table public.scheduled_cares
  add constraint scheduled_cares_id_user_unique unique (id, user_id);

-- A reschedule always points at the row that replaced it, and only then (DATA-MODEL invariant 6).
alter table public.scheduled_cares
  add constraint scheduled_cares_reschedule_consistent
    check ((status = 'rescheduled') = (rescheduled_to_id is not null));

-- The replacement must belong to the same user; the database enforces it, not the RPC.
alter table public.scheduled_cares
  add constraint scheduled_cares_reschedule_link_fk
    foreign key (rescheduled_to_id, user_id) references public.scheduled_cares (id, user_id)
    on delete cascade;

comment on column public.scheduled_cares.status is
  'SPEC-005: lifecycle of the intention. No `completed` — done is derived from an effective care_execution (D-69).';

-- Exactly the "today / overdue / upcoming" lookup.
create index if not exists scheduled_cares_user_planned
  on public.scheduled_cares (user_id, planned_date) where status = 'planned';

-- ------------------------------------------------------------------ care_executions: the facts
create table if not exists public.care_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheduled_care_id uuid not null,
  -- The historical fact: kept even if the care_types catalogue (SPEC-007) later renames things.
  care_type_code text not null
    check (care_type_code in ('hydration', 'nutrition', 'reconstruction')),
  client_execution_id uuid not null,
  executed_at timestamptz not null default now(),
  -- The user's civil day, computed server-side from her IANA timezone (T22) — never client-supplied.
  executed_on date not null,
  -- Undo (D-69/D-12): the row stays in history, it is never deleted. The only mutable column.
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint care_executions_client_unique unique (user_id, client_execution_id),
  constraint care_executions_care_owner_fk
    foreign key (scheduled_care_id, user_id) references public.scheduled_cares (id, user_id)
    on delete cascade
);

comment on table public.care_executions is
  'SPEC-005: what actually happened, append-only. At most one effective (non-voided) execution per scheduled care (D-69/D-35); undo sets voided_at within 15 minutes and frees the care to be recorded again.';

-- D-69/D-35 enforced by the database, not by the UI: 0 or 1 *effective* execution per care.
-- A voided row does not occupy the slot, which is what makes "undo, then do it again" work.
create unique index if not exists care_executions_one_effective_per_care
  on public.care_executions (scheduled_care_id) where voided_at is null;
create index if not exists care_executions_user_recent
  on public.care_executions (user_id, executed_on desc);

alter table public.care_executions enable row level security;
alter table public.care_executions force row level security;

-- SPEC-005 §10: the client may only READ its own rows. Every write goes through the RPCs below.
revoke all on public.care_executions from anon, authenticated;
grant select on public.care_executions to authenticated;

drop policy if exists care_executions_select_own on public.care_executions;
create policy care_executions_select_own on public.care_executions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- FORCE row level security applies to the table owner too, and the DEFINER functions run as it.
-- Explicit rather than relying on the platform role carrying BYPASSRLS (same reasoning as SPEC-004).
drop policy if exists care_executions_definer_all on public.care_executions;
create policy care_executions_definer_all on public.care_executions
  for all to postgres using (true) with check (true);

-- ------------------------------------------------------------------------------------ helpers
/*
 * The user's civil day, from the IANA timezone she sends.
 *
 * SECURITY INVOKER on purpose: it touches no table, so it needs no elevated rights and stays out of
 * the SECURITY DEFINER allowlist. T22: a tampered client could claim any timezone to complete a care
 * on another day, so the resulting date must stay within one day of UTC — real civil offsets span
 * -12h..+14h, so a plausible timezone can never exceed that.
 */
create or replace function public.care_local_today(p_timezone text)
returns date
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_utc date := (now() at time zone 'UTC')::date;
begin
  if p_timezone is null or p_timezone = '' then
    raise exception 'care_local_today: timezone is required' using errcode = '22023';
  end if;
  begin
    v_today := (now() at time zone p_timezone)::date;
  exception when others then
    raise exception 'care_local_today: invalid timezone' using errcode = '22023';
  end;
  if abs(v_today - v_utc) > 1 then
    raise exception 'care_local_today: implausible timezone' using errcode = '22023';
  end if;
  return v_today;
end;
$$;

/*
 * Loads a care for transition and locks it, or raises.
 *
 * The two checks are both required: `status` alone is not enough, because completing a care does NOT
 * change its status (the fact lives in care_executions). Without the second check a care that was
 * already done could still be skipped or rescheduled (SPEC-005 BR5/AC19).
 *
 * FOR UPDATE is sufficient here — unlike SPEC-004's advisory lock, the row always exists.
 */
create or replace function public.care_lock_actionable(p_scheduled_care_id uuid, p_user_id uuid)
returns public.scheduled_cares
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_care public.scheduled_cares;
begin
  select * into v_care from public.scheduled_cares
   where id = p_scheduled_care_id and user_id = p_user_id
   for update;
  if not found then
    raise exception 'care not found' using errcode = 'P0002';
  end if;
  if v_care.status <> 'planned' then
    raise exception 'care is no longer planned' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.care_executions
     where scheduled_care_id = p_scheduled_care_id and voided_at is null
  ) then
    raise exception 'care is already completed' using errcode = '23514';
  end if;
  return v_care;
end;
$$;

create or replace function public.care_current_user()
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------------------- RPCs
/*
 * SECURITY DEFINER justification (SECURITY-BASELINE S5, allow-listed):
 * the client holds no INSERT/UPDATE privilege on scheduled_cares or care_executions, so a tampered
 * client cannot forge a fact or a transition. EXECUTE is granted to `authenticated` — safe here,
 * unlike create_plan_tx: these take only an id that is already hers, an idempotency key and a
 * timezone. The user is never a parameter; it comes from auth.uid(). search_path is pinned.
 */

-- Records a care as done. Idempotent by (user, client_execution_id): a retry after a lost response
-- returns the same fact instead of creating a second one (T19/AC3).
create or replace function public.complete_care(
  p_scheduled_care_id uuid,
  p_client_execution_id uuid,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_care public.scheduled_cares;
  v_execution_id uuid;
  v_executed_on date;
begin
  if p_client_execution_id is null then
    raise exception 'complete_care: client_execution_id is required' using errcode = '22023';
  end if;

  select id into v_execution_id from public.care_executions
   where user_id = v_user and client_execution_id = p_client_execution_id;
  if v_execution_id is not null then
    return v_execution_id; -- idempotent replay: no second fact, no state change
  end if;

  v_executed_on := public.care_local_today(p_timezone);
  v_care := public.care_lock_actionable(p_scheduled_care_id, v_user);

  begin
    insert into public.care_executions
      (user_id, scheduled_care_id, care_type_code, client_execution_id, executed_on)
    values
      (v_user, p_scheduled_care_id, v_care.care_type_code, p_client_execution_id, v_executed_on)
    returning id into v_execution_id;
  exception when unique_violation then
    -- Concurrent retry with the same key: return what the other transaction created. The
    -- subtransaction rolls back only this insert, never the caller's transaction.
    select id into v_execution_id from public.care_executions
     where user_id = v_user and client_execution_id = p_client_execution_id;
    if v_execution_id is null then raise; end if;
  end;

  return v_execution_id;
end;
$$;

-- Skips a care: no execution is created, the planned date is untouched (D-28).
create or replace function public.skip_care(p_scheduled_care_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
begin
  perform public.care_lock_actionable(p_scheduled_care_id, v_user);
  update public.scheduled_cares set status = 'skipped' where id = p_scheduled_care_id;
end;
$$;

-- Moves a care by ending the original row and creating a new one (D-28/BR1): the original
-- planned_date is never rewritten, so history keeps saying when it was meant to happen.
create or replace function public.reschedule_care(
  p_scheduled_care_id uuid,
  p_new_date date,
  p_timezone text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_care public.scheduled_cares;
  v_today date;
  v_new_id uuid;
begin
  v_today := public.care_local_today(p_timezone);
  if p_new_date is null or p_new_date < v_today or p_new_date > v_today + 28 then
    raise exception 'reschedule_care: date outside the allowed window' using errcode = '22023';
  end if;

  v_care := public.care_lock_actionable(p_scheduled_care_id, v_user);

  insert into public.scheduled_cares (plan_id, user_id, care_type_code, planned_date, status)
  values (v_care.plan_id, v_user, v_care.care_type_code, p_new_date, 'planned')
  returning id into v_new_id;

  update public.scheduled_cares
     set status = 'rescheduled', rescheduled_to_id = v_new_id
   where id = p_scheduled_care_id;

  return v_new_id;
end;
$$;

-- Undo an accidental execution (D-69/D-12): 15 minutes from executed_at, measured by the server
-- clock. The row is kept and marked, never deleted, and the care becomes actionable again.
create or replace function public.void_execution(p_execution_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := public.care_current_user();
  v_execution public.care_executions;
begin
  select * into v_execution from public.care_executions
   where id = p_execution_id and user_id = v_user
   for update;
  if not found then
    raise exception 'void_execution: execution not found' using errcode = 'P0002';
  end if;
  if v_execution.voided_at is not null then
    raise exception 'void_execution: already undone' using errcode = '23514';
  end if;
  if now() - v_execution.executed_at > interval '15 minutes' then
    raise exception 'void_execution: undo window has expired' using errcode = '23514';
  end if;

  update public.care_executions set voided_at = now() where id = p_execution_id;
end;
$$;

revoke all on function public.complete_care(uuid, uuid, text) from public, anon;
revoke all on function public.skip_care(uuid) from public, anon;
revoke all on function public.reschedule_care(uuid, date, text) from public, anon;
revoke all on function public.void_execution(uuid) from public, anon;
revoke all on function public.care_lock_actionable(uuid, uuid) from public, anon, authenticated;

grant execute on function public.complete_care(uuid, uuid, text) to authenticated;
grant execute on function public.skip_care(uuid) to authenticated;
grant execute on function public.reschedule_care(uuid, date, text) to authenticated;
grant execute on function public.void_execution(uuid) to authenticated;

-- ROLLBACK:
--   drop function if exists public.void_execution(uuid);
--   drop function if exists public.reschedule_care(uuid, date, text);
--   drop function if exists public.skip_care(uuid);
--   drop function if exists public.complete_care(uuid, uuid, text);
--   drop function if exists public.care_lock_actionable(uuid, uuid);
--   drop function if exists public.care_current_user();
--   drop function if exists public.care_local_today(text);
--   drop table if exists public.care_executions;
--   alter table public.scheduled_cares
--     drop constraint if exists scheduled_cares_reschedule_link_fk,
--     drop constraint if exists scheduled_cares_reschedule_consistent,
--     drop constraint if exists scheduled_cares_id_user_unique,
--     drop constraint if exists scheduled_cares_status_check,
--     drop column if exists rescheduled_to_id,
--     drop column if exists status;
