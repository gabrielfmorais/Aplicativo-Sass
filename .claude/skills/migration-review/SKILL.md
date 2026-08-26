---
name: migration-review
description: Read-only classification of a Supabase migration as SAFE / NEEDS-HUMAN / BLOCKED, checking size, idempotency, rollback note, destructive statements, backfills and app compatibility. Use before merging any file under supabase/migrations.
---

# /migration-review <migration-file>

## Purpose
Keep migrations small, additive, reversible and reviewed (`docs/architecture/ENGINEERING-WORKFLOW.md` §7, `CLAUDE.md` §4).

## When to use
- Any new or changed file in `supabase/migrations/`.

## Required inputs
- Migration file path.

## Steps
1. Read the file, its SPEC reference (header comment), `docs/architecture/DATA-MODEL.md`, `docs/architecture/ENGINEERING-WORKFLOW.md` §7.
2. Classify statements: additive (create table/column/index/function/policy) vs destructive (`drop`, `truncate`, `alter ... drop`, type narrowing, `not null` on existing column without default, renaming) vs security-relevant (RLS, grants, DEFINER — hand off to `/rls-review`).
3. Check: one logical change; `if not exists` where re-runnable; `-- ROLLBACK:` note present and plausible; no data backfill mixed with DDL on large tables; no statement that locks a table for long; app compatibility with the previous version (expand/contract for renames); timestamps/dates follow ADR-008 (`timestamptz`, `date`); `user_id` conventions from DATA-MODEL §1.
4. Verify tests exist under `supabase/tests/` for constraints/RPCs introduced.
5. Verdict.

## Guardrails
- Read-only; never edits or applies migrations. Never runs `supabase db push`.
- Destructive statements → always `NEEDS-HUMAN` at minimum; disabling RLS/weakening policies → `BLOCKED`.
- Does not "fix" the migration to make it pass.

## Expected output
Classification table, findings, explicit verdict `SAFE / NEEDS-HUMAN / BLOCKED` with reasons, and the exact human approval required (if any).

## Stop conditions
- Target environment other than local/dev is mentioned → stop and remind that production migrations are human-controlled (D-27, MCP-POLICY).
