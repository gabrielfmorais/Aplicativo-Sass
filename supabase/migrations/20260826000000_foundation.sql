-- SPEC-000 foundation migration. TECHNICAL HELPERS ONLY — no product tables (SPEC-000 §8, §10).
-- Additive and idempotent. Applied locally via `supabase db reset`; never pushed remotely under SPEC-000.

create extension if not exists pgcrypto with schema extensions;

-- Generic updated_at maintenance trigger function (DATA-MODEL §1 conventions).
-- Usage (future SPECs):
--   create trigger set_updated_at before update on public.<table>
--     for each row execute function public.set_updated_at();
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is 'Trigger helper: sets updated_at = now() on row update. SECURITY INVOKER; no data access.';

-- Nothing else. is_admin()/has_entitlement() belong to SPEC-001/SPEC-010 (they depend on product tables).

-- ROLLBACK:
--   drop function if exists public.set_updated_at();
--   (pgcrypto is left in place; it is a Supabase default extension.)
