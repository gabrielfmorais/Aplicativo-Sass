-- SPEC-015 §8/§10 (D-81) — plan preferences: the weekdays she wants her cares on, and nothing more.
--
-- Additive: one new table, no RPC, no SECURITY DEFINER. Like notification_preferences (SPEC-008)
-- and unlike plans or executions, this row guards no server-side invariant — it is her own
-- statement about her own routine. Ownership is RLS plus `with check`.
--
-- IMPORTANT — storing a preference is NOT the premium gate. The capability is decided where it is
-- applied: `generate-plan` revalidates `has_entitlement('plan_customization')` before passing these
-- weekdays to the placement layer, and generates the engine default when she is not entitled (FR3,
-- fail closed). Gating the write instead would (a) put the same gate in two places and (b) lock a
-- lapsed subscriber out of the preference she already wrote, which she should get back the moment
-- she resubscribes. So the write is hers; the effect is the server's.

create table if not exists public.plan_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- `0` = Sunday … `6` = Saturday, matching core's `Weekday` (packages/core shared/time).
  -- Empty array = no preference = the engine's own placement, which is exactly the free behaviour.
  -- Duplicates are harmless and cannot change the outcome: the core normalises (dedupes and sorts)
  -- before applying, and nothing in SQL reads this column to decide anything.
  preferred_weekdays smallint[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint plan_preferences_weekdays_in_range
    check (preferred_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  constraint plan_preferences_weekdays_bounded
    check (cardinality(preferred_weekdays) <= 7)
);

comment on table public.plan_preferences is
  'SPEC-015: the weekdays she prefers her cares on. Holding a preference grants nothing — applying it is gated server-side by has_entitlement(''plan_customization'') at generation time (D-81).';
comment on column public.plan_preferences.preferred_weekdays is
  '0 = Sunday .. 6 = Saturday. Empty = no preference = engine default. Never changes which cares or how often (D-26); only when each one lands.';

create trigger plan_preferences_set_updated_at
  before update on public.plan_preferences
  for each row execute function public.set_updated_at();

alter table public.plan_preferences enable row level security;
alter table public.plan_preferences force row level security;

-- SPEC-015 §10: her own row, and nothing else. No DELETE for anyone — "no preference" is the empty
-- array, not a missing row, so there is nothing to delete.
revoke all on public.plan_preferences from anon, authenticated;
grant select, insert, update on public.plan_preferences to authenticated;

drop policy if exists plan_preferences_select_own on public.plan_preferences;
create policy plan_preferences_select_own on public.plan_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

-- `with check` is what stops a tampered client from writing somebody else's preference.
drop policy if exists plan_preferences_insert_own on public.plan_preferences;
create policy plan_preferences_insert_own on public.plan_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists plan_preferences_update_own on public.plan_preferences;
create policy plan_preferences_update_own on public.plan_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FORCE row level security applies to the table owner too.
drop policy if exists plan_preferences_owner_all on public.plan_preferences;
create policy plan_preferences_owner_all on public.plan_preferences
  for all to postgres using (true) with check (true);

-- Rollback (no production data before release, SPEC-015 §22):
--   drop table if exists public.plan_preferences;
