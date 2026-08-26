---
name: rls-review
description: Read-only audit of Supabase tables/policies/grants/functions in a migration or for a table against SUPABASE-RLS-STRATEGY. Use whenever SQL touching public tables, policies, grants or SECURITY DEFINER functions is written or reviewed.
---

# /rls-review <migration-file | table-name>

## Purpose
Ensure every table is fail-closed and every privilege is intentional before SQL is merged (`docs/security/SUPABASE-RLS-STRATEGY.md`, `SECURITY-BASELINE.md` S1–S7).

## When to use
- A migration under `supabase/migrations/` creates/alters tables, policies, grants or functions.
- A reviewer asks "who can read/write this table?".

## Required inputs
- Path to a migration file, or a table name (the skill then greps migrations for it).

## Steps
1. Read the SQL, `docs/security/SUPABASE-RLS-STRATEGY.md`, `docs/architecture/DATA-MODEL.md`, `supabase/security/allowlists.sql`, and the SPEC referenced by the migration header.
2. For every table touched build the matrix: RLS enabled? FORCE? grants to anon/authenticated per verb? policy per verb with `user_id = (select auth.uid())` or documented exception? `user_id` NOT NULL + FK + index? server-only write tables have NO client write policy?
3. For every function: `SECURITY DEFINER`? if yes → in `supabase/security/allowlists.sql` with SPEC + justification? `set search_path = ''`? validates `auth.uid()`? `REVOKE EXECUTE FROM public, anon`? `GRANT` minimal?
4. For every policy: no `USING (true)` on user tables; no joins inside policies without justification; premium content uses `has_entitlement()`.
5. Verify a pgTAP test exists in `supabase/tests/` with positive AND negative cases for each policy (cross-user, anon, server-only write).
6. Report.

## Guardrails
- Read-only. Never edits SQL, policies, allowlists or tests — proposes a diff in the report.
- Never suggests disabling RLS, widening a policy or using service role to "fix" access.
- Any table without RLS+FORCE or any DEFINER outside the allowlist is a BLOCKER.

## Expected output
Matrix `table × verb × (grant, policy, test)`, function table, list of gaps with severity, verdict `PASS / NEEDS-CHANGES / BLOCKED`.

## Stop conditions
- Migration contains `DROP`, `TRUNCATE`, `DISABLE ROW LEVEL SECURITY`, `NO FORCE ROW LEVEL SECURITY`, `GRANT ALL`, or grants to `public` → report BLOCKED and stop.
