-- SPEC-008 §8/§10 — notification preferences: opt-in, the hour she chose, nothing more.
--
-- Additive: one new table. No RPC and no SECURITY DEFINER function — unlike plans, executions and
-- check-ins, this row protects no server-side invariant: it is the user's own preference about her
-- own device. Ownership is RLS plus `with check`, the same shape as account_deletion_requests
-- (SPEC-001). `max_per_day` is deliberately absent: the cap is a central rule with no UI that
-- changes it, so it lives in the core as a constant instead of a column nobody writes (§8.2).

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Opt-in (BR1): a user with no row, or a row that was never enabled, gets nothing.
  enabled boolean not null default false,
  reminder_time_local time not null default '19:00',
  checkin_reminder_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.notification_preferences is
  'SPEC-008: local-notification preferences. Opt-in by default; no push token, so no device identifier (D-22).';

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
alter table public.notification_preferences force row level security;

-- SPEC-008 §10: her own row, and nothing else. No DELETE for anyone — turning reminders off is
-- `enabled = false`, not removing the row, so there is nothing to delete.
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

-- `with check` is what stops a tampered client from writing somebody else's preference.
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FORCE row level security applies to the table owner too.
drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences
  for all to postgres using (true) with check (true);
