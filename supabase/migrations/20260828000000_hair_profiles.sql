-- SPEC-002 §8/§9/§13 — hair_profiles: immutable, versionless historical snapshots (D-62/D-63/D-64).
-- A snapshot's identity is its stable id; "current" = most recent (created_at desc, id desc).
-- Additive. No `profiles` table, no version column, no trigger, no RPC (D-63/D-64).
-- Values are approved product inputs (D-62), NOT a diagnosis (D-26). Enum sets mirror packages/core zod.

create table if not exists public.hair_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hair_pattern text not null
    check (hair_pattern in ('straight', 'wavy', 'curly', 'coily', 'transitioning_or_mixed', 'unknown')),
  strand_thickness text not null
    check (strand_thickness in ('fine', 'medium', 'coarse', 'unknown')),
  scalp_tendency text not null
    check (scalp_tendency in ('oily_quickly', 'balanced', 'dry_tendency', 'unknown')),
  wash_frequency text not null
    check (wash_frequency in ('once_or_less_weekly', 'twice_weekly', 'three_to_four_weekly', 'five_or_more_weekly', 'varies')),
  -- [] = no chemical treatments (no 'none' value). Elements must be a subset of the approved set.
  chemical_treatments text[] not null default '{}'
    check (chemical_treatments <@ array['coloring', 'bleaching_or_highlights', 'straightening_relaxing_or_progressive', 'perm_or_chemical_texturizing']::text[]),
  heat_usage text not null
    check (heat_usage in ('almost_never', 'one_to_two_weekly', 'three_to_four_weekly', 'almost_daily')),
  -- at least one concern; subset of the approved set; 'no_major_concern' is exclusive (must be alone).
  current_concerns text[] not null
    check (
      cardinality(current_concerns) >= 1
      and current_concerns <@ array['dryness', 'breakage', 'tangling', 'dullness', 'frizz', 'no_major_concern']::text[]
      and (not ('no_major_concern' = any (current_concerns)) or cardinality(current_concerns) = 1)
    ),
  primary_goal text not null
    check (primary_goal in ('softness_and_hydration', 'reduce_breakage_and_strengthen', 'recover_chemical_or_heat_damage', 'definition_and_frizz_control', 'maintain_healthy_hair')),
  created_at timestamptz not null default now()
);

comment on table public.hair_profiles is
  'SPEC-002: immutable hair-profile snapshots. New assessment = new row; current = latest (created_at desc, id desc). No version numbering (D-64). Product inputs only, not diagnosis (D-26).';

create index if not exists hair_profiles_user_recent
  on public.hair_profiles (user_id, created_at desc, id desc);

alter table public.hair_profiles enable row level security;
alter table public.hair_profiles force row level security;

-- Remove Supabase implicit default privileges (SUPABASE-RLS-STRATEGY §1.3) and grant only SPEC-002 §13:
-- authenticated may SELECT/INSERT own rows. No UPDATE, no DELETE (append-only, immutable). Nothing for anon.
revoke all on public.hair_profiles from anon, authenticated;
grant select, insert on public.hair_profiles to authenticated;

drop policy if exists hair_profiles_select_own on public.hair_profiles;
create policy hair_profiles_select_own on public.hair_profiles
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists hair_profiles_insert_own on public.hair_profiles;
create policy hair_profiles_insert_own on public.hair_profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ROLLBACK:
--   drop table if exists public.hair_profiles;
