-- SPEC-001 §8/§18 — account deletion request record (D-55). Additive, idempotent.
-- Minimal model: a row = an active request; the user cancels by deleting her own row.
-- Actual deletion of auth.users is privileged/server-owned (policy pending D-60) — never from the client.

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);

comment on table public.account_deletion_requests is
  'SPEC-001: active account-deletion requests. Row present = requested. Cancel = user deletes own row. Purge is server-owned (D-60).';

alter table public.account_deletion_requests enable row level security;
alter table public.account_deletion_requests force row level security;

-- Supabase default privileges grant implicit rights to anon/authenticated on new tables — remove them
-- (SUPABASE-RLS-STRATEGY §1.3) and grant only what SPEC-001 §18 allows. No UPDATE, nothing for anon.
revoke all on public.account_deletion_requests from anon, authenticated;
grant select, insert, delete on public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own on public.account_deletion_requests;
create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists account_deletion_requests_insert_own on public.account_deletion_requests;
create policy account_deletion_requests_insert_own on public.account_deletion_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists account_deletion_requests_delete_own on public.account_deletion_requests;
create policy account_deletion_requests_delete_own on public.account_deletion_requests
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ROLLBACK:
--   drop table if exists public.account_deletion_requests;
